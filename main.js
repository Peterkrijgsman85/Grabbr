'use strict';

const electron = require('electron');
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, nativeImage, globalShortcut, Tray, Menu, shell, systemPreferences, screen, session } = electron;
const fs = require('node:fs/promises');
const path = require('node:path');
const { DEFAULTS, validateSettings } = require('./src/hotkeys.js');
const { screenshotFilename } = require('./src/storage.js');
const { isSupportedPlatform, loginItemOptions, normalizeState } = require('./src/startup.js');
const { isOwnSourceName, filterExternalSources } = require('./src/capture-policy.js');
const { detectClipboardCapabilities, writePngToSystemClipboard } = require('./src/system-clipboard.js');
const { WindowRegistry } = require('./src/window-registry.js');
const { DEFAULT_ANNOTATION_SETTINGS, normalizeAnnotationSettings } = require('./src/annotation-settings.js');
const { buildTrayTemplate } = require('./src/tray-menu.js');
const { loadRecentScreenshot } = require('./src/recent-screenshot.js');
const { WindowLifecyclePolicy } = require('./src/window-lifecycle.js');

app.setName('Grabbr');

const electronClipboard = electron.clipboard;

let mainWindow;
let overlayWindow;
let tray;
let lastSavedPath = null;
let pendingCapture = null;
let shortcuts = { ...DEFAULTS };
let shortcutStatus = {};
let storage = { autoSave: true, directory: null };
let startup = { openAtLogin: false };
let annotation = { ...DEFAULT_ANNOTATION_SETTINGS };
let recent = { lastSavedPath: null };
let regionContext = null;
const annotationWindows = new WindowRegistry();
const annotationPayloads = new Map();
const isMac = process.platform === 'darwin';
const lifecyclePolicy = new WindowLifecyclePolicy();

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }

async function loadSettings() {
  const defaultDirectory = path.join(app.getPath('pictures'), 'Grabbr');
  try {
    const parsed = JSON.parse(await fs.readFile(settingsPath(), 'utf8'));
    const checked = validateSettings(parsed.shortcuts);
    shortcuts = checked.valid ? checked.settings : { ...DEFAULTS };
    storage = {
      autoSave: parsed.storage?.autoSave !== false,
      directory: typeof parsed.storage?.directory === 'string' && parsed.storage.directory.trim() ? parsed.storage.directory : defaultDirectory
    };
    startup = { openAtLogin: parsed.startup?.openAtLogin === true };
    annotation = normalizeAnnotationSettings(parsed.annotation);
    recent = { lastSavedPath: typeof parsed.recent?.lastSavedPath === 'string' ? parsed.recent.lastSavedPath : null };
    lastSavedPath = recent.lastSavedPath;
  } catch {
    shortcuts = { ...DEFAULTS };
    storage = { autoSave: true, directory: defaultDirectory };
    startup = { openAtLogin: false };
    annotation = { ...DEFAULT_ANNOTATION_SETTINGS };
    recent = { lastSavedPath: null };
  }
  await fs.mkdir(storage.directory, { recursive: true }).catch(() => {});
}

async function saveSettings() {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify({ shortcuts, storage, startup, annotation, recent }, null, 2), 'utf8');
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
  };
}

function broadcastSettings() {
  const snapshot = settingsSnapshot();
  for (const win of [mainWindow, ...annotationWindows.values()]) {
    if (win && !win.isDestroyed()) win.webContents.send('settings:updated', snapshot);
  }
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

async function writeUniqueImage(dataUrl, baseName, directory = storage.directory) {
  if (!directory) throw new Error('Er is geen opslagmap ingesteld.');
  await fs.mkdir(directory, { recursive: true });
  const image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) throw new Error('De screenshot kon niet als afbeelding worden verwerkt.');
  const bytes = image.toPNG();
  const createdAt = new Date();
  for (let index = 1; index < 10000; index++) {
    const filePath = path.join(directory, screenshotFilename(baseName, createdAt, index));
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
  mainWindow.setContentProtection(true);
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
    skipAutoSave: payload.skipAutoSave === true
  });
  win.setContentProtection(true);
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

function createTray() {
  const iconPath = isMac ? path.join(__dirname, 'assets', 'trayTemplate.png') : path.join(__dirname, 'assets', 'icon.png');
  const sourceIcon = nativeImage.createFromPath(iconPath);
  if (isMac) sourceIcon.setTemplateImage(true);
  tray = new Tray(isMac ? sourceIcon : sourceIcon.resize({ width: 18, height: 18 }));
  tray.setToolTip('Grabbr');
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayTemplate(process.platform, {
    captureWindow: () => showCapture('window'),
    captureRegion: () => showCapture('region'),
    captureScreen: () => showCapture('screen'),
    openLastScreenshot: () => openLastScreenshot(),
    openApp: () => { ensureMainWindow().show(); mainWindow.focus(); },
    quit: () => { app.isQuitting = true; app.quit(); }
  })));
  tray.on('double-click', () => showCapture('window'));
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
  const actions = { window: () => showCapture('window'), region: () => showCapture('region'), screen: () => showCapture('screen') };
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
  return { ok: true, shortcuts: { ...shortcuts }, status: { ...shortcutStatus } };
}

function restoreRegionRequester() {
  const context = regionContext;
  regionContext = null;
  if (context?.wasVisible && context.requester && !context.requester.isDestroyed()) {
    context.requester.show(); context.requester.focus();
  }
}

async function beginRegionCapture(requester = activeGrabbrWindow()) {
  if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.focus(); return; }
  const targetDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  regionContext = { requester, wasVisible: Boolean(requester?.isVisible()) };
  requester?.hide();
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
      const source = sources.find(item => item.id === selection.id && !isOwnSourceName(item.name));
      callback(source ? { video: source } : null);
    } catch (error) {
      console.error('Capturebron kon niet worden voorbereid:', error); callback(null);
    }
  });
  createWindow(); createTray(); registerShortcuts(shortcuts);
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

ipcMain.handle('capture:start-region', async event => {
  const requester = BrowserWindow.fromWebContents(event.sender) || activeGrabbrWindow();
  try { await beginRegionCapture(requester); return true; }
  catch (error) { restoreRegionRequester(); if (requester && !requester.isDestroyed()) { requester.show(); requester.focus(); } throw error; }
});
ipcMain.on('region:complete', (_event, dataUrl) => {
  closeOverlay(); restoreRegionRequester();
  createAnnotationWindow({ dataUrl, name: 'Grabbr gebied', shadow: false, autoSaveBaseName: 'Gebied' });
});
ipcMain.on('region:cancel', () => { closeOverlay(); restoreRegionRequester(); });

ipcMain.handle('capture:list-sources', async (_event, kind = 'window') => {
  const sources = await desktopCapturer.getSources({ types: kind === 'window' ? ['window'] : ['screen'], thumbnailSize: { width: 640, height: 400 }, fetchWindowIcons: true });
  return filterExternalSources(sources).map(source => ({ id: source.id, name: source.name || 'Naamloos venster', displayId: source.display_id || null, image: source.thumbnail.toDataURL(), size: source.thumbnail.getSize(), icon: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null }));
});
ipcMain.handle('capture:prepare', (_event, { id, kind = 'window' }) => { pendingCapture = { id, kind }; return true; });
ipcMain.handle('capture:get-source-image', async (_event, { id, kind = 'window' }) => {
  const displays = screen.getAllDisplays();
  const maxWidth = Math.min(8192, Math.max(2560, ...displays.map(d => Math.round(d.size.width * d.scaleFactor))));
  const maxHeight = Math.min(8192, Math.max(1440, ...displays.map(d => Math.round(d.size.height * d.scaleFactor))));
  const sources = await desktopCapturer.getSources({ types: kind === 'window' ? ['window'] : ['screen'], thumbnailSize: { width: maxWidth, height: maxHeight }, fetchWindowIcons: false });
  const source = sources.find(item => item.id === id && !isOwnSourceName(item.name));
  if (!source || source.thumbnail.isEmpty()) throw new Error('De geselecteerde bron is niet meer beschikbaar.');
  return source.thumbnail.toDataURL();
});

ipcMain.handle('clipboard:write-png', async (_event, payload) => writePngToSystemClipboard(payload, {
  electronClipboard,
  nativeImage,
  platform: process.platform,
  electronVersion: process.versions.electron || null,
  nodeVersion: process.versions.node || null,
  closeAfterCopy: annotation.closeAfterCopy === true
}));
ipcMain.handle('image:auto-save', async (_event, { dataUrl, baseName = 'Screenshot' }) => {
  if (!storage.autoSave) return { saved: false, disabled: true };
  return { saved: true, filePath: await writeUniqueImage(dataUrl, baseName, storage.directory) };
});
ipcMain.handle('image:save', async (event, { dataUrl, suggestedName = 'Grabbr.png', format = 'png' }) => {
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showSaveDialog(parent, {
    title: 'Screenshot opslaan', defaultPath: path.join(storage.directory || app.getPath('pictures'), suggestedName.replace(/\.(png|jpe?g)$/i, `.${extension}`)),
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
ipcMain.handle('external:open', (_event, url) => shell.openExternal(url));
