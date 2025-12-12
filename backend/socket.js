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
const voiceMembers = new Map();
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

      if (!token) {
        return next(new Error("NO_TOKEN"));
      }

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
    // ... (기존 서버 채팅 / 친구 알림 이벤트들)

    /**
     * 클라이언트가 특정 DM 방에 입장
     * 예: socket.emit('join-dm', dmId)
     */
    socket.on("join-dm", (dmId) => {
      if (!dmId) return;
      // DM 방은 "dm_방번호" 이름으로 관리
      socket.join(`dm_${dmId}`);
    });

    /**
     * DM 메시지 전송
     * 예: socket.emit('send-dm', { dmId, message: '안녕' })
     */
    socket.on("send-dm", async (data) => {
      try {
        if (!socket.user) return; // JWT 인증에서 넣어둔 유저 정보
        const { dmId, message } = data || {};
        const text = (message || "").trim();
        if (!dmId || !text) return;

        const userId = socket.user.userId;
        const username = socket.user.username;

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
        if (auth.rowCount === 0) {
          return; // 권한 없으면 무시
        }

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

        // 4) 브로드캐스트할 payload 구성
        const payload = {
          id: msgRow.id,
          dm_id: msgRow.dm_id,
          user_id: msgRow.user_id,
          username,
          message: msgRow.content,
          created_at: msgRow.created_at,
        };

        // 5) 해당 DM 방에 있는 유저들에게 보내기
        //    클라이언트는 socket.on('receive-dm', ...) 으로 받으면 됨
        io.to(`dm_${dmId}`).emit("receive-dm", payload);
      } catch (err) {
        console.error("SEND_DM_ERROR", err);
      }
    });

    // ... (필요하다면 추가 이벤트)
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
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    log.info(
      `👤 ONLINE_ADD userId=${userId}, socketId=${socket.id}, totalSockets=${
        onlineUsers.get(userId).size
      }`
    );

    /**
     * 방 입장
     * payload: { roomId, username } 또는 roomId 문자열
     */
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

    /**
     * 메시지 전송
     * data: { roomId, message }
     */
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

    /**
     * 연결 해제
     */
    socket.on("disconnect", (reason) => {
      log.connection("DISCONNECTED", socket.id, `Reason: ${reason}`);

      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(socket.id);
        const remain = set.size;
        if (remain === 0) {
          onlineUsers.delete(userId);
        }
        log.info(
          `👤 ONLINE_REMOVE userId=${userId}, socketId=${socket.id}, remainSockets=${remain}`
        );
      }
    });
  });

  return io;
}
function emitVoiceMembers(io, channelId) {
  const membersMap = voiceMembers.get(channelId);
  const members = membersMap ? Array.from(membersMap.values()) : [];

  // 이 채널에 참여한 소켓(room)에만 브로드캐스트
  io.to(`voice:${channelId}`).emit("voice-members", {
    channelId,
    members, // [{ userId, username }]
  });
}

/**
 * 라우터 등에서 Socket.IO 인스턴스를 얻기 위한 함수
 */
function getIo() {
  if (!ioInstance) {
    throw new Error("Socket.IO has not been initialized");
  }
  return ioInstance;
}

module.exports = {
  initSocket,
  getIo,
  onlineUsers,
};
