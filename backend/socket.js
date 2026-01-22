// socket.js
const { Server } = require("socket.io");
const pool = require("./config/db");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { JWT_SECRET } = require("./config/network");
const { isAllowedOrigin } = require("./config/cors");
const { socketLogger, log } = require("./middleware/logger");
const { loadRooms } = require("./utils/room");
const {
  generateReply,
  analyzeUploadedImage,
} = require("./services/botService");
const BOT_USER_ID = Number(process.env.BOT_USER_ID || 9999999);
const BOT_USERNAME = process.env.BOT_USERNAME || "DevSyncBot";
const fs = require("fs");
const os = require("os");
const path = require("path");
const OpenAI = require("openai");
const { toFile } = require("openai/uploads");
const sttInFlight = new Map(); // socketId -> boolean
const sttSessions = new Map();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { spawn } = require("child_process");

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
function isWebmHeader(buf) {
  // EBML(WebM) 헤더: 1A 45 DF A3
  return (
    Buffer.isBuffer(buf) &&
    buf.length >= 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  );
}
function shouldEmitCaption(text) {
  const t = String(text || "").trim();
  if (!t) return false;

  // 너무 짧으면(잡음 확률↑)
  if (t.length < 2) return false;

  // 너무 길면(무음/잡음에서 이상하게 길어지는 케이스 방지)
  if (t.length > 140) return false;

  // 자주 섞이는 에러/시스템 문구 차단
  const BLOCK_PATTERNS = [
    /network error/i,
    /speechrecognition/i,
    /not[- ]allowed/i,
    /denied/i,
    /permission/i,
    /mic/i,
    /오류/i,
    /에러/i,
    /권한/i,
    /마이크/i,
    /잠시 후/i,
    /다시 시도/i,
  ];
  if (BLOCK_PATTERNS.some((re) => re.test(t))) return false;

  // 헛자막으로 자주 나오는 특정 문구 차단(필요시 더 추가)
  const BLOCK_EXACT = new Set([
    "시청해주셔서 감사합니다",
    "구독과 좋아요 부탁드립니다",
    "MBC 뉴스 이덕영입니다.",
    "시청해주셔서 감사합니다.",
  ]);
  if (BLOCK_EXACT.has(t)) return false;

  return true;
}

function startSttSession(socketId) {
  const webmPath = path.join(
    os.tmpdir(),
    `devsync-stt-${socketId}-${Date.now()}.webm`,
  );
  const s = { webmPath, startedAt: Date.now() };
  sttSessions.set(socketId, s);
  return s;
}

function cleanupSttSession(socketId) {
  const s = sttSessions.get(socketId);
  if (s?.webmPath) {
    try {
      fs.unlinkSync(s.webmPath);
    } catch {}
  }
  sttSessions.delete(socketId);
  sttInFlight.delete(socketId);
}

function appendWebm(session, buf) {
  fs.appendFileSync(session.webmPath, buf);
}

async function convertWebmToWav(webmPath) {
  const wavPath = webmPath.replace(/\.webm$/i, ".wav");

  await new Promise((resolve, reject) => {
    // mono + 16kHz로 고정(Whisper 안정)
    const args = ["-y", "-i", webmPath, "-ac", "1", "-ar", "16000", wavPath];
    const p = spawn(FFMPEG_PATH, args);

    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${err}`));
    });
  });

  return wavPath;
}

async function transcribeWavWithWhisper(wavPath, { language = "ko" } = {}) {
  const resp = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: fs.createReadStream(wavPath),
    language,
  });
  return (resp?.text || "").trim();
}
function normalizeMime(mimeType = "") {
  return String(mimeType).split(";")[0].trim().toLowerCase();
}

function extFromMime(mime) {
  // file name에 붙일 확장자(점 포함)
  if (!mime) return ".webm";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  if (mime.includes("ogg") || mime.includes("oga")) return ".ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return ".mp4";
  return ".webm";
}

async function transcribeBufferWithWhisper(
  buffer,
  mimeType,
  { language = "ko" } = {},
) {
  const mime = normalizeMime(mimeType);
  const ext = extFromMime(mime);

  // 🔥 파일명에 확장자 필수 + Content-Type 지정
  const file = await toFile(buffer, `chunk.${ext}`, { type: mime });

  const resp = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language, // 한국어 고정이면 ko
  });

  // openai sdk 응답은 보통 { text: "..." }
  return resp?.text || "";
}

// 방 목록 (파일에서 로딩)
let rooms = loadRooms();

// ✅ 전역 io 인스턴스 보관용
let ioInstance = null;

// ✅ 현재 온라인인 유저 맵: userId -> Set<socketId>
const onlineUsers = new Map();

// ✅ 음성 채널 멤버: channelId(string) -> Map<socketId, { socketId, userId, username }>
const voiceMembers = new Map();

function emitVoiceMembers(io, channelId) {
  const cid = String(channelId);
  const membersMap = voiceMembers.get(cid);
  const members = membersMap ? Array.from(membersMap.values()) : [];

  io.to(`voice:${cid}`).emit("voice-members", {
    channelId: cid,
    members, // [{ socketId, userId, username }]
  });
}

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin(origin, cb) {
        if (isAllowedOrigin(origin)) return cb(null, true);
        cb(new Error(`Not allowed by Socket.IO CORS: ${origin}`));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  ioInstance = io;

  // 🔐 인증
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers["authorization"] || "").split(" ")[1];

      if (!token) return next(new Error("NO_TOKEN"));

      const user = jwt.verify(token, JWT_SECRET);
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    socket.onAny((event, ...args) => {
      console.log("[ON_ANY]", socket.id, event, args?.[0]);
    });

    socketLogger(socket);

    const user = socket.user;
    if (!user || !user.userId) {
      log.warn(`⚠️ CONNECTED WITHOUT USER socketId=${socket.id}`);
      socket.disconnect(true);
      return;
    }

    const userId = user.userId;
    const username = user.username;

    log.connection("CONNECTED", socket.id, `User: ${username} (${userId})`);

    // onlineUsers
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // =========================
    // ✅ VOICE
    // =========================
    socket.currentVoiceChannelId = null;
    // ✅ STT 호출 과도 방지(간단 쿨다운)
    socket._lastSttAt = 0;

    function toNodeBuffer(x) {
      if (!x) return null;
      if (Buffer.isBuffer(x)) return x;
      if (x instanceof Uint8Array) return Buffer.from(x);
      if (x instanceof ArrayBuffer) return Buffer.from(new Uint8Array(x));
      if (x?.type === "Buffer" && Array.isArray(x.data))
        return Buffer.from(x.data);
      return Buffer.from(x);
    }

    socket.on("voice:audio-chunk", async (p) => {
      // ✅ 간단 쿨다운(비용/폭주 방지) - 1.2초 이내 재호출 무시
      const now = Date.now();
      if (now - (socket._lastSttAt || 0) < 1200) return;
      socket._lastSttAt = now;

      try {
        const cid = String(p.channelId);
        const mimeType = p.mimeType || "audio/webm";
        const audioBuf = toNodeBuffer(p.audio);

        // 너무 작은 버퍼는 잡음/깨짐일 확률 높음
        if (!audioBuf || audioBuf.length < 1500) return;

        // ✅ isFinal만 처리(비용 방지)
        if (!p.isFinal) return;

        // ✅ 동시 STT 요청 방지
        if (sttInFlight.get(socket.id)) return;
        sttInFlight.set(socket.id, true);

        // ✅ Whisper 호출
        const text = await transcribeBufferWithWhisper(audioBuf, mimeType, {
          language: "ko",
        });

        const cleaned = String(text || "").trim();

        // ✅ (핵심) 헛자막/이상문장/에러성 문구면 emit 금지
        if (!shouldEmitCaption(cleaned)) {
          console.log("[STT] dropped caption:", { cleaned });
          return;
        }

        // ✅ 정상일 때만 emit
        io.to(`voice:${cid}`).emit("voice:caption", {
          channelId: cid,
          fromSocketId: socket.id,
          fromUsername: socket.user?.username || "Unknown",
          text: cleaned,
          isFinal: true,
          ts: Date.now(),
        });
      } catch (e) {
        // ✅ 에러면 “아예 자막 emit 안 함”
        console.error("[STT] voice:audio-chunk failed:", e?.message || e);
      } finally {
        // ✅ false로 남기지 말고 완전 제거
        sttInFlight.delete(socket.id);
      }
    });

    // ✅ 자막 릴레이
    socket.on("voice:caption", ({ channelId, text, isFinal }) => {
      console.log("[CAPTION RECV]", {
        socketId: socket.id,
        curCid: socket.currentVoiceChannelId,
        gotChannelId: channelId,
        text,
        isFinal,
      });

      const cid = String(channelId || socket.currentVoiceChannelId || "");
      if (!cid) return console.log("[CAPTION DROP] no cid");

      if (String(socket.currentVoiceChannelId || "") !== cid)
        return console.log("[CAPTION DROP] not same channel", {
          cur: socket.currentVoiceChannelId,
          cid,
        });

      const clean = String(text || "").trim();
      if (!clean) return console.log("[CAPTION DROP] empty text");

      const payload = {
        channelId: cid,
        fromSocketId: socket.id,
        fromUserId: userId,
        fromUsername: username,
        text: clean,
        isFinal: !!isFinal,
        ts: Date.now(),
      };

      const room = io.sockets.adapter.rooms.get(`voice:${cid}`);

      console.log("[CAPTION CAST]", {
        room: `voice:${cid}`,
        roomSize: room?.size || 0,
        text: clean,
      });

      io.to(`voice:${cid}`).emit("voice:caption", payload);
    });

    socket.on("join-voice", async ({ channelId }) => {
      console.log("[JOIN-VOICE RECV]", { socketId: socket.id, channelId });
      if (!channelId) return;
      const cid = String(channelId);

      // 이전 음성 채널 정리
      const prev = socket.currentVoiceChannelId;
      if (prev && prev !== cid) {
        // prev room에서 빠지기 + 멤버 정리 + peer-left 브로드캐스트
        socket.leave(`voice:${prev}`);

        const prevMap = voiceMembers.get(prev);
        if (prevMap) {
          prevMap.delete(socket.id);
          if (prevMap.size === 0) voiceMembers.delete(prev);
        }

        io.to(`voice:${prev}`).emit("voice:peer-left", { peerId: socket.id });
        emitVoiceMembers(io, prev);
      }

      // 새 채널 join
      socket.currentVoiceChannelId = cid;
      socket.join(`voice:${cid}`);
      // ✅ (추가) room size 확인
      const room = io.sockets.adapter.rooms.get(`voice:${cid}`);
      console.log("[JOIN-VOICE ROOM]", { cid, roomSize: room?.size || 0 });

      if (!voiceMembers.has(cid)) voiceMembers.set(cid, new Map());
      const map = voiceMembers.get(cid);

      // ✅ join 직전, 기존 피어 목록을 joiner에게 전달
      const peers = Array.from(map.keys()).filter((sid) => sid !== socket.id);
      socket.emit("voice:peers", { channelId: cid, peers });
      let profileImage = null;
      try {
        const uRes = await pool.query(
          "SELECT profile_image_url FROM users WHERE id = $1",
          [userId],
        );
        profileImage = uRes.rows?.[0]?.profile_image_url || null;
      } catch (e) {
        console.warn("[VOICE] profile image load failed", e?.message || e);
      }
      // ✅ 멤버 등록(이제 socketId 포함)
      map.set(socket.id, {
        socketId: socket.id,
        userId,
        username,
        micMuted: false,
        profileImage,
      });

      emitVoiceMembers(io, cid);
      if (typeof ack === "function") ack({ ok: true, channelId: cid });
    });
    // ✅ 마이크 음소거 상태 변경(클라가 보내는 이벤트)
    socket.on("voice:mic-muted", ({ channelId, micMuted }) => {
      const cid = String(channelId || socket.currentVoiceChannelId || "");
      if (!cid) return;

      // 같은 채널 안에서만 처리(안전장치)
      if (String(socket.currentVoiceChannelId || "") !== cid) return;

      const map = voiceMembers.get(cid);
      if (!map) return;

      const me = map.get(socket.id);
      if (!me) return;

      map.set(socket.id, { ...me, micMuted: !!micMuted });

      // ✅ 최신 멤버 목록 다시 브로드캐스트 (상대방 UI 갱신)
      emitVoiceMembers(io, cid);
    });

    socket.on("leave-voice", ({ channelId }) => {
      const cid = String(channelId || socket.currentVoiceChannelId || "");
      if (!cid) return;

      socket.leave(`voice:${cid}`);

      const map = voiceMembers.get(cid);
      if (map) {
        map.delete(socket.id);
        if (map.size === 0) voiceMembers.delete(cid);
      }

      if (socket.currentVoiceChannelId === cid) {
        socket.currentVoiceChannelId = null;
      }

      // ✅ 같은 채널 사람들에게 "이 피어 나감" 알려서 WebRTC 정리
      io.to(`voice:${cid}`).emit("voice:peer-left", { peerId: socket.id });

      emitVoiceMembers(io, cid);
    });

    // ✅ 시그널링 릴레이
    socket.on("voice:signal", ({ to, channelId, data }) => {
      const cid = String(channelId || "");
      if (!to || !cid || !data) return;

      // 기본 안전장치: 같은 음성 채널 안에서만 중계
      if (String(socket.currentVoiceChannelId || "") !== cid) return;
      const map = voiceMembers.get(cid);
      if (!map || !map.has(String(to))) return;

      io.to(String(to)).emit("voice:signal", {
        from: socket.id,
        channelId: cid,
        data,
      });
    });

    // =========================
    // ✅ DM (기존 유지)
    // =========================
    socket.on("join-dm", (dmId) => {
      if (!dmId) return;
      socket.join(`dm_${dmId}`);
    });

    socket.on("send-dm", async (data) => {
      try {
        if (!socket.user) return;
        const { dmId, message } = data || {};
        const text = (message || "").trim();
        if (!dmId || !text) return;

        const auth = await pool.query(
          `
          SELECT 1
          FROM dm_participants
          WHERE dm_id = $1 AND user_id = $2
          `,
          [dmId, userId],
        );
        if (auth.rowCount === 0) return;

        const result = await pool.query(
          `
          INSERT INTO dm_messages (dm_id, user_id, content)
          VALUES ($1, $2, $3)
          RETURNING id, dm_id, user_id, content, created_at
          `,
          [dmId, userId, text],
        );

        const msgRow = result.rows[0];

        await pool.query(
          `
          UPDATE dms SET updated_at = NOW()
          WHERE id = $1
          `,
          [dmId],
        );

        io.to(`dm_${dmId}`).emit("receive-dm", {
          id: msgRow.id,
          dm_id: msgRow.dm_id,
          user_id: msgRow.user_id,
          username,
          message: msgRow.content,
          created_at: msgRow.created_at,
        });
      } catch (err) {
        console.error("SEND_DM_ERROR", err);
      }
    });

    // =========================
    // ✅ 텍스트 룸 (기존 유지)
    // =========================
    socket.on("join-room", (payload) => {
      const roomId = typeof payload === "string" ? payload : payload?.roomId;
      const joinedUsername = payload?.username || username || "Unknown";
      if (!roomId) return;

      const room = rooms.find((r) => r.id === roomId);
      socket.emit("room-info", room || { id: roomId, name: roomId });
      socket.join(roomId);

      io.to(roomId).emit("receive-message", {
        id: uuidv4(),
        message: `${joinedUsername}님이 들어왔습니다.`,
        userId: "system",
        username: "System",
        timestamp: new Date().toISOString(),
        isSystem: true,
      });
    });

    socket.on("send-message", async (data = {}) => {
      try {
        const { roomId, serverId, message } = data;

        const text = (message || "").trim();
        if (!roomId || !text) return;

        // channelId는 현재 roomId로 쓰고 있으니 숫자 변환(테이블이 integer)
        const channelId = Number(roomId);
        const sid = Number(serverId);

        if (!Number.isFinite(channelId) || !Number.isFinite(sid)) return;

        // (권장) 서버 멤버인지 검증
        const mem = await pool.query(
          `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
          [sid, userId],
        );
        if (mem.rowCount === 0) return;

        // (권장) 채널이 해당 서버 소속인지 검증
        const ch = await pool.query(
          `SELECT 1 FROM server_channels WHERE id = $1 AND server_id = $2`,
          [channelId, sid],
        );
        if (ch.rowCount === 0) return;

        // ✅ DB 저장 (id는 SERIAL이라 넣지 않음)
        const saved = await pool.query(
          `
      INSERT INTO channel_messages (server_id, channel_id, user_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, content, created_at
      `,
          [sid, channelId, userId, text],
        );

        const row = saved.rows[0];

        // ✅ 저장된 id/created_at으로 broadcast
        io.to(String(roomId)).emit("receive-message", {
          id: row.id,
          message: row.content,
          userId,
          username,
          timestamp: row.created_at,
        });
        // =========================
        // ✅ BOT (대화형 챗봇)
        // =========================
        // 봇 자신 메시지는 무시
        if (userId === BOT_USER_ID) return;

        const prompt = parseBotTrigger(text);

        if (!prompt) return;

        // 레이트리밋 (유저가 연타하면 비용 폭발 방지)
        if (isRateLimited({ serverId: sid, channelId, userId })) {
          io.to(String(roomId)).emit("receive-message", {
            id: uuidv4(),
            message: `${username}님, 잠시만요! (봇 호출은 몇 초 간격으로 부탁해요)`,
            userId: BOT_USER_ID,
            username: BOT_USERNAME,
            timestamp: new Date().toISOString(),
            isSystem: false,
          });
          return;
        }
        let reply = "";

        // ✅ 0) 날짜 지정이 있는지 먼저 확인 (예: "1월19일", "2026-01-19")
        const targetDate = parseTargetDateFromPrompt(prompt);

        if (targetDate) {
          console.log("[BOT] date command detected:", targetDate, prompt);

          const wantSummary = isSummaryCommand(prompt);
          const wantImageOnly = !wantSummary;
          // 날짜가 있는데 '요약' 키워드가 있으면 => 텍스트+이미지 요약
          // 아니면 기존처럼 "그 날짜 이미지 분석"으로 취급

          if (wantSummary) {
            // ✅ 1) 그 날짜 텍스트 메시지 가져오기
            const msgs = await loadChannelMessagesByKstDate({
              serverId: sid,
              channelId,
              ...targetDate,
            });

            // ✅ 2) 그 날짜 이미지 여러 장 가져오기(최대 3장)
            const imgs = await loadChannelImagesByKstDate({
              serverId: sid,
              channelId,
              ...targetDate,
              limit: 3,
            });

            console.log("[BOT] date msgs:", msgs.length);
            console.log("[BOT] date imgs:", imgs.length);

            if (msgs.length === 0 && imgs.length === 0) {
              reply = `${targetDate.mo}월 ${targetDate.d}일에는 메시지나 이미지가 없어요.`;
            } else {
              // ✅ 3) 이미지 -> 텍스트 설명(짧게)
              const imageSummaries = [];
              for (const img of imgs) {
                try {
                  const desc = await analyzeUploadedImage({
                    fileUrl: img.file_url,
                    prompt: `
이미지에 보이는 내용을 한국어로 짧게 설명해줘.
- 불필요한 거절 문구는 쓰지 말고, 바로 설명만 해줘.
- 출력은 한 단락(3~5줄)로.
`.trim(),
                  });
                  imageSummaries.push(
                    `[이미지: ${img.file_name}] ${desc}`.trim(),
                  );
                } catch (e) {
                  console.error(
                    "[BOT][VISION] date image analyze failed:",
                    e?.message || e,
                  );
                  imageSummaries.push(`[이미지: ${img.file_name}] (분석 실패)`);
                }
              }

              // ✅ 4) LLM 입력 컨텍스트 구성
              const textBlock = msgs
                .map((m) => {
                  const name = m.is_bot ? BOT_USERNAME : m.username;
                  return `${name}: ${m.content}`;
                })
                .join("\n");

              const imageBlock = imageSummaries.length
                ? imageSummaries.map((s) => `- ${s}`).join("\n")
                : "(없음)";

              const combinedContext = `
[${targetDate.y}-${String(targetDate.mo).padStart(2, "0")}-${String(targetDate.d).padStart(2, "0")} 대화 로그]
${textBlock || "(텍스트 없음)"}

[같은 날짜의 이미지 요약]
${imageBlock}
`.trim();

              // ✅ 5) 최종 요약 생성
              reply = await generateReply({
                historyText: combinedContext,
                userPrompt: `${targetDate.mo}월 ${targetDate.d}일의 대화/회의 내용을 핵심만 요약해줘.`,
              });
            }
          } else {
            // ✅ 기존 동작 유지: "그 날짜의 최근 이미지 1장" 분석
            const hit = await findLatestImageInChannelByKstDate({
              serverId: sid,
              channelId,
              ...targetDate,
            });

            console.log("[BOT] date image:", hit);

            if (!hit?.file_url) {
              reply = `${targetDate.mo}월 ${targetDate.d}일에 업로드된 이미지를 찾지 못했어요. 그날 이미지가 올라갔는지 확인해줘!`;
            } else {
              try {
                reply = await analyzeUploadedImage({
                  fileUrl: hit.file_url,
                  prompt: `
이미지에 보이는 내용만 한국어로 설명해줘.
- 불필요한 거절 문구는 쓰지 말고, 바로 설명만 해줘.
1) 한 줄 요약
2) 관찰(색/형태/텍스트)
3) 맥락 추정(있다면)
`.trim(),
                });
              } catch (e) {
                console.error("[BOT][VISION] analyzeUploadedImage failed:", e);
                reply =
                  `이미지 분석 중 오류가 발생했어요.\n` +
                  `- file_url: ${hit.file_url}\n` +
                  `- error: ${e?.message || e}`;
              }
            }
          }
        } else if (isRecentImageCommand(prompt)) {
          console.log("[BOT] recent-image command detected:", prompt);

          const latest = await findLatestImageInChannel({
            serverId: sid,
            channelId,
          });

          console.log("[BOT] latest image:", latest);

          if (!latest?.file_url) {
            reply =
              "최근에 업로드된 이미지를 찾지 못했어요. 이미지를 먼저 올려주세요!";
          } else {
            reply = await analyzeUploadedImage({
              fileUrl: latest.file_url,
              prompt: "이 이미지를 분석해줘. 핵심만 한국어로 정리해줘.",
            });
          }
        } else {
          console.log("[BOT] normal text reply:", prompt);

          const historyText = await loadRecentChannelHistory({
            serverId: sid,
            channelId,
            limit: 40,
          });

          reply = await generateReply({
            historyText,
            userPrompt: prompt,
          });
        }

        if (!reply) return;

        // 봇 메시지 DB 저장
        const savedBot = await pool.query(
          `
          INSERT INTO channel_messages (server_id, channel_id, user_id, content)
          VALUES ($1, $2, $3, $4)
          RETURNING id, content, created_at
          `,
          [sid, channelId, BOT_USER_ID, reply],
        );

        const botRow = savedBot.rows[0];

        // 봇 메시지 브로드캐스트
        io.to(String(roomId)).emit("receive-message", {
          id: botRow.id,
          message: botRow.content,
          userId: BOT_USER_ID,
          username: BOT_USERNAME,
          timestamp: botRow.created_at,
        });
      } catch (err) {
        console.error("SEND_MESSAGE_ERROR", err);
      }
    });

    // =========================
    // ✅ disconnect 정리
    // =========================
    socket.on("disconnect", (reason) => {
      log.connection("DISCONNECTED", socket.id, `Reason: ${reason}`);

      // onlineUsers 정리
      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineUsers.delete(userId);
      }

      // voice 정리
      const cid = socket.currentVoiceChannelId;
      if (cid) {
        const map = voiceMembers.get(cid);
        if (map) {
          map.delete(socket.id);
          if (map.size === 0) voiceMembers.delete(cid);
        }
        io.to(`voice:${cid}`).emit("voice:peer-left", { peerId: socket.id });

        emitVoiceMembers(io, cid);
      }
    });
  });

  return io;
}

function getIo() {
  if (!ioInstance) throw new Error("Socket.IO has not been initialized");
  return ioInstance;
}
function parseBotTrigger(text) {
  const t = (text || "").trim();
  const prefix = "@DevSyncBot";
  if (!t.startsWith(prefix)) return null;
  const prompt = t.slice(prefix.length).trim();
  return prompt.length ? prompt : null;
}
function isRecentImageCommand(prompt = "") {
  const p = String(prompt).trim().toLowerCase();
  if (!p) return false;

  const hasRecent =
    p.includes("최근") || p.includes("마지막") || p.includes("방금");
  const hasImage =
    p.includes("이미지") || p.includes("사진") || p.includes("짤");
  const hasAnalyze =
    p.includes("분석") ||
    p.includes("설명") ||
    p.includes("무슨") ||
    p.includes("뭐");

  return hasRecent && hasImage && hasAnalyze;
}

async function findLatestImageInChannel({ serverId, channelId }) {
  const r = await pool.query(
    `
    SELECT f.file_url, f.file_name, f.mime_type
    FROM channel_message_files f
    JOIN channel_messages m ON m.id = f.message_id
    WHERE m.server_id = $1
      AND m.channel_id = $2
      AND LOWER(f.mime_type) LIKE 'image/%'
    ORDER BY m.id DESC
    LIMIT 1
    `,
    [serverId, channelId],
  );

  return r.rows[0] || null;
}
function isSummaryCommand(prompt = "") {
  const p = String(prompt || "")
    .trim()
    .toLowerCase();
  if (!p) return false;

  // '요약/정리/회의내용/대화내용/메시지들' 류면 요약으로 판단
  const KEYWORDS = [
    "요약",
    "정리",
    "회의",
    "회의내용",
    "회의 내용",
    "대화",
    "대화내용",
    "대화 내용",
    "메시지",
    "메시지들",
    "로그",
    "기록",
  ];

  return KEYWORDS.some((k) => p.includes(k));
}
async function loadChannelMessagesByKstDate({ serverId, channelId, y, mo, d }) {
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const target = `${y}-${mm}-${dd}`;

  const r = await pool.query(
    `
    SELECT
      m.id,
      m.content,
      m.created_at,
      u.username,
      u.is_bot
    FROM channel_messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.server_id = $1
      AND m.channel_id = $2
      AND (m.created_at AT TIME ZONE 'Asia/Seoul')::date = $3::date
      AND m.content IS NOT NULL
      AND m.content <> ''
    ORDER BY m.id ASC
    `,
    [serverId, channelId, target],
  );

  return r.rows;
}
async function loadChannelImagesByKstDate({
  serverId,
  channelId,
  y,
  mo,
  d,
  limit = 3,
}) {
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const target = `${y}-${mm}-${dd}`;

  const r = await pool.query(
    `
    SELECT
      f.file_url,
      f.file_name,
      f.mime_type,
      m.created_at,
      m.id as message_id
    FROM channel_message_files f
    JOIN channel_messages m ON m.id = f.message_id
    WHERE m.server_id = $1
      AND m.channel_id = $2
      AND LOWER(f.mime_type) LIKE 'image/%'
      AND (m.created_at AT TIME ZONE 'Asia/Seoul')::date = $3::date
    ORDER BY m.id ASC
    LIMIT $4
    `,
    [serverId, channelId, target, limit],
  );

  return r.rows;
}

function parseTargetDateFromPrompt(prompt) {
  const p = String(prompt || "").trim();

  // 1) YYYY-MM-DD (예: 2026-01-19)
  let m = p.match(/(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (y >= 1970 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
      return { y, mo, d };
  }

  // 2) M월 D일 (예: 1월19일)
  m = p.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = new Date().getFullYear(); // 연도 생략 시 올해로
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { y, mo, d };
  }

  // 3) M/D, M-D (예: 1/19, 1-19)
  m = p.match(/(?:^|\s)(\d{1,2})\s*[-/]\s*(\d{1,2})(?:\s|$)/);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = new Date().getFullYear();
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { y, mo, d };
  }

  return null;
}
async function findLatestImageInChannelByKstDate({
  serverId,
  channelId,
  y,
  mo,
  d,
}) {
  // targetDate: '2026-01-19'
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const target = `${y}-${mm}-${dd}`;

  const r = await pool.query(
    `
    SELECT f.file_url, f.file_name, f.mime_type, m.id AS message_id, m.created_at
    FROM channel_message_files f
    JOIN channel_messages m ON m.id = f.message_id
    WHERE m.server_id = $1
      AND m.channel_id = $2
      AND LOWER(f.mime_type) LIKE 'image/%'
      AND (m.created_at AT TIME ZONE 'Asia/Seoul')::date = $3::date
    ORDER BY m.id DESC
    LIMIT 1
    `,
    [serverId, channelId, target],
  );

  return r.rows[0] || null;
}

// 채널별/유저별 과도 호출 방지 (간단 버전)
const botCooldown = new Map(); // key: `${serverId}:${channelId}:${userId}` -> lastMs
function isRateLimited({ serverId, channelId, userId, windowMs = 5000 }) {
  const key = `${serverId}:${channelId}:${userId}`;
  const now = Date.now();
  const last = botCooldown.get(key) || 0;
  if (now - last < windowMs) return true;
  botCooldown.set(key, now);
  return false;
}
async function loadRecentChannelHistory({ serverId, channelId, limit = 40 }) {
  const res = await pool.query(
    `
    SELECT
      m.id,
      m.content,
      u.username,
      u.is_bot
    FROM channel_messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.server_id = $1 AND m.channel_id = $2
    ORDER BY m.id DESC
    LIMIT $3
    `,
    [serverId, channelId, limit],
  );

  // 오래된 → 최신 순으로
  const rows = res.rows.reverse();

  // LLM 입력용 텍스트 직렬화
  return rows
    .map((r) => {
      const name = r.is_bot ? BOT_USERNAME : r.username;
      return `${name}: ${r.content}`;
    })
    .join("\n");
}

module.exports = {
  initSocket,
  getIo,
  onlineUsers,
};
