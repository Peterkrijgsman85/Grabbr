'use strict';

const electron = require('electron');
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, nativeImage, globalShortcut, Tray, Menu, shell, systemPreferences, screen, session, net, Notification } = electron;
const fs = require('node:fs/promises');
const path = require('node:path');
const { DEFAULTS, validateSettings } = require('./src/hotkeys.js');
const { isSupportedPlatform, loginItemOptions, normalizeState } = require('./src/startup.js');
const { isOwnSourceName, filterExternalSources } = require('./src/capture-policy.js');
const { detectClipboardCapabilities, writePngToSystemClipboard } = require('./src/system-clipboard.js');
const { WindowRegistry } = require('./src/window-registry.js');
const { DEFAULT_ANNOTATION_SETTINGS, normalizeAnnotationSettings } = require('./src/annotation-settings.js');
const { buildTrayTemplate } = require('./src/tray-menu.js');
const { loadRecentScreenshot } = require('./src/recent-screenshot.js');
const { WindowLifecyclePolicy } = require('./src/window-lifecycle.js');
const { migrateSettings } = require('./src/settings-schema.js');
const { filenameFromPattern, filenameForAttempt } = require('./src/filename-pattern.js');
const { isCheckDue, normalizeRepository, isSafeReleaseUrl } = require('./src/update-check.js');
const { checkForUpdate } = require('./src/update-service.js');
const { extractAndCopyText } = require('./src/ocr-service.js');
const { writeTextToSystemClipboard } = require('./src/system-text-clipboard.js');
const { completeOcrSelection } = require('./src/ocr-flow-controller.js');
const { showNativeNotification } = require('./src/native-notification.js');
const packageMetadata = require('./package.json');

app.setName('Grabbr');

const electronClipboard = electron.clipboard;

let mainWindow;
let overlayWindow;
let tray;
let settingsWindow;
let lastSavedPath = null;
let pendingCapture = null;
let shortcuts = { ...DEFAULTS };
let shortcutStatus = {};
let storage = { autoSave: true, directory: null };
let startup = { openAtLogin: false };
let annotation = { ...DEFAULT_ANNOTATION_SETTINGS };
let general = { hideGrabbrDuringCapture: true };
let captureSettings = { windowShadow: true };
let editorSettings = { strokeWidth: 7, fontSize: 28, stepSize: 44, annotationShadow: false };
let recent = { lastSavedPath: null };
let updates = { automatic: true, lastCheckedAt: null, includePrereleases: false };
let updateStatus = { state: 'idle', message: 'Nog niet gecontroleerd.' };
const githubRepository = normalizeRepository(process.env.GRABBR_GITHUB_REPOSITORY || packageMetadata.grabbr?.githubRepository);
let regionContext = null;
const annotationWindows = new WindowRegistry();
const annotationPayloads = new Map();
const captureHiddenWindows = new Map();
const isMac = process.platform === 'darwin';
const lifecyclePolicy = new WindowLifecyclePolicy();

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }

async function loadSettings() {
  const defaultDirectory = path.join(app.getPath('pictures'), 'Grabbr');
  try {
    const parsed = JSON.parse(await fs.readFile(settingsPath(), 'utf8'));
    const migrated=migrateSettings(parsed,defaultDirectory);
    shortcuts=migrated.shortcuts;
    storage=migrated.storage;
    startup={openAtLogin:migrated.general.startup};
    annotation={afterCopy:migrated.general.afterCopy};
    general={hideGrabbrDuringCapture:migrated.general.hideGrabbrDuringCapture};
    captureSettings=migrated.capture;
    editorSettings=migrated.editor;
    updates=migrated.updates;
    recent=migrated.recent;
    lastSavedPath = recent.lastSavedPath;
  } catch {
    shortcuts = { ...DEFAULTS };
    storage = { autoSave: true, directory: defaultDirectory };
    startup = { openAtLogin: false };
    annotation = { ...DEFAULT_ANNOTATION_SETTINGS };
    general={hideGrabbrDuringCapture:true}; captureSettings={windowShadow:true}; editorSettings={strokeWidth:7,fontSize:28,stepSize:44,annotationShadow:false}; updates={automatic:true,lastCheckedAt:null,includePrereleases:false};
    recent = { lastSavedPath: null };
  }
  await fs.mkdir(storage.directory, { recursive: true }).catch(() => {});
}

async function saveSettings() {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify({
    shortcuts,
    general:{startup:startup.openAtLogin,afterCopy:annotation.afterCopy,hideGrabbrDuringCapture:general.hideGrabbrDuringCapture},
    capture:captureSettings, storage, editor:editorSettings, updates, recent
  }, null, 2), 'utf8');
}

async function recordLastSavedPath(filePath) {
  lastSavedPath = filePath;
  recent = { lastSavedPath: filePath };
  await saveSettings();
}

function settingsSnapshot() {
  return {
    shortcuts: { ...shortcuts },
    shortcutStatus: { ...shortcutStatus },
    storage: { ...storage },
    startup: nativeStartupState(),
    annotation: { ...annotation }
    ,general:{...general},capture:{...captureSettings},editor:{...editorSettings},updates:{...updates},updateStatus:{...updateStatus},githubRepository,recent:{...recent}
  };
}

function broadcastSettings() {
  const snapshot = settingsSnapshot();
  for (const win of [mainWindow, ...annotationWindows.values()]) {
    if (win && !win.isDestroyed()) win.webContents.send('settings:updated', snapshot);
  }
}

async function performUpdateCheck({ manual = false } = {}) {
  if (!manual && (!updates.automatic || !isCheckDue(updates.lastCheckedAt))) return { ...updateStatus, skipped: true };
  if (!githubRepository) {
    updateStatus = { state: 'error', message: 'Updatecontrole is niet geconfigureerd voor deze bronbuild.' };
    broadcastSettings();
    return updateStatus;
  }
  updateStatus = { state: 'checking', message: 'Controleren op updates…' };
  broadcastSettings();
  const checkedAt = new Date().toISOString();
  updateStatus = { ...(await checkForUpdate({repository:githubRepository,currentVersion:app.getVersion(),includePrereleases:updates.includePrereleases,fetchImpl:net?.fetch?.bind(net)})),checkedAt };
  updates.lastCheckedAt = checkedAt;
  await saveSettings().catch(() => {});
  broadcastSettings();
  return { ...updateStatus };
}

function nativeStartupState() {
  if (!isSupportedPlatform(process.platform)) return normalizeState(process.platform, {}, startup.openAtLogin);
  const options = loginItemOptions(process.platform, process.execPath, startup.openAtLogin);
  const nativeState = process.platform === 'win32'
    ? app.getLoginItemSettings({ path: options.path, args: options.args })
    : app.getLoginItemSettings();
  return normalizeState(process.platform, nativeState, startup.openAtLogin);
}

function applyStartupPreference(enabled) {
  if (!isSupportedPlatform(process.platform)) {
    startup = { openAtLogin: false };
    return { ok: false, reason: 'Autostart wordt alleen ondersteund op macOS en Windows.', startup: nativeStartupState() };
  }
  try {
    const options = loginItemOptions(process.platform, process.execPath, enabled);
    app.setLoginItemSettings(options);
    const state = nativeStartupState();
    if (state.openAtLogin !== Boolean(enabled)) return { ok: false, reason: 'Het besturingssysteem heeft de autostartinstelling niet bevestigd.', startup: state };
    startup = { openAtLogin: state.openAtLogin };
    return { ok: true, startup: state };
  } catch (error) {
    return { ok: false, reason: `Autostart kon niet worden aangepast: ${error.message}`, startup: nativeStartupState() };
  }
}

async function writeUniqueImage(dataUrl, baseName, directory = storage.directory, format=storage.format) {
  if (!directory) throw new Error('Er is geen opslagmap ingesteld.');
  await fs.mkdir(directory, { recursive: true });
  const image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) throw new Error('De screenshot kon niet als afbeelding worden verwerkt.');
  const bytes = format==='jpeg'?image.toJPEG(storage.jpegQuality):image.toPNG();
  const createdAt = new Date();
  for (let index = 1; index < 10000; index++) {
    const filename=filenameForAttempt(storage.filenamePattern,{date:createdAt,type:baseName,format},index);
    const filePath = path.join(directory, filename);
    try {
      await fs.writeFile(filePath, bytes, { flag: 'wx' });
      await recordLastSavedPath(filePath);
      return filePath;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Er kon geen unieke bestandsnaam worden gemaakt.');
}

function windowOptions(title) {
  const options = {
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#11131a',
    title,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: !isMac,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
  if (isMac) {
    options.titleBarStyle = 'hiddenInset';
    options.titleBarSeparatorStyle = 'none';
    options.trafficLightPosition = { x: 18, y: 20 };
  }
  return options;
}

function createWindow() {
  mainWindow = new BrowserWindow(windowOptions('Grabbr'));
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'), { query: { mode: 'home' } });
  mainWindow.setContentProtection(general.hideGrabbrDuringCapture);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', event => {
    if (!app.isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

function createAnnotationWindow(payload) {
  if (!payload?.dataUrl || !String(payload.dataUrl).startsWith('data:image/')) throw new Error('Geen geldige screenshot voor het annotatievenster ontvangen.');
  const title = `Grabbr — ${String(payload.name || 'Screenshot').slice(0, 80)}`;
  const win = new BrowserWindow(windowOptions(title));
  const webContentsId = win.webContents.id;
  annotationWindows.add(win);
  annotationPayloads.set(webContentsId, {
    dataUrl: payload.dataUrl,
    name: payload.name || 'Grabbr screenshot',
    shadow: payload.shadow === true,
    autoSaveBaseName: payload.autoSaveBaseName || payload.name || 'Screenshot',
    skipAutoSave: payload.skipAutoSave === true,
    coordinateSpace:payload.coordinateSpace||null
  });
  win.setContentProtection(general.hideGrabbrDuringCapture);
  win.loadFile(path.join(__dirname, 'src', 'index.html'), { query: { mode: 'annotation' } });
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.on('closed', () => {
    annotationPayloads.delete(webContentsId);
    annotationWindows.remove(win);
  });
  return win;
}

function ensureMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow();
  return mainWindow;
}

function activeGrabbrWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && (focused === mainWindow || annotationWindows.has(focused))) return focused;
  return ensureMainWindow();
}

function showCapture(mode = 'window') {
  if (mode === 'ocr') {
    const focused = BrowserWindow.getFocusedWindow();
    const requester = focused && (focused === mainWindow || focused === settingsWindow || annotationWindows.has(focused)) ? focused : null;
    beginRegionCapture(requester, 'ocr').catch(async error => {
      ocrDebug('selection-start-failed', { ok: false, errorName: error.name, platform: process.platform });
      try { await notifyOcrResult(false, `OCR-tekst vastleggen mislukt: ${error.message}`); }
      catch (notificationError) { console.error('[Grabbr OCR] melding mislukt', notificationError.message); }
    });
    return;
  }
  const host = activeGrabbrWindow();
  if (mode === 'region') {
    beginRegionCapture(host).catch(error => notifyCaptureError(error, host));
    return;
  }
  host.show(); host.focus();
  host.webContents.send('capture:open', mode);
}

function notifyCaptureError(error, target = mainWindow) {
  console.error(error);
  const win = target && !target.isDestroyed() ? target : ensureMainWindow();
  win.show();
  win.webContents.send('capture:error', error.message || 'Gebiedsselectie kon niet worden gestart.');
}

function ocrDebug(stage, metadata = {}) {
  if (app.isPackaged && process.env.GRABBR_OCR_DEBUG !== '1') return;
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (['bytes', 'width', 'height', 'ok', 'stage', 'recognitionMethod', 'clipboardMethod', 'errorName', 'method', 'platform'].includes(key)) safe[key] = value;
  }
  console.info(`[Grabbr OCR] ${stage}`, safe);
}

async function electronNotification(success, title, message) {
  if (!Notification || typeof Notification.isSupported !== 'function' || !Notification.isSupported()) throw new Error('Electron Notification wordt niet ondersteund.');
  await new Promise((resolve, reject) => {
    const notification = new Notification({ title, body: message, silent: false });
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(); } }, 1800);
    notification.once?.('show', () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } });
    notification.once?.('failed', (_event, error) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(error || 'Electron Notification faalde.')); } });
    notification.show();
  });
  return { ok: true, method: 'Electron Notification' };
}

async function notifyOcrResult(success, message) {
  const title = success ? 'Grabbr — tekst gekopieerd' : 'Grabbr — OCR';
  const failures = [];
  try {
    const result = await showNativeNotification(process.platform, title, message);
    ocrDebug('notification-native', { ok: true, method: result.method, platform: process.platform });
    return result;
  } catch (error) { failures.push(`native: ${error.message}`); ocrDebug('notification-native-failed', { ok: false, errorName: error.name, platform: process.platform }); }
  try {
    const result = await electronNotification(success, title, message);
    ocrDebug('notification-electron', { ok: true, method: result.method });
    return result;
  } catch (error) { failures.push(`electron: ${error.message}`); ocrDebug('notification-electron-failed', { ok: false, errorName: error.name }); }
  if (process.platform === 'win32' && tray && typeof tray.displayBalloon === 'function') {
    tray.displayBalloon({ title, content: message, iconType: success ? 'info' : 'warning', noSound: false });
    ocrDebug('notification-balloon', { ok: true, method: 'tray balloon' });
    return { ok: true, method: 'tray balloon' };
  }
  console[success ? 'info' : 'warn'](`${title}: ${message}`);
  throw new Error(`Geen native OCR-melding kon worden getoond (${failures.join(' | ')}).`);
}

async function processOcrSelection(payload) {
  return completeOcrSelection(payload, {
    extractAndCopy: extractAndCopyText,
    serviceDependencies: {
      platform: process.platform,
      ocrOptions: { log: ocrDebug },
      clipboardOptions: { electronClipboard, platform: process.platform }
    },
    notify: notifyOcrResult,
    log: ocrDebug
  });
}

function createTray() {
  const iconPath = isMac ? path.join(__dirname, 'assets', 'trayTemplate.png') : path.join(__dirname, 'assets', 'icon.png');
  const sourceIcon = nativeImage.createFromPath(iconPath);
  if (isMac) sourceIcon.setTemplateImage(true);
  tray = new Tray(isMac ? sourceIcon : sourceIcon.resize({ width: 18, height: 18 }));
  tray.setToolTip('Grabbr');
  refreshTrayMenu();
  tray.on('double-click', () => showCapture('window'));
}
function trayMenuIcons(){
  const result={};
  for(const name of ['window','region','screen','ocr','settings','grabbr']){
    const icon=nativeImage.createFromPath(path.join(__dirname,'assets','menu',`${name}.png`)).resize({width:16,height:16});
    if(isMac) icon.setTemplateImage(true); result[name]=icon;
  }
  return result;
}
function openSettingsWindow(){
  if(settingsWindow&&!settingsWindow.isDestroyed()){settingsWindow.show();settingsWindow.focus();settingsWindow.webContents.send('settings:open');return settingsWindow;}
  settingsWindow=new BrowserWindow({...windowOptions('Grabbr — Instellingen'),width:820,height:680,minWidth:720,minHeight:580});
  settingsWindow.setContentProtection(general.hideGrabbrDuringCapture);
  settingsWindow.loadFile(path.join(__dirname,'src','index.html'),{query:{mode:'settings'}});
  settingsWindow.once('ready-to-show',()=>{settingsWindow.show();settingsWindow.focus();settingsWindow.webContents.send('settings:open');});
  settingsWindow.on('closed',()=>{settingsWindow=null;});return settingsWindow;
}
function refreshTrayMenu(){
  if(!tray)return;
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayTemplate(process.platform, {
    captureWindow: () => showCapture('window'),
    captureRegion: () => showCapture('region'),
    captureScreen: () => showCapture('screen'),
    captureOcr: () => showCapture('ocr'),
    openLastScreenshot: () => openLastScreenshot(),
    openSettings:()=>openSettingsWindow(),
    openApp: () => { ensureMainWindow().show(); mainWindow.focus(); },
    quit: () => { app.isQuitting = true; app.quit(); }
  },{shortcuts,icons:trayMenuIcons()})));
}

function applyCaptureVisibilityProtection() {
  for(const win of [mainWindow,settingsWindow,...annotationWindows.values()]) if(win&&!win.isDestroyed()) win.setContentProtection(general.hideGrabbrDuringCapture);
}

async function showLastScreenshotMessage(message) {
  const options = { type: 'info', title: 'Grabbr', message, buttons: ['OK'], defaultId: 0 };
  if (mainWindow && !mainWindow.isDestroyed()) await dialog.showMessageBox(mainWindow, options);
  else await dialog.showMessageBox(options);
}

async function openLastScreenshot() {
  const filePath = lastSavedPath || recent.lastSavedPath;
  const loaded = await loadRecentScreenshot(filePath, fs);
  if (loaded.reason === 'missing-history') {
    await showLastScreenshotMessage('Er is nog geen door Grabbr opgeslagen screenshot beschikbaar.');
    return { ok: false, reason: 'missing-history' };
  }
  if (loaded.reason === 'file-missing') {
    lastSavedPath = null; recent = { lastSavedPath: null }; await saveSettings();
    await showLastScreenshotMessage('De laatst opgeslagen screenshot bestaat niet meer. Maak of bewaar eerst een nieuwe screenshot.');
    return { ok: false, reason: 'file-missing' };
  }
  if (!loaded.ok) {
    await showLastScreenshotMessage(`De laatste screenshot kon niet worden geopend: ${loaded.error?.message || 'onbekende leesfout'}`);
    return { ok: false, reason: loaded.reason };
  }
  try {
    const image = nativeImage.createFromBuffer(loaded.bytes);
    if (image.isEmpty()) throw new Error('Het bestand bevat geen leesbare afbeelding.');
    createAnnotationWindow({ dataUrl: image.toDataURL(), name: path.basename(filePath), shadow: false, autoSaveBaseName: path.basename(filePath), skipAutoSave: true });
    return { ok: true, filePath };
  } catch (error) {
    await showLastScreenshotMessage(`De laatste screenshot kon niet worden geopend: ${error.message}`);
    return { ok: false, reason: 'open-failed' };
  }
}

function registerShortcuts(next = shortcuts) {
  const checked = validateSettings(next);
  if (!checked.valid) return { ok: false, reason: checked.reason, action: checked.action };
  const previous = { ...shortcuts };
  globalShortcut.unregisterAll();
  const actions = { window: () => showCapture('window'), region: () => showCapture('region'), screen: () => showCapture('screen'), ocr: () => showCapture('ocr') };
  shortcutStatus = {};
  for (const [action, accelerator] of Object.entries(checked.settings)) {
    const ok = globalShortcut.register(accelerator, actions[action]);
    shortcutStatus[action] = ok;
    if (!ok) {
      globalShortcut.unregisterAll();
      for (const [oldAction, oldAccelerator] of Object.entries(previous)) shortcutStatus[oldAction] = globalShortcut.register(oldAccelerator, actions[oldAction]);
      return { ok: false, action, reason: `De sneltoets ${accelerator} is al in gebruik door een andere applicatie.` };
    }
  }
  shortcuts = checked.settings;
  refreshTrayMenu();
  return { ok: true, shortcuts: { ...shortcuts }, status: { ...shortcutStatus } };
}

function restoreRegionRequester() {
  const context = regionContext;
  regionContext = null;
  if(context?.hiddenWindows?.length){
    for(const win of context.hiddenWindows) if(win&&!win.isDestroyed()) win.show();
  }
  if (context?.wasVisible && context.requester && !context.requester.isDestroyed()) context.requester.focus();
}

async function beginRegionCapture(requester = activeGrabbrWindow(), action = 'capture') {
  if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.focus(); return; }
  const targetDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const requesterWasVisible=Boolean(requester?.isVisible());
  const hiddenWindows=[];
  if(general.hideGrabbrDuringCapture){
    for(const win of [mainWindow,settingsWindow,...annotationWindows.values()]) if(win&&!win.isDestroyed()&&win.isVisible()){hiddenWindows.push(win);win.hide();}
  }
  regionContext = { requester, wasVisible: requesterWasVisible, hiddenWindows, action };
  await new Promise(resolve => setTimeout(resolve, 160));
  const requestedWidth = Math.min(8192, Math.round(targetDisplay.bounds.width * targetDisplay.scaleFactor));
  const requestedHeight = Math.min(8192, Math.round(targetDisplay.bounds.height * targetDisplay.scaleFactor));
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: requestedWidth, height: requestedHeight }, fetchWindowIcons: false });
  const source = sources.find(item => String(item.display_id) === String(targetDisplay.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) { restoreRegionRequester(); throw new Error('Het actieve beeldscherm kon niet worden vastgelegd.'); }

  overlayWindow = new BrowserWindow({
    x: targetDisplay.bounds.x, y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width, height: targetDisplay.bounds.height,
    frame: false, title: 'Grabbr selectie', show: false, transparent: false,
    backgroundColor: '#05070b', alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, enableLargerThanScreen: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setContentProtection(true);
  if (isMac) overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(__dirname, 'src', 'overlay.html'));
  overlayWindow.webContents.once('did-finish-load', () => {
    overlayWindow?.webContents.send('region:initialize', { image: source.thumbnail.toDataURL() });
    overlayWindow?.show(); overlayWindow?.focus();
  });
  overlayWindow.on('closed', () => {
    overlayWindow = null;
    if (regionContext) restoreRegionRequester();
  });
}

function closeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
  overlayWindow = null;
}

app.whenReady().then(async () => {
  await loadSettings();
  const startupResult = applyStartupPreference(startup.openAtLogin);
  if (!startupResult.ok && startup.openAtLogin) console.warn(startupResult.reason);
  if (isMac) app.dock?.setIcon(path.join(__dirname, 'assets', 'icon.png'));
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const selection = pendingCapture;
    pendingCapture = null;
    if (!selection) { callback(null); return; }
    try {
      const sources = await desktopCapturer.getSources({ types: selection.kind === 'window' ? ['window'] : ['screen'], thumbnailSize: { width: 0, height: 0 } });
      const source = sources.find(item => item.id === selection.id && (!general.hideGrabbrDuringCapture || !isOwnSourceName(item.name)));
      callback(source ? { video: source } : null);
    } catch (error) {
      console.error('Capturebron kon niet worden voorbereid:', error); callback(null);
    }
  });
  createWindow(); createTray(); registerShortcuts(shortcuts);
  setTimeout(() => performUpdateCheck({ manual: false }), 2500).unref?.();
  setInterval(() => performUpdateCheck({ manual: false }), 60 * 60 * 1000).unref?.();
  app.on('activate', () => { lifecyclePolicy.activateExistingMainWindow(mainWindow); });
});

app.on('before-quit', () => { app.isQuitting = true; globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (lifecyclePolicy.shouldQuitOnAllWindowsClosed(Boolean(tray))) app.quit(); });

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on('second-instance', () => { const win = ensureMainWindow(); if (win.isMinimized()) win.restore(); win.show(); win.focus(); });

ipcMain.handle('app:info', () => ({
  platform: process.platform,
  version: app.getVersion(),
  runtime: { electron: process.versions.electron || null, node: process.versions.node || null },
  clipboardCapabilities: detectClipboardCapabilities({ electronClipboard, nativeImage, platform: process.platform }),
  ...settingsSnapshot(),
  screenPermission: isMac ? systemPreferences.getMediaAccessStatus('screen') : 'granted'
}));
ipcMain.handle('annotation:get-initial', event => annotationPayloads.get(event.sender.id) || null);
ipcMain.handle('annotation:open', (_event, payload) => { const win = createAnnotationWindow(payload); return { ok: true, windowId: win.id }; });
ipcMain.handle('window:close-self', event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !annotationWindows.has(win)) return { ok: false, reason: 'Alleen een annotatievenster kan zichzelf na kopiëren sluiten.' };
  lifecyclePolicy.markProgrammaticAnnotationClose();
  win.close(); return { ok: true };
});
ipcMain.handle('window:close-empty-home',event=>{
  const win=BrowserWindow.fromWebContents(event.sender);
  if(!win||win!==mainWindow)return {ok:false};
  mainWindow=null;win.destroy();return {ok:true};
});
ipcMain.handle('window:minimize-self',event=>{
  const win=BrowserWindow.fromWebContents(event.sender);if(!win||!annotationWindows.has(win))return{ok:false,reason:'Alleen een annotatievenster kan worden geminimaliseerd.'};
  if(isMac)win.hide();else win.minimize();return{ok:true};
});

ipcMain.handle('settings:update-shortcuts', async (_event, next) => { const result = registerShortcuts(next); if (result.ok) { await saveSettings(); broadcastSettings(); } return result; });
ipcMain.handle('settings:reset-shortcuts', async () => { const result = registerShortcuts({ ...DEFAULTS }); if (result.ok) { await saveSettings(); broadcastSettings(); } return result; });
ipcMain.handle('settings:choose-storage-directory', async event => {
  const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showOpenDialog(parent, { title: 'Kies de standaard opslagmap', defaultPath: storage.directory || app.getPath('pictures'), properties: ['openDirectory', 'createDirectory'] });
  return result.canceled || !result.filePaths[0] ? { canceled: true } : { canceled: false, directory: result.filePaths[0] };
});
ipcMain.handle('settings:update-storage', async (_event, next) => {
  const directory = typeof next?.directory === 'string' ? path.resolve(next.directory) : storage.directory;
  if (!directory) return { ok: false, reason: 'Kies eerst een opslagmap.' };
  try {
    await fs.mkdir(directory, { recursive: true }); await fs.access(directory);
    storage = { autoSave: next.autoSave !== false, directory };
    await saveSettings(); broadcastSettings();
    return { ok: true, storage: { ...storage } };
  } catch (error) { return { ok: false, reason: `De opslagmap is niet beschikbaar: ${error.message}` }; }
});
ipcMain.handle('settings:update-startup', async (_event, enabled) => {
  const previous = { ...startup }; const result = applyStartupPreference(Boolean(enabled));
  if (!result.ok) { startup = previous; return result; }
  await saveSettings(); broadcastSettings(); return result;
});
ipcMain.handle('settings:update-annotation', async (_event, next) => {
  annotation = normalizeAnnotationSettings(next);
  await saveSettings(); broadcastSettings();
  return { ok: true, annotation: { ...annotation } };
});
ipcMain.handle('settings:update-all',async(_event,next)=>{
  const shortcutResult=registerShortcuts(next.shortcuts||shortcuts); if(!shortcutResult.ok)return shortcutResult;
  const migrated=migrateSettings({...next,shortcuts:shortcutResult.shortcuts,recent},storage.directory);
  const startupResult=applyStartupPreference(migrated.general.startup); if(!startupResult.ok)return startupResult;
  shortcuts=migrated.shortcuts; general=migrated.general; captureSettings=migrated.capture; storage=migrated.storage; editorSettings=migrated.editor; updates=migrated.updates;
  startup={openAtLogin:general.startup}; annotation={afterCopy:general.afterCopy};
  applyCaptureVisibilityProtection(); await saveSettings(); broadcastSettings(); refreshTrayMenu();
  return {ok:true,...settingsSnapshot()};
});
ipcMain.handle('updates:check-now', async () => performUpdateCheck({ manual: true }));
ipcMain.handle('updates:open-release', async (_event, url) => {
  if (!isSafeReleaseUrl(url, githubRepository)) return { ok: false, reason: 'De release-URL is niet toegestaan.' };
  try { await shell.openExternal(url); return { ok: true }; }
  catch (error) { return { ok: false, reason: `De releasepagina kon niet worden geopend: ${error.message}` }; }
});

ipcMain.handle('capture:start-region', async event => {
  const requester = BrowserWindow.fromWebContents(event.sender) || activeGrabbrWindow();
  try { await beginRegionCapture(requester); return true; }
  catch (error) { restoreRegionRequester(); if (requester && !requester.isDestroyed()) { requester.show(); requester.focus(); } throw error; }
});
ipcMain.handle('capture:hide-grabbr-windows',event=>{
  if(!general.hideGrabbrDuringCapture)return {hidden:false};
  const hidden=[];for(const win of [mainWindow,...annotationWindows.values()])if(win&&!win.isDestroyed()&&win.isVisible()){hidden.push(win);win.hide();}
  captureHiddenWindows.set(event.sender.id,hidden);return {hidden:true};
});
ipcMain.handle('capture:restore-grabbr-windows',event=>{
  const hidden=captureHiddenWindows.get(event.sender.id)||[];captureHiddenWindows.delete(event.sender.id);
  for(const win of hidden)if(win&&!win.isDestroyed())win.show();return true;
});
ipcMain.on('region:complete',async(_event,payload)=>{
  const action=regionContext?.action||'capture';
  if(action==='ocr') ocrDebug('region-complete', { ok: true, width: payload?.coordinateSpace?.bitmapWidth || null, height: payload?.coordinateSpace?.bitmapHeight || null, platform: process.platform });
  closeOverlay();restoreRegionRequester();
  if(action==='ocr'){
    try { await processOcrSelection(payload); }
    catch (error) {
      ocrDebug('region-handler-failed', { ok: false, errorName: error.name, platform: process.platform });
      try { await notifyOcrResult(false, `OCR-tekst vastleggen is mislukt: ${error.message}`); }
      catch (notificationError) { console.error('[Grabbr OCR] melding mislukt', notificationError.message); }
    }
    return;
  }
  createAnnotationWindow({dataUrl:payload.dataUrl,name:'Grabbr gebied',shadow:false,autoSaveBaseName:'Gebied',coordinateSpace:payload.coordinateSpace});
});
ipcMain.on('region:cancel', () => { closeOverlay(); restoreRegionRequester(); });

ipcMain.handle('capture:list-sources', async (_event, kind = 'window') => {
  const sources = await desktopCapturer.getSources({ types: kind === 'window' ? ['window'] : ['screen'], thumbnailSize: { width: 640, height: 400 }, fetchWindowIcons: true });
  const displays=screen.getAllDisplays();const primary=screen.getPrimaryDisplay();
  const visibleSources=general.hideGrabbrDuringCapture?filterExternalSources(sources):sources;
  return visibleSources.map(source => {const display=displays.find(d=>String(d.id)===String(source.display_id))||primary;return { id: source.id, name: source.name || 'Naamloos venster', displayId: source.display_id || null, scaleFactor:display.scaleFactor||1,logicalDisplaySize:display.size,image: source.thumbnail.toDataURL(), size: source.thumbnail.getSize(), icon: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null };});
});
ipcMain.handle('capture:prepare', (_event, { id, kind = 'window' }) => { pendingCapture = { id, kind }; return true; });
ipcMain.handle('capture:get-source-image', async (_event, { id, kind = 'window' }) => {
  const displays = screen.getAllDisplays();
  const maxWidth = Math.min(8192, Math.max(2560, ...displays.map(d => Math.round(d.size.width * d.scaleFactor))));
  const maxHeight = Math.min(8192, Math.max(1440, ...displays.map(d => Math.round(d.size.height * d.scaleFactor))));
  const sources = await desktopCapturer.getSources({ types: kind === 'window' ? ['window'] : ['screen'], thumbnailSize: { width: maxWidth, height: maxHeight }, fetchWindowIcons: false });
  const source = sources.find(item => item.id === id && (!general.hideGrabbrDuringCapture || !isOwnSourceName(item.name)));
  if (!source || source.thumbnail.isEmpty()) throw new Error('De geselecteerde bron is niet meer beschikbaar.');
  return source.thumbnail.toDataURL();
});

ipcMain.handle('clipboard:write-png', async (_event, payload) => writePngToSystemClipboard(payload, {
  electronClipboard,
  nativeImage,
  platform: process.platform,
  electronVersion: process.versions.electron || null,
  nodeVersion: process.versions.node || null,
  afterCopy:annotation.afterCopy||'copy'
}));
ipcMain.handle('image:auto-save', async (_event, { dataUrl, baseName = 'Screenshot', format=storage.format }) => {
  if (!storage.autoSave) return { saved: false, disabled: true };
  return { saved: true, filePath: await writeUniqueImage(dataUrl, baseName, storage.directory,format) };
});
ipcMain.handle('image:save', async (event, { dataUrl, suggestedName = 'Grabbr.png', format = 'png' }) => {
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showSaveDialog(parent, {
    title: 'Screenshot opslaan', defaultPath: path.join(storage.directory || app.getPath('pictures'), filenameFromPattern(storage.filenamePattern,{date:new Date(),type:suggestedName.replace(/\.(png|jpe?g)$/i,''),counter:1,format})),
    filters: format === 'jpeg' ? [{ name: 'JPEG-afbeelding', extensions: ['jpg', 'jpeg'] }] : [{ name: 'PNG-afbeelding', extensions: ['png'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const image = nativeImage.createFromDataURL(dataUrl);
  const bytes = format === 'jpeg' ? image.toJPEG(92) : image.toPNG();
  await fs.writeFile(result.filePath, bytes); await recordLastSavedPath(result.filePath);
  return { canceled: false, filePath: result.filePath };
});
ipcMain.handle('image:show-last', () => { if (lastSavedPath) shell.showItemInFolder(lastSavedPath); return Boolean(lastSavedPath); });
ipcMain.handle('window:hide', event => { BrowserWindow.fromWebContents(event.sender)?.hide(); return true; });
