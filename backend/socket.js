// socket.js
const { Server } = require("socket.io");
const pool = require("./config/db");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { JWT_SECRET } = require("./config/network");
const { isAllowedOrigin } = require("./config/cors");
const { socketLogger, log } = require("./middleware/logger");
const { loadRooms } = require("./utils/room");

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

    socket.on("join-voice", ({ channelId }) => {
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

      if (!voiceMembers.has(cid)) voiceMembers.set(cid, new Map());
      const map = voiceMembers.get(cid);

      // ✅ join 직전, 기존 피어 목록을 joiner에게 전달
      const peers = Array.from(map.keys()).filter((sid) => sid !== socket.id);
      socket.emit("voice:peers", { channelId: cid, peers });

      // ✅ 멤버 등록(이제 socketId 포함)
      map.set(socket.id, {
        socketId: socket.id,
        userId,
        username,
        micMuted: false,
      });

      emitVoiceMembers(io, cid);
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
          [dmId, userId]
        );
        if (auth.rowCount === 0) return;

        const result = await pool.query(
          `
          INSERT INTO dm_messages (dm_id, user_id, content)
          VALUES ($1, $2, $3)
          RETURNING id, dm_id, user_id, content, created_at
          `,
          [dmId, userId, text]
        );

        const msgRow = result.rows[0];

        await pool.query(
          `
          UPDATE dms SET updated_at = NOW()
          WHERE id = $1
          `,
          [dmId]
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
          [sid, userId]
        );
        if (mem.rowCount === 0) return;

        // (권장) 채널이 해당 서버 소속인지 검증
        const ch = await pool.query(
          `SELECT 1 FROM server_channels WHERE id = $1 AND server_id = $2`,
          [channelId, sid]
        );
        if (ch.rowCount === 0) return;

        // ✅ DB 저장 (id는 SERIAL이라 넣지 않음)
        const saved = await pool.query(
          `
      INSERT INTO channel_messages (server_id, channel_id, user_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, content, created_at
      `,
          [sid, channelId, userId, text]
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

module.exports = {
  initSocket,
  getIo,
  onlineUsers,
};
