(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const canvas = $('#editorCanvas');
  const windowMode = new URLSearchParams(window.location.search).get('mode') || 'home';
  let history = new GrabbrModel.History(50);
  let zoom = 1;
  let sourceKind = 'window';
  let captureMode = 'window';
  let pendingTextCallback = null;
  let toastTimer = null;
  let appInfo = { platform: 'unknown', screenPermission: 'unknown', shortcuts: {} };
  let editingShortcuts = {};
  let editingStorage = { autoSave: true, directory: '' };
  let editingStartup = { openAtLogin: false, supported: true };
  let editingAnnotation = { closeAfterCopy: false };
  let internalAnnotationClipboard = null;
  let pasteOffset = 16;

  const engine = new CanvasEngine(canvas, {
    onCommit: () => commitCurrentState(),
    onSelection: (selected, item) => updateSelectionUI(selected, item),
    onTextRequest: (_point, callback) => openTextDialog(callback),
    onCropChange: valid => { $('#cropActions').classList.remove('hidden'); $('#applyCrop').disabled = !valid; },
    onBaseChanged: () => { applyZoom(); updateDocumentInfo(); showToast('Screenshot bijgesneden'); }
  });

  async function init() {
    appInfo = await window.grabbr.getAppInfo();
    document.documentElement.classList.add(`platform-${appInfo.platform}`);
    document.body.classList.add(`platform-${appInfo.platform}`);
    document.body.dataset.windowMode = windowMode;
    bindUI();
    updateHistoryUI();
    window.grabbr.onOpenCapture(mode => openCapture(mode));
    window.grabbr.onCaptureError(message => showToast(message, true));
    window.grabbr.onSettingsUpdated(settings => { appInfo = { ...appInfo, ...settings }; });
    if (windowMode === 'annotation') {
      const payload = await window.grabbr.getInitialAnnotation();
      if (!payload) throw new Error('De screenshot voor dit annotatievenster ontbreekt.');
      await initializeAnnotation(payload);
    }
    $('#statusText').textContent = `Klaar · gebied ${formatShortcut(appInfo.shortcuts.region)}`;
  }

  function bindUI() {
    $('#captureWindow').addEventListener('click', () => openCapture('window'));
    $('#captureRegion').addEventListener('click', () => openCapture('region'));
    $('#captureScreen').addEventListener('click', () => openCapture('screen'));
    $('#emptyWindow').addEventListener('click', () => openCapture('window'));
    $('#emptyRegion').addEventListener('click', () => openCapture('region'));
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#closeSettings').addEventListener('click', closeSettings);
    $('#cancelSettings').addEventListener('click', closeSettings);
    $('#settingsModal').addEventListener('click', e => { if (e.target === $('#settingsModal')) closeSettings(); });
    $('#settingsForm').addEventListener('submit', saveSettings);
    $('#resetHotkeys').addEventListener('click', resetHotkeys);
    $('#chooseStorageDirectory').addEventListener('click', chooseStorageDirectory);
    $('#autoSaveEnabled').addEventListener('change', updateStorageControls);
    $$('.hotkey-input').forEach(input => {
      input.addEventListener('focus', () => beginHotkeyRecording(input));
      input.addEventListener('click', () => beginHotkeyRecording(input));
      input.addEventListener('keydown', event => recordHotkey(event, input));
      input.addEventListener('blur', () => input.classList.remove('recording'));
    });
    $('#closeSourceModal').addEventListener('click', closeSourceModal);
    $('#sourceModal').addEventListener('click', e => { if (e.target === $('#sourceModal')) closeSourceModal(); });
    $$('.source-tabs button').forEach(button => button.addEventListener('click', () => {
      $$('.source-tabs button').forEach(b => b.classList.toggle('active', b === button));
      sourceKind = button.dataset.sourceKind;
      loadSources();
    }));
    $$('.tool').forEach(button => button.addEventListener('click', () => selectTool(button.dataset.tool)));
    $$('#colorPalette button').forEach(button => button.addEventListener('click', () => setColor(button.dataset.color, button)));
    $('#customColor').addEventListener('input', e => setColor(e.target.value, null));
    $('#strokeWidth').addEventListener('input', e => {
      const width = Number(e.target.value);
      $('#strokeOutput').value = `${width} px`;
      if (!engine.applySelectedProperties({ width }, false)) engine.setStyle({ width });
    });
    $('#strokeWidth').addEventListener('change', () => commitCurrentState());
    $('#fontSize').addEventListener('input', e => {
      const fontSize = Number(e.target.value);
      $('#fontOutput').value = `${fontSize} px`;
      if (!engine.applySelectedProperties({ fontSize }, false)) engine.setStyle({ fontSize });
    });
    $('#fontSize').addEventListener('change', () => commitCurrentState());
    $('#shadowEnabled').addEventListener('change', e => { engine.setShadowEnabled(e.target.checked); syncShadowUI(); applyZoom(); });
    $('#undoBtn').addEventListener('click', undo);
    $('#redoBtn').addEventListener('click', redo);
    $('#zoomIn').addEventListener('click', () => setZoom(zoom + .1));
    $('#zoomOut').addEventListener('click', () => setZoom(zoom - .1));
    $('#fitBtn').addEventListener('click', fitCanvas);
    $('#copyBtn').addEventListener('click', copyImage);
    $('#saveBtn').addEventListener('click', saveImage);
    $('#deleteSelection').addEventListener('click', () => engine.deleteSelected());
    $('#cancelCrop').addEventListener('click', () => { engine.cancelCrop(); $('#cropActions').classList.add('hidden'); selectTool('select'); });
    $('#applyCrop').addEventListener('click', async () => { await engine.applyCrop(); $('#cropActions').classList.add('hidden'); selectTool('select'); });
    $('#textForm').addEventListener('submit', e => { e.preventDefault(); commitText(); });
    $('#cancelText').addEventListener('click', closeTextDialog);
    $('#textModal').addEventListener('click', e => { if (e.target === $('#textModal')) closeTextDialog(); });
    window.addEventListener('keydown', handleKeys);
    window.addEventListener('resize', () => { if (engine.image && zoom < 1) fitCanvas(false); });
  }

  function selectTool(tool) {
    $$('.tool').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    engine.setTool(tool);
    $('#cropActions').classList.toggle('hidden', tool !== 'crop');
    if (tool === 'crop') $('#applyCrop').disabled = true;
    $('#statusText').textContent = toolHelp(tool);
  }

  function setColor(color, button) {
    engine.setStyle({ color });
    engine.applySelectedProperties({ color }, true);
    $$('#colorPalette button').forEach(b => b.classList.toggle('active', b === button));
    $('#customColor').value = color;
  }

  async function openCapture(mode) {
    if (mode === 'region') {
      try {
        $('#statusText').textContent = 'Sleep in de fullscreen overlay om een gebied te kiezen';
        await window.grabbr.startRegionCapture();
      } catch (error) {
        showToast(error.message || 'Gebiedsselectie kon niet worden gestart.', true);
      }
      return;
    }
    captureMode = mode;
    sourceKind = mode === 'window' ? 'window' : 'screen';
    $$('.source-tabs button').forEach(button => button.classList.toggle('active', button.dataset.sourceKind === sourceKind));
    $('#sourceTitle').textContent = mode === 'window' ? 'Kies een venster' : 'Kies een scherm';
    $('#sourceSubtitle').textContent = 'Selecteer de bron die je wilt vastleggen.';
    $('#sourceModal').classList.remove('hidden');
    $('#permissionWarning').classList.toggle('hidden', !(appInfo.platform === 'darwin' && appInfo.screenPermission !== 'granted'));
    await loadSources();
  }

  function closeSourceModal() { $('#sourceModal').classList.add('hidden'); }

  async function loadSources() {
    const grid = $('#sourceGrid');
    grid.innerHTML = '';
    $('#sourceLoading').classList.remove('hidden');
    try {
      const sources = await window.grabbr.listSources(sourceKind);
      $('#sourceLoading').classList.add('hidden');
      if (!sources.length) {
        grid.innerHTML = '<p class="empty-grid">Geen beschikbare bronnen gevonden. Controleer de schermopnametoestemming.</p>';
        return;
      }
      for (const source of sources) {
        const button = document.createElement('button');
        button.className = 'source-item';
        button.title = source.name;
        const thumb = document.createElement('div'); thumb.className = 'source-thumb';
        const image = document.createElement('img'); image.src = source.image; image.alt = '';
        thumb.append(image);
        const name = document.createElement('div'); name.className = 'source-name';
        if (source.icon) { const icon = document.createElement('img'); icon.src = source.icon; icon.alt = ''; name.append(icon); }
        const label = document.createElement('span'); label.textContent = source.name; name.append(label);
        button.append(thumb, name);
        button.addEventListener('click', () => chooseSource(source, button));
        grid.append(button);
      }
    } catch (error) {
      $('#sourceLoading').classList.add('hidden');
      grid.innerHTML = '';
      showToast(error.message || 'Bronnen konden niet worden opgehaald.', true);
    }
  }

  async function chooseSource(source, button) {
    button.disabled = true;
    button.querySelector('.source-name span:last-child').textContent = 'Vastleggen…';
    try {
      const dataUrl = await captureFullResolution(source);
      closeSourceModal();
      const result = await window.grabbr.openAnnotation({
        dataUrl,
        name: source.name,
        shadow: sourceKind === 'window',
        autoSaveBaseName: source.name
      });
      if (!result?.ok) throw new Error(result?.reason || 'Het annotatievenster kon niet worden geopend.');
      showToast('Nieuw annotatievenster geopend');
    } catch (error) {
      button.disabled = false;
      button.querySelector('.source-name span:last-child').textContent = source.name;
      showToast(error.message || 'Vastleggen is mislukt.', true);
    }
  }

  async function initializeAnnotation(payload) {
    captureMode = payload.shadow ? 'window' : 'screen';
    sourceKind = payload.shadow ? 'window' : 'screen';
    await engine.setDocument(payload.dataUrl, payload.name || 'Grabbr screenshot', { shadow: payload.shadow === true });
    document.title = `Grabbr — ${engine.name}`;
    syncShadowUI();
    $('#emptyState').classList.add('hidden');
    $('#canvasViewport').classList.remove('hidden');
    $('#copyBtn').disabled = false;
    $('#saveBtn').disabled = false;
    resetHistory();
    fitCanvas();
    updateDocumentInfo();
    selectTool('select');
    const autoSaved = payload.skipAutoSave ? null : await autoSaveCapture(payload.autoSaveBaseName || payload.name || 'Screenshot');
    if (autoSaved === true) showToast('Screenshot automatisch opgeslagen');
  }

  async function captureFullResolution(source) {
    let stream;
    if (sourceKind === 'window') {
      try {
        // desktopCapturer window snapshots are cursor-free at source. This is the
        // primary window pipeline on both macOS and Windows; no pixel cleanup is used.
        return await window.grabbr.getSourceImage(source.id, 'window');
      } catch (error) {
        console.warn('Cursorvrije windowsnapshot niet beschikbaar; beveiligde streamfallback wordt geprobeerd.', error);
      }
    }
    try {
      await window.grabbr.prepareCapture(source.id, sourceKind);
      stream = await navigator.mediaDevices.getDisplayMedia(GrabbrCapturePolicy.mediaConstraints(sourceKind));
      const track = stream.getVideoTracks()[0];
      if (sourceKind === 'window' && track) {
        try { await track.applyConstraints({ cursor: 'never' }); }
        catch (error) { console.warn('Het platform accepteerde de aanvullende cursorconstraint niet.', error); }
        if (!GrabbrCapturePolicy.cursorPolicySatisfied('window', track.getSettings?.() || {})) {
          throw new Error('Het platform kon een cursorvrije windowstream niet garanderen.');
        }
      }
      const video = document.createElement('video');
      video.srcObject = stream; video.muted = true;
      await video.play();
      await new Promise(resolve => {
        if (video.videoWidth) resolve();
        else video.addEventListener('loadedmetadata', resolve, { once: true });
      });
      await new Promise(resolve => {
        if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(() => resolve());
        else setTimeout(resolve, 180);
      });
      if (!video.videoWidth || !video.videoHeight) throw new Error('Geen videoframe ontvangen.');
      const output = document.createElement('canvas'); output.width = video.videoWidth; output.height = video.videoHeight;
      output.getContext('2d').drawImage(video, 0, 0);
      return output.toDataURL('image/png');
    } catch (error) {
      console.warn('Videocapture niet beschikbaar; hoge-resolutiebron wordt gebruikt.', error);
      try { return await window.grabbr.getSourceImage(source.id, sourceKind); }
      catch { if (source.image) return source.image; throw error; }
    } finally {
      stream?.getTracks().forEach(track => track.stop());
    }
  }

  function resetHistory() {
    history = new GrabbrModel.History(50);
    history.push(engine.scene());
    updateHistoryUI();
  }

  function commitCurrentState() {
    history.push(engine.scene());
    updateHistoryUI(); applyZoom(); updateDocumentInfo();
  }

  async function undo() {
    const scene = history.undo();
    if (!scene) return;
    await engine.restoreScene(scene);
    syncShadowUI(); updateHistoryUI(); applyZoom(); updateDocumentInfo();
  }

  async function redo() {
    const scene = history.redo();
    if (!scene) return;
    await engine.restoreScene(scene);
    syncShadowUI(); updateHistoryUI(); applyZoom(); updateDocumentInfo();
  }
  function updateHistoryUI() { $('#undoBtn').disabled = !history.canUndo(); $('#redoBtn').disabled = !history.canRedo(); }

  function syncShadowUI() {
    $('#shadowEnabled').checked = engine.shadow.enabled;
    const jpeg = $('#formatSelect').querySelector('option[value="jpeg"]');
    jpeg.disabled = engine.shadow.enabled;
    if (engine.shadow.enabled && $('#formatSelect').value === 'jpeg') $('#formatSelect').value = 'png';
  }

  function updateSelectionUI(selected, item) {
    $('#selectionPanel').classList.toggle('hidden', !selected);
    if (!selected || !item) {
      $('#strokeWidth').disabled = false;
      $('#fontSize').disabled = false;
      return;
    }
    const supportsWidth = GrabbrModel.supportsStrokeWidth(item);
    const supportsFont = GrabbrModel.supportsFontSize(item);
    $('#strokeWidth').disabled = !supportsWidth;
    $('#fontSize').disabled = !supportsFont;
    if (supportsWidth) {
      $('#strokeWidth').value = item.width || 5;
      $('#strokeOutput').value = `${item.width || 5} px`;
    }
    if (supportsFont) {
      $('#fontSize').value = item.fontSize || 28;
      $('#fontOutput').value = `${item.fontSize || 28} px`;
    }
    if (item.color) {
      $('#customColor').value = item.color;
      $$('#colorPalette button').forEach(button => button.classList.toggle('active', button.dataset.color.toLowerCase() === item.color.toLowerCase()));
    }
  }

  function setZoom(value) {
    zoom = Math.max(.1, Math.min(3, Math.round(value * 10) / 10));
    applyZoom();
  }

  function applyZoom() {
    if (!engine.image) return;
    canvas.style.width = `${Math.round(canvas.width * zoom)}px`;
    canvas.style.height = `${Math.round(canvas.height * zoom)}px`;
    $('#zoomLabel').textContent = `${Math.round(zoom * 100)}%`;
    engine.render();
  }

  function fitCanvas(changeOnly = true) {
    if (!engine.image) return;
    const viewport = $('#canvasViewport');
    const availableWidth = Math.max(200, viewport.clientWidth - 120);
    const availableHeight = Math.max(200, viewport.clientHeight - 120);
    const next = Math.min(1, availableWidth / canvas.width, availableHeight / canvas.height);
    if (changeOnly || next < zoom) zoom = Math.max(.1, Math.floor(next * 100) / 100);
    applyZoom();
  }

  async function copyImage() {
    if (!engine.image) {
      showToast('Er is geen screenshot om te kopiëren.', true);
      return false;
    }
    const button = $('#copyBtn');
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Kopiëren…';
    try {
      const pngBytes = await engine.exportPngBytes();
      const result = await window.grabbr.writePngToClipboard(pngBytes);
      if (!result?.ok) throw new Error(result?.error || 'Het systeemklembord heeft de afbeelding niet geaccepteerd.');
      showToast(`Afbeelding gekopieerd (${result.width} × ${result.height} px)`);
      if (result.closeAfterCopy === true) {
        const closed = await window.grabbr.closeSelf();
        if (!closed?.ok) throw new Error(closed?.reason || 'De afbeelding is gekopieerd, maar het annotatievenster kon niet worden gesloten.');
      }
      return true;
    } catch (error) {
      showToast(error.message || 'Kopiëren naar het systeemklembord is mislukt.', true);
      return false;
    } finally {
      if (document.body.isConnected) {
        button.textContent = originalLabel;
        button.disabled = !engine.image;
      }
    }
  }

  async function saveImage() {
    const format = $('#formatSelect').value;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const result = await window.grabbr.saveImage({ dataUrl: engine.exportDataUrl(format), suggestedName: `${engine.name}-${stamp}.${format === 'jpeg' ? 'jpg' : 'png'}`, format });
    if (!result.canceled) showToast(`Opgeslagen als ${result.filePath.split(/[\\/]/).pop()}`);
  }

  async function autoSaveCapture(baseName) {
    if (!appInfo.storage?.autoSave) return null;
    try {
      const result = await window.grabbr.autoSaveImage({ dataUrl: engine.exportDataUrl('png'), baseName });
      if (result.saved) {
        appInfo.lastAutoSavedPath = result.filePath;
        $('#statusText').textContent = `Automatisch opgeslagen · ${result.filePath.split(/[\\/]/).pop()}`;
        return true;
      }
      return null;
    } catch (error) {
      showToast(`Automatisch opslaan mislukt: ${error.message}`, true);
      return false;
    }
  }

  function openTextDialog(callback) {
    pendingTextCallback = callback;
    $('#textInput').value = '';
    $('#textModal').classList.remove('hidden');
    setTimeout(() => $('#textInput').focus(), 20);
  }

  function commitText() { const text = $('#textInput').value; pendingTextCallback?.(text); pendingTextCallback = null; $('#textModal').classList.add('hidden'); }
  function closeTextDialog() { pendingTextCallback = null; $('#textModal').classList.add('hidden'); }

  function openSettings() {
    editingShortcuts = { ...appInfo.shortcuts };
    editingStorage = { ...(appInfo.storage || { autoSave: true, directory: '' }) };
    editingStartup = { ...(appInfo.startup || { openAtLogin: false, supported: true }) };
    editingAnnotation = { ...(appInfo.annotation || { closeAfterCopy: false }) };
    populateShortcutInputs();
    populateStorageSettings();
    populateStartupSettings();
    populateAnnotationSettings();
    $('#settingsError').classList.add('hidden');
    $('#settingsModal').classList.remove('hidden');
  }

  function closeSettings() {
    $$('.hotkey-input').forEach(input => input.classList.remove('recording'));
    $('#settingsModal').classList.add('hidden');
  }

  function populateShortcutInputs() {
    $('#hotkeyWindow').value = formatShortcut(editingShortcuts.window);
    $('#hotkeyRegion').value = formatShortcut(editingShortcuts.region);
    $('#hotkeyScreen').value = formatShortcut(editingShortcuts.screen);
    $('#hotkeyWindow').dataset.accelerator = editingShortcuts.window || '';
    $('#hotkeyRegion').dataset.accelerator = editingShortcuts.region || '';
    $('#hotkeyScreen').dataset.accelerator = editingShortcuts.screen || '';
  }

  function populateStorageSettings() {
    $('#autoSaveEnabled').checked = editingStorage.autoSave !== false;
    $('#storageDirectory').value = editingStorage.directory || '';
    updateStorageControls();
  }

  function populateStartupSettings() {
    $('#startupEnabled').checked = editingStartup.openAtLogin === true;
    $('#startupEnabled').disabled = editingStartup.supported === false;
  }

  function populateAnnotationSettings() {
    $('#closeAfterCopy').checked = editingAnnotation.closeAfterCopy === true;
  }

  function updateStorageControls() {
    const enabled = $('#autoSaveEnabled').checked;
    $('#storageDirectory').classList.toggle('disabled', !enabled);
  }

  async function chooseStorageDirectory() {
    try {
      const result = await window.grabbr.chooseStorageDirectory();
      if (!result.canceled) {
        editingStorage.directory = result.directory;
        $('#storageDirectory').value = result.directory;
      }
    } catch (error) {
      showSettingsError(error.message || 'De mapkiezer kon niet worden geopend.');
    }
  }

  function beginHotkeyRecording(input) {
    $$('.hotkey-input').forEach(field => field.classList.toggle('recording', field === input));
    input.value = 'Druk een toetsencombinatie…';
    input.select();
  }

  function recordHotkey(event, input) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      input.value = formatShortcut(input.dataset.accelerator);
      input.blur();
      return;
    }
    const accelerator = GrabbrHotkeys.eventToAccelerator(event, appInfo.platform === 'darwin');
    if (!accelerator) return;
    const action = input.id === 'hotkeyWindow' ? 'window' : input.id === 'hotkeyRegion' ? 'region' : 'screen';
    editingShortcuts[action] = accelerator;
    input.dataset.accelerator = accelerator;
    input.value = formatShortcut(accelerator);
    input.blur();
  }

  async function saveSettings(event) {
    event.preventDefault();
    const check = GrabbrHotkeys.validateSettings(editingShortcuts);
    if (!check.valid) {
      showSettingsError(check.reason);
      return;
    }
    try {
      editingStorage.autoSave = $('#autoSaveEnabled').checked;
      editingStorage.directory = $('#storageDirectory').value;
      const storageResult = await window.grabbr.updateStorage(editingStorage);
      if (!storageResult.ok) {
        showSettingsError(storageResult.reason || 'De opslaginstellingen konden niet worden opgeslagen.');
        return;
      }
      const result = await window.grabbr.updateShortcuts(check.settings);
      if (!result.ok) {
        showSettingsError(result.reason || 'De sneltoetsen konden niet worden geregistreerd.');
        return;
      }
      const startupResult = await window.grabbr.updateStartup($('#startupEnabled').checked);
      if (!startupResult.ok) {
        showSettingsError(startupResult.reason || 'De autostartinstelling kon niet worden opgeslagen.');
        return;
      }
      const annotationResult = await window.grabbr.updateAnnotationSettings({ closeAfterCopy: $('#closeAfterCopy').checked });
      if (!annotationResult.ok) {
        showSettingsError(annotationResult.reason || 'De annotatievensterinstelling kon niet worden opgeslagen.');
        return;
      }
      appInfo.shortcuts = result.shortcuts;
      appInfo.storage = storageResult.storage;
      appInfo.startup = startupResult.startup;
      appInfo.annotation = annotationResult.annotation;
      editingShortcuts = { ...result.shortcuts };
      $('#statusText').textContent = `Klaar · gebied ${formatShortcut(appInfo.shortcuts.region)}`;
      closeSettings();
      showToast('Instellingen opgeslagen');
    } catch (error) {
      showSettingsError(error.message || 'De instellingen konden niet worden opgeslagen.');
    }
  }

  async function resetHotkeys() {
    try {
      const result = await window.grabbr.resetShortcuts();
      if (!result.ok) {
        showSettingsError(result.reason || 'De standaardsneltoetsen konden niet worden hersteld.');
        return;
      }
      appInfo.shortcuts = result.shortcuts;
      editingShortcuts = { ...result.shortcuts };
      populateShortcutInputs();
      $('#settingsError').classList.add('hidden');
      $('#statusText').textContent = `Klaar · gebied ${formatShortcut(appInfo.shortcuts.region)}`;
      showToast('Standaardsneltoetsen hersteld');
    } catch (error) {
      showSettingsError(error.message || 'De standaardsneltoetsen konden niet worden hersteld.');
    }
  }

  function showSettingsError(message) {
    $('#settingsError').textContent = message;
    $('#settingsError').classList.remove('hidden');
  }

  function handleKeys(event) {
    if (!$('#settingsModal').classList.contains('hidden')) {
      if (event.key === 'Escape' && !event.target.classList.contains('hotkey-input')) closeSettings();
      return;
    }
    if (!$('#textModal').classList.contains('hidden')) {
      if (event.key === 'Escape') closeTextDialog();
      return;
    }
    const targetIsTextInput = event.target.matches('input,textarea,select,[contenteditable="true"]');
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (targetIsTextInput) return;
    if (mod && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if (mod && key === 'y') {
      const isSupportedRedo = appInfo.platform === 'darwin' ? event.metaKey : event.ctrlKey;
      if (isSupportedRedo) { event.preventDefault(); redo(); return; }
    }
    if (mod && key === 'c' && engine.image) {
      event.preventDefault();
      const selected = engine.copySelectedAnnotation();
      if (selected) {
        internalAnnotationClipboard = selected;
        pasteOffset = 16;
        showToast('Annotatie gekopieerd');
      } else {
        copyImage();
      }
      return;
    }
    if (mod && key === 'v' && internalAnnotationClipboard) {
      event.preventDefault();
      if (engine.pasteAnnotation(internalAnnotationClipboard, pasteOffset)) {
        pasteOffset = Math.min(96, pasteOffset + 8);
        showToast('Annotatie geplakt');
      }
      return;
    }
    if (mod && key === 's' && engine.image) { event.preventDefault(); saveImage(); return; }
    if (event.key === 'Escape') {
      if (!$('#sourceModal').classList.contains('hidden')) closeSourceModal();
      else { engine.cancelCrop(); $('#cropActions').classList.add('hidden'); selectTool('select'); }
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && engine.selectedIndex >= 0) { event.preventDefault(); engine.deleteSelected(); return; }
    if (mod || event.altKey) return;
    const keyMap = { v:'select', a:'arrow', r:'rect', e:'ellipse', l:'line', p:'pen', t:'text', s:'step', b:'blur', x:'pixelate', d:'redact', c:'crop' };
    const tool = keyMap[event.key.toLowerCase()]; if (tool) selectTool(tool);
  }

  function updateDocumentInfo() {
    const dimensions = engine.dimensions();
    $('#documentInfo').textContent = dimensions ? `${dimensions.width} × ${dimensions.height} px · ${engine.annotations.length} annotatie${engine.annotations.length === 1 ? '' : 's'}` : '';
  }

  function showToast(message, error = false) {
    const toast = $('#toast');
    toast.textContent = message; toast.classList.remove('hidden', 'error'); toast.classList.toggle('error', error);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  }

  function formatShortcut(value) { return (value || '').replace('CommandOrControl', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl').replaceAll('+', ' + '); }
  function toolHelp(tool) {
    return ({ select:'Klik op een annotatie om deze te verplaatsen', arrow:'Sleep om een pijl te tekenen', rect:'Sleep om een kader te tekenen', ellipse:'Sleep om een ellips te tekenen', line:'Sleep om een lijn te tekenen', pen:'Sleep om vrij te tekenen', text:'Klik op de screenshot om tekst toe te voegen', step:'Klik om een automatisch stapnummer te plaatsen', blur:'Sleep over informatie die je wilt vervagen', pixelate:'Sleep over informatie die je wilt pixeleren', redact:'Sleep om informatie permanent af te dekken', crop:'Sleep om een uitsnede te maken' })[tool] || 'Klaar';
  }

  init().catch(error => { console.error(error); showToast('Grabbr kon niet volledig starten.', true); });
})();
