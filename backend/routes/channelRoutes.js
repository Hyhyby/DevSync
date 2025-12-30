// routes/channelRoutes.js
const { getIo, onlineUsers } = require("../socket");
const express = require("express");
const router = express.Router({ mergeParams: true }); // serverId 전달
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { log } = require("../middleware/logger");

// 서버 멤버인지 확인 (간단 버전)
async function assertServerMember(serverId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  return result.rowCount > 0;
}

/**
 * 📌 채널 목록 조회
 * GET /api/:serverId/channels
 */
router.get("/", authenticateToken, async (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.userId;

  try {
    const isMember = await assertServerMember(serverId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const result = await pool.query(
      `
      SELECT id, server_id, name, type, position, topic, created_at
      FROM server_channels
      WHERE server_id = $1
      ORDER BY 
        CASE WHEN type = 'text' THEN 0 ELSE 1 END,
        position ASC, created_at ASC
      `,
      [serverId]
    );

    res.json(result.rows);
  } catch (err) {
    log.error?.("CHANNEL_LIST_ERR", err);
    res.status(500).json({ error: "Failed to load channels" });
  }
});

/**
 * 📌 채널 생성
 * POST /api/:serverId/channels
 * body: { name, type: 'text' | 'voice' }
 */
router.post("/", authenticateToken, async (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.userId;
  const { name, type = "text" } = req.body;

  if (!name) return res.status(400).json({ error: "name is required" });

  try {
    const isMember = await assertServerMember(serverId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    // 마지막 position + 1
    const posRes = await pool.query(
      `SELECT COALESCE(MAX(position) + 1, 0) AS next_pos
       FROM server_channels
       WHERE server_id = $1`,
      [serverId]
    );
    const position = posRes.rows[0].next_pos;

    // ❌ const id = require("uuid").v4();  <-- 삭제

    // ✅ id는 SERIAL 이므로 DB가 자동 생성
    const insertRes = await pool.query(
      `
      INSERT INTO server_channels (server_id, name, type, position, topic)
      VALUES ($1, $2, $3, $4, '')
      RETURNING id, server_id, name, type, position, topic, created_at
      `,
      [serverId, name, type, position]
    );

    res.status(201).json(insertRes.rows[0]);
    // ✅ 채널 생성 후 → 서버 멤버들에게 채널 변경 이벤트 전송
    try {
      const io = getIo();

      const memberIdsRes = await pool.query(
        `SELECT user_id FROM server_members WHERE server_id = $1`,
        [serverId]
      );

      const payload = {
        serverId,
        channelId: insertRes.rows[0].id,
        action: "created",
      };

      for (const row of memberIdsRes.rows) {
        const sockets = onlineUsers.get(row.user_id);
        if (!sockets) continue;

        for (const sid of sockets) {
          io.to(sid).emit("channels-updated", payload);
        }
      }
    } catch (e) {
      console.error("CHANNEL_CREATE_SOCKET_ERROR", e);
    }
  } catch (err) {
    log.error?.("CHANNEL_CREATE_ERR", err);
    res.status(500).json({ error: "Failed to create channel" });
  }
});

/**
 * 📌 채널 수정
 * PATCH /api/:serverId/channels/:channelId
 */
router.patch("/:channelId", authenticateToken, async (req, res) => {
  const { serverId, channelId } = req.params;
  const userId = req.user.userId;
  const { name, topic, position } = req.body;

  try {
    const isMember = await assertServerMember(serverId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (topic !== undefined) {
      fields.push(`topic = $${idx++}`);
      values.push(topic);
    }
    if (position !== undefined) {
      fields.push(`position = $${idx++}`);
      values.push(position);
    }

    if (!fields.length)
      return res.status(400).json({ error: "No fields to update" });

    values.push(serverId, channelId);

    const result = await pool.query(
      `
      UPDATE server_channels
      SET ${fields.join(", ")}
      WHERE server_id = $${idx++} AND id = $${idx}
      RETURNING id, server_id, name, type, position, topic, created_at
      `,
      values
    );

    if (!result.rowCount)
      return res.status(404).json({ error: "Channel not found" });

    res.json(result.rows[0]);
    // ✅ 채널 수정 후 → 서버 멤버들에게 채널 변경 이벤트 전송
    try {
      const io = getIo();

      const memberIdsRes = await pool.query(
        `SELECT user_id FROM server_members WHERE server_id = $1`,
        [serverId]
      );

      const payload = {
        serverId,
        channelId,
        action: "updated",
      };

      for (const row of memberIdsRes.rows) {
        const sockets = onlineUsers.get(row.user_id);
        if (!sockets) continue;

        for (const sid of sockets) {
          io.to(sid).emit("channels-updated", payload);
        }
      }
    } catch (e) {
      console.error("CHANNEL_UPDATE_SOCKET_ERROR", e);
    }
  } catch (err) {
    log.error?.("CHANNEL_UPDATE_ERR", err);
    res.status(500).json({ error: "Failed to update channel" });
  }
});

/**
 * 📌 채널 삭제
 * DELETE /api/:serverId/channels/:channelId
 */
router.delete("/:channelId", authenticateToken, async (req, res) => {
  const { serverId, channelId } = req.params;
  const userId = req.user.userId;

  try {
    const isMember = await assertServerMember(serverId, userId);
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    await pool.query(
      `DELETE FROM server_channels WHERE server_id = $1 AND id = $2`,
      [serverId, channelId]
    );
    res.json({ ok: true });
    // ✅ 채널 삭제 후 → 서버 멤버들에게 채널 변경 이벤트 전송
    try {
      const io = getIo();

      const memberIdsRes = await pool.query(
        `SELECT user_id FROM server_members WHERE server_id = $1`,
        [serverId]
      );

      const payload = {
        serverId,
        channelId,
        action: "deleted",
      };

      for (const row of memberIdsRes.rows) {
        const sockets = onlineUsers.get(row.user_id);
        if (!sockets) continue;

        for (const sid of sockets) {
          io.to(sid).emit("channels-updated", payload);
        }
      }
    } catch (e) {
      console.error("CHANNEL_DELETE_SOCKET_ERROR", e);
    }
  } catch (err) {
    log.error?.("CHANNEL_DELETE_ERR", err);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

module.exports = router;
