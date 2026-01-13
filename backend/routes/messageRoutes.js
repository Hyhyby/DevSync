// routes/messageRoutes.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { log } = require("../middleware/logger");

/**
 * 📌 채널 메시지 조회 (cursor 기반 무한 스크롤)
 * GET /api/:serverId/messages/channels/:channelId?before=123&limit=50
 */
router.get("/channels/:channelId", authenticateToken, async (req, res) => {
  const { serverId, channelId } = req.params;
  const { before, limit = 50 } = req.query;

  try {
    let query;
    let params;

    if (before) {
      // 🔹 과거 메시지 불러오기 (cursor)
      query = `
        SELECT 
          m.id,
          m.content,
          m.created_at,
          u.id AS user_id,
          u.username,
          u.is_bot
        FROM channel_messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.server_id = $1
          AND m.channel_id = $2
          AND m.id < $3
        ORDER BY m.id DESC
        LIMIT $4
      `;
      params = [
        Number(serverId),
        Number(channelId),
        Number(before),
        Number(limit),
      ];
    } else {
      // 🔹 최초 진입: 최신 메시지
      query = `
        SELECT 
          m.id,
          m.content,
          m.created_at,
          u.id AS user_id,
          u.username,
          u.is_bot
        FROM channel_messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.server_id = $1
          AND m.channel_id = $2
        ORDER BY m.id DESC
        LIMIT $3
      `;
      params = [Number(serverId), Number(channelId), Number(limit)];
    }

    const result = await pool.query(query, params);

    // ✅ 메시지 id 목록
    const msgIds = result.rows.map((r) => r.id);

    // ✅ message_id -> files[] 맵 만들기
    const filesByMessageId = {};
    if (msgIds.length > 0) {
      const fRes = await pool.query(
        `
        SELECT
          id,
          message_id,
          file_name,
          file_url,
          mime_type,
          file_size,
          created_at
        FROM channel_message_files
        WHERE message_id = ANY($1::bigint[])
        ORDER BY id ASC
        `,
        [msgIds]
      );

      for (const f of fRes.rows) {
        const mid = String(f.message_id);
        if (!filesByMessageId[mid]) filesByMessageId[mid] = [];
        filesByMessageId[mid].push({
          id: f.id,
          fileName: f.file_name,
          fileUrl: f.file_url,
          mimeType: f.mime_type,
          fileSize: f.file_size,
          createdAt: f.created_at,
        });
      }
    }

    // 최신 → 오래된 순이므로 뒤집어서 반환
    const rows = result.rows.reverse().map((row) => ({
      id: row.id,
      message: row.content,
      timestamp: row.created_at,
      userId: row.user_id,
      isBot: row.is_bot,
      username: row.username,
      files: filesByMessageId[String(row.id)] || [],
    }));

    res.json(rows);
  } catch (err) {
    log.error?.("CHANNEL_MSG_LIST_ERR", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

module.exports = router;
