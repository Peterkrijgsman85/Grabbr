'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('grabbrOverlay', {
  onInitialize: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('region:initialize', listener);
    return () => ipcRenderer.removeListener('region:initialize', listener);
  },
  complete: dataUrl => ipcRenderer.send('region:complete', dataUrl),
  cancel: () => ipcRenderer.send('region:cancel')
});
