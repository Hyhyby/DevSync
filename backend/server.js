const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { log, requestLogger, socketLogger, errorHandler } = require('./middleware/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "file://"], // 웹 + Electron 지원
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// In-memory room storage
// { roomName: [ { id: socket.id, nickname } ] }
const rooms = {};

// ✅ 방 목록 조회
app.get('/api/rooms', (req, res) => {
  const roomList = Object.keys(rooms).map(roomName => ({
    name: roomName,
    participants: rooms[roomName].length
  }));
  res.json(roomList);
});

// ✅ 방 생성 (중복 이름 방지)
app.post('/api/rooms', (req, res) => {
  const { name } = req.body;
  if (rooms[name]) return res.status(400).json({ error: 'Room already exists' });
  rooms[name] = [];
  log.info(`Room created: ${name}`);
  res.json({ name });
});

// ✅ Socket.io 통신 (채팅 전용)
io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);
  socketLogger(socket);

  // 방 참가
  socket.on("join room", ({ roomName, nickname }) => {
    socket.join(roomName);
    if (!rooms[roomName]) rooms[roomName] = [];
    rooms[roomName].push({ id: socket.id, nickname });

    console.log(`${nickname} (${socket.id}) joined room: ${roomName}`);
    io.to(roomName).emit("system message", `${nickname} joined the room`);
    io.to(roomName).emit("room users", rooms[roomName].map(u => u.nickname));
  });

  // 채팅 메시지 송신
  socket.on("chat message", ({ roomName, message }) => {
    const user = rooms[roomName]?.find(u => u.id === socket.id);
    if (user) {
      console.log(`[${roomName}] ${user.nickname}: ${message}`);
      io.to(roomName).emit("chat message", { nickname: user.nickname, message });
    }
  });

  // 방 나가기
  socket.on("leave room", (roomName) => {
    const userIndex = rooms[roomName]?.findIndex(u => u.id === socket.id);
    if (userIndex !== undefined && userIndex !== -1) {
      const user = rooms[roomName][userIndex];
      rooms[roomName].splice(userIndex, 1);
      io.to(roomName).emit("system message", `${user.nickname} left the room`);
      io.to(roomName).emit("room users", rooms[roomName].map(u => u.nickname));
      if (rooms[roomName].length === 0) delete rooms[roomName];
    }
    socket.leave(roomName);
  });

  // 연결 종료
  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
    for (const roomName in rooms) {
      const userIndex = rooms[roomName]?.findIndex(u => u.id === socket.id);
      if (userIndex !== undefined && userIndex !== -1) {
        const user = rooms[roomName][userIndex];
        rooms[roomName].splice(userIndex, 1);
        io.to(roomName).emit("system message", `${user.nickname} disconnected`);
        io.to(roomName).emit("room users", rooms[roomName].map(u => u.nickname));
        if (rooms[roomName].length === 0) delete rooms[roomName];
      }
    }
  });
});

// 오류 처리 미들웨어
app.use(errorHandler);

// 서버 실행
server.listen(PORT, () => {
  console.log(`🚀 Chat server running on port ${PORT}`);
  log.access(`Server started on port ${PORT}`);
});
