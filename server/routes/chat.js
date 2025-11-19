const express = require('express');
const jwt = require('jsonwebtoken');
const { User, ChatRoom, Message } = require('../models');
const router = express.Router();

// JWT 인증 미들웨어
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: '인증 토큰이 필요합니다.' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsync-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: '유효하지 않은 토큰입니다.' 
    });
  }
};

// 채팅방 목록 조회
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      include: [{
        model: ChatRoom,
        as: 'ChatRooms',
        through: { attributes: [] },
        include: [{
          model: Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [{
            model: User,
            as: 'sender',
            attributes: ['id', 'nickname']
          }]
        }]
      }]
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '사용자를 찾을 수 없습니다.' 
      });
    }

    res.json({
      success: true,
      data: user.ChatRooms
    });

  } catch (error) {
    console.error('채팅방 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 채팅방 생성
router.post('/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, type = 'private', participantIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: '채팅방 이름을 입력해주세요.' 
      });
    }

    // 채팅방 생성
    const chatRoom = await ChatRoom.create({
      name,
      description,
      type
    });

    // 생성자를 채팅방에 추가
    await chatRoom.addUser(req.user.userId);

    // 참여자들을 채팅방에 추가
    if (participantIds.length > 0) {
      await chatRoom.addUsers(participantIds);
    }

    // 생성된 채팅방 정보 조회
    const createdRoom = await ChatRoom.findByPk(chatRoom.id, {
      include: [{
        model: User,
        as: 'Users',
        attributes: ['id', 'username', 'nickname', 'status']
      }]
    });

    res.status(201).json({
      success: true,
      message: '채팅방이 생성되었습니다.',
      data: createdRoom
    });

  } catch (error) {
    console.error('채팅방 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 채팅방 참여
router.post('/rooms/:roomId/join', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.user;

    const chatRoom = await ChatRoom.findByPk(roomId);
    
    if (!chatRoom) {
      return res.status(404).json({ 
        success: false, 
        message: '채팅방을 찾을 수 없습니다.' 
      });
    }

    // 이미 참여 중인지 확인
    const isAlreadyJoined = await chatRoom.hasUser(userId);
    
    if (isAlreadyJoined) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 참여 중인 채팅방입니다.' 
      });
    }

    // 채팅방에 참여
    await chatRoom.addUser(userId);

    res.json({
      success: true,
      message: '채팅방에 참여했습니다.'
    });

  } catch (error) {
    console.error('채팅방 참여 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 메시지 목록 조회
router.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // 채팅방 존재 확인 및 권한 확인
    const chatRoom = await ChatRoom.findByPk(roomId, {
      include: [{
        model: User,
        as: 'Users',
        where: { id: req.user.userId },
        required: true
      }]
    });

    if (!chatRoom) {
      return res.status(404).json({ 
        success: false, 
        message: '채팅방을 찾을 수 없거나 접근 권한이 없습니다.' 
      });
    }

    // 메시지 조회
    const messages = await Message.findAndCountAll({
      where: { 
        chatRoomId: roomId,
        isDeleted: false
      },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'nickname', 'profileImage']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        messages: messages.rows.reverse(), // 최신순으로 정렬
        totalCount: messages.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(messages.count / limit)
      }
    });

  } catch (error) {
    console.error('메시지 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 메시지 전송 (실제로는 Socket.io를 통해 처리되지만 REST API도 제공)
router.post('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, type = 'text', replyTo } = req.body;

    if (!content) {
      return res.status(400).json({ 
        success: false, 
        message: '메시지 내용을 입력해주세요.' 
      });
    }

    // 채팅방 존재 확인 및 권한 확인
    const chatRoom = await ChatRoom.findByPk(roomId, {
      include: [{
        model: User,
        as: 'Users',
        where: { id: req.user.userId },
        required: true
      }]
    });

    if (!chatRoom) {
      return res.status(404).json({ 
        success: false, 
        message: '채팅방을 찾을 수 없거나 접근 권한이 없습니다.' 
      });
    }

    // 메시지 생성
    const message = await Message.create({
      content,
      type,
      senderId: req.user.userId,
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

    res.status(201).json({
      success: true,
      message: '메시지가 전송되었습니다.',
      data: createdMessage
    });

  } catch (error) {
    console.error('메시지 전송 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

module.exports = router;
