const { contextBridge, ipcRenderer } = require('electron');

// 렌더러 프로세스에서 안전하게 사용할 수 있는 API 노출
contextBridge.exposeInMainWorld('electron', {
  // 윈도우 관련 기능
  resizeWindow: (width, height) => {
    ipcRenderer.invoke('window-resize', width, height);
  },
  toggleDevTools: () => {
    ipcRenderer.invoke('toggle-dev-tools');
  },

  // 환경 정보
  getPlatform: () => process.platform,
  getVersions: () => process.versions,
});
