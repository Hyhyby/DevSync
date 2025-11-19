// src/components/Home/Notification.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../../config';

const Notification = ({ bellIcon }) => {
  const [open, setOpen] = useState(false);

  // 🔹 더미 알림 2개 추가
  const [messages, setMessages] = useState([
    'DevSync에 오신 것을 환영합니다.1',
    'DevSync에 오신 것을 환영합니다.2',
    'DevSync에 오신 것을 환영합니다.3',
  ]);

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

  // 🔹 친구 요청 목록 불러오기
  const fetchRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/api/friends/requests');
      const received = Array.isArray(res.data?.received)
        ? res.data.received
        : [];
      setFriendRequests(received);
    } catch (err) {
      console.error(
        '[Notification] 친구 요청 목록 실패:',
        err?.response?.data || err?.message
      );
    }
  }, [api, token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // 알림 개수
  const unreadCount = friendRequests.length + messages.length;

  // 🔹 친구 요청 응답 처리
  const respondRequest = async (fromUserId, action) => {
    try {
      if (action === 'accept') {
        await api.post('/api/friends/requests/accept', { fromUserId });
      } else {
        await api.post('/api/friends/requests/decline', { fromUserId });
      }

      setFriendRequests((prev) =>
        prev.filter((r) => r.from_user_id !== fromUserId)
      );

      if (action === 'accept') {
        window.dispatchEvent(new Event('friends-updated'));
      }
    } catch (err) {
      console.error(
        '[Notification] 요청 응답 실패:',
        err?.response?.data || err?.message
      );
    }
  };

  // 🔹 개별 메시지 삭제
  const removeMessage = (index) => {
    setMessages((prev) => prev.filter((_, i) => i !== index));
  };

  // 🔹 전체 알림 삭제
  const clearAll = () => {
    setMessages([]);
    setFriendRequests([]);
  };

  return (
    <>
      {/* 🔔 알림 아이콘 */}
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

      {/* 알림 모달 */}
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-lg p-4">
            <h3 className="text-white text-lg font-semibold mb-3">
              Notifications
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto text-sm">
              {/* 🔹 친구 요청 알림 */}
              {friendRequests.map((req) => (
                <div
                  key={req.from_user_id}
                  className="p-3 bg-neutral-800 rounded border border-neutral-700 flex flex-col gap-2"
                >
                  <p className="text-gray-200">
                    <span className="font-semibold">
                      {req.from_username}
                    </span>{' '}
                    님이 친구 요청을 보냈어요.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => respondRequest(req.from_user_id, 'reject')}
                      className="px-2 py-1 rounded bg-neutral-700 text-gray-200 hover:bg-neutral-600 text-xs"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => respondRequest(req.from_user_id, 'accept')}
                      className="px-2 py-1 rounded bg-green-500 text-black hover:bg-green-400 text-xs font-semibold"
                    >
                      수락
                    </button>
                  </div>
                </div>
              ))}

              {/* 🔹 일반 메시지 알림 */}
              {messages.map((m, i) => (
                <div
                  key={`msg-${i}`}
                  className="p-2 bg-neutral-800 rounded text-gray-200 flex justify-between items-center"
                >
                  <span>{m}</span>
                  <button
                    onClick={() => removeMessage(i)}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {friendRequests.length === 0 && messages.length === 0 && (
                <p className="text-gray-400 text-sm">No notifications yet.</p>
              )}
            </div>

            {/* 🔹 전체 삭제 버튼 */}
            {(messages.length > 0 || friendRequests.length > 0) && (
              <div className="mt-4 flex justify-between">
                <button
                  onClick={clearAll}
                  className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-500 text-sm"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 bg-neutral-700 text-gray-200 rounded hover:bg-neutral-600 text-sm"
                >
                  Close
                </button>
              </div>
            )}

            {(messages.length === 0 && friendRequests.length === 0) && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 bg-neutral-700 text-gray-200 rounded hover:bg-neutral-600 text-sm"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Notification;
