// electron/main.js
const { app, BrowserWindow,shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

let mainWindow;
let backendProcess;
let frontendProcess;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/* =========================
   0) config.json (API_BASE 등)
   ========================= */
const getConfigPath = () => path.join(app.getPath('userData'), 'config.json');
const defaultConfig = { API_BASE: 'http://localhost:5000' };

function readConfig() {
  const p = getConfigPath();
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(defaultConfig, null, 2));
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}
function writeConfig(cfg) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2));
}

/* =========================
   1) 유틸: 포트 사용중 체크 / 서버대기
   ========================= */
function isPortBusy(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { resolve(false); });
    socket.connect(port, host);
  });
}

function waitFor(url, { timeoutMs = 20000, intervalMs = 300 } = {}) {
  const end = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http.get(url, res => {
        res.resume();
        resolve(url);
      }).on('error', () => {
        if (Date.now() > end) reject(new Error(`Dev server not ready: ${url}`));
        else setTimeout(tryOnce, intervalMs);
      });
    };
    tryOnce();
  });
}

async function waitForAny(urls, { timeoutMsEach = 5000 } = {}) {
  for (const url of urls) {
    try {
      await waitFor(url, { timeoutMs: timeoutMsEach, intervalMs: 300 });
      return url;
    } catch (_) {
      // next candidate
    }
  }
  throw new Error('No dev server found on candidates: ' + urls.join(', '));
}

/* =========================
   2) 프로세스 스폰: 백엔드/프론트
   ========================= */
async function startBackend() {
  const { API_BASE } = readConfig();

  // 원격 API(ngrok 등) 사용 시 로컬 백엔드 스킵
  const usingRemote = API_BASE && !API_BASE.includes('localhost');
  if (usingRemote) {
    console.log('[Backend] Skip spawn (using remote API_BASE):', API_BASE);
    return;
  }

  // 이미 5000이 떠 있으면 스킵
  if (await isPortBusy(5000)) {
    console.log('[Backend] Port 5000 already in use, skip spawning.');
    return;
  }

  const backendPath = path.join(__dirname, '../backend');
  const isWindows = process.platform === 'win32';

  if (!isDev) {
    backendProcess = spawn('node', ['server.js'], {
      cwd: backendPath,
      shell: true,
      stdio: 'pipe'
    });
  } else {
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    backendProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: backendPath,
      shell: true,
      stdio: 'pipe'
    });
  }

  backendProcess.stdout?.on('data', (data) => console.log(`[Backend] ${data}`));
  backendProcess.stderr?.on('data', (data) => console.error(`[Backend Error] ${data}`));
  backendProcess.on('error', (error) => console.error('백엔드 시작 오류:', error));
  backendProcess.on('exit', (code) => console.log(`백엔드 종료, 코드: ${code}`));
}

function startFrontend() {
  if (!isDev) return; // 배포에서는 정적 파일 사용

  const frontendPath = path.join(__dirname, '../frontend');
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  // ※ 프론트 package.json에 "vite --port 3000 --strictPort"를 권장.
  //    그래도 포트가 바뀌면 아래 자동감지가 처리해줌.
  frontendProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: frontendPath,
    shell: true,
    stdio: 'pipe'
  });

  frontendProcess.stdout?.on('data', (data) => console.log(`[Frontend] ${data}`));
  frontendProcess.stderr?.on('data', (data) => console.error(`[Frontend Error] ${data}`));
  frontendProcess.on('error', (error) => console.error('프론트엔드 시작 오류:', error));
  frontendProcess.on('exit', (code) => console.log(`프론트엔드 종료, 코드: ${code}`));
}

/* =========================
   3) 브라우저 윈도우
   ========================= */
function createWindow(devUrl) {
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

  if (isDev) {
    mainWindow.loadURL(devUrl || 'http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      .messages{overflow-y:auto; scrollbar-gutter:stable;}
      .messages::-webkit-scrollbar{width:10px; height:10px;}
      .messages::-webkit-scrollbar-track{background:#2f3136; margin:4px; border-radius:10px;}
      .messages::-webkit-scrollbar-thumb{background:#5865f2; border-radius:10px; border:2px solid #2f3136;}
      .messages::-webkit-scrollbar-thumb:hover{background:#4752c4;}
      .messages::-webkit-scrollbar-corner{background:#2f3136; border-radius:10px;}
    `);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}
app.commandLine.appendSwitch('disable-features', 'OverlayScrollbar');
/* =========================
   4) 앱 라이프사이클
   ========================= */
app.whenReady().then(async () => {
  await startBackend();

  if (isDev) {
    startFrontend();

    // 3000 우선 대기 → 실패하면 5173~5180 자동 감지
    let devUrl = 'http://localhost:3000';
    try {
      devUrl = await waitForAny([
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:5177',
        'http://localhost:5178',
        'http://localhost:5179',
        'http://localhost:5180',
      ], { timeoutMsEach: 5000 });
      console.log('[Frontend] Dev server ready at:', devUrl);
    } catch (e) {
      console.error(e.message);
      // 그래도 윈도우는 띄워서 오류를 눈으로 보게 함
    }

    createWindow(devUrl);
  } else {
    // 배포: 빌드 파일 로딩 전에 백엔드 숨 고르기
    setTimeout(createWindow, 1500);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 종료/정리
function safeKill(p) {
  try { p && p.kill(); } catch { /* noop */ }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    safeKill(backendProcess);
    safeKill(frontendProcess);
    app.quit();
  }
});
app.on('before-quit', () => {
  safeKill(backendProcess);
  safeKill(frontendProcess);
});

/* =========================
   5) IPC: dev 도움용 + config
   ========================= */
ipcMain.handle('window-resize', async (_e, w, h) => {
  if (mainWindow) mainWindow.setSize(w, h);
});
ipcMain.handle('toggle-dev-tools', async () => {
  if (mainWindow) mainWindow.webContents.toggleDevTools();
});

// config IPC
ipcMain.handle('config:get', async () => readConfig());
ipcMain.handle('config:set', async (_e, partial) => {
  const cur = readConfig();
  const next = { ...cur, ...partial };
  writeConfig(next);
  return next;
});

/* =========================
   6) 전역 예외
   ========================= */
process.on('uncaughtException', (error) => console.error('처리되지 않은 예외:', error));
process.on('unhandledRejection', (reason) => console.error('처리되지 않은 Promise 거부:', reason));
