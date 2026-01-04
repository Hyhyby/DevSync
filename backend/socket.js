// socket.js (Socket.IO 설정 담당)
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

// ✅ 음성 채널 멤버: channelId(string) -> Map<socketId, { userId, username }>
const voiceMembers = new Map();

function emitVoiceMembers(io, channelId) {
  const cid = String(channelId);
  const membersMap = voiceMembers.get(cid);
  const members = membersMap ? Array.from(membersMap.values()) : [];

  // 이 채널에 참여한 소켓(room)에만 브로드캐스트
  io.to(`voice:${cid}`).emit("voice-members", {
    channelId: cid,
    members, // [{ userId, username }]
  });
}

/**
 * Socket.IO 초기화
 */
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

  // 전역 저장
  ioInstance = io;

  /**
   * 🔐 인증 미들웨어
   * - 토큰 없거나 검증 실패하면 연결 거부
   */
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers["authorization"] || "").split(" ")[1];

      if (!token) return next(new Error("NO_TOKEN"));

      const user = jwt.verify(token, JWT_SECRET);
      // user: { userId, username, ... }
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    socketLogger(socket);

    // ---------------------------
    // ✅ 인증 유저 체크
    // ---------------------------
    const user = socket.user;
    if (!user || !user.userId) {
      log.warn(
        `⚠️ CONNECTED WITHOUT USER, socketId=${socket.id}, force disconnect`
      );
      socket.disconnect(true);
      return;
    }

    const userId = user.userId;
    const username = user.username;

    log.connection("CONNECTED", socket.id, `User: ${username} (${userId})`);

    // ✅ 인증된 유저를 onlineUsers에 등록
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    log.info(
      `👤 ONLINE_ADD userId=${userId}, socketId=${socket.id}, totalSockets=${
        onlineUsers.get(userId).size
      }`
    );

    // =====================================================
    // ✅ VOICE CHANNEL (멤버목록 + WebRTC 시그널링)
    // =====================================================
    // 디코처럼 "한 번에 하나의 음성 채널"만 들어가게 하기 위한 상태
    socket.currentVoiceChannelId = null;

    // 음성 채널 입장
    // client: socket.emit("join-voice", { channelId })
    socket.on("join-voice", ({ channelId }) => {
      if (!channelId) return;
      const cid = String(channelId);
      const roomName = `voice:${cid}`;

      // ✅ 이미 다른 음성 채널에 들어가 있으면 먼저 나가기
      const prev = socket.currentVoiceChannelId;
      if (prev && prev !== cid) {
        const prevRoom = `voice:${prev}`;

        socket.leave(prevRoom);

        const prevMap = voiceMembers.get(prev);
        if (prevMap) {
          prevMap.delete(socket.id);
          if (prevMap.size === 0) voiceMembers.delete(prev);
        }

        // ✅ (추가) prevRoom 사람들에게 "나감" 알림 (WebRTC 정리용)
        socket.to(prevRoom).emit("voice:peer-left", {
          channelId: String(prev),
          peerId: socket.id,
        });

        emitVoiceMembers(io, prev);
      }

      // ✅ 새 채널 입장
      socket.currentVoiceChannelId = cid;
      socket.join(roomName);

      if (!voiceMembers.has(cid)) voiceMembers.set(cid, new Map());
      voiceMembers.get(cid).set(socket.id, { userId, username });

      // ✅ (추가) 현재 room에 있는 peer(socket.id) 목록을 새로 들어온 사람에게 전달
      const clients = Array.from(io.sockets.adapter.rooms.get(roomName) || []);
      const peers = clients.filter((id) => id !== socket.id);

      socket.emit("voice:peers", {
        channelId: cid,
        peers, // [socketId, socketId...]
      });

      // ✅ (추가) 기존 사람들에게 새 유저가 들어왔다고 알림(선택)
      socket.to(roomName).emit("voice:peer-joined", {
        channelId: cid,
        peerId: socket.id,
        user: { userId, username },
      });

      emitVoiceMembers(io, cid);
    });

    // 음성 채널 퇴장
    // client: socket.emit("leave-voice", { channelId })
    socket.on("leave-voice", ({ channelId }) => {
      const cid = String(channelId || socket.currentVoiceChannelId || "");
      if (!cid) return;

      const roomName = `voice:${cid}`;

      socket.leave(roomName);

      const map = voiceMembers.get(cid);
      if (map) {
        map.delete(socket.id);
        if (map.size === 0) voiceMembers.delete(cid);
      }

      if (socket.currentVoiceChannelId === cid) {
        socket.currentVoiceChannelId = null;
      }

      // ✅ (추가) 같은 채널 사람들에게 "나감" 알림 (WebRTC 정리용)
      socket.to(roomName).emit("voice:peer-left", {
        channelId: cid,
        peerId: socket.id,
      });

      emitVoiceMembers(io, cid);
    });

    // ✅ WebRTC 시그널링 중계
    // client: socket.emit("voice:signal", { to, channelId, data })
    socket.on("voice:signal", ({ to, channelId, data }) => {
      if (!to || !data) return;

      io.to(to).emit("voice:signal", {
        from: socket.id,
        channelId: String(channelId || socket.currentVoiceChannelId || ""),
        data, // { type: 'offer'|'answer'|'ice', sdp/candidate... }
      });
    });

    // =====================================================
    // ✅ DM
    // =====================================================
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

        // 1) 내가 이 DM 방의 참가자인지 확인 (보안)
        const auth = await pool.query(
          `
          SELECT 1
          FROM dm_participants
          WHERE dm_id = $1
            AND user_id = $2
          `,
          [dmId, userId]
        );
        if (auth.rowCount === 0) return;

        // 2) DB에 메시지 저장
        const result = await pool.query(
          `
          INSERT INTO dm_messages (dm_id, user_id, content)
          VALUES ($1, $2, $3)
          RETURNING id, dm_id, user_id, content, created_at
          `,
          [dmId, userId, text]
        );

        const msgRow = result.rows[0];

        // 3) DM 마지막 활동시간 업데이트 (목록 정렬용)
        await pool.query(
          `
          UPDATE dms
          SET updated_at = NOW()
          WHERE id = $1
          `,
          [dmId]
        );

        // 4) payload
        const payload = {
          id: msgRow.id,
          dm_id: msgRow.dm_id,
          user_id: msgRow.user_id,
          username,
          message: msgRow.content,
          created_at: msgRow.created_at,
        };

        // 5) 브로드캐스트
        io.to(`dm_${dmId}`).emit("receive-dm", payload);
      } catch (err) {
        console.error("SEND_DM_ERROR", err);
      }
    });

    // =====================================================
    // ✅ 서버(텍스트 채팅방) - 기존 로직 유지
    // =====================================================
    socket.on("join-room", (payload) => {
      const roomId = typeof payload === "string" ? payload : payload?.roomId;
      const joinedUsername = payload?.username || username || "Unknown";
      if (!roomId) return;

      const room = rooms.find((r) => r.id === roomId);
      socket.emit("room-info", room || { id: roomId, name: roomId });
      socket.join(roomId);

      const systemMsg = {
        id: uuidv4(),
        message: `${joinedUsername}님이 들어왔습니다.`,
        userId: "system",
        username: "System",
        timestamp: new Date().toISOString(),
        isSystem: true,
      };

      io.to(roomId).emit("receive-message", systemMsg);
    });

    socket.on("send-message", (data = {}) => {
      const { roomId, message } = data;
      if (!roomId || !message) return;

      const msg = {
        id: uuidv4(),
        message,
        userId,
        username,
        timestamp: new Date().toISOString(),
      };

      io.to(roomId).emit("receive-message", msg);
    });

    // =====================================================
    // ✅ 연결 해제
    // =====================================================
    socket.on("disconnect", (reason) => {
      log.connection("DISCONNECTED", socket.id, `Reason: ${reason}`);

      // onlineUsers 정리
      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(socket.id);
        const remain = set.size;
        if (remain === 0) onlineUsers.delete(userId);

        log.info(
          `👤 ONLINE_REMOVE userId=${userId}, socketId=${socket.id}, remainSockets=${remain}`
        );
      }

      const cid = socket.currentVoiceChannelId;
      if (cid) {
        const roomName = `voice:${cid}`;

        const map = voiceMembers.get(cid);
        if (map) {
          map.delete(socket.id);
          if (map.size === 0) voiceMembers.delete(cid);
        }

        // ✅ (추가) 같은 방 사람들에게 나감 알림
        socket.to(roomName).emit("voice:peer-left", {
          channelId: String(cid),
          peerId: socket.id,
        });

        emitVoiceMembers(io, cid);
      }
    });
  });

  return io;
}

/**
 * 라우터 등에서 Socket.IO 인스턴스를 얻기 위한 함수
 */
function getIo() {
  if (!ioInstance) throw new Error("Socket.IO has not been initialized");
  return ioInstance;
}

module.exports = {
  initSocket,
  getIo,
  onlineUsers,
};
