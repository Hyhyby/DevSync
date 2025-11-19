const { DataTypes } = require('sequelize');
const { sequelize, enableDirtyChecking } = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: '메시지 고유 식별자'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 10000] // 최대 10,000자
    },
    comment: '메시지 내용'
  },
  type: {
    type: DataTypes.ENUM('text', 'image', 'file', 'system', 'emoji', 'sticker'),
    defaultValue: 'text',
    comment: '메시지 타입'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '읽음 여부'
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '삭제 여부 (soft delete)'
  },
  replyTo: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '답장 대상 메시지 ID'
  },
  editedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '수정 시간'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '메시지 메타데이터 (파일 정보, 이미지 크기 등)'
  },
  reactions: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '메시지 반응 (이모지 반응)'
  },
  isPinned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '고정 메시지 여부'
  },
  readBy: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: '읽은 사용자 목록'
  }
}, {
  tableName: 'messages',
  timestamps: true, // createdAt, updatedAt 자동 생성 (JPA Auditing과 동일)
  underscored: true, // snake_case 사용
  freezeTableName: true, // 테이블명 복수형 방지
  paranoid: false, // soft delete는 isDeleted 필드로 관리
  indexes: [
    {
      fields: ['chat_room_id']
    },
    {
      fields: ['sender_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['is_deleted']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['reply_to']
    },
    {
      fields: ['is_pinned']
    }
  ],
  hooks: {
    // JPA Auditing과 유사한 동작을 위한 훅
    beforeCreate: (message) => {
      console.log(`➕ Message 엔티티 생성: ${message.type} 메시지`);
    },
    beforeUpdate: (message) => {
      if (message.changed()) {
        console.log(`🔄 Message 엔티티 업데이트 감지:`, message.changed());
        
        // 메시지가 수정된 경우 editedAt 업데이트
        if (message.changed('content')) {
          message.editedAt = new Date();
        }
        
        // updatedAt은 자동으로 업데이트됨
      }
    },
    beforeDestroy: (message) => {
      console.log(`🗑️ Message 엔티티 삭제: ${message.id}`);
    }
  }
});

// 더티체킹 활성화
enableDirtyChecking(Message);

// 인스턴스 메서드 추가
Message.prototype.markAsRead = function(userId) {
  const readBy = this.readBy || [];
  if (!readBy.includes(userId)) {
    readBy.push(userId);
    return this.update({ 
      readBy,
      isRead: true 
    });
  }
  return Promise.resolve(this);
};

Message.prototype.addReaction = function(userId, emoji) {
  const reactions = this.reactions || {};
  if (!reactions[emoji]) {
    reactions[emoji] = [];
  }
  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId);
    return this.update({ reactions });
  }
  return Promise.resolve(this);
};

Message.prototype.removeReaction = function(userId, emoji) {
  const reactions = this.reactions || {};
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter(id => id !== userId);
    if (reactions[emoji].length === 0) {
      delete reactions[emoji];
    }
    return this.update({ reactions });
  }
  return Promise.resolve(this);
};

Message.prototype.editContent = function(newContent) {
  return this.update({ 
    content: newContent,
    editedAt: new Date()
  });
};

Message.prototype.softDelete = function() {
  return this.update({ isDeleted: true });
};

Message.prototype.pin = function() {
  return this.update({ isPinned: true });
};

Message.prototype.unpin = function() {
  return this.update({ isPinned: false });
};

// 클래스 메서드 추가
Message.findByRoom = function(roomId, options = {}) {
  const { limit = 50, offset = 0, includeDeleted = false } = options;
  
  const where = { chatRoomId: roomId };
  if (!includeDeleted) {
    where.isDeleted = false;
  }
  
  return this.findAll({ 
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });
};

Message.findUnreadByUser = function(userId, roomId) {
  return this.findAll({ 
    where: { 
      chatRoomId: roomId,
      isDeleted: false,
      isRead: false
    },
    order: [['createdAt', 'ASC']]
  });
};

Message.findPinnedMessages = function(roomId) {
  return this.findAll({ 
    where: { 
      chatRoomId: roomId,
      isPinned: true,
      isDeleted: false
    },
    order: [['createdAt', 'DESC']]
  });
};

Message.searchInRoom = function(roomId, searchTerm) {
  return this.findAll({ 
    where: { 
      chatRoomId: roomId,
      isDeleted: false,
      content: {
        [sequelize.Op.like]: `%${searchTerm}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });
};

module.exports = Message;
