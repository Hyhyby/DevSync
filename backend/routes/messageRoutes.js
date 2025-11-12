const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
let messages = [];

router.get('/channels/:channelId/messages', authenticateToken, (req, res) => {
  const { limit = 50, before } = req.query;
  const filtered = messages
    .filter(m => m.channelId === req.params.channelId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const startIndex = before ? filtered.findIndex(m => m.id === before) + 1 : 0;
  res.json(filtered.slice(startIndex, startIndex + Number(limit)));
});

router.post('/channels/:channelId/messages', authenticateToken, (req, res) => {
  const { content, attachments } = req.body;
  const msg = {
    id: uuidv4(),
    channelId: req.params.channelId,
    userId: req.user.userId,
    username: req.user.username,
    content,
    attachments: attachments || [],
    timestamp: new Date().toISOString(),
  };
  messages.push(msg);
  res.json(msg);
});

router.patch('/messages/:messageId', authenticateToken, (req, res) => {
  const msg = messages.find(m => m.id === req.params.messageId);
  if (!msg) return res.status(404).json({ error: 'Not found' });
  if (msg.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  msg.content = req.body.content;
  res.json(msg);
});

router.delete('/messages/:messageId', authenticateToken, (req, res) => {
  const msg = messages.find(m => m.id === req.params.messageId);
  if (!msg) return res.status(404).json({ error: 'Not found' });
  if (msg.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  messages = messages.filter(m => m.id !== msg.id);
  res.json({ ok: true });
});

module.exports = router;
