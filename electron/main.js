const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { execSync } = require('child_process');

let mainWindow;
let backendProcess;
let frontendProcess;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  // 메인 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, 'assets/devsync-icon2.png'),
    autoHideMenuBar: true,
    frame: true,
    backgroundColor: '#36393f'
  });

  // 개발 모드에서는 로컬 서버로, 프로덕션에서는 빌드된 파일로
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const backendPath = path.join(__dirname, '../backend');
  const isWindows = process.platform === 'win32';
  
  // 프로덕션 모드에서는 node로 직접 실행
  if (!isDev) {
    backendProcess = spawn('node', ['server.js'], {
      cwd: backendPath,
      shell: true,
      stdio: 'pipe'
    });
  } else {
    // 개발 모드에서는 npm run dev 실행
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    backendProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: backendPath,
      shell: true,
      stdio: 'pipe'
    });
  }

  backendProcess.stdout?.on('data', (data) => {
    console.log(`[Backend] ${data}`);
  });

  backendProcess.stderr?.on('data', (data) => {
    console.error(`[Backend Error] ${data}`);
  });

  backendProcess.on('error', (error) => {
    console.error('백엔드 시작 오류:', error);
  });

  backendProcess.on('exit', (code) => {
    console.log(`백엔드 종료, 코드: ${code}`);
  });
}

function startFrontend() {
  // 개발 모드에서만 프론트엔드 서버 시작
  if (!isDev) {
    return;
  }

  const frontendPath = path.join(__dirname, '../frontend');
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  frontendProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: frontendPath,
    shell: true,
    stdio: 'pipe'
  });

  frontendProcess.stdout?.on('data', (data) => {
    console.log(`[Frontend] ${data}`);
  });

  frontendProcess.stderr?.on('data', (data) => {
    console.error(`[Frontend Error] ${data}`);
  });

  frontendProcess.on('error', (error) => {
    console.error('프론트엔드 시작 오류:', error);
  });

  frontendProcess.on('exit', (code) => {
    console.log(`프론트엔드 종료, 코드: ${code}`);
  });
}

// 앱이 준비되면 윈도우 생성
app.whenReady().then(() => {
  // 백엔드 서버 시작
  startBackend();
  
  if (isDev) {
    // 개발 모드: 프론트엔드 서버도 시작
    setTimeout(() => {
      startFrontend();
      // 프론트엔드 서버가 준비될 때까지 대기
      setTimeout(() => {
        createWindow();
      }, 3000);
    }, 1000);
  } else {
    // 프로덕션 모드: 백엔드만 시작하고 빌드된 파일 사용
    setTimeout(() => {
      createWindow();
    }, 2000);
  }

  // macOS에서 독 아이콘 클릭 시 윈도우 재생성
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 모든 윈도우가 닫히면 앱 종료
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 프로세스 정리
    if (backendProcess) {
      backendProcess.kill();
    }
    if (frontendProcess) {
      frontendProcess.kill();
    }
    app.quit();
  }
});

// 앱 종료 전 프로세스 정리
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (frontendProcess) {
    frontendProcess.kill();
  }
});

// 개발 모드에서만
if (isDev) {
  // 윈도우 크기 변경 감지
  ipcMain.handle('window-resize', async (event, width, height) => {
    if (mainWindow) {
      mainWindow.setSize(width, height);
    }
  });

  // 개발자 도구 토글
  ipcMain.handle('toggle-dev-tools', async () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// 예외 처리
process.on('uncaughtException', (error) => {
  console.error('처리되지 않은 예외:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason);
});