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
  updateAllSettings: settings => ipcRenderer.invoke('settings:update-all', settings),
  getInitialAnnotation: () => ipcRenderer.invoke('annotation:get-initial'),
  openAnnotation: payload => ipcRenderer.invoke('annotation:open', payload),
  closeSelf: () => ipcRenderer.invoke('window:close-self'),
  closeEmptyHome:()=>ipcRenderer.invoke('window:close-empty-home'),
  minimizeSelf:()=>ipcRenderer.invoke('window:minimize-self'),
  startRegionCapture: () => ipcRenderer.invoke('capture:start-region'),
  hideGrabbrWindows:()=>ipcRenderer.invoke('capture:hide-grabbr-windows'),
  restoreGrabbrWindows:()=>ipcRenderer.invoke('capture:restore-grabbr-windows'),
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
  },
  onOpenSettings:callback=>{const listener=()=>callback();ipcRenderer.on('settings:open',listener);return()=>ipcRenderer.removeListener('settings:open',listener);}
});
