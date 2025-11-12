const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let dms = [];       // { id, userIds }
let dmMessages = []; // { id, dmId, userId, content, timestamp }

router.post('/dms', authenticateToken, (req, res) => {
  const { userIds } = req.body;
  const participants = [...new Set([req.user.userId, ...userIds])];
  let dm = dms.find(d => d.userIds.sort().join(',') === participants.sort().join(','));
  if (!dm) {
    dm = { id: uuidv4(), userIds: participants };
    dms.push(dm);
  }
  res.json({ dmId: dm.id });
});

router.get('/dms', authenticateToken, (req, res) => {
  const myDms = dms.filter(d => d.userIds.includes(req.user.userId));
  res.json(myDms);
});

router.get('/dms/:dmId/messages', authenticateToken, (req, res) => {
  const { limit = 50, before } = req.query;
  const filtered = dmMessages
    .filter(m => m.dmId === req.params.dmId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const start = before ? filtered.findIndex(m => m.id === before) + 1 : 0;
  res.json(filtered.slice(start, start + Number(limit)));
});

router.post('/dms/:dmId/messages', authenticateToken, (req, res) => {
  const { content, attachments } = req.body;
  const msg = {
    id: uuidv4(),
    dmId: req.params.dmId,
    userId: req.user.userId,
    username: req.user.username,
    content,
    attachments: attachments || [],
    timestamp: new Date().toISOString(),
  };
  dmMessages.push(msg);
  res.json(msg);
});

module.exports = router;
