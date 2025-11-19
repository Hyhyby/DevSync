const User = require('./User');
const ChatRoom = require('./ChatRoom');
const Message = require('./Message');

// User와 ChatRoom 간의 다대다 관계 (사용자는 여러 채팅방에 참여 가능)
User.belongsToMany(ChatRoom, {
  through: 'UserChatRoom',
  foreignKey: 'userId',
  otherKey: 'chatRoomId',
  timestamps: true, // createdAt, updatedAt 자동 생성
  as: 'ChatRooms'
});

ChatRoom.belongsToMany(User, {
  through: 'UserChatRoom',
  foreignKey: 'chatRoomId',
  otherKey: 'userId',
  timestamps: true, // createdAt, updatedAt 자동 생성
  as: 'Users'
});

// User와 Message 간의 일대다 관계 (사용자는 여러 메시지를 보낼 수 있음)
User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'sentMessages'
});

Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});

// ChatRoom과 Message 간의 일대다 관계 (채팅방은 여러 메시지를 가질 수 있음)
ChatRoom.hasMany(Message, {
  foreignKey: 'chatRoomId',
  as: 'messages'
});

Message.belongsTo(ChatRoom, {
  foreignKey: 'chatRoomId',
  as: 'chatRoom'
});

// Message와 Message 간의 자기참조 관계 (답장 기능)
Message.belongsTo(Message, {
  foreignKey: 'replyTo',
  as: 'parentMessage'
});

Message.hasMany(Message, {
  foreignKey: 'replyTo',
  as: 'replies'
});

// ChatRoom과 User 간의 소유자 관계 (채팅방 생성자)
ChatRoom.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

User.hasMany(ChatRoom, {
  foreignKey: 'createdBy',
  as: 'createdRooms'
});

// 관계 설정 완료 후 모델들을 다시 로드하여 관계가 제대로 설정되도록 함
const models = { User, ChatRoom, Message };

// 모든 모델의 관계를 초기화
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = {
  User,
  ChatRoom,
  Message
};
