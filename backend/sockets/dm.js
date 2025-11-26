// dm.js
const { v4: uuidv4 } = require('uuid');
const { loadRooms } = require('../utils/room');

const rooms = loadRooms();

module.exports = function (io, socket) {
  // socket.js의 미들웨어에서 설정한 user 정보 가져오기
  const { userId, username } = socket.user;

  /**
   * 방 입장
   * payload: { roomId, username } 또는 roomId 문자열
   */
  socket.on('join-room', (payload) => {
    const roomId = typeof payload === 'string' ? payload : payload?.roomId;
    const joinedUsername = payload?.username || username || 'Unknown';

    if (!roomId) return;

    // 임시 진단 로그
    console.log(`[JOIN] User: ${username} trying to join Room: ${roomId}`); 

    const room = rooms.find((r) => r.id === roomId);
    socket.emit('room-info', room || { id: roomId, name: roomId });
    socket.join(roomId);

    // 임시 진단 로그 2
    console.log(`[JOIN SUCCESS] User: ${username} joined Room: ${roomId}. Sockets in room: ${io.sockets.adapter.rooms.get(roomId)?.size || 0}`);

    // 시스템 메시지 생성
    const systemMsg = {
      id: uuidv4(),
      message: `${joinedUsername}님이 들어왔습니다.`,
      userId: 'system',
      username: 'System',
      timestamp: new Date().toISOString(),
      isSystem: true,
    };

    // 해당 방에 있는 모든 유저에게 전송
    io.to(roomId).emit('receive-message', systemMsg);
  });

  /**
   * 메시지 전송
   * data: { roomId, message }
   */
  socket.on('send-message', (data = {}) => {
    const { roomId, message } = data;
    if (!roomId || !message) return;

    // 임시 진단 로그 3
    console.log(`[SEND] User: ${username} sending to Room: ${roomId}, Message: ${message}`);

    const msg = {
      id: uuidv4(),
      message,
      userId,
      username,
      timestamp: new Date().toISOString(),
    };

    io.to(roomId).emit('receive-message', msg);

    // 임시 진단 로그 4
    console.log(`[BROADCAST SUCCESS] Sent message to Room: ${roomId}`);
  });
};