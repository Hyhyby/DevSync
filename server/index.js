const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// 환경 변수 설정
require('dotenv').config();

// 데이터베이스 연결
const { sequelize } = require('./config/database');

// 모델 가져오기 (관계 설정을 위해)
require('./models');

// 라우트 가져오기
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');

// 소켓 핸들러
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// 미들웨어 설정
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 정적 파일 서빙 (Electron에서 사용)
app.use(express.static(path.join(__dirname, '../build')));

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 소켓 연결 처리
socketHandler(io);

// 데이터베이스 디렉토리 생성
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 데이터베이스 연결 및 서버 시작
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // 데이터베이스 연결 테스트
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공');

    // 데이터베이스 동기화 (개발 환경에서만)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('✅ 데이터베이스 동기화 완료');
    }
    
    server.listen(PORT, () => {
      console.log(`🚀 DevSync 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`📡 Socket.io 서버 준비 완료`);
      console.log(`🌐 API 엔드포인트: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 서버 종료 신호 수신');
  await sequelize.close();
  server.close(() => {
    console.log('✅ 서버가 안전하게 종료되었습니다.');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 서버 종료 신호 수신 (Ctrl+C)');
  await sequelize.close();
  server.close(() => {
    console.log('✅ 서버가 안전하게 종료되었습니다.');
    process.exit(0);
  });
});

startServer();

module.exports = { app, server, io };
