const express = require('express');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/* ------------------------------
   1. 친구 목록 조회
------------------------------ */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const myId = req.user.userId;

    const { rows } = await pool.query(
      `SELECT u.id, u.username
       FROM friendships f
       JOIN users u 
         ON u.id = CASE 
                     WHEN f.user1 = $1 THEN f.user2 
                     ELSE f.user1 
                   END
       WHERE f.user1 = $1 OR f.user2 = $1`,
      [myId]
    );

    res.json(rows);
  } catch (err) {
    console.error('친구 목록 조회 실패', err);
    res.status(500).json({ error: '친구 목록 조회 실패' });
  }
});

/* ------------------------------
   2. 친구 요청 전송 (username 기반)
------------------------------ */
// POST /friends/add
router.post('/add', async (req, res) => {
  const { requesterId } = req.body;  // 로그인된 유저 id
  const { friendName } = req.body;   // 추가하려는 친구의 username

  try {
    // 1. 친구 username 존재 여부 확인
    const userCheck = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      [friendName]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: '해당 닉네임을 가진 유저가 없습니다.' });
    }

    const friendId = userCheck.rows[0].id;

    // 2. 자기 자신 추가 방지
    if (friendId === requesterId) {
      return res.status(400).json({ error: '자기 자신은 친구로 추가할 수 없습니다.' });
    }

    // 3. 이미 친구인지 확인
    const friendCheck = await pool.query(
      `SELECT * FROM friends 
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [requesterId, friendId]
    );

    if (friendCheck.rows.length > 0) {
      return res.status(400).json({ error: '이미 친구입니다.' });
    }

    // 4. 친구 추가
    const newFriend = await pool.query(
      `INSERT INTO friends (user_id, friend_id)
       VALUES ($1, $2)
       RETURNING id, user_id, friend_id`,
      [requesterId, friendId]
    );

    return res.status(200).json({
      message: '친구 추가 완료',
      friend: {
        id: friendId,
        username: userCheck.rows[0].username
      }
    });
  } catch (err) {
    console.error('친구 추가 오류:', err);
    return res.status(500).json({ error: '서버 오류 발생' });
  }
});


/* ------------------------------
   3. 받은/보낸 요청 조회
------------------------------ */
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT u.id, u.username
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1`,
      [userId]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('친구 목록 조회 오류:', err);
    return res.status(500).json({ error: '서버 오류 발생' });
  }
});


/* ------------------------------
   4. 친구 요청 수락
------------------------------ */
router.post('/requests/:id/accept', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    const reqData = await pool.query(
      'SELECT * FROM friend_requests WHERE id = $1',
      [requestId]
    );

    if (reqData.rows.length === 0)
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });

    const { from_user, to_user } = reqData.rows[0];

    // 친구 관계 생성
    await pool.query(
      'INSERT INTO friendships (user1, user2) VALUES ($1, $2)',
      [from_user, to_user]
    );

    // 요청 상태 변경
    await pool.query(
      'UPDATE friend_requests SET status = $1 WHERE id = $2',
      ['accepted', requestId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('친구 요청 수락 실패', err);
    res.status(500).json({ error: '친구 요청 수락 실패' });
  }
});

/* ------------------------------
   5. 친구 요청 거절
------------------------------ */
router.post('/requests/:id/decline', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    await pool.query(
      'UPDATE friend_requests SET status = $1 WHERE id = $2',
      ['declined', requestId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('친구 요청 거절 실패', err);
    res.status(500).json({ error: '친구 요청 거절 실패' });
  }
});

/* ------------------------------
   6. 친구 삭제
------------------------------ */
router.delete('/:friendId', authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const friendId = req.params.friendId;

  try {
    await pool.query(
      `DELETE FROM friendships
       WHERE (user1 = $1 AND user2 = $2)
          OR (user1 = $2 AND user2 = $1)`,
      [myId, friendId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('친구 삭제 실패', err);
    res.status(500).json({ error: '친구 삭제 실패' });
  }
});

/* ------------------------------
   7. 사용자 검색 (LIKE)
------------------------------ */
router.get('/search', authenticateToken, async (req, res) => {
  const { username } = req.query;

  if (!username)
    return res.status(400).json({ error: 'username query required' });

  try {
    const result = await pool.query(
      `SELECT id, username 
       FROM users 
       WHERE username ILIKE $1`,
      [`%${username}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('사용자 검색 실패', err);
    res.status(500).json({ error: '사용자 검색 실패' });
  }
});

module.exports = router;
