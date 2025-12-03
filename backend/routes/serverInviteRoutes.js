// routes/serverInviteRoutes.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const pool = require("../config/db");
const { getIo, onlineUsers } = require("../socket");
const router = express.Router();

/**
 * (1) 서버 초대 보내기
 * POST /api/servers/:serverId/invites
 */
router.post("/:serverId/invites", authenticateToken, async (req, res) => {
  const serverId = Number(req.params.serverId);
  const fromUserId = req.user.userId;
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: "targetUserId가 필요합니다." });
  }

  try {
    // 1) 서버 멤버 여부 확인
    const memberCheck = await pool.query(
      `
      SELECT role FROM server_members
      WHERE server_id = $1 AND user_id = $2
      `,
      [serverId, fromUserId]
    );
    if (memberCheck.rowCount === 0) {
      return res.status(403).json({ error: "이 서버의 멤버가 아닙니다." });
    }

    // 2) 타겟이 이미 멤버인지 확인
    const existingMember = await pool.query(
      `
      SELECT 1 FROM server_members
      WHERE server_id = $1 AND user_id = $2
      `,
      [serverId, targetUserId]
    );
    if (existingMember.rowCount > 0) {
      return res.status(400).json({ error: "이미 서버 멤버입니다." });
    }

    // 3) 이미 pending 초대가 있는지 확인
    const existingInvite = await pool.query(
      `
      SELECT 1 FROM server_invites
      WHERE server_id = $1
        AND from_user_id = $2
        AND to_user_id = $3
        AND status = 'pending'
      `,
      [serverId, fromUserId, targetUserId]
    );
    if (existingInvite.rowCount > 0) {
      return res.status(400).json({ error: "이미 초대가 진행 중입니다." });
    }

    // 4) 초대 생성
    const insert = await pool.query(
      `
      INSERT INTO server_invites (server_id, from_user_id, to_user_id)
      VALUES ($1, $2, $3)
      RETURNING id, server_id, from_user_id, to_user_id, status, created_at
      `,
      [serverId, fromUserId, targetUserId]
    );
    const invite = insert.rows[0];

    // 5) 응답
    res.status(201).json({ invite });

    // 6) 소켓 이벤트
    const io = getIo();
    const sockets = onlineUsers.get(targetUserId);

    if (sockets && sockets.size > 0) {
      const [serverRes, fromUserRes] = await Promise.all([
        pool.query("SELECT id, name FROM servers WHERE id = $1", [serverId]),
        pool.query("SELECT id, username FROM users WHERE id = $1", [
          fromUserId,
        ]),
      ]);

      const payload = {
        inviteId: invite.id,
        serverId: serverRes.rows[0].id,
        serverName: serverRes.rows[0].name,
        fromUserId: fromUserRes.rows[0].id,
        fromUsername: fromUserRes.rows[0].username,
        createdAt: invite.created_at,
      };

      for (const sid of sockets) {
        io.to(sid).emit("server-invite", payload);
      }
    }
  } catch (err) {
    console.error("SERVER_INVITE_CREATE_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * (2) 초대 목록 조회
 * GET /api/servers/invites
 */
router.get("/invites", authenticateToken, async (req, res) => {
  const myId = req.user.userId;

  try {
    // 받은 초대
    const received = await pool.query(
      `
      SELECT
        i.id           AS invite_id,
        i.server_id,
        s.name         AS server_name,
        i.from_user_id,
        u.username     AS from_username,
        i.status,
        i.created_at
      FROM server_invites i
      JOIN servers s ON s.id = i.server_id
      JOIN users   u ON u.id = i.from_user_id
      WHERE i.to_user_id = $1
        AND i.status = 'pending'
      ORDER BY i.created_at DESC
      `,
      [myId]
    );

    // 보낸 초대
    const sent = await pool.query(
      `
      SELECT
        i.id           AS invite_id,
        i.server_id,
        s.name         AS server_name,
        i.to_user_id,
        u.username     AS to_username,
        i.status,
        i.created_at
      FROM server_invites i
      JOIN servers s ON s.id = i.server_id
      JOIN users   u ON u.id = i.to_user_id
      WHERE i.from_user_id = $1
        AND i.status = 'pending'
      ORDER BY i.created_at DESC
      `,
      [myId]
    );

    res.json({
      received: received.rows,
      sent: sent.rows,
    });
  } catch (err) {
    console.error("GET_SERVER_INVITES_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * (3) 초대 수락
 * POST /api/servers/invites/accept
 */
router.post("/invites/accept", authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const { inviteId } = req.body;

  if (!inviteId) {
    return res.status(400).json({ error: "inviteId가 필요합니다." });
  }

  try {
    // 초대 찾기
    const inviteRes = await pool.query(
      `
      SELECT * FROM server_invites
      WHERE id = $1
        AND to_user_id = $2
        AND status = 'pending'
      `,
      [inviteId, myId]
    );

    if (inviteRes.rowCount === 0) {
      return res.status(404).json({ error: "초대를 찾을 수 없습니다." });
    }

    const invite = inviteRes.rows[0];

    // 이미 멤버인지 체크
    const existingMember = await pool.query(
      `
      SELECT 1 FROM server_members
      WHERE server_id = $1 AND user_id = $2
      `,
      [invite.server_id, myId]
    );

    if (existingMember.rowCount === 0) {
      // 멤버 추가
      await pool.query(
        `
        INSERT INTO server_members (server_id, user_id, role, joined_at)
        VALUES ($1, $2, 'member', NOW())
        `,
        [invite.server_id, myId]
      );
    }

    // 초대 상태 업데이트
    await pool.query(
      `
      UPDATE server_invites
      SET status = 'accepted', responded_at = NOW()
      WHERE id = $1
      `,
      [inviteId]
    );

    res.json({ ok: true });

    // 소켓 - 초대 보낸 사람에게 알려주기
    const io = getIo();
    const socketsOfFrom = onlineUsers.get(invite.from_user_id);

    if (socketsOfFrom && socketsOfFrom.size > 0) {
      const payload = {
        inviteId,
        serverId: invite.server_id,
        toUserId: myId,
      };
      for (const sid of socketsOfFrom) {
        io.to(sid).emit("server-invite-accepted", payload);
      }
    }
  } catch (err) {
    console.error("ACCEPT_SERVER_INVITE_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * (4) 초대 거절
 * POST /api/servers/invites/decline
 */
router.post("/invites/decline", authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const { inviteId } = req.body;

  if (!inviteId) {
    return res.status(400).json({ error: "inviteId가 필요합니다." });
  }

  try {
    const inviteRes = await pool.query(
      `
      SELECT * FROM server_invites
      WHERE id = $1
        AND to_user_id = $2
        AND status = 'pending'
      `,
      [inviteId, myId]
    );

    if (inviteRes.rowCount === 0) {
      return res.status(404).json({ error: "초대를 찾을 수 없습니다." });
    }

    await pool.query(
      `
      UPDATE server_invites
      SET status = 'declined', responded_at = NOW()
      WHERE id = $1
      `,
      [inviteId]
    );

    res.json({ ok: true });

    // 소켓으로 보내는 사람에게 decline 알림
    const invite = inviteRes.rows[0];
    const io = getIo();
    const socketsOfFrom = onlineUsers.get(invite.from_user_id);

    if (socketsOfFrom && socketsOfFrom.size > 0) {
      const payload = {
        inviteId,
        serverId: invite.server_id,
        toUserId: myId,
      };
      for (const sid of socketsOfFrom) {
        io.to(sid).emit("server-invite-declined", payload);
      }
    }
  } catch (err) {
    console.error("DECLINE_SERVER_INVITE_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
