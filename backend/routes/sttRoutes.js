// routes/sttRoutes.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const OpenAI = require("openai");
const { JWT_SECRET } = require("../config/network");
const { getIo } = require("../socket");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "NO_TOKEN" });
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "INVALID_TOKEN" });
  }
}

function extFromMime(mime) {
  if (!mime) return ".webm";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("mp4")) return ".mp4";
  return ".webm";
}

/**
 * POST /api/stt/transcribe
 * form-data:
 *  - audio: Blob/File (webm/wav/mp3...)
 *  - channelId: string|number
 *  - isFinal: "true"|"false" (optional)
 *
 * return: { text }
 * + 동시에 voice:${channelId}로 voice:caption emit도 해줌
 */
router.post(
  "/transcribe",
  requireAuth,
  upload.single("audio"),
  async (req, res) => {
    const { channelId, isFinal } = req.body || {};
    if (!req.file) return res.status(400).json({ message: "audio required" });
    if (!channelId)
      return res.status(400).json({ message: "channelId required" });

    const cid = String(channelId);
    const userId = req.user?.userId;
    const username = req.user?.username || "Unknown";

    const tmpPath = path.join(
      os.tmpdir(),
      `stt_${Date.now()}_${Math.random().toString(16).slice(2)}${extFromMime(
        req.file.mimetype
      )}`
    );

    try {
      fs.writeFileSync(tmpPath, req.file.buffer);

      const result = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: fs.createReadStream(tmpPath),
        language: "ko",
      });

      const text = String(result.text || "").trim();
      if (!text) return res.json({ text: "" });

      // ✅ 소켓으로도 바로 자막 뿌리기(voice room)
      const io = getIo();
      io.to(`voice:${cid}`).emit("voice:caption", {
        channelId: cid,
        fromSocketId: null, // HTTP라 소켓ID 없음
        fromUserId: userId,
        fromUsername: username,
        text,
        isFinal: String(isFinal) === "true",
        ts: Date.now(),
      });

      return res.json({ text });
    } catch (e) {
      console.error("[STT] transcribe failed:", e);
      return res
        .status(500)
        .json({ message: "stt failed", error: String(e?.message || e) });
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
  }
);

module.exports = router;
