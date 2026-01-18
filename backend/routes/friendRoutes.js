// routes/friendRoutes.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const pool = require("../config/db");
const { log } = require("../middleware/logger");
const { getIo, onlineUsers } = require("../socket");

const router = express.Router();

/**
 * 1) 친구 요청 보내기
 *    POST /api/friends/request
 *    body: { identifier }  // username
 */
router.post("/request", authenticateToken, async (req, res) => {
  console.log("📩 /request BODY:", req.body);
  const myId = req.user.userId;
  const { identifier, targetUserId } = req.body;

  if (!identifier && !targetUserId) {
    return res.status(400).json({
      error: "아이디를 입력해 주세요. (identifier 또는 targetUserId 필요)",
    });
  }

  try {
    let targetUser = null;

    if (targetUserId) {
      // ✅ profile_image_url 포함
      const userCheck = await pool.query(
        "SELECT id, username, profile_image_url FROM users WHERE id = $1",
        [targetUserId]
      );
      if (userCheck.rowCount === 0) {
        return res.status(404).json({ error: "해당 유저를 찾을 수 없습니다." });
      }
      targetUser = userCheck.rows[0];
    } else {
      // ✅ profile_image_url 포함
      const userCheck = await pool.query(
        "SELECT id, username, profile_image_url FROM users WHERE username = $1",
        [identifier]
      );
      if (userCheck.rowCount === 0) {
        return res.status(404).json({ error: "존재하지 않는 아이디입니다." });
      }
      targetUser = userCheck.rows[0];
    }

    if (Number(targetUser.id) === Number(myId)) {
      return res
        .status(400)
        .json({ error: "자기 자신에게는 친구 요청을 보낼 수 없습니다." });
    }

    // 이미 관계 확인
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
      if (row.status === "pending") {
        return res
          .status(400)
          .json({ error: "이미 친구 요청이 진행 중입니다." });
      }
      if (row.status === "accepted") {
        return res.status(400).json({ error: "이미 친구입니다." });
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
    const requestRow = insert.rows[0];

    // 1) HTTP 응답
    res.status(201).json({
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        profileImage: targetUser.profile_image_url, // ✅ 프론트에서 바로 쓰기 좋게
      },
      request: requestRow,
    });

    // 2) 소켓으로 알림 보내기 (상대방이 온라인이면)
    try {
      const io = getIo();

      // ✅ sender도 profile_image_url 포함
      const senderResult = await pool.query(
        "SELECT id, username, profile_image_url FROM users WHERE id = $1",
        [myId]
      );
      const sender = senderResult.rows[0];

      const sockets = onlineUsers.get(targetUser.id);
      if (sockets && sockets.size > 0) {
        const payload = {
          from_user_id: sender.id,
          from_username: sender.username,
          from_profile_image: sender.profile_image_url, // ✅ 추가
          created_at: requestRow.created_at,
        };

        for (const socketId of sockets) {
          io.to(socketId).emit("friend-request", payload);
        }

        log.info(
          `📨 FRIEND_REQUEST_EMIT from ${sender.username} to userId=${targetUser.id}`
        );
      }
    } catch (socketErr) {
      log.error("FRIEND_REQUEST_SOCKET_ERROR", socketErr);
    }
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "이미 친구 관계(또는 요청)가 존재합니다." });
    }

    log.error("FRIEND_REQUEST_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 2) 친구 목록 조회
 *    GET /api/friends
 *    응답: [ { id, username, profile_image_url(or profileImage) }, ... ]
 */
router.get("/", authenticateToken, async (req, res) => {
  const myId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.username,
        u.profile_image_url
      FROM friends f
      JOIN users u
        ON (
             u.id = f.user_index AND f.friend_index = $1
           )
        OR (
             u.id = f.friend_index AND f.user_index = $1
           )
      WHERE f.status = 'accepted'
      ORDER BY u.username
      `,
      [myId]
    );

    // ✅ 프론트가 friend.profileImage로 쓰기 쉽게 변환
    const friends = result.rows.map((r) => ({
      id: r.id,
      username: r.username,
      profileImage: r.profile_image_url,
    }));

    res.json(friends);
  } catch (err) {
    log.error("GET_FRIENDS_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 3) 친구 요청 목록 조회 (받은/보낸)
 *    GET /api/friends/requests
 *    응답: { received: [...], sent: [...] }
 */
router.get("/requests", authenticateToken, async (req, res) => {
  const myId = req.user.userId;

  try {
    // 내가 받은 친구 요청 (상대가 나한테 보냄)
    const receivedResult = await pool.query(
      `
      SELECT
        f.user_index AS from_user_id,
        u.username   AS from_username,
        u.profile_image_url AS from_profile_image,
        f.created_at
      FROM friends f
      JOIN users u ON u.id = f.user_index
      WHERE f.friend_index = $1
        AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `,
      [myId]
    );

    // 내가 보낸 친구 요청
    const sentResult = await pool.query(
      `
      SELECT
        f.friend_index AS to_user_id,
        u.username     AS to_username,
        u.profile_image_url AS to_profile_image,
        f.created_at
      FROM friends f
      JOIN users u ON u.id = f.friend_index
      WHERE f.user_index = $1
        AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `,
      [myId]
    );

    // ✅ profileImage로 내려주기
    res.json({
      received: receivedResult.rows.map((r) => ({
        from_user_id: r.from_user_id,
        from_username: r.from_username,
        profileImage: r.from_profile_image,
        created_at: r.created_at,
      })),
      sent: sentResult.rows.map((r) => ({
        to_user_id: r.to_user_id,
        to_username: r.to_username,
        profileImage: r.to_profile_image,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    log.error("GET_FRIEND_REQUESTS_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 4) 친구 요청 수락
 *    POST /api/friends/requests/accept
 *    body: { fromUserId }
 */
router.post("/requests/accept", authenticateToken, async (req, res) => {
  const myId = req.user.userId; // 수락한 사람
  const { fromUserId } = req.body; // 요청 보낸 사람

  if (!fromUserId) {
    return res.status(400).json({ error: "fromUserId가 필요합니다." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE friends
      SET status = 'accepted'
      WHERE user_index = $1
        AND friend_index = $2
        AND status = 'pending'
      RETURNING *
      `,
      [fromUserId, myId]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "해당 친구 요청을 찾을 수 없습니다." });
    }

    log.info(`FRIEND_REQUEST_ACCEPT: from=${fromUserId}, to=${myId}`);

    // ⚠️ 1) HTTP 응답 먼저 보내기
    res.json({ ok: true });

    // ⚠️ 2) 이제 두 유저 모두에게 friend-accepted 소켓 이벤트 보내기
    try {
      const io = getIo();

      const payload = {
        fromUserId, // 요청 보낸 사람
        toUserId: myId, // 수락한 사람
      };

      // 요청 보낸 사람에게 보내기 (A)
      const socketsOfFrom = onlineUsers.get(fromUserId);
      if (socketsOfFrom && socketsOfFrom.size > 0) {
        for (const sid of socketsOfFrom) {
          io.to(sid).emit("friend-accepted", payload);
        }
      }

      // 수락한 사람에게도 보내기 (B)
      const socketsOfMe = onlineUsers.get(myId);
      if (socketsOfMe && socketsOfMe.size > 0) {
        for (const sid of socketsOfMe) {
          io.to(sid).emit("friend-accepted", payload);
        }
      }

      log.info(
        `FRIEND_ACCEPT_EMIT to both users: fromUserId=${fromUserId}, toUserId=${myId}`
      );
    } catch (socketErr) {
      log.error("FRIEND_ACCEPT_SOCKET_ERROR", socketErr);
    }
  } catch (err) {
    log.error("ACCEPT_FRIEND_REQUEST_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 5) 친구 요청 거절
 *    POST /api/friends/requests/decline
 *    body: { fromUserId }
 */
router.post("/requests/decline", authenticateToken, async (req, res) => {
  const myId = req.user.userId; // 거절하는 사람 (나)
  const { fromUserId } = req.body; // 요청 보낸 사람

  if (!fromUserId) {
    return res.status(400).json({ error: "fromUserId가 필요합니다." });
  }

  try {
    // pending 상태인 요청만 삭제
    const result = await pool.query(
      `
      DELETE FROM friends
      WHERE user_index = $1
        AND friend_index = $2
        AND status = 'pending'
      RETURNING *
      `,
      [fromUserId, myId]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "해당 친구 요청을 찾을 수 없습니다." });
    }

    log.info(`FRIEND_REQUEST_DECLINE: from=${fromUserId}, to=${myId}`);

    // 1) HTTP 응답
    res.json({ ok: true });

    // 2) 소켓으로 "거절됨" 알림 보내기 (요청 보낸 쪽 → 보낸 목록에서 제거)
    try {
      const io = getIo();

      const payload = {
        fromUserId, // 요청 보낸 사람
        toUserId: myId, // 거절한 사람
      };

      const socketsOfFrom = onlineUsers.get(fromUserId);
      if (socketsOfFrom && socketsOfFrom.size > 0) {
        for (const sid of socketsOfFrom) {
          io.to(sid).emit("friend-declined", payload);
        }
      }

      log.info(
        `FRIEND_DECLINE_EMIT: fromUserId=${fromUserId}, toUserId=${myId}`
      );
    } catch (socketErr) {
      log.error("FRIEND_DECLINE_SOCKET_ERROR", socketErr);
    }
  } catch (err) {
    log.error("DECLINE_FRIEND_REQUEST_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
