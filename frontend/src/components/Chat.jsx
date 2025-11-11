import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate,useLocation} from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE } from '../config';

const BOTTOM_THRESHOLD = 48; // px, 이 이내면 '바닥에 있음'으로 판단

const Chat = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
   const location = useLocation();  

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);
   // ✅ 방 이름 상태 (라우터 state에 있으면 우선 사용)
  const [roomName, setRoomName] = useState(location.state?.roomName || '');
  // ✅ 스크롤 제어를 위한 ref와 상태
  const messagesWrapRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // ✅ 방 이름 없으면 서버에서 조회
  useEffect(() => {
    let ignore = false;
    if (!roomName) {
      const token = sessionStorage.getItem('token');
      fetch(`${API_BASE}/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then(data => { if (!ignore) setRoomName(data.name); })
        .catch(() => {/* 조회 실패 시 roomId fallback */});
    }
    return () => { ignore = true; };
  }, [roomId, roomName]);
  // 소켓 연결 (연결된 후에 join-room)
  useEffect(() => {
    const token = sessionStorage.getItem('token');

    const socket = io(API_BASE, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      withCredentials: true,
      // path: '/socket.io',
    });

    socketRef.current = socket;

    const handleConnect = () => {
      socket.emit('join-room', { roomId, username: user?.username || 'Unknown' });
    };

    const handleReceive = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleError = (err) => {
      console.error('[socket connect_error]', err?.message || err);
    };
     // ✅ 방 정보 수신 → 이름 세팅
  const handleRoomInfo = (room) => {
    if (room?.name) setRoomName(room.name);
  };

    socket.on('connect', handleConnect);
    socket.on('receive-message', handleReceive);
    socket.on('connect_error', handleError);
     socket.on('room-info', handleRoomInfo); // ✅ 추가
    return () => {
      socket.off('connect', handleConnect);
      socket.off('receive-message', handleReceive);
      socket.off('connect_error', handleError);
      socket.off('room-info', handleRoomInfo); // ✅ 추가
      socket.disconnect();
    };
  }, [roomId, user?.username]);

  // ✅ 스크롤 위치 추적: 사용자가 바닥 근처에 있는지 계산
  const handleScroll = () => {
    const el = messagesWrapRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom <= BOTTOM_THRESHOLD);
  };

  // ✅ 새 메시지가 들어오면, 바닥에 있을 때만 자동 스크롤
  useEffect(() => {
    if (!messagesWrapRef.current) return;
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  // 첫 로딩/방 이동 시에는 즉시 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, [roomId]);

  // 메시지 전송
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

    socket.emit('send-message', messageData);

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
    <div className="h-screen bg-discord-dark flex">
      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-discord-darker p-4">
        <button
          onClick={() => navigate('/home')}
          className="text-gray-400 hover:text-white"
        >
          ← Back to Home
        </button>
       <h2 className="text-white font-semibold mt-4">
          {/* ✅ 이름 있으면 이름, 없으면 id 일부만 */}
          Room: {roomName || `${roomId}`}
        </h2>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div
          ref={messagesWrapRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          {messages.map((msg, index) => {
            const isOwn = msg.username === user?.username;

            return (
              <div
                key={msg.id || index}
                className={`flex items-start ${isOwn ? 'justify-end' : 'justify-start'} gap-3`}
              >
                {/* 상대 메시지 아바타 */}
                {!isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {msg.username?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}

                {/* 말풍선 */}
                <div
                  className={`p-3 rounded-lg max-w-[70%] break-words whitespace-pre-wrap ${
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
        <form onSubmit={sendMessage} className="p-4 border-t border-discord-dark flex gap-2">
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
