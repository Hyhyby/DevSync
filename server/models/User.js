const { DataTypes } = require('sequelize');
const { sequelize, enableDirtyChecking } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: '사용자 고유 식별자'
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      notEmpty: true,
      isAlphanumeric: true
    },
    comment: '사용자명 (로그인용)'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    },
    comment: '이메일 주소'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [6, 255],
      notEmpty: true
    },
    comment: '해시된 비밀번호'
  },
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      len: [1, 50],
      notEmpty: true
    },
    comment: '표시용 닉네임'
  },
  profileImage: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    },
    comment: '프로필 이미지 URL'
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'away'),
    defaultValue: 'offline',
    comment: '사용자 상태'
  },
  lastSeen: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '마지막 접속 시간'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '계정 활성화 상태'
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '이메일 인증 여부'
  }
}, {
  tableName: 'users',
  timestamps: true, // createdAt, updatedAt 자동 생성 (JPA Auditing과 동일)
  underscored: true, // snake_case 사용
  freezeTableName: true, // 테이블명 복수형 방지
  paranoid: false, // soft delete 비활성화
  indexes: [
    {
      unique: true,
      fields: ['username']
    },
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['status']
    },
    {
      fields: ['last_seen']
    }
  ],
  hooks: {
    // JPA Auditing과 유사한 동작을 위한 훅
    beforeCreate: (user) => {
      console.log(`➕ User 엔티티 생성: ${user.username}`);
    },
    beforeUpdate: (user) => {
      if (user.changed()) {
        console.log(`🔄 User 엔티티 업데이트 감지:`, user.changed());
        // updatedAt은 자동으로 업데이트됨
      }
    },
    beforeDestroy: (user) => {
      console.log(`🗑️ User 엔티티 삭제: ${user.username}`);
    }
  }
});

// 더티체킹 활성화
enableDirtyChecking(User);

// 인스턴스 메서드 추가
User.prototype.toSafeJSON = function() {
  const values = { ...this.dataValues };
  delete values.password; // 비밀번호 제외
  return values;
};

User.prototype.updateLastSeen = function() {
  return this.update({ 
    lastSeen: new Date(),
    status: 'online'
  });
};

User.prototype.setOffline = function() {
  return this.update({ 
    status: 'offline',
    lastSeen: new Date()
  });
};

// 클래스 메서드 추가
User.findByUsername = function(username) {
  return this.findOne({ where: { username } });
};

User.findByEmail = function(email) {
  return this.findOne({ where: { email } });
};

User.findOnlineUsers = function() {
  return this.findAll({ 
    where: { status: 'online' },
    order: [['lastSeen', 'DESC']]
  });
};

module.exports = User;
