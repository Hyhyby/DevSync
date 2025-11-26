// socket.js (Socket.IO 설정 담당)
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/network');
const { isAllowedOrigin } = require('./config/cors');
const { socketLogger, log } = require('./middleware/logger');

const registerChannelHandlers = require('./sockets/channel');
const registerDmHandlers = require('./sockets/dm');

let ioInstance = null;
const onlineUsers = new Map();

/**
 * Socket.IO 초기화
 */
function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin(origin, cb) {
        if (isAllowedOrigin(origin)) return cb(null, true);
        cb(new Error(`Not allowed by Socket.IO CORS: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // 전역 저장
  ioInstance = io;

  /**
   * 🔐 인증 미들웨어
   * - 토큰 없거나 검증 실패하면 연결 거부
   */
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers['authorization'] || '').split(' ')[1];

      if (!token) {
        return next(new Error('NO_TOKEN'));
      }

      const user = jwt.verify(token, JWT_SECRET);
      // user: { userId, username, ... }
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket) => {
    socketLogger(socket);

    const user = socket.user;
    if (!user || !user.userId) {
      log.warn(`⚠️ CONNECTED WITHOUT USER, socketId=${socket.id}, force disconnect`);
      socket.disconnect(true);
      return;
    }

    const userId = user.userId;
    const username = user.username;

    log.connection('CONNECTED', socket.id, `User: ${username} (${userId})`);

    // ✅ 인증된 유저를 onlineUsers에 등록
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    log.info(
      `👤 ONLINE_ADD userId=${userId}, socketId=${socket.id}, totalSockets=${onlineUsers.get(userId).size}`
    );
    
    // 채널 및 DM 핸들러 등록
    registerChannelHandlers(io, socket);
    registerDmHandlers(io, socket);

    /**
     * 연결 해제
     */
    socket.on('disconnect', (reason) => {
      log.connection('DISCONNECTED', socket.id, `Reason: ${reason}`);

      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(socket.id);
        const remain = set.size;
        if (remain === 0) {
          onlineUsers.delete(userId);
        }
        log.info(
          `👤 ONLINE_REMOVE userId=${userId}, socketId=${socket.id}, remainSockets=${remain}`
        );
      }
    });
  });

  return io;
}

/**
 * 라우터 등에서 Socket.IO 인스턴스를 얻기 위한 함수
 */
function getIo() {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized');
  }
  return ioInstance;
}

module.exports = {
  initSocket,
  getIo,
  onlineUsers,
};
