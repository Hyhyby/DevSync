// app.js (Express 설정 담당)
const express = require('express');
const cors = require('cors');
const { corsOptions } = require('./config/cors');
const { requestLogger, errorHandler } = require('./middleware/logger');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const serverRoutes = require('./routes/serverRoutes');
const channelRoutes = require('./routes/channelRoutes');
const messageRoutes = require('./routes/messageRoutes');
const dmRoutes = require('./routes/dmRoutes');

const app = express();

app.set('trust proxy', true);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(requestLogger);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/:serverId/channels', channelRoutes);
app.use('/api/:serverId/messages', messageRoutes);
app.use('/api/:serverId/dm', dmRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use(errorHandler);

module.exports = app;
