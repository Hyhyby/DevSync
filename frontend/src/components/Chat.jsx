// src/components/Chat.jsx
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../config'; // config 파일 경로 확인

// 👇 [핵심] props로 roomId와 user를 받습니다.
const Chat = ({ roomId, user }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // roomId가 없으면 연결 시도 X
    if (!roomId) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    // 1. 소켓 연결
    const socket = io(API_BASE, {
      auth: { token },
    });
    socketRef.current = socket;

    // 2. 연결 및 방 입장
    socket.on('connect', () => {
      console.log(`✅ 채팅방 입장: ${roomId}`);
      // 백엔드의 'join-room' 이벤트 실행
      socket.emit('join-room', { roomId, username: user?.username });
    });

    // 3. 메시지 수신
    socket.on('receive-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // 4. 정리 (방 바뀔 때 기존 소켓 끊기)
    return () => {
      socket.disconnect();
    };
  }, [roomId]); // 👈 roomId가 바뀌면(다른 채널 클릭하면) 재실행됨

  // ... (스크롤 자동 이동 useEffect 유지) ...

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current) return;

    socketRef.current.emit('send-message', {
      roomId, // 현재 props로 받은 roomId
      message: newMessage,
    });
    setNewMessage('');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#36393f] h-full">
      {/* 헤더: 현재 채널 이름 표시 */}
      <div className="h-12 border-b border-[#202225] flex items-center px-4 shadow-sm">
        <span className="text-gray-400 text-xl mr-2">#</span>
        <span className="font-bold text-white">{roomId}</span>
        {/* roomId 대신 channelName을 props로 받아 보여줘도 됨 */}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, index) => {
          const isOwn = msg.username === user?.username;
          return (
            <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-2 rounded text-white ${isOwn ? 'bg-blue-600' : 'bg-gray-600'}`}>
                {/* 닉네임 표시 */}
                {!isOwn && <div className="text-xs text-gray-300 mb-1">{msg.username}</div>}
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 영역 */}
      <div className="p-4 bg-[#36393f]">
        <div className="bg-[#40444b] rounded-lg p-2">
          <form onSubmit={sendMessage}>
            <input
              className="w-full bg-transparent text-white focus:outline-none px-2"
              placeholder={`#${roomId}에 메시지 보내기`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;