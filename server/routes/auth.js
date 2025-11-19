const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, nickname } = req.body;

    // 입력 검증
    if (!username || !email || !password || !nickname) {
      return res.status(400).json({ 
        success: false, 
        message: '모든 필드를 입력해주세요.' 
      });
    }

    // 사용자명 형식 검증
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자명은 3-50자의 영문, 숫자, 언더스코어만 사용 가능합니다.' 
      });
    }

    // 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: '올바른 이메일 형식이 아닙니다.' 
      });
    }

    // 비밀번호 강도 검증
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: '비밀번호는 6자 이상이어야 합니다.' 
      });
    }

    // 중복 검사
    const existingUser = await User.findOne({
      where: {
        $or: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      const field = existingUser.username === username ? '사용자명' : '이메일';
      return res.status(400).json({ 
        success: false, 
        message: `이미 존재하는 ${field}입니다.` 
      });
    }

    // 비밀번호 해시화
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 사용자 생성
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      nickname,
      status: 'offline',
      isActive: true,
      emailVerified: false
    });

    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET || 'devsync-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        user: user.toSafeJSON(),
        token
      }
    });

  } catch (error) {
    console.error('회원가입 오류:', error);
    
    // Sequelize 유효성 검사 오류 처리
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ') 
      });
    }
    
    // Sequelize 고유 제약 조건 오류 처리
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        success: false, 
        message: '이미 존재하는 사용자명 또는 이메일입니다.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 입력 검증
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자명과 비밀번호를 입력해주세요.' 
      });
    }

    // 사용자 찾기 (활성화된 사용자만)
    const user = await User.findOne({
      where: { 
        username,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '존재하지 않는 사용자이거나 비활성화된 계정입니다.' 
      });
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: '비밀번호가 일치하지 않습니다.' 
      });
    }

    // 사용자 상태 업데이트 (온라인으로 변경)
    await user.updateLastSeen();

    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET || 'devsync-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '로그인 성공',
      data: {
        user: user.toSafeJSON(),
        token
      }
    });

  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 로그아웃
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '토큰이 필요합니다.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsync-secret-key');
    const user = await User.findByPk(decoded.userId);

    if (user) {
      await user.setOffline();
    }

    res.json({
      success: true,
      message: '로그아웃 성공'
    });

  } catch (error) {
    console.error('로그아웃 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// 토큰 검증
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '토큰이 필요합니다.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsync-secret-key');
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: '유효하지 않은 토큰입니다.' 
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toSafeJSON(),
        token
      }
    });

  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.status(401).json({ 
      success: false, 
      message: '유효하지 않은 토큰입니다.' 
    });
  }
});

// 토큰 갱신
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '토큰이 필요합니다.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsync-secret-key');
    const user = await User.findByPk(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: '유효하지 않은 토큰입니다.' 
      });
    }

    // 새 토큰 생성
    const newToken = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET || 'devsync-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: user.toSafeJSON(),
        token: newToken
      }
    });

  } catch (error) {
    console.error('토큰 갱신 오류:', error);
    res.status(401).json({ 
      success: false, 
      message: '유효하지 않은 토큰입니다.' 
    });
  }
});

module.exports = router;
