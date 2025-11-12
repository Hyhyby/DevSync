const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
let users = [];

router.get('/search', authenticateToken, (req, res) => {
  const { q = '', limit = 20 } = req.query;
  const result = users
    .filter(u =>
      u.username.toLowerCase().includes(q.toLowerCase()) ||
      u.email?.toLowerCase().includes(q.toLowerCase())
    )
    .slice(0, limit);
  res.json(result);
});

router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username });
});

module.exports = router;
