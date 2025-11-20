import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_BASE } from '../../config';

const Friends = ({ user, logo, addFriendIcon, onLogout }) => {
  // 🔹 더미 데이터 (UI 테스트용)
  const dummyFriends = [
    { id: 1, username: 'DevSyncUser' },
    { id: 2, username: 'StudyBuddy' },
    { id: 3, username: '코딩친구' },
  ];

  const [friends, setFriends] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('friends') || '[]');
      // 저장된 값이 있으면 그걸 사용, 없으면 더미 사용
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
      return dummyFriends;
    } catch {
      return dummyFriends;
    }
  });
  const [loadingFriends, setLoadingFriends] = useState(true);

  // 친구 추가 모달
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendIdentifier, setFriendIdentifier] = useState('');

  // ✅ 친구 요청 결과 모달
  const [requestResult, setRequestResult] = useState(null);
  // { type: 'success' | 'error', message: string }

  const navigate = useNavigate();
  const socketRef = useRef(null);

  const token = sessionStorage.getItem('token') || localStorage.getItem('token');

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

  // 🔹 친구 목록 불러오기
  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.get('/api/friends');
      console.log('[Friends] /api/friends:', res.status, res.data);
      setFriends(Array.isArray(res.data) && res.data.length > 0 ? res.data : dummyFriends);
    } catch (err) {
      console.error(
        '[Friends] /api/friends 실패:',
        err?.response?.data || err?.message
      );
      // 실패해도 UI 테스트용으로 더미 유지
      setFriends((prev) => (prev.length > 0 ? prev : dummyFriends));
    } finally {
      setLoadingFriends(false);
    }
  }, [api]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // 친구 목록 업데이트 이벤트 리스너
  useEffect(() => {
    const handler = () => fetchFriends();
    window.addEventListener('friends-updated', handler);
    return () => window.removeEventListener('friends-updated', handler);
  }, [fetchFriends]);

  // 창 포커스 시 새로고침
  useEffect(() => {
    const onFocus = () => fetchFriends();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchFriends]);

  // 로컬 저장
  useEffect(() => {
    localStorage.setItem('friends', JSON.stringify(friends));
  }, [friends]);

  // (선택) 소켓으로 나중에 친구 수락 알림 받기
  useEffect(() => {
    if (!token) return;

    const s = io(API_BASE, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = s;

    s.on('connect', () => {
      console.log('[Friends SOCKET] connected:', s.id);
    });

    // 서버에서 'friend-accepted' 이벤트를 보내준다고 가정
    s.on('friend-accepted', (payload) => {
      console.log('[Friends] friend-accepted:', payload);
      fetchFriends(); // 새로 친구 목록 불러오기
    });

    return () => {
      s.off('connect');
      s.off('friend-accepted');
      s.disconnect();
    };
  }, [token, fetchFriends]);

  const joinRoom = (friendId) => {
    navigate(`/chat/${friendId}`); // 지금은 friendId를 roomId처럼 사용
  };

  // ✅ 친구 추가 요청 (백엔드 연결)
  const handleAddFriend = useCallback(
    async (e) => {
      e.preventDefault();
      const identifier = friendIdentifier.trim();
      if (!identifier) return;

      try {
        const res = await api.post('/api/friends/request', { identifier });
        const target = res.data?.targetUser;

        setRequestResult({
          type: 'success',
          message: target
            ? `${target.username}에게 친구 요청을 보냈어요.`
            : '친구 요청을 보냈어요.',
        });

        setFriendIdentifier('');
        setShowAddFriend(false);
      } catch (err) {
        const msg =
          err.response?.data?.error ||
          '친구 요청을 보내지 못했어요. 아이디를 다시 확인해 주세요.';
        setRequestResult({
          type: 'error',
          message: msg,
        });
      }
    },
    [friendIdentifier, api]
  );

  return (
    <>
      <aside className="w-64 bg-neutral-900 flex flex-col border-r border-neutral-800">
        {/* Logo */}
        <div className="p-4 pb-2 border-b border-neutral-800">
          <img
            src={logo}
            alt="DevSync Logo"
            className="w-10 h-10 object-contain drop-shadow-[0_0_6px_#F9E4BC]"
          />
        </div>

        {/* Profile */}
        <div className="p-4 border-b border-neutral-800 flex flex-col items-center gap-2">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center text-gray-400 text-sm">
              IMG
            </div>
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-neutral-900 rounded-full" />
          </div>
          <p className="text-white font-semibold text-sm">
            {user?.username || 'Guest'}
          </p>
          <p className="text-gray-500 text-xs">@{user?.username || 'guest'}</p>
        </div>

        {/* Friends List */}
        <div className="flex-1 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-white font-semibold">Friends</h2>
            <button
              onClick={() => setShowAddFriend(true)}
              className="p-1 hover:bg-neutral-800 rounded transition"
              aria-label="Add friend"
              title="Add friend"
            >
              <img
                src={addFriendIcon}
                alt="Add Friend"
                className="w-5 h-5 opacity-80 hover:opacity-100"
              />
            </button>
          </div>

          <div className="space-y-1">
            {loadingFriends ? (
              <div className="text-gray-500 text-sm">Loading friends…</div>
            ) : friends.length === 0 ? (
              <div className="text-gray-500 text-sm">
                No friends yet. Click <span className="text-yellow-400">+</span> to add one.
              </div>
            ) : (
              friends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => joinRoom(friend.id)}
                  className="w-full p-2 rounded hover:bg-neutral-800 text-gray-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* 🔹 프로필 동그라미 (이미지 자리) */}
                    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-[11px] text-gray-300">
                      {friend.username?.[0]?.toUpperCase() || '?'}
                    </div>

                    {/* 🔹 닉네임 */}
                    <span className="text-sm font-medium truncate">
                      {friend.username}
                    </span>
                  </div>
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

      {/* 친구 추가 모달 */}
      {showAddFriend && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-sm rounded-lg bg-neutral-900 border border-neutral-700 p-5 shadow-xl">
            <h3 className="text-white text-lg font-semibold mb-2">Add Friend</h3>
            <p className="text-sm text-gray-400 mb-4">
              Enter your friend&apos;s DevSync tag or email to send a friend request.
            </p>

            <form onSubmit={handleAddFriend} className="space-y-4">
              <input
                type="text"
                value={friendIdentifier}
                onChange={(e) => setFriendIdentifier(e.target.value)}
                placeholder="e.g. username#0001 or email"
                className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-sm"
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFriend(false);
                    setFriendIdentifier('');
                  }}
                  className="px-3 py-1.5 rounded bg-neutral-800 text-gray-300 text-sm hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-yellow-400 text-black text-sm font-semibold hover:bg-yellow-300"
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ 친구 요청 결과 모달 (성공/실패 공통) */}
      {requestResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-xs bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-center">
            <p
              className={
                requestResult.type === 'success'
                  ? 'text-green-400 text-sm'
                  : 'text-red-400 text-sm'
              }
            >
              {requestResult.message}
            </p>
            <button
              onClick={() => setRequestResult(null)}
              className="mt-4 px-3 py-1.5 bg-neutral-700 rounded text-xs text-gray-200 hover:bg-neutral-600"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Friends;
