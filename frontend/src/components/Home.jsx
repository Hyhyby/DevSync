import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';        // ✅ 추가

const API_BASE = 'http://localhost:5000';     // ✅ 백엔드 주소 명시

const Home = ({ user, onLogout }) => {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const navigate = useNavigate();
  const socketRef = useRef(null);             // ✅ 소켓 보관

  // 1) 최초 1회 목록 로드
  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token'); // ✅ sessionStorage 우선
    axios.get(`${API_BASE}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setRooms(Array.isArray(res.data) ? res.data : []))
    .catch(() => {/* 무시 */});
  }, []);

  // 2) 소켓 연결 & 실시간 업데이트
  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');

    socketRef.current = io(API_BASE, {
      transports: ['websocket'],
      auth: { token },                         // ✅ JWT 전달(서버에서 사용자 식별)
    });

    // 새 방이 생성되면 모든 클라이언트가 즉시 목록 갱신
    socketRef.current.on('room-created', (newRoom) => {
      setRooms(prev => prev.some(r => r.id === newRoom.id) ? prev : [...prev, newRoom]);
    });

    return () => {
      socketRef.current?.disconnect();         // ✅ 중복 연결 방지
    };
  }, []);

  // 3) 방 생성(내 화면은 즉시 갱신 + 소켓으로 상대방도 실시간)
  const createRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_BASE}/api/rooms`,               // ✅ 절대주소 사용 (socket과 동일 오리진)
        { name: newRoomName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 낙관적 업데이트(내 화면은 즉시)
      setRooms(prev => prev.some(r => r.id === data.id) ? prev : [...prev, data]);
      setNewRoomName('');
      setShowCreateRoom(false);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const joinRoom = (roomId) => navigate(`/chat/${roomId}`);
  return (
    <div className="min-h-screen bg-discord-darkest flex">
      {/* Sidebar */}
      <div className="w-64 bg-discord-darker flex flex-col">
        <div className="p-4 border-b border-discord-dark">
          <h1 className="text-white text-xl font-bold">Discord Clone</h1>
          <p className="text-gray-400 text-sm">Welcome, {user.username}</p>
        </div>

        <div className="flex-1 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold">Rooms</h2>
            <button
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              className="text-discord-blurple hover:text-blue-300 text-xl"
            >
              +
            </button>
          </div>

          {showCreateRoom && (
            <form onSubmit={createRoom} className="mb-4">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className="w-full p-2 bg-discord-dark border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-discord-blurple"
                autoFocus
              />
            </form>
          )}

          <div className="space-y-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => joinRoom(room.id)}
                className="w-full text-left p-2 rounded hover:bg-discord-dark text-gray-300 hover:text-white transition-colors"
              >
                # {room.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-discord-dark">
          <button
            onClick={onLogout}
            className="w-full p-2 bg-discord-red hover:bg-red-600 rounded text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Welcome to Discord Clone
          </h2>
          <p className="text-gray-400 mb-8">
            Select a room from the sidebar to start chatting
          </p>
          <div className="text-gray-500">
            <p>Features:</p>
            <ul className="mt-2 space-y-1">
              <li>• Real-time messaging</li>
              <li>• WebRTC voice/video chat</li>
              <li>• JWT authentication</li>
              <li>• Socket.io integration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
