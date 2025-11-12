// routes/authRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/db'); // PostgreSQL Pool
const { authenticateToken } = require('../middleware/auth');
const { log } = require('../middleware/logger');

const router = express.Router();

// 🔑 환경변수 기본값
const JWT_SECRET = process.env.JWT_SECRET || 'access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

let refreshTokens = [];

/* -------------------- Helper functions -------------------- */
const generateAccessToken = (user) =>
  jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '15m' });

const generateRefreshToken = (user) => {
  const token = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  refreshTokens.push(token);
  return token;
};

/* -------------------- Register -------------------- */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });

    // DB에서 중복 확인
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0)
      return res.status(400).json({ error: 'Username already exists' });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashed]
    );

    const user = newUser.rows[0];
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    log.user('REGISTER_SUCCESS', username, `- ID: ${user.id}`);
    res.json({ accessToken, refreshToken, user });
  } catch (err) {
    log.error('REGISTER_ERROR', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------- Login -------------------- */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });

    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'User not found' });

    const user = userResult.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    log.user('LOGIN_SUCCESS', username, `- ID: ${user.id}`);
    res.json({ accessToken, refreshToken, user: { id: user.id, username: user.username } });
  } catch (err) {
    log.error('LOGIN_ERROR', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------- Refresh Token -------------------- */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || !refreshTokens.includes(refreshToken))
    return res.status(403).json({ error: 'Invalid refresh token' });

  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Expired or invalid refresh token' });
    const newAccess = generateAccessToken(user);
    res.json({ accessToken: newAccess });
  });
});

/* -------------------- Logout -------------------- */
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  refreshTokens = refreshTokens.filter(t => t !== refreshToken);
  res.json({ ok: true });
});

/* -------------------- Get Me -------------------- */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(userResult.rows[0]);
  } catch (err) {
    log.error('GET_ME_ERROR', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
