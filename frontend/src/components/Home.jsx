// src/pages/Home.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import logo from '../../assets/devsync-logo.png';

// 모두 같은 ngrok 백엔드로 통일
const API_BASE = "https://commensurately-preflagellate-merissa.ngrok-free.dev";

const Home = ({ user, onLogout }) => {
  // 로컬 캐시 복구로 깜빡임 최소화
  const [rooms, setRooms] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rooms') || '[]'); }
    catch { return []; }
  });
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  // 매 렌더마다 최신 토큰을 사용 (useMemo([])로 고정하지 않음)
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');

  // CORS 환경에서 인증 안정화를 위해 withCredentials 추가
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
        timeout: 15000,
      }),
    [token]
  );

  // /api/rooms 공통 로더
  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get('/api/rooms');
      console.log('[API] /api/rooms status:', res.status, res.data);
      setRooms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[API] /api/rooms 실패:', err?.response?.status, err?.response?.data || err?.message);
    } finally {
      setLoadingRooms(false);
    }
  }, [api]);

  // 최초 로드
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // 창 포커스 돌아올 때 최신 목록 싱크
  useEffect(() => {
    const onFocus = () => fetchRooms();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchRooms]);

  // rooms 로컬 캐시 동기화
  useEffect(() => {
    localStorage.setItem('rooms', JSON.stringify(rooms));
  }, [rooms]);

  // 소켓 연결 & 실시간 업데이트
  useEffect(() => {
    if (!token) return;

    const s = io(API_BASE, {
      transports: ['websocket'],
      auth: { token },
      // withCredentials는 socket.io에선 헤더·쿠키 자동 처리, 필요 시 path 동일하게 맞춰 사용
    });
    socketRef.current = s;

    s.on('connect', () => {
      console.log('[SOCKET] connected:', s.id, '→', s.io?.uri);
    });
    s.on('connect_error', (e) => {
      console.error('[SOCKET] connect_error:', e?.message || e);
    });

    // 다른 클라이언트가 만든 방을 실시간 반영
    s.on('room-created', (newRoom) => {
      console.log('📡 room-created', newRoom);
      setRooms((prev) => (prev.some((r) => r.id === newRoom.id) ? prev : [...prev, newRoom]));
    });

    // 확장용 이벤트들
    s.on('room-updated', (room) => {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    });
    s.on('room-deleted', (roomId) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    });

    return () => {
      s.off('connect');
      s.off('connect_error');
      s.off('room-created');
      s.off('room-updated');
      s.off('room-deleted');
      s.disconnect();
    };
  }, [token]);

  // 방 생성
  const createRoom = useCallback(
    async (e) => {
      e.preventDefault();
      const name = newRoomName.trim();
      if (!name) return;

      try {
        const { data } = await api.post('/api/rooms', { name });
        // 내 화면 즉시 반영 (소켓 브로드캐스트는 다른 클라용)
        setRooms((prev) => (prev.some((r) => r.id === data.id) ? prev : [...prev, data]));
        setNewRoomName('');
        setShowCreateRoom(false);
      } catch (err) {
        console.error('Failed to create room:', err?.response?.data || err?.message || err);
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
