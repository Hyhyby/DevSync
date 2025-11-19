const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
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

// 사용자 프로필 조회
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '사용자를 찾을 수 없습니다.' 
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 사용자 프로필 수정
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { nickname, profileImage } = req.body;
    const user = await User.findByPk(req.user.userId);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '사용자를 찾을 수 없습니다.' 
      });
    }

    // 업데이트할 데이터 준비
    const updateData = {};
    if (nickname) updateData.nickname = nickname;
    if (profileImage !== undefined) updateData.profileImage = profileImage;

    // 사용자 정보 업데이트 (Sequelize의 더티체킹 활용)
    await user.update(updateData);

    res.json({
      success: true,
      message: '프로필이 수정되었습니다.',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        profileImage: user.profileImage,
        status: user.status,
        lastSeen: user.lastSeen
      }
    });

  } catch (error) {
    console.error('프로필 수정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 비밀번호 변경
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: '새 비밀번호는 6자 이상이어야 합니다.' 
      });
    }

    const user = await User.findByPk(req.user.userId);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '사용자를 찾을 수 없습니다.' 
      });
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: '현재 비밀번호가 일치하지 않습니다.' 
      });
    }

    // 새 비밀번호 해시화
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // 비밀번호 업데이트
    await user.update({ password: hashedNewPassword });

    res.json({
      success: true,
      message: '비밀번호가 변경되었습니다.'
    });

  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 사용자 검색
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: '검색어는 2자 이상이어야 합니다.' 
      });
    }

    const users = await User.findAll({
      where: {
        id: { $ne: req.user.userId }, // 자신 제외
        $or: [
          { username: { $like: `%${query}%` } },
          { nickname: { $like: `%${query}%` } },
          { email: { $like: `%${query}%` } }
        ]
      },
      attributes: ['id', 'username', 'nickname', 'profileImage', 'status', 'lastSeen'],
      limit: 20
    });

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('사용자 검색 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 온라인 사용자 목록 조회
router.get('/online', authenticateToken, async (req, res) => {
  try {
    const onlineUsers = await User.findAll({
      where: {
        status: 'online',
        id: { $ne: req.user.userId } // 자신 제외
      },
      attributes: ['id', 'username', 'nickname', 'profileImage', 'lastSeen'],
      order: [['lastSeen', 'DESC']]
    });

    res.json({
      success: true,
      data: onlineUsers
    });

  } catch (error) {
    console.error('온라인 사용자 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

module.exports = router;
