const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

let friendRequests = [];
let friendships = [];

router.get('/', authenticateToken, (req, res) => {
  const myId = req.user.userId;
  const myFriends = friendships
    .filter(f => f.user1 === myId || f.user2 === myId)
    .map(f => (f.user1 === myId ? f.user2 : f.user1));
  res.json(myFriends);
});

router.post('/requests', authenticateToken, (req, res) => {
  const request = {
    id: uuidv4(),
    from: req.user.userId,
    to: req.body.targetUserId,
    status: 'pending',
  };
  friendRequests.push(request);
  res.json(request);
});

router.get('/requests', authenticateToken, (req, res) => {
  const myId = req.user.userId;
  const received = friendRequests.filter(r => r.to === myId);
  const sent = friendRequests.filter(r => r.from === myId);
  res.json({ received, sent });
});

router.post('/requests/:requestId/accept', authenticateToken, (req, res) => {
  const request = friendRequests.find(r => r.id === req.params.requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  friendships.push({ user1: request.from, user2: request.to });
  friendRequests = friendRequests.filter(r => r.id !== request.id);
  res.json({ ok: true });
});

router.post('/requests/:requestId/decline', authenticateToken, (req, res) => {
  friendRequests = friendRequests.filter(r => r.id !== req.params.requestId);
  res.json({ ok: true });
});

router.delete('/:friendUserId', authenticateToken, (req, res) => {
  const myId = req.user.userId;
  friendships = friendships.filter(
    f => !(
      (f.user1 === myId && f.user2 === req.params.friendUserId) ||
      (f.user2 === myId && f.user1 === req.params.friendUserId)
    )
  );
  res.json({ ok: true });
});

module.exports = router;
