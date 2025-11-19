const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  // 메인 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#1a1a1a', // 다크 테마 기본 배경색
    title: 'DevSync'
  });

  // 개발 모드에서는 개발자 도구 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (!isDev) {
      mainWindow.focus();
    }
  });

  // 윈도우가 닫힐 때
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 앱이 준비되면 윈도우 생성
app.whenReady().then(() => {
  createWindow();

  // macOS에서 독 아이콘 클릭 시 윈도우 재생성
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // 메뉴 설정
  createMenu();
});

// 모든 윈도우가 닫히면 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 메뉴 생성
function createMenu() {
  const template = [
    {
      label: 'DevSync',
      submenu: [
        {
          label: 'DevSync 정보',
          click: () => {
            require('electron').dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'DevSync 정보',
              message: 'DevSync Desktop Messenger',
              detail: '개발자를 위한 데스크톱 메신저 앱\n버전: 1.0.0'
            });
          }
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '다시 실행', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '잘라내기', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '복사', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '붙여넣기', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: '보기',
      submenu: [
        { label: '새로고침', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '강제 새로고침', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: '개발자 도구', accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '실제 크기', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '확대', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '축소', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '전체화면', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: '창',
      submenu: [
        { label: '최소화', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: '닫기', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 통신 핸들러
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

// 앱 종료 전 정리 작업
app.on('before-quit', () => {
  console.log('DevSync 앱이 종료됩니다.');
});
