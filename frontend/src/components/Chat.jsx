import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

// ngrok 백엔드 주소 (환경변수 쓰면 더 좋아요: import.meta.env.VITE_SOCKET_URL)
export const API_BASE = "https://commensurately-preflagellate-merissa.ngrok-free.dev";

const Chat = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ✅ 소켓 연결 (연결된 후에 join-room)
  useEffect(() => {
    const token = sessionStorage.getItem('token');

    // 기존 소켓이 있으면 정리
    // if (socketRef.current?.connected) {
    //   socketRef.current.disconnect();
    // }

    const socket = io(API_BASE, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      withCredentials: true,
      // path: '/socket.io', // 서버에서 커스텀했다면 주석 해제
    });

    socketRef.current = socket;

    const handleConnect = () => {
      // 연결된 후에 방 입장
      socket.emit('join-room', { roomId, username: user?.username || 'Unknown' });
    };

    const handleReceive = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleError = (err) => {
      console.error('[socket connect_error]', err?.message || err);
    };

    socket.on('connect', handleConnect);
    socket.on('receive-message', handleReceive);
    socket.on('connect_error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('receive-message', handleReceive);
      socket.off('connect_error', handleError);
      socket.disconnect();
    };
  }, [roomId, user?.username]);

  // 스크롤 항상 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ✅ 메시지 전송
  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn('Socket not connected yet.');
      return;
    }

    const messageData = {
      roomId,
      message: text,
      userId: user?.id || 'unknown',
      username: user?.username || 'Unknown',
    };

    // 서버로 전송
    socket.emit('send-message', messageData);

    // 내 메시지를 즉시 반영
    setMessages((prev) => [
      ...prev,
      {
        ...messageData,
        id: Date.now(),
        timestamp: new Date().toISOString(),
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
            const isOwn = msg.username === user?.username;

            return (
              <div
                key={msg.id || index}
                className={`flex items-start space-x-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {/* 상대 메시지 아바타 */}
                {!isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {msg.username?.charAt(0)?.toUpperCase() || '?'}
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

                {/* 내 메시지 아바타 */}
                {isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {msg.username?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력창 */}
        <form onSubmit={sendMessage} className="p-4 border-t border-discord-dark flex space-x-2">
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
