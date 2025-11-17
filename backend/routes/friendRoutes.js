const express = require('express');
const pool = require('../config/db'); // PostgreSQL 연결
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// --- 친구 목록 조회 ---
router.get('/', authenticateToken, async (req, res) => {
  try {
    const myId = req.user.userId;
    const { rows } = await pool.query(
      `SELECT u.id, u.username
       FROM friendships f
       JOIN users u ON (u.id = CASE WHEN f.user1 = $1 THEN f.user2 ELSE f.user1 END)
       WHERE f.user1 = $1 OR f.user2 = $1`,
      [myId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '친구 목록 조회 실패' });
  }
});

// --- 친구 요청 전송 ---
router.post('/requests', authenticateToken, async (req, res) => {
  const fromId = req.user.userId;
  const { targetUsername } = req.body;

  try {
    // 1. 대상 유저 조회
    const userRes = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [targetUsername]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const toId = userRes.rows[0].id;

    // 2. 이미 친구인지 확인
    const friendshipRes = await pool.query(
      'SELECT 1 FROM friendships WHERE (user1 = $1 AND user2 = $2) OR (user1 = $2 AND user2 = $1)',
      [fromId, toId]
    );
    if (friendshipRes.rows.length > 0) return res.status(400).json({ error: '이미 친구입니다.' });

    // 3. 이미 요청 보냈는지 확인
    const requestRes = await pool.query(
      'SELECT 1 FROM friend_requests WHERE from_user = $1 AND to_user = $2 AND status = $3',
      [fromId, toId, 'pending']
    );
    if (requestRes.rows.length > 0) return res.status(400).json({ error: '이미 요청을 보냈습니다.' });

    // 4. 요청 저장
    const requestId = uuidv4();
    await pool.query(
      'INSERT INTO friend_requests(id, from_user, to_user, status) VALUES($1, $2, $3, $4)',
      [requestId, fromId, toId, 'pending']
    );

    res.json({ id: requestId, from: fromId, to: toId, status: 'pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '친구 요청 전송 실패' });
  }
});

// --- 받은/보낸 요청 조회 ---
router.get('/requests', authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  try {
    const receivedRes = await pool.query(
      `SELECT fr.id, fr.from_user, u.username as fromUsername, fr.status
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user
       WHERE fr.to_user = $1 AND fr.status = 'pending'`,
      [myId]
    );
    const sentRes = await pool.query(
      `SELECT fr.id, fr.to_user, u.username as toUsername, fr.status
       FROM friend_requests fr
       JOIN users u ON u.id = fr.to_user
       WHERE fr.from_user = $1 AND fr.status = 'pending'`,
      [myId]
    );

    res.json({ received: receivedRes.rows, sent: sentRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '친구 요청 조회 실패' });
  }
});

// --- 요청 수락 ---
router.post('/requests/:requestId/accept', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.requestId;

    const reqRes = await pool.query('SELECT * FROM friend_requests WHERE id = $1', [requestId]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const { from_user, to_user } = reqRes.rows[0];

    await pool.query('INSERT INTO friendships(user1, user2) VALUES($1, $2)', [from_user, to_user]);
    await pool.query('UPDATE friend_requests SET status = $1 WHERE id = $2', ['accepted', requestId]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '친구 요청 수락 실패' });
  }
});

// --- 요청 거절 ---
router.post('/requests/:requestId/decline', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.requestId;
    await pool.query('UPDATE friend_requests SET status = $1 WHERE id = $2', ['declined', requestId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '친구 요청 거절 실패' });
  }
});

// --- 친구 삭제 ---
router.delete('/:friendUserId', authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const friendId = req.params.friendUserId;
  try {
    await pool.query(
      'DELETE FROM friendships WHERE (user1 = $1 AND user2 = $2) OR (user1 = $2 AND user2 = $1)',
      [myId, friendId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '친구 삭제 실패' });
  }
});

// --- 사용자 검색 ---
router.get('/search', authenticateToken, async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username query required' });

  try {
    const result = await pool.query(
      'SELECT id, username FROM users WHERE username ILIKE $1',
      [`%${username}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '사용자 검색 실패' });
  }
});

module.exports = router;
