const fs = require('fs');
const path = require('path');

// 로그 디렉토리 생성
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 로그 파일 경로
const accessLogPath = path.join(logDir, 'access.log');
const errorLogPath = path.join(logDir, 'error.log');
const userLogPath = path.join(logDir, 'users.log');

// 로그 함수들
const log = {
  access: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ACCESS: ${message}\n`;
    fs.appendFileSync(accessLogPath, logMessage);
    console.log(`📝 ${message}`);
  },

  // ✅ 추가
  info: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}\n`;
    fs.appendFileSync(accessLogPath, logMessage);
    console.log(`ℹ️ ${message}`);
  },

  // (선택) 필요하면 경고/디버그도
  warn: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message}\n`;
    fs.appendFileSync(accessLogPath, logMessage);
    console.warn(`⚠️ ${message}`);
  },

  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}${error ? ` - ${error.message}` : ''}\n`;
    fs.appendFileSync(errorLogPath, logMessage);
    console.error(`❌ ${message}`, error || '');
  },

  user: (action, username, details = '') => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] USER: ${action} - ${username} ${details}\n`;
    fs.appendFileSync(userLogPath, logMessage);
    console.log(`👤 ${action}: ${username} ${details}`);
  },

  connection: (action, socketId, details = '') => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] CONNECTION: ${action} - ${socketId} ${details}\n`;
    fs.appendFileSync(accessLogPath, logMessage);
    console.log(`🔌 ${action}: ${socketId} ${details}`);
  }
};

// Express 미들웨어
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const url = req.url;
    const ip = req.ip || req.connection.remoteAddress;
    
    let statusIcon = '✅';
    if (status >= 400) statusIcon = '❌';
    else if (status >= 300) statusIcon = '🔄';
    
    log.access(`${statusIcon} ${method} ${url} - ${status} (${duration}ms) - IP: ${ip}`);
  });
  
  next();
};

// Socket.io 연결 로거
const socketLogger = (socket) => {
  const clientIP = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'];
  
  log.connection('CONNECTED', socket.id, `IP: ${clientIP}`);
  
  socket.on('disconnect', (reason) => {
    log.connection('DISCONNECTED', socket.id, `Reason: ${reason}`);
  });
  
  socket.on('error', (error) => {
    log.error(`Socket Error - ${socket.id}`, error);
  });
};

// 오류 처리 미들웨어
const errorHandler = (err, req, res, next) => {
  log.error(`Express Error - ${req.method} ${req.url}`, err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

// 로그 파일 정리 (매일 자정에 실행)
const cleanupLogs = () => {
  const files = [accessLogPath, errorLogPath, userLogPath];
  
  files.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      // 10MB 이상이면 백업 후 새로 시작
      if (fileSizeInMB > 10) {
        const backupPath = filePath.replace('.log', `_${Date.now()}.log`);
        fs.renameSync(filePath, backupPath);
        log.access(`Log file rotated: ${path.basename(filePath)}`);
      }
    }
  });
};

module.exports = {
  log,
  requestLogger,
  socketLogger,
  errorHandler,
  cleanupLogs
};
