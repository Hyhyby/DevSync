// src/components/Home/Notification.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_BASE } from '../../config';

const Notification = ({ bellIcon, socket: externalSocket }) => {
  const [open, setOpen] = useState(false);

  // 받은 친구 요청 / 보낸 친구 요청
  const [friendRequestsReceived, setFriendRequestsReceived] = useState([]);
  const [friendRequestsSent, setFriendRequestsSent] = useState([]);

  // 일반 메시지(시스템 알림용)
  const [messages] = useState(['DevSync에 오신 것을 환영합니다.']);

  const token =
    sessionStorage.getItem('token') || localStorage.getItem('token');

  // 내부에서 생성한 소켓을 기억용으로 보관
  const socketRef = useRef(null);

  // Axios 인스턴스
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        withCredentials: true,
        timeout: 15000,
      }),
    [token]
  );

  // 🔹 HTTP로 초기 요청 목록 불러오기
  const fetchRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/api/friends/requests');

      const received = Array.isArray(res.data?.received)
        ? res.data.received
        : [];
      const sent = Array.isArray(res.data?.sent) ? res.data.sent : [];

      setFriendRequestsReceived(received);
      setFriendRequestsSent(sent);
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

  // ✅ Socket.IO 연결: 실시간 친구 요청 이벤트 받기
  useEffect(() => {
    if (!token) return;

    // 1) 부모에서 socket을 넘겨준 경우 그걸 사용
    let s = externalSocket || socketRef.current;

    // 2) 없으면 여기서 새로 생성
    if (!s) {
      s = io(API_BASE, {
        transports: ['websocket'],
        auth: { token },
      });
      socketRef.current = s;
    }

    const handleConnect = () => {
      console.log('[Notification SOCKET] connected:', s.id);
    };

    const handleFriendRequest = (payload) => {
      console.log('[Notification] friend-request 이벤트 수신:', payload);
      // payload: { from_user_id, from_username, created_at }

      setFriendRequestsReceived((prev) => [
        {
          from_user_id: payload.from_user_id,
          from_username: payload.from_username,
          created_at: payload.created_at,
        },
        ...prev,
      ]);

      // 알림창 자동으로 열기
      setOpen(true);
    };

    s.on('connect', handleConnect);
    s.on('friend-request', handleFriendRequest);

    // cleanup
    return () => {
      s.off('connect', handleConnect);
      s.off('friend-request', handleFriendRequest);

      // 외부에서 받은 socket이 아니면 여기서만 disconnect
      if (!externalSocket) {
        s.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, externalSocket]);

  // 읽지 않은 개수 (원하면 messages 제외하고 계산해도 됨)
  const unreadCount =
    friendRequestsReceived.length + friendRequestsSent.length + messages.length;

  // 받은 요청 수락/거절
  const respondRequest = async (fromUserId, action) => {
    try {
      if (action === 'accept') {
        await api.post('/api/friends/requests/accept', { fromUserId });
      } else {
        // 거절 라우트 만들면 여기서 호출
        // await api.post('/api/friends/requests/decline', { fromUserId });
      }

      // 해당 요청 목록에서 제거
      setFriendRequestsReceived((prev) =>
        prev.filter((r) => r.from_user_id !== fromUserId)
      );

      // 수락했으면 친구 목록 갱신 이벤트 발생 (Friends.jsx에서 듣고 있음)
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

      {/* 🔔 알림 모달 */}
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-lg p-4">
            <h3 className="text-white text-lg font-semibold mb-3">
              Notifications
            </h3>

            <div className="space-y-4 max-h-72 overflow-y-auto text-sm">
              {/* 받은 친구 요청 */}
              <div>
                <h4 className="text-gray-300 text-xs mb-2">받은 친구 요청</h4>
                {friendRequestsReceived.length === 0 ? (
                  <p className="text-gray-500 text-xs">
                    받은 친구 요청이 없어요.
                  </p>
                ) : (
                  friendRequestsReceived.map((req) => (
                    <div
                      key={`${req.from_user_id}-${req.created_at}`}
                      className="p-3 bg-neutral-800 rounded border border-neutral-700 flex flex-col gap-2"
                    >
                      <p className="text-gray-200">
                        <span className="font-semibold">
                          {req.from_username}
                        </span>{' '}
                        님이 친구 요청을 보냈어요.
                      </p>
                      <div className="flex gap-2 justify-end">
                        {/* 거절 라우트 만들면 여기 붙이면 됨 */}
                        {/* <button
                          onClick={() =>
                            respondRequest(req.from_user_id, 'reject')
                          }
                          className="px-2 py-1 rounded bg-neutral-700 text-gray-200 hover:bg-neutral-600 text-xs"
                        >
                          거절
                        </button> */}
                        <button
                          onClick={() =>
                            respondRequest(req.from_user_id, 'accept')
                          }
                          className="px-2 py-1 rounded bg-green-500 text-black hover:bg-green-400 text-xs font-semibold"
                        >
                          수락
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 내가 보낸 진행중인 친구 요청 */}
              <div>
                <h4 className="text-gray-300 text-xs mb-2">
                  내가 보낸 친구 요청
                </h4>
                {friendRequestsSent.length === 0 ? (
                  <p className="text-gray-500 text-xs">
                    내가 보낸 진행중인 요청이 없어요.
                  </p>
                ) : (
                  friendRequestsSent.map((req) => (
                    <div
                      key={`${req.to_user_id}-${req.created_at}`}
                      className="p-3 bg-neutral-800 rounded border border-neutral-700"
                    >
                      <p className="text-gray-200 text-sm">
                        <span className="font-semibold">
                          {req.to_username}
                        </span>{' '}
                        님에게 친구 요청을 보냈어요.
                      </p>
                      <p className="text-gray-500 text-[11px]">진행 중…</p>
                    </div>
                  ))
                )}
              </div>

              {/* 일반 메시지 */}
              {messages.map((m, i) => (
                <div
                  key={`msg-${i}`}
                  className="p-2 bg-neutral-800 rounded text-gray-200"
                >
                  {m}
                </div>
              ))}
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
