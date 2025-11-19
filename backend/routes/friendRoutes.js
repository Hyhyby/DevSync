// routes/friendRoutes.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/db');
const { log } = require('../middleware/logger');

const router = express.Router();

/**
 * 친구 목록 가져오기
 * friends 테이블에서 status = 'accepted' 인 것만 반환
 * → [{ id, username }] 형태로 프론트에 전달
 */
router.get('/', authenticateToken, async (req, res) => {
  const myId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.username
      FROM friends f
      JOIN users u
        ON u.id = CASE 
                    WHEN f.user_index = $1 THEN f.friend_index
                    ELSE f.user_index
                  END
      WHERE 
        (f.user_index = $1 OR f.friend_index = $1)
        AND f.status = 'accepted'
      `,
      [myId]
    );

    // 프론트는 friends.map(friend => friend.id, friend.username) 사용 중
    res.json(result.rows);
  } catch (err) {
    log.error('GET_FRIENDS_ERROR', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * 친구 요청 보내기
 * 프론트: POST /api/friends/request
 * body: { identifier }  // username
 * (추가로 { targetUserId }도 지원 가능)
 */
router.post('/request', authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const { identifier, targetUserId } = req.body;

  // identifier도 없고 targetUserId도 없으면 에러
  if (!identifier && !targetUserId) {
    return res
      .status(400)
      .json({ error: '아이디를 입력해 주세요. (identifier 또는 targetUserId 필요)' });
  }

  try {
    let targetUser = null;

    if (targetUserId) {
      // 숫자 ID로 직접 찾는 경우 (확장용)
      const userCheck = await pool.query(
        'SELECT id, username FROM users WHERE id = $1',
        [targetUserId]
      );
      if (userCheck.rowCount === 0) {
        return res.status(404).json({ error: '해당 유저를 찾을 수 없습니다.' });
      }
      targetUser = userCheck.rows[0];
    } else {
      // identifier로 username 검색 (지금 Friends.jsx에서 사용하는 방식)
      const userCheck = await pool.query(
        'SELECT id, username FROM users WHERE username = $1',
        [identifier]
      );
      if (userCheck.rowCount === 0) {
        return res.status(404).json({ error: '존재하지 않는 아이디입니다.' });
      }
      targetUser = userCheck.rows[0];
    }

    if (Number(targetUser.id) === Number(myId)) {
      return res
        .status(400)
        .json({ error: '자기 자신에게는 친구 요청을 보낼 수 없습니다.' });
    }

    // 이미 친구/요청 관계인지 확인
    const existing = await pool.query(
      `
      SELECT *
      FROM friends
      WHERE 
        (user_index = $1 AND friend_index = $2)
        OR
        (user_index = $2 AND friend_index = $1)
      `,
      [myId, targetUser.id]
    );

    if (existing.rowCount > 0) {
      const row = existing.rows[0];
      if (row.status === 'pending') {
        return res.status(400).json({ error: '이미 친구 요청이 진행 중입니다.' });
      }
      if (row.status === 'accepted') {
        return res.status(400).json({ error: '이미 친구입니다.' });
      }
    }

    // 친구 요청 생성 (pending)
    const insert = await pool.query(
      `
      INSERT INTO friends (user_index, friend_index, status)
      VALUES ($1, $2, 'pending')
      RETURNING user_index, friend_index, status, created_at
      `,
      [myId, targetUser.id]
    );

    res.status(201).json({
      targetUser,        // 프론트에서 메시지에 사용
      request: insert.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: '이미 친구 관계(또는 요청)가 존재합니다.' });
    }

    log.error('FRIEND_REQUEST_ERROR', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * 내가 받은 / 보낸 친구 요청 목록
 */
router.get('/requests', authenticateToken, async (req, res) => {
  const myId = req.user.userId;

  try {
    const received = await pool.query(
      `
      SELECT f.user_index AS from_user_id, u.username AS from_username, f.created_at
      FROM friends f
      JOIN users u ON f.user_index = u.id
      WHERE f.friend_index = $1 AND f.status = 'pending'
      `,
      [myId]
    );

    const sent = await pool.query(
      `
      SELECT f.friend_index AS to_user_id, u.username AS to_username, f.created_at
      FROM friends f
      JOIN users u ON f.friend_index = u.id
      WHERE f.user_index = $1 AND f.status = 'pending'
      `,
      [myId]
    );

    res.json({
      received: received.rows,
      sent: sent.rows,
    });
  } catch (err) {
    log.error('GET_REQUESTS_ERROR', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * 친구 요청 수락
 * body: { fromUserId }
 */
router.post('/requests/accept', authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const { fromUserId } = req.body;

  if (!fromUserId) {
    return res.status(400).json({ error: 'fromUserId is required' });
  }

  try {
    const result = await pool.query(
      `
      UPDATE friends
      SET status = 'accepted'
      WHERE user_index = $1 AND friend_index = $2 AND status = 'pending'
      RETURNING *
      `,
      [fromUserId, myId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '해당 친구 요청을 찾을 수 없습니다.' });
    }

    res.json({ ok: true, friend: result.rows[0] });
  } catch (err) {
    log.error('ACCEPT_REQUEST_ERROR', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * 친구 삭제
 */
router.delete('/:friendUserId', authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const friendId = req.params.friendUserId;

  try {
    const result = await pool.query(
      `
      DELETE FROM friends
      WHERE 
        (user_index = $1 AND friend_index = $2)
        OR
        (user_index = $2 AND friend_index = $1)
      `,
      [myId, friendId]
    );

    res.json({ ok: true, deleted: result.rowCount });
  } catch (err) {
    log.error('DELETE_FRIEND_ERROR', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;