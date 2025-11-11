// server.js
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
const fs = require('fs');
const path = require('path');

/* -------------------- IP & 기본설정 -------------------- */
const networkInterfaces = os.networkInterfaces();
const ipv4 = Object.values(networkInterfaces)
  .flat()
  .find(info => info.family === 'IPv4' && !info.internal)?.address || '127.0.0.1';

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const NGROK_ORIGIN = 'https://commensurately-preflagellate-merissa.ngrok-free.dev';

/* -------------------- CORS 허용 -------------------- */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174', 
  `http://${ipv4}:3000`,
  `http://${ipv4}:5173`,
  `http://${ipv4}:5174`,
  NGROK_ORIGIN
];

const NGROK_REGEXES = [
  /^https:\/\/[a-z0-9-]+\.ngrok\.app$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/i,
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return NGROK_REGEXES.some(r => r.test(origin));
};

const corsOptions = {
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'OPTIONS'],
};

/* -------------------- App & Socket 설정 -------------------- */
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) return cb(null, true);
      cb(new Error(`Not allowed by Socket.IO CORS: ${origin}`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['authorization', 'content-type'],
    credentials: true,
  },
});

app.set('trust proxy', true); 
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 
app.use(express.json());
app.use(requestLogger);

/* -------------------- users & rooms.json -------------------- */
const users = [];

const ROOMS_FILE = path.join(__dirname, 'rooms.json');

// 파일에서 rooms 불러오기
function loadRooms() {
  try {
    const data = fs.readFileSync(ROOMS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// 파일에 rooms 저장
function saveRooms(rooms) {
  fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2));
}

let rooms = loadRooms(); // ✅ 서버 시작 시 rooms.json 불러오기

/* -------------------- JWT 인증 -------------------- */
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

/* -------------------- REST API -------------------- */

// 헬스체크
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 회원가입
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { id: uuidv4(), username, password: hashedPassword };
    users.push(user);

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    log.user('REGISTER_SUCCESS', username, `- ID: ${user.id}`);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    log.error('Register Error', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 로그인
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    log.user('LOGIN_SUCCESS', username, `- ID: ${user.id}`);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    log.error('Login Error', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 방 목록 불러오기
app.get('/api/rooms', authenticateToken, (_req, res) => {
  res.json(rooms);
});

// 방 생성
app.post('/api/rooms', authenticateToken, (req, res) => {
  const { name } = req.body;
  const room = { id: uuidv4(), name, createdBy: req.user.userId };
  rooms.push(room);
  saveRooms(rooms); // ✅ 파일에 즉시 저장
  console.log('💾 rooms.json saved:', rooms.length);
  io.emit('room-created', room);
  res.json(room);
});
// 🔽 방 단건 조회 (이름 가져오기)
app.get('/api/rooms/:id', authenticateToken, (req, res) => {
  const room = rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room); // { id, name, createdBy }
});
/* -------------------- Socket.IO -------------------- */
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
  } catch (e) {
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
    log.connection('JOINED_ROOM', socket.id, `Room: ${roomId} / User: ${username}`);

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
    const { roomId, message, userId, username } = data;
    if (!roomId || !message) return;

    const msg = {
      id: uuidv4(),
      message,
      userId: userId || socket.user.userId,
      username: username || socket.user.username,
      timestamp: new Date().toISOString(),
    };

    socket.to(roomId).emit('receive-message', msg);
  });

  socket.on('disconnect', (reason) => {
    log.connection('DISCONNECTED', socket.id, `Reason: ${reason}`);
  });
});

/* -------------------- 에러 처리 및 시작 -------------------- */
app.use(errorHandler);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server on ${PORT}`);
  console.log('✅ Allowed origins:', ALLOWED_ORIGINS);
  console.log('✅ Rooms loaded:', rooms.length);
});
