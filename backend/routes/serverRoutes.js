const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
let servers = [];

router.post('/', authenticateToken, (req, res) => {
  const { name, iconUrl } = req.body;
  const server = { id: uuidv4(), name, iconUrl, ownerId: req.user.userId };
  servers.push(server);
  res.json(server);
});

router.get('/', authenticateToken, (req, res) => {
  const myServers = servers.filter(s => s.ownerId === req.user.userId);
  res.json(myServers);
});

router.get('/:serverId', authenticateToken, (req, res) => {
  const server = servers.find(s => s.id === req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Not found' });
  res.json(server);
});

router.patch('/:serverId', authenticateToken, (req, res) => {
  const server = servers.find(s => s.id === req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Not found' });
  if (server.ownerId !== req.user.userId) return res.status(403).json({ error: 'No permission' });
  Object.assign(server, req.body);
  res.json(server);
});

router.delete('/:serverId', authenticateToken, (req, res) => {
  const server = servers.find(s => s.id === req.params.serverId);
  if (!server || server.ownerId !== req.user.userId)
    return res.status(403).json({ error: 'No permission' });
  servers = servers.filter(s => s.id !== req.params.serverId);
  res.json({ ok: true });
});

module.exports = router;
