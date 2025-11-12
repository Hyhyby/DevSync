const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

let channels = [];

router.post('/servers/:serverId/channels', authenticateToken, (req, res) => {
  const { name, type } = req.body;
  const channel = { id: uuidv4(), serverId: req.params.serverId, name, type, topic: '' };
  channels.push(channel);
  res.json(channel);
});

router.get('/servers/:serverId/channels', authenticateToken, (req, res) => {
  const result = channels.filter(c => c.serverId === req.params.serverId);
  res.json(result);
});

router.get('/channels/:channelId', authenticateToken, (req, res) => {
  const channel = channels.find(c => c.id === req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Not found' });
  res.json(channel);
});

router.patch('/channels/:channelId', authenticateToken, (req, res) => {
  const channel = channels.find(c => c.id === req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Not found' });
  Object.assign(channel, req.body);
  res.json(channel);
});

router.delete('/channels/:channelId', authenticateToken, (req, res) => {
  channels = channels.filter(c => c.id !== req.params.channelId);
  res.json({ ok: true });
});

module.exports = router;
