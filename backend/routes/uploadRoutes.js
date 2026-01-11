// routes/uploadRoutes.js
const express = require("express");
const router = express.Router({ mergeParams: true });

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { getIo } = require("../socket"); // socket.js에서 export 중 :contentReference[oaicite:1]{index=1}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// 서버 멤버인지 검증
async function assertServerMember(serverId, userId) {
  const r = await pool.query(
    `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  return r.rowCount > 0;
}

// 채널이 해당 서버 소속인지 검증
async function assertChannelInServer(serverId, channelId) {
  const r = await pool.query(
    `SELECT 1 FROM server_channels WHERE id = $1 AND server_id = $2`,
    [channelId, serverId]
  );
  return r.rowCount > 0;
}

// multer 저장 위치: backend/uploads/servers/{serverId}/channels/{channelId}/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { serverId, channelId } = req.params;

    const dest = path.join(
      __dirname,
      "..",
      "uploads",
      "servers",
      String(serverId),
      "channels",
      String(channelId)
    );
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    // 파일명 충돌 방지
    const safeOriginal = (file.originalname || "file").replace(
      /[^\w.\-() ]/g,
      "_"
    );
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `${unique}-${safeOriginal}`);
  },
});

const upload = multer({
  storage,
  limits: {
    // 필요하면 조절 (예: 20MB)
    fileSize: 20 * 1024 * 1024,
  },
});

// POST /api/:serverId/messages/channels/:channelId/files
// form-data: message(optional), files[]
router.post(
  "/channels/:channelId/files",
  authenticateToken,
  upload.array("files", 10),
  async (req, res) => {
    const { serverId, channelId } = req.params;
    const userId = req.user.userId;
    const username = req.user.username;

    const sid = Number(serverId);
    const cid = Number(channelId);

    const text = String(req.body?.message || "").trim();
    const files = Array.isArray(req.files) ? req.files : [];

    if (!text && files.length === 0) {
      return res
        .status(400)
        .json({ error: "message 또는 files 중 하나는 필요합니다." });
    }

    try {
      // 권한 체크
      const isMember = await assertServerMember(sid, userId);
      if (!isMember) return res.status(403).json({ error: "Not a member" });

      const channelOk = await assertChannelInServer(sid, cid);
      if (!channelOk)
        return res.status(403).json({ error: "Channel not in server" });

      // 1) 메시지 row 생성
      const messageType =
        files.length > 0 && text ? "mixed" : files.length > 0 ? "file" : "text";

      const msgIns = await pool.query(
        `
        INSERT INTO channel_messages (server_id, channel_id, user_id, content, message_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
        `,
        [sid, cid, userId, text || "", messageType]
      );

      const messageId = msgIns.rows[0].id;
      const createdAt = msgIns.rows[0].created_at;

      // 2) 파일 rows 생성
      const fileRows = [];
      for (const f of files) {
        // 브라우저에서 접근할 URL (/uploads 아래로 열어줄 거임)
        // 실제 파일 저장은 backend/uploads/... 이고, app.js에서 /uploads 정적서빙으로 연결
        const relativeUrl = `/uploads/servers/${sid}/channels/${cid}/${f.filename}`;

        const ins = await pool.query(
          `
          INSERT INTO channel_message_files (message_id, file_name, file_url, mime_type, file_size)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, file_name, file_url, mime_type, file_size, created_at
          `,
          [messageId, f.originalname, relativeUrl, f.mimetype, f.size]
        );

        fileRows.push(ins.rows[0]);
      }

      // 3) 소켓 브로드캐스트 (텍스트 채널 룸이 channelId로 join되어 있음)
      try {
        const io = getIo();
        io.to(String(cid)).emit("receive-message", {
          id: messageId,
          message: text || "",
          messageType,
          files: fileRows.map((r) => ({
            id: r.id,
            fileName: r.file_name,
            fileUrl: r.file_url,
            mimeType: r.mime_type,
            fileSize: r.file_size,
          })),
          userId,
          username,
          timestamp: createdAt,
        });
      } catch (e) {
        // 소켓이 죽어도 업로드는 성공일 수 있으니 무시(로그만)
        console.warn("UPLOAD_SOCKET_EMIT_WARN", e?.message || e);
      }

      return res.status(201).json({
        id: messageId,
        message: text || "",
        messageType,
        files: fileRows,
        userId,
        username,
        timestamp: createdAt,
      });
    } catch (err) {
      console.error("UPLOAD_MESSAGE_ERROR", err);
      return res.status(500).json({ error: "Failed to upload files/message" });
    }
  }
);

module.exports = router;
