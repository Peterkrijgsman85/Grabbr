'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('grabbrOverlay', {
  onInitialize: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('region:initialize', listener);
    return () => ipcRenderer.removeListener('region:initialize', listener);
  },
  complete: payload => ipcRenderer.send('region:complete', payload),
  cancel: () => ipcRenderer.send('region:cancel')
});
