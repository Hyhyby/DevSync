const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let users = [];
let refreshTokens = [];

const JWT_SECRET = process.env.JWT_SECRET || 'access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

/* --- Helper functions --- */
const generateAccessToken = (user) =>
  jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '15m' });

const generateRefreshToken = (user) => {
  const token = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  refreshTokens.push(token);
  return token;
};

/* --- Register --- */
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (users.some(u => u.email === email))
    return res.status(400).json({ error: 'Email already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), username, email, password: hashed };
  users.push(user);

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  res.json({ accessToken, refreshToken, user: { id: user.id, username, email } });
});

/* --- Login --- */
router.post('/login', async (req, res) => {
  const { email, username, password } = req.body;
  const user = users.find(u => u.email === email || u.username === username);
  if (!user) return res.status(400).json({ error: 'User not found' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid password' });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  res.json({ accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email } });
});

/* --- Refresh Token --- */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || !refreshTokens.includes(refreshToken))
    return res.status(403).json({ error: 'Invalid refresh token' });

  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Expired refresh token' });
    const newAccess = generateAccessToken(user);
    res.json({ accessToken: newAccess });
  });
});

/* --- Logout --- */
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  refreshTokens = refreshTokens.filter(t => t !== refreshToken);
  res.json({ ok: true });
});

/* --- Get Me --- */
router.get('/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, email: user.email });
});

module.exports = router;
