const { DataTypes } = require('sequelize');
const { sequelize, enableDirtyChecking } = require('../config/database');

const ChatRoom = sequelize.define('ChatRoom', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: '채팅방 고유 식별자'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
    },
    comment: '채팅방 이름'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '채팅방 설명'
  },
  type: {
    type: DataTypes.ENUM('private', 'group', 'public'),
    defaultValue: 'private',
    comment: '채팅방 타입'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '채팅방 활성화 상태'
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '마지막 메시지 시간'
  },
  maxMembers: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
    validate: {
      min: 2,
      max: 1000
    },
    comment: '최대 참여자 수'
  },
  isEncrypted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '메시지 암호화 여부'
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '채팅방 설정 (JSON)'
  }
}, {
  tableName: 'chat_rooms',
  timestamps: true, // createdAt, updatedAt 자동 생성 (JPA Auditing과 동일)
  underscored: true, // snake_case 사용
  freezeTableName: true, // 테이블명 복수형 방지
  paranoid: false, // soft delete 비활성화
  indexes: [
    {
      fields: ['type']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['last_message_at']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    // JPA Auditing과 유사한 동작을 위한 훅
    beforeCreate: (chatRoom) => {
      console.log(`➕ ChatRoom 엔티티 생성: ${chatRoom.name}`);
    },
    beforeUpdate: (chatRoom) => {
      if (chatRoom.changed()) {
        console.log(`🔄 ChatRoom 엔티티 업데이트 감지:`, chatRoom.changed());
        // updatedAt은 자동으로 업데이트됨
      }
    },
    beforeDestroy: (chatRoom) => {
      console.log(`🗑️ ChatRoom 엔티티 삭제: ${chatRoom.name}`);
    }
  }
});

// 더티체킹 활성화
enableDirtyChecking(ChatRoom);

// 인스턴스 메서드 추가
ChatRoom.prototype.updateLastMessage = function() {
  return this.update({ 
    lastMessageAt: new Date()
  });
};

ChatRoom.prototype.addMember = function(userId) {
  return this.addUser(userId);
};

ChatRoom.prototype.removeMember = function(userId) {
  return this.removeUser(userId);
};

ChatRoom.prototype.getMemberCount = function() {
  return this.countUsers();
};

ChatRoom.prototype.isMember = function(userId) {
  return this.hasUser(userId);
};

// 클래스 메서드 추가
ChatRoom.findByType = function(type) {
  return this.findAll({ 
    where: { type, isActive: true },
    order: [['lastMessageAt', 'DESC']]
  });
};

ChatRoom.findActiveRooms = function() {
  return this.findAll({ 
    where: { isActive: true },
    order: [['lastMessageAt', 'DESC']]
  });
};

ChatRoom.findRecentRooms = function(limit = 10) {
  return this.findAll({ 
    where: { isActive: true },
    order: [['lastMessageAt', 'DESC']],
    limit
  });
};

module.exports = ChatRoom;
