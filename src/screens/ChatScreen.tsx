import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical, 
  Users,
  Search,
  Phone,
  Video
} from 'lucide-react';
import { useChatStore, useUIStore } from '../stores';
import { chatAPI } from '../services/api';
import { socketService } from '../services/socket';

export const ChatScreen: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { 
    currentRoom, 
    setCurrentRoom, 
    messages, 
    setMessages, 
    addMessage,
    typingUsers,
    setTypingUsers
  } = useChatStore();
  const { openModal } = useUIStore();
  
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (roomId) {
      loadRoomData(roomId);
      loadMessages(roomId);
    }
  }, [roomId]);

  useEffect(() => {
    // 메시지가 업데이트될 때마다 스크롤을 맨 아래로
    scrollToBottom();
  }, [messages]);

  const loadRoomData = async (roomId: string) => {
    try {
      // TODO: 특정 채팅방 정보 로드 API 호출
      // const response = await chatAPI.getChatRoom(roomId);
      // setCurrentRoom(response.data);
    } catch (error) {
      console.error('채팅방 정보 로드 오류:', error);
    }
  };

  const loadMessages = async (roomId: string) => {
    try {
      setLoading(true);
      const response = await chatAPI.getMessages(roomId);
      setMessages(roomId, response.data.messages);
    } catch (error) {
      console.error('메시지 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !roomId) return;

    const messageData = {
      content: messageText.trim(),
      type: 'text' as const
    };

    try {
      // 로컬에 먼저 메시지 추가 (낙관적 업데이트)
      const tempMessage = {
        id: `temp-${Date.now()}`,
        content: messageData.content,
        type: messageData.type,
        senderId: 'current-user', // 실제로는 현재 사용자 ID
        chatRoomId: roomId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: {
          id: 'current-user',
          nickname: '나',
          profileImage: null
        }
      };

      addMessage(roomId, tempMessage);
      setMessageText('');
      setIsTyping(false);

      // 서버에 메시지 전송
      await chatAPI.sendMessage(roomId, messageData);
      
      // 소켓을 통해 실시간 전송
      socketService.sendMessage(roomId, messageData);
    } catch (error) {
      console.error('메시지 전송 오류:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = () => {
    if (!roomId) return;

    setIsTyping(true);
    
    // 타이핑 상태 전송
    socketService.sendTyping(roomId, true);

    // 타이핑 타임아웃 리셋
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.sendTyping(roomId, false);
    }, 1000);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '오늘';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '어제';
    } else {
      return date.toLocaleDateString('ko-KR');
    }
  };

  const roomMessages = roomId ? messages[roomId] || [] : [];

  return (
    <div className="chat-screen">
      {/* 채팅방 헤더 */}
      <div className="chat-header">
        <div className="chat-room-info">
          <div className="room-avatar">
            <Users size={20} />
          </div>
          <div className="room-details">
            <h2>{currentRoom?.name || '채팅방'}</h2>
            <p>{currentRoom?.description || '설명이 없습니다.'}</p>
          </div>
        </div>
        
        <div className="chat-actions">
          <button className="btn-icon" title="검색">
            <Search size={20} />
          </button>
          <button className="btn-icon" title="음성 통화">
            <Phone size={20} />
          </button>
          <button className="btn-icon" title="영상 통화">
            <Video size={20} />
          </button>
          <button 
            className="btn-icon" 
            title="채팅방 설정"
            onClick={() => openModal('roomSettings')}
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="chat-messages">
        {loading ? (
          <div className="loading-messages">
            <div className="spinner" />
            <p>메시지를 불러오는 중...</p>
          </div>
        ) : (
          <div className="messages-container">
            {roomMessages.map((message, index) => {
              const prevMessage = index > 0 ? roomMessages[index - 1] : null;
              const showDate = !prevMessage || 
                formatDate(message.createdAt) !== formatDate(prevMessage.createdAt);
              
              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="date-separator">
                      {formatDate(message.createdAt)}
                    </div>
                  )}
                  <div className={`message ${message.senderId === 'current-user' ? 'own' : ''}`}>
                    <div className="message-avatar">
                      {message.sender?.nickname?.charAt(0) || '?'}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-sender">
                          {message.sender?.nickname || '알 수 없음'}
                        </span>
                        <span className="message-time">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                      <div className="message-text">
                        {message.content}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            
            {/* 타이핑 인디케이터 */}
            {roomId && typingUsers[roomId] && typingUsers[roomId].length > 0 && (
              <div className="typing-indicator">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="typing-text">
                  {typingUsers[roomId].map(user => user.nickname).join(', ')}님이 입력 중...
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 메시지 입력 */}
      <div className="chat-input">
        <div className="input-container">
          <button className="btn-icon" title="파일 첨부">
            <Paperclip size={20} />
          </button>
          
          <div className="message-input-wrapper">
            <textarea
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요..."
              rows={1}
              className="message-input"
            />
          </div>
          
          <button className="btn-icon" title="이모티콘">
            <Smile size={20} />
          </button>
          
          <button
            className="btn btn-primary btn-icon"
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            title="전송"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
