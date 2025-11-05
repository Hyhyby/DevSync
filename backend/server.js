const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { log, requestLogger, socketLogger, errorHandler } = require('./middleware/logger');
require('dotenv').config();
const os = require('os');

const networkInterfaces = os.networkInterfaces();
const ipv4 = Object.values(networkInterfaces)
  .flat()
  .find(info => info.family === 'IPv4' && !info.internal)?.address || '127.0.0.1';

const ALLOWED_ORIGINS = [
  `http://localhost:3000`,
  `http://localhost:5173`,
  `http://${ipv4}:3000`,
  `http://${ipv4}:5173`,
];
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));
app.use(express.json());
app.use(requestLogger); // 요청 로깅 미들웨어 추가

// In-memory storage (replace with database in production)
const users = [];
const rooms = [];

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user already exists
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      log.user('REGISTER_FAILED', username, '- User already exists');
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      id: uuidv4(),
      username,
      password: hashedPassword
    };
    
    users.push(user);
    
    // Generate JWT
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    
    log.user('REGISTER_SUCCESS', username, `- ID: ${user.id}`);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    log.error('Register Error', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = users.find(u => u.username === username);
    if (!user) {
      log.user('LOGIN_FAILED', username, '- User not found');
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      log.user('LOGIN_FAILED', username, '- Invalid password');
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    
    log.user('LOGIN_SUCCESS', username, `- ID: ${user.id}`);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    log.error('Login Error', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rooms', authenticateToken, (req, res) => {
  res.json(rooms);
});

app.post('/api/rooms', authenticateToken, (req, res) => {
  const { name } = req.body;
  const room = {
    id: uuidv4(),
    name,
    createdBy: req.user.userId
  };
  rooms.push(room);
  io.emit('room-created', room);
  res.json(room);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  socketLogger(socket); // 소켓 로깅 추가
  
  socket.on('join-room', (payload) => {
    const roomId = typeof payload === 'string' ? payload : payload?.roomId;
    const username = typeof payload === 'string' ? '알 수 없음' : payload?.username || '알 수 없음';
    if (!roomId) return;

    socket.join(roomId);
    log.connection('JOINED_ROOM', socket.id, `Room: ${roomId} / User: ${username}`);

    // 시스템 알림 메시지 (같은 receive-message 채널 사용)
    const systemMsg = {
      id: uuidv4(),
      message: `${username}님이 들어왔습니다.`,
      userId: 'system',
      username: 'System',
      timestamp: new Date(),
      isSystem: true
    };
    io.to(roomId).emit('receive-message', systemMsg);
  });

  socket.on('send-message', (data) => {
    const message = {
      id: uuidv4(),
      message: data.message,   // ✅ message로 통일
      userId: data.userId,
      username: data.username,
      timestamp: new Date()
    };
    
    log.access(`MESSAGE_SENT - User: ${data.username}, Room: ${data.roomId}, Message: ${data.message.substring(0, 50)}...`);
    socket.to(data.roomId).emit('receive-message', message);
  });

  socket.on('webrtc-signal', (data) => {
    log.connection('WEBRTC_SIGNAL', socket.id, `Room: ${data.roomId}`);
    socket.to(data.roomId).emit('webrtc-signal', {
      signal: data.signal,
      from: socket.id
    });
  });

  socket.on('disconnect', (reason) => {
    log.connection('DISCONNECTED', socket.id, `Reason: ${reason}`);
  });
});

// 오류 처리 미들웨어 추가
app.use(errorHandler);
// server.js
server.listen(PORT, '0.0.0.0', () => console.log(`Server on ${PORT}`));

