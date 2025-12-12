// routes/messageRoutes.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { log } = require("../middleware/logger");

/**
 * 📌 채널 메시지 조회
 * GET /api/:serverId/messages/channels/:channelId?limit=50
 */
router.get("/channels/:channelId", authenticateToken, async (req, res) => {
  const { serverId, channelId } = req.params;
  const { limit = 50 } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT 
        m.id,
        m.content,
        m.created_at,
        u.id AS user_id,
        u.username
      FROM channel_messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.server_id = $1
        AND m.channel_id = $2
      ORDER BY m.created_at DESC
      LIMIT $3
      `,
      [serverId, channelId, Number(limit)]
    );

    // 최신 → 오래된 순으로 정렬했으니 프론트에서 보기 쉽게 뒤집기
    const rows = result.rows.reverse().map((row) => ({
      id: row.id,
      message: row.content,
      timestamp: row.created_at,
      userId: row.user_id,
      username: row.username,
    }));

    res.json(rows);
  } catch (err) {
    log.error?.("CHANNEL_MSG_LIST_ERR", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

module.exports = router;
