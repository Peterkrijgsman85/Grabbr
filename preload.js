'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('grabbr', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  updateShortcuts: settings => ipcRenderer.invoke('settings:update-shortcuts', settings),
  resetShortcuts: () => ipcRenderer.invoke('settings:reset-shortcuts'),
  chooseStorageDirectory: () => ipcRenderer.invoke('settings:choose-storage-directory'),
  updateStorage: settings => ipcRenderer.invoke('settings:update-storage', settings),
  updateStartup: enabled => ipcRenderer.invoke('settings:update-startup', enabled),
  updateAnnotationSettings: settings => ipcRenderer.invoke('settings:update-annotation', settings),
  getInitialAnnotation: () => ipcRenderer.invoke('annotation:get-initial'),
  openAnnotation: payload => ipcRenderer.invoke('annotation:open', payload),
  closeSelf: () => ipcRenderer.invoke('window:close-self'),
  startRegionCapture: () => ipcRenderer.invoke('capture:start-region'),
  listSources: kind => ipcRenderer.invoke('capture:list-sources', kind),
  prepareCapture: (id, kind) => ipcRenderer.invoke('capture:prepare', { id, kind }),
  getSourceImage: (id, kind) => ipcRenderer.invoke('capture:get-source-image', { id, kind }),
  writePngToClipboard: pngBytes => ipcRenderer.invoke('clipboard:write-png', pngBytes),
  autoSaveImage: payload => ipcRenderer.invoke('image:auto-save', payload),
  saveImage: payload => ipcRenderer.invoke('image:save', payload),
  showLastSaved: () => ipcRenderer.invoke('image:show-last'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  openExternal: url => ipcRenderer.invoke('external:open', url),
  onOpenCapture: callback => {
    const listener = (_event, mode) => callback(mode);
    ipcRenderer.on('capture:open', listener);
    return () => ipcRenderer.removeListener('capture:open', listener);
  },
  onCaptureError: callback => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('capture:error', listener);
    return () => ipcRenderer.removeListener('capture:error', listener);
  },
  onSettingsUpdated: callback => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings:updated', listener);
    return () => ipcRenderer.removeListener('settings:updated', listener);
  }
});
