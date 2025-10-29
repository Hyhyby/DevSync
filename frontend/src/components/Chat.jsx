import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000'; // 백엔드 주소

const Chat = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ✅ 소켓 연결
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const socket = io(API_BASE, {
      transports: ['websocket'],
      auth: { token },
    });

    socketRef.current = socket;

    // 방 입장
    socket.emit('join-room', { roomId, username: user.username });

    // 메시지 수신
    socket.on('receive-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // 연결 종료 시 정리
    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  // 스크롤 항상 맨 아래로 유지
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 전송
  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const messageData = {
      roomId,
      message: input,
      userId: user.id,
      username: user.username,
    };

    // ✅ 서버로 전송
    socketRef.current.emit('send-message', messageData);

    // ✅ 내 메시지를 즉시 반영
    setMessages((prev) => [
      ...prev,
      {
        ...messageData,
        id: Date.now(),
        timestamp: new Date(),
      },
    ]);

    setInput('');
  };

  return (
    <div className="min-h-screen bg-discord-dark flex">
      {/* Sidebar */}
      <div className="w-64 bg-discord-darker p-4">
        <button
          onClick={() => navigate('/home')}
          className="text-gray-400 hover:text-white"
        >
          ← Back to Home
        </button>
        <h2 className="text-white font-semibold mt-4">Room: {roomId}</h2>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => {
            const isOwn = msg.username === user.username;

            return (
              <div
                key={index}
                className={`flex items-start space-x-3 ${
                  isOwn ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* 상대 메시지 */}
                {!isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {msg.username?.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* 말풍선 */}
                <div
                  className={`p-3 rounded-lg max-w-xs break-words ${
                    isOwn
                      ? 'bg-discord-blurple text-white text-right'
                      : 'bg-discord-darkest text-gray-300 text-left'
                  }`}
                >
                  {!isOwn && (
                    <div className="text-sm font-semibold text-white mb-1">
                      {msg.username}
                    </div>
                  )}
                  <div>{msg.message}</div>
                </div>

                {/* 내 메시지 */}
                {isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {msg.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력창 */}
        <form
          onSubmit={sendMessage}
          className="p-4 border-t border-discord-dark flex space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 bg-discord-dark border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-discord-blurple"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-discord-blurple hover:bg-blue-600 rounded text-white font-semibold"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
