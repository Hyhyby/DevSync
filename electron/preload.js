// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 창/환경
contextBridge.exposeInMainWorld('electron', {
  resizeWindow: (width, height) => ipcRenderer.invoke('window-resize', width, height),
  getPlatform: () => process.platform,
  getVersions: () => process.versions,
  toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools')
});

// 설정 (API_BASE 등)
contextBridge.exposeInMainWorld('appConfig', {
  get: () => ipcRenderer.invoke('config:get'),
  set: (partial) => ipcRenderer.invoke('config:set', partial)
});
