// server.js (메인 실행 진입점)
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');        // ✅ 이 형태
const { ipv4, PORT, ALLOWED_ORIGINS } = require('./config/network');
const { log } = require('./middleware/logger');    // ✅ 경로도 이렇게
const { corsOptions, isAllowedOrigin } = require('./config/cors');

// ✅ HTTP 서버 생성
const server = http.createServer(app);

// ✅ 소켓 초기화
initSocket(server);

// ✅ 서버 실행
server.listen(PORT, '0.0.0.0', () => {
  log.info(`✅ Server running at http://${ipv4}:${PORT}`);
  log.info(`✅ Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
