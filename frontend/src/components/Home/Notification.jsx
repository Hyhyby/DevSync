// src/components/Home/Notification.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../config';

const Notification = ({ bellIcon }) => {
  const [open, setOpen] = useState(false);

  // 일반 텍스트 알림 (선택)
  const [messages, setMessages] = useState([]);

  // ✅ 나에게 온 친구 요청
  const [friendRequests, setFriendRequests] = useState([]);

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

  // 처음에 친구 요청 목록 불러오기
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await api.get('/api/friends/requests');
        setFriendRequests(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('[Notification] 친구 요청 목록 실패:', err?.response?.data || err?.message);
      }
    };

    if (token) {
      fetchRequests();
    }

    // 디자인용 더미 메시지
    setMessages([
      'DevSync에 오신 것을 환영합니다.',
    ]);
  }, [api, token]);

  const unreadCount = friendRequests.length + messages.length;

  // ✅ 수락 / 거절 처리
  const respondRequest = async (requestId, action) => {
    try {
      await api.post(`/api/friends/requests/${requestId}/respond`, { action });

      // 목록에서 제거
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));

      if (action === 'accept') {
        // 친구 목록 새로고침 이벤트 (Friends.jsx에서 리스닝)
        window.dispatchEvent(new Event('friends-updated'));
      }
    } catch (err) {
      console.error('[Notification] 요청 응답 실패:', err?.response?.data || err?.message);
    }
  };

  return (
    <>
      {/* 🔔 아이콘 */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setOpen(true)}
          className="relative p-2 hover:bg-neutral-800 rounded-full"
        >
          <img
            src={bellIcon}
            alt="Notifications"
            className="w-6 h-6 opacity-80 hover:opacity-100"
          />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 text-[10px] bg-red-600 text-white px-1.5 py-[1px] rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 모달 */}
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-lg p-4">
            <h3 className="text-white text-lg font-semibold mb-3">
              Notifications
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto text-sm">
              {/* ✅ 친구 요청 알림 */}
              {friendRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-neutral-800 rounded border border-neutral-700 flex flex-col gap-2"
                >
                  <p className="text-gray-200">
                    <span className="font-semibold">{req.from.username}</span>
                    {' '}님이 친구 요청을 보냈어요.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => respondRequest(req.id, 'reject')}
                      className="px-2 py-1 rounded bg-neutral-700 text-gray-200 hover:bg-neutral-600 text-xs"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => respondRequest(req.id, 'accept')}
                      className="px-2 py-1 rounded bg-green-500 text-black hover:bg-green-400 text-xs font-semibold"
                    >
                      수락
                    </button>
                  </div>
                </div>
              ))}

              {/* 일반 메시지 알림 */}
              {messages.map((m, i) => (
                <div
                  key={`msg-${i}`}
                  className="p-2 bg-neutral-800 rounded text-gray-200"
                >
                  {m}
                </div>
              ))}

              {friendRequests.length === 0 && messages.length === 0 && (
                <p className="text-gray-400 text-sm">No notifications yet.</p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 bg-neutral-700 text-gray-200 rounded hover:bg-neutral-600 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Notification;