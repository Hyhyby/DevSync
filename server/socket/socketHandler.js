const jwt = require('jsonwebtoken');
const { User, ChatRoom, Message } = require('../models');

// 연결된 사용자들을 저장하는 Map
const connectedUsers = new Map();

// Socket.io 핸들러
const socketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('인증 토큰이 필요합니다.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsync-secret-key');
      const user = await User.findByPk(decoded.userId);

      if (!user) {
        return next(new Error('사용자를 찾을 수 없습니다.'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      socket.nickname = user.nickname;
      
      next();
    } catch (error) {
      next(new Error('인증에 실패했습니다.'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`사용자 연결: ${socket.username} (${socket.userId})`);

    // 사용자 상태를 온라인으로 변경
    await User.update(
      { status: 'online', lastSeen: new Date() },
      { where: { id: socket.userId } }
    );

    // 연결된 사용자 목록에 추가
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      username: socket.username,
      nickname: socket.nickname,
      connectedAt: new Date()
    });

    // 사용자에게 연결 성공 알림
    socket.emit('connected', {
      message: 'DevSync에 연결되었습니다.',
      userId: socket.userId,
      username: socket.username
    });

    // 다른 사용자들에게 온라인 상태 알림
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      username: socket.username,
      nickname: socket.nickname
    });

    // 채팅방 참여
    socket.on('join_room', async (data) => {
      try {
        const { roomId } = data;
        
        // 채팅방 존재 확인 및 권한 확인
        const chatRoom = await ChatRoom.findByPk(roomId, {
          include: [{
            model: User,
            as: 'Users',
            where: { id: socket.userId },
            required: true
          }]
        });

        if (!chatRoom) {
          socket.emit('error', { message: '채팅방을 찾을 수 없거나 접근 권한이 없습니다.' });
          return;
        }

        // Socket.io 룸에 참여
        socket.join(roomId);
        
        // 채팅방 참여자들에게 알림
        socket.to(roomId).emit('user_joined_room', {
          userId: socket.userId,
          username: socket.username,
          nickname: socket.nickname,
          roomId
        });

        console.log(`${socket.username}이 채팅방 ${roomId}에 참여했습니다.`);

      } catch (error) {
        console.error('채팅방 참여 오류:', error);
        socket.emit('error', { message: '채팅방 참여에 실패했습니다.' });
      }
    });

    // 채팅방 나가기
    socket.on('leave_room', async (data) => {
      try {
        const { roomId } = data;
        
        socket.leave(roomId);
        
        // 채팅방 참여자들에게 알림
        socket.to(roomId).emit('user_left_room', {
          userId: socket.userId,
          username: socket.username,
          nickname: socket.nickname,
          roomId
        });

        console.log(`${socket.username}이 채팅방 ${roomId}에서 나갔습니다.`);

      } catch (error) {
        console.error('채팅방 나가기 오류:', error);
        socket.emit('error', { message: '채팅방 나가기에 실패했습니다.' });
      }
    });

    // 메시지 전송
    socket.on('send_message', async (data) => {
      try {
        const { roomId, content, type = 'text', replyTo } = data;

        if (!content || !roomId) {
          socket.emit('error', { message: '메시지 내용과 채팅방 ID가 필요합니다.' });
          return;
        }

        // 채팅방 존재 확인 및 권한 확인
        const chatRoom = await ChatRoom.findByPk(roomId, {
          include: [{
            model: User,
            as: 'Users',
            where: { id: socket.userId },
            required: true
          }]
        });

        if (!chatRoom) {
          socket.emit('error', { message: '채팅방을 찾을 수 없거나 접근 권한이 없습니다.' });
          return;
        }

        // 메시지 생성
        const message = await Message.create({
          content,
          type,
          senderId: socket.userId,
          chatRoomId: roomId,
          replyTo
        });

        // 채팅방의 마지막 메시지 시간 업데이트
        await chatRoom.update({ lastMessageAt: new Date() });

        // 생성된 메시지 정보 조회
        const createdMessage = await Message.findByPk(message.id, {
          include: [{
            model: User,
            as: 'sender',
            attributes: ['id', 'nickname', 'profileImage']
          }]
        });

        // 채팅방의 모든 참여자에게 메시지 전송
        io.to(roomId).emit('new_message', {
          message: createdMessage,
          roomId
        });

        console.log(`${socket.username}이 채팅방 ${roomId}에 메시지를 전송했습니다.`);

      } catch (error) {
        console.error('메시지 전송 오류:', error);
        socket.emit('error', { message: '메시지 전송에 실패했습니다.' });
      }
    });

    // 타이핑 상태 전송
    socket.on('typing', (data) => {
      const { roomId, isTyping } = data;
      
      if (roomId) {
        socket.to(roomId).emit('user_typing', {
          userId: socket.userId,
          username: socket.username,
          nickname: socket.nickname,
          isTyping,
          roomId
        });
      }
    });

    // 연결 해제
    socket.on('disconnect', async () => {
      console.log(`사용자 연결 해제: ${socket.username} (${socket.userId})`);

      // 사용자 상태를 오프라인으로 변경
      await User.update(
        { status: 'offline', lastSeen: new Date() },
        { where: { id: socket.userId } }
      );

      // 연결된 사용자 목록에서 제거
      connectedUsers.delete(socket.userId);

      // 다른 사용자들에게 오프라인 상태 알림
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        username: socket.username,
        nickname: socket.nickname
      });
    });
  });

  // 연결된 사용자 목록 조회 함수
  const getConnectedUsers = () => {
    return Array.from(connectedUsers.values());
  };

  return { getConnectedUsers };
};

module.exports = socketHandler;
