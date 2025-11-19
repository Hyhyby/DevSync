import React, { useEffect, useState } from 'react';
import { MessageSquare, Plus, Bell, Clock, Users } from 'lucide-react';
import { useChatStore, useUIStore } from '../stores';
import { chatAPI } from '../services/api';

export const HomeScreen: React.FC = () => {
  const { chatRooms, setChatRooms, setCurrentRoom } = useChatStore();
  const { openModal } = useUIStore();
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState([
    {
      id: 1,
      title: 'DevSync v1.0.0 출시',
      content: '개발자를 위한 데스크톱 메신저가 정식 출시되었습니다!',
      date: '2024-01-15',
      type: 'info'
    },
    {
      id: 2,
      title: '새로운 기능 업데이트',
      content: '실시간 채팅과 파일 공유 기능이 추가되었습니다.',
      date: '2024-01-10',
      type: 'success'
    }
  ]);

  useEffect(() => {
    loadChatRooms();
  }, []);

  const loadChatRooms = async () => {
    try {
      const response = await chatAPI.getChatRooms();
      setChatRooms(response.data);
      
      // 최근 채팅방 5개만 홈에서 표시
      const recent = response.data
        .sort((a: any, b: any) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime())
        .slice(0, 5);
      setRecentChats(recent);
    } catch (error) {
      console.error('채팅방 목록 로드 오류:', error);
    }
  };

  const handleCreateRoom = () => {
    openModal('createRoom');
  };

  const handleJoinRoom = (room: any) => {
    setCurrentRoom(room);
    // 채팅 화면으로 이동
    window.location.href = `/chat/${room.id}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className="home-screen">
      <div className="home-header">
        <h1>홈</h1>
        <p>최근 채팅과 공지를 확인하세요</p>
      </div>

      <div className="home-content">
        {/* 최근 채팅 */}
        <section className="recent-chats">
          <div className="section-header">
            <h2>
              <Clock size={20} />
              최근 채팅
            </h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCreateRoom}
            >
              <Plus size={16} />
              새 채팅방
            </button>
          </div>

          <div className="chats-list">
            {recentChats.length > 0 ? (
              recentChats.map((room) => (
                <div
                  key={room.id}
                  className="chat-item"
                  onClick={() => handleJoinRoom(room)}
                >
                  <div className="chat-icon">
                    <MessageSquare size={20} />
                  </div>
                  <div className="chat-info">
                    <h3>{room.name}</h3>
                    <p>{room.description || '설명이 없습니다.'}</p>
                    <span className="chat-meta">
                      {room.lastMessageAt ? formatDate(room.lastMessageAt) : '새 채팅방'}
                    </span>
                  </div>
                  <div className="chat-members">
                    <Users size={16} />
                    <span>{room.Users?.length || 0}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <MessageSquare size={48} />
                <h3>채팅방이 없습니다</h3>
                <p>새 채팅방을 만들어 대화를 시작해보세요!</p>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateRoom}
                >
                  <Plus size={16} />
                  첫 채팅방 만들기
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 공지사항 */}
        <section className="announcements">
          <div className="section-header">
            <h2>
              <Bell size={20} />
              공지사항
            </h2>
          </div>

          <div className="announcements-list">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`announcement-item ${announcement.type}`}
              >
                <div className="announcement-header">
                  <h3>{announcement.title}</h3>
                  <span className="announcement-date">{announcement.date}</span>
                </div>
                <p>{announcement.content}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
