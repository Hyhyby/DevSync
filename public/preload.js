const { contextBridge, ipcRenderer } = require('electron');

// 렌더러 프로세스에서 사용할 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // 윈도우 제어
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  
  // 알림
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  
  // 파일 시스템 (필요시)
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (data) => ipcRenderer.invoke('save-file', data)
});
