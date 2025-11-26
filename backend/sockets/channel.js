// sockets/channel.js
const { v4: uuidv4 } = require('uuid');

module.exports = (io, socket) => {
  // socket.js 미들웨어에서 이미 socket.user를 세팅했다고 가정
  const user = socket.user || { userId: 'anon', username: 'Anonymous' };
  const { userId, username } = user;

  /**
   * 1. 채널(Room) 입장
   * 클라이언트에서 { roomId: "채널ID" } 형태를 보내야 함
   */
  socket.on('join-room', (payload) => {
    // payload가 문자열이면 그대로 쓰고, 객체면 roomId 추출
    const roomId = typeof payload === 'string' ? payload : payload?.roomId;

    if (!roomId) {
      console.error(`❌ [join-room] roomId missing. payload:`, payload);
      return;
    }

    console.log(`📥 [join-room] User ${username}(${userId}) joining ${roomId}`);

    // 기존에 들어가 있던 방이 있다면 나가는 로직이 필요할 수도 있음 (선택사항)
    // socket.rooms.forEach((r) => { if (r !== socket.id) socket.leave(r); });

    socket.join(roomId);

    const systemMsg = {
      id: uuidv4(),
      type: 'system',
      message: `${username}님이 입장했습니다.`,
      timestamp: new Date().toISOString(),
    };
    io.to(roomId).emit('receive-message', systemMsg);    
  });

  /**
   * 2. 메시지 전송
   * 클라이언트에서 { roomId, message } 전송
   */
  socket.on('send-message', (data) => {
    const { roomId, message } = data;
    if (!roomId || !message) return;

    console.log(`💬 [send-message] ${username} in ${roomId}: ${message}`);

    const msgPayload = {
      id: uuidv4(),
      roomId,
      message,
      userId,
      username,     // 프론트에서 닉네임 표시용
      timestamp: new Date().toISOString(),
      type: 'user', // 메시지 타입 구분
    };

    // 해당 방에 있는 모든 사람(나 포함)에게 전송
    io.to(roomId).emit('receive-message', msgPayload);
  });
};