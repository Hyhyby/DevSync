// socket.js (Socket.IO 설정 담당)
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET } = require('./config/network');
const { isAllowedOrigin } = require('./config/cors');
const { socketLogger, log } = require('./middleware/logger');
const { loadRooms, saveRooms } = require('./utils/room');

let rooms = loadRooms();

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

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers['authorization'] || '').split(' ')[1];

      if (!token) {
        socket.user = { userId: 'guest', username: 'Guest' };
        return next();
      }
      const user = jwt.verify(token, JWT_SECRET);
      socket.user = user;
      next();
    } catch {
      socket.user = { userId: 'guest', username: 'Guest' };
      next();
    }
  });

  io.on('connection', (socket) => {
    socketLogger(socket);
    const user = socket.user || { username: 'Unknown' };
    log.connection('CONNECTED', socket.id, `User: ${user.username}`);

    socket.on('join-room', (payload) => {
      const roomId = typeof payload === 'string' ? payload : payload?.roomId;
      const username = payload?.username || user.username;
      if (!roomId) return;

      const room = rooms.find(r => r.id === roomId);
      socket.emit('room-info', room || { id: roomId, name: roomId });
      socket.join(roomId);

      const systemMsg = {
        id: uuidv4(),
        message: `${username}님이 들어왔습니다.`,
        userId: 'system',
        username: 'System',
        timestamp: new Date().toISOString(),
        isSystem: true,
      };
      io.to(roomId).emit('receive-message', systemMsg);
    });

    socket.on('send-message', (data = {}) => {
      const { roomId, message } = data;
      if (!roomId || !message) return;

      const msg = {
        id: uuidv4(),
        message,
        userId: socket.user.userId,
        username: socket.user.username,
        timestamp: new Date().toISOString(),
      };

      io.to(roomId).emit('receive-message', msg);
    });

    socket.on('disconnect', (reason) => {
      log.connection('DISCONNECTED', socket.id, `Reason: ${reason}`);
    });
  });

  return io;
}

module.exports = { initSocket };
