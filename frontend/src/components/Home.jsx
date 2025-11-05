// src/pages/Home.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import logo from '../../assets/devsync-logo.png';

// .env 예) VITE_API_BASE=http://localhost:5000
const API_BASE = import.meta?.env?.VITE_API_BASE || 'http://localhost:5000';

const Home = ({ user, onLogout }) => {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const token = useMemo(
    () => sessionStorage.getItem('token') || localStorage.getItem('token'),
    []
  );

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  // 1) 최초 1회 목록 로드
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/api/rooms');
        if (!mounted) return;
        setRooms(Array.isArray(res.data) ? res.data : []);
      } catch {
        // 필요시 에러 토스트
      } finally {
        if (mounted) setLoadingRooms(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

  // 2) 소켓 연결 & 실시간 업데이트
  useEffect(() => {
    if (!token) return;

    socketRef.current = io(API_BASE, {
      transports: ['websocket'],
      auth: { token },
    });

    // 새 방 생성 실시간 반영
    socketRef.current.on('room-created', (newRoom) => {
      setRooms((prev) =>
        prev.some((r) => r.id === newRoom.id) ? prev : [...prev, newRoom]
      );
    });

    // 방 이름 변경, 삭제 같은 이벤트도 대비(서버가 보내면)
    socketRef.current.on('room-updated', (room) => {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    });
    socketRef.current.on('room-deleted', (roomId) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [token]);

  // 3) 방 생성
  const createRoom = useCallback(
    async (e) => {
      e.preventDefault();
      if (!newRoomName.trim()) return;
      try {
        const { data } = await api.post('/api/rooms', { name: newRoomName });
        setRooms((prev) =>
          prev.some((r) => r.id === data.id) ? prev : [...prev, data]
        );
        setNewRoomName('');
        setShowCreateRoom(false);
      } catch (err) {
        console.error('Failed to create room:', err?.response?.data || err);
      }
    },
    [api, newRoomName]
  );

  const joinRoom = (roomId) => navigate(`/chat/${roomId}`);

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-900 flex flex-col border-r border-neutral-800">
        <div className="p-4 border-b border-neutral-800">
          {/* ✅ 로고 + 타이틀 (Discord Clone → DevSync 로고) */}
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="DevSync Logo"
              className="w-10 h-10 object-contain drop-shadow-[0_0_6px_#F9E4BC]"
            />
            <div>
              <p className="text-gray-400 text-xs">
                Welcome, {user?.username}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-white font-semibold">Rooms</h2>
            <button
              onClick={() => setShowCreateRoom((v) => !v)}
              className="text-yellow-400 hover:text-yellow-300 text-xl"
              aria-label="Create room"
              title="Create room"
            >
              +
            </button>
          </div>

          {showCreateRoom && (
            <form onSubmit={createRoom} className="mb-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
                autoFocus
              />
            </form>
          )}

          {/* 방 목록 */}
          <div className="space-y-1">
            {loadingRooms ? (
              <div className="text-gray-500 text-sm">Loading rooms…</div>
            ) : rooms.length === 0 ? (
              <div className="text-gray-500 text-sm">
                No rooms yet. Click <span className="text-yellow-400">+</span> to create one.
              </div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => joinRoom(room.id)}
                  className="w-full text-left p-2 rounded hover:bg-neutral-800 text-gray-300 hover:text-white transition-colors"
                >
                  # {room.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800">
          <button
            onClick={onLogout}
            className="w-full p-2 bg-red-600 hover:bg-red-500 rounded text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {/* ✅ 메인 히어로에 로고 재사용 */}
          <img
            src={logo}
            alt="DevSync Logo"
            className="w-40 h-auto mx-auto mb-4 drop-shadow-[0_0_8px_#F9E4BC]"
          />
  

          <p className="text-gray-400 mb-6">
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
      </main>
    </div>
  );
};

export default Home;
