// src/pages/Home.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logo from '../../assets/devsync-logo.png';
import { API_BASE } from '../config';

const Home = ({ user, onLogout }) => {
  const [rooms, setRooms] = useState(() => JSON.parse(localStorage.getItem('rooms') || '[]'));
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  const [friends, setFriends] = useState([]);
  const [friendQuery, setFriendQuery] = useState('');
  const [showFriendSearch, setShowFriendSearch] = useState(false);

  const [notifications, setNotifications] = useState([]); // 알림 목록
  const [showNotifPanel, setShowNotifPanel] = useState(false); // 알림 모아보기

  const navigate = useNavigate();
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');

  const api = useMemo(() => axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: true,
    timeout: 15000,
  }), [token]);

  // 알림 추가 (카카오톡처럼)
  const addNotification = useCallback((message) => {
    const id = Date.now();
    setNotifications(prev => [{ id, message }, ...prev]);
  }, []);

  const searchUser = useCallback(async (username) => {
    if (!username) return [];
    try {
      const res = await api.get(`/api/users/search?username=${username}`);
      return res.data; // { id, username } 배열
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [api]);

  const handleAddFriend = useCallback(async () => {
    const targetUsername = friendQuery.trim();
    if (!targetUsername) return;

    try {
      // 서버 API 호출 (friendbla.js /requests POST)
      const res = await api.post('/api/friends/requests', { targetUsername });

      // 성공 시 알림
      addNotification(`✅ 친구 요청을 보냈습니다: ${targetUsername}`);

      // 친구 목록 갱신 (원하면 바로 fetch 해서 갱신 가능)
      setFriends(prev => [...prev, { id: res.data.to, username: targetUsername }]);
    } catch (err) {
      // 에러 메시지 서버에서 보내준 메시지 활용
      const msg = err.response?.data?.error || '친구 요청 실패';
      addNotification(`❌ ${msg}`);
    } finally {
      setFriendQuery('');
      setShowFriendSearch(false);
    }
  }, [friendQuery, api, addNotification]);

  const joinRoom = (roomId) => navigate(`/chat/${roomId}`);

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-900 flex flex-col border-r border-neutral-800">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="DevSync Logo" className="w-10 h-10 object-contain" />
            <p className="text-gray-400 text-xs">Welcome, {user?.username}</p>
          </div>
          <div className="relative">
            {/* 친구 추가 버튼 */}
            <button
              onClick={() => setShowFriendSearch(v => !v)}
              className="text-green-400 hover:text-green-300 text-xl"
              title="Add Friend"
            >+</button>
            {/* 알림 아이콘 */}
            <button
              onClick={() => setShowNotifPanel(v => !v)}
              className="ml-3 relative text-yellow-400 hover:text-yellow-300 text-xl"
              title="Notifications"
            >
              🔔
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 친구 검색창 */}
        {showFriendSearch && (
          <div className="p-2 border-b border-neutral-800">
            <input
              type="text"
              value={friendQuery}
              onChange={e => setFriendQuery(e.target.value)}
              placeholder="Search username..."
              className="w-full p-1 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-400"
            />
            <button
              onClick={handleAddFriend}
              className="mt-1 w-full bg-green-600 hover:bg-green-500 rounded p-1 text-white"
            >Add Friend</button>
          </div>
        )}

        {/* 알림 패널 */}
        {showNotifPanel && (
          <div className="absolute top-12 right-4 w-60 max-h-80 overflow-y-auto bg-neutral-800 border border-neutral-700 rounded shadow-lg z-50 p-2">
            <h3 className="text-white font-semibold text-sm mb-2">Notifications</h3>
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-xs">알림이 없습니다.</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="bg-neutral-700 text-white text-xs p-1 rounded mb-1">
                  {n.message}
                </div>
              ))
            )}
            <button
              onClick={() => setNotifications([])}
              className="mt-2 w-full text-xs bg-red-600 hover:bg-red-500 rounded p-1 text-white"
            >Clear All</button>
          </div>
        )}

        {/* 방 목록 */}
        <div className="flex-1 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-white font-semibold">Rooms</h2>
            <button
              onClick={() => setShowCreateRoom(v => !v)}
              className="text-yellow-400 hover:text-yellow-300 text-xl"
            >+</button>
          </div>

          {showCreateRoom && (
            <form onSubmit={e => { e.preventDefault(); setRooms([...rooms, { id: Date.now(), name: newRoomName }]); setNewRoomName(''); setShowCreateRoom(false); }}>
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className="w-full p-1 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
                autoFocus
              />
            </form>
          )}

          <div className="space-y-1 mt-2">
            {rooms.map(r => (
              <button
                key={r.id}
                onClick={() => joinRoom(r.id)}
                className="w-full text-left p-2 rounded hover:bg-neutral-800 text-gray-300 hover:text-white transition-colors"
              >
                # {r.name}
              </button>
            ))}
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
        <div className="text-center text-gray-400">
          <img src={logo} alt="DevSync Logo" className="w-40 h-auto mx-auto mb-4" />
          <p>Select a room from the sidebar to start chatting</p>
        </div>
      </main>
    </div>
  );
};

export default Home;
