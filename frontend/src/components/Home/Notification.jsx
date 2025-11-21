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
import NotificationBell from '../ui/NotificationBell';
import NotificationModal from '../ui/NotificationModal';

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
        timeout: 15000,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'ngrok-skip-browser-warning': 'true',
        },
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

  // 다른 컴포넌트에서 friend-requests-updated 이벤트 쏘면 새로고침
  useEffect(() => {
    const handler = () => {
      fetchRequests();
    };

    window.addEventListener('friend-requests-updated', handler);
    return () => window.removeEventListener('friend-requests-updated', handler);
  }, [fetchRequests]);

  // ✅ Socket.IO 연결: 실시간 친구 요청 / 수락 이벤트
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
      setFriendRequestsReceived((prev) => [
        {
          from_user_id: payload.from_user_id,
          from_username: payload.from_username,
          created_at: payload.created_at,
        },
        ...prev,
      ]);
    };

    // ⭐ 친구 요청 수락 이벤트 → 양쪽 모두 목록 새로고침
    const handleFriendAccepted = (payload) => {
      console.log('[Notification] friend-accepted 이벤트 수신:', payload);
      fetchRequests();
    };
    // 🔹 거절 이벤트: 보낸 사람이 이걸 받아서 목록 새로고침
    const handleFriendDeclined = (payload) => {
      console.log('[Notification] friend-declined 이벤트 수신:', payload);
      fetchRequests();
    };

    s.on('connect', handleConnect);
    s.on('friend-request', handleFriendRequest);
    s.on('friend-accepted', handleFriendAccepted);
    s.on('friend-declined', handleFriendDeclined);
    // cleanup
    return () => {
      s.off('connect', handleConnect);
      s.off('friend-request', handleFriendRequest);
      s.off('friend-accepted', handleFriendAccepted);
      s.off('friend-declined', handleFriendDeclined);

      if (!externalSocket) {
        s.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, externalSocket, fetchRequests]);

  // 읽지 않은 개수
  const unreadCount =
    friendRequestsReceived.length + friendRequestsSent.length;

  // 받은 요청 수락/거절
  const respondRequest = async (fromUserId, action) => {
    try {
      if (action === 'accept') {
        await api.post('/api/friends/requests/accept', { fromUserId });
      } else if (action === 'decline') {
        await api.post('/api/friends/requests/decline', { fromUserId });
      }

      setFriendRequestsReceived((prev) =>
        prev.filter((r) => r.from_user_id !== fromUserId)
      );

      if (action === 'accept') {
        window.dispatchEvent(new Event('friends-updated'));
      }
      fetchRequests();
    } catch (err) {
      console.error(
        '[Notification] 요청 응답 실패:',
        err?.response?.data || err?.message
      );
    }
  };

  return (
    <>
      <NotificationBell
        bellIcon={bellIcon}
        unreadCount={unreadCount}
        onClick={() => setOpen(true)}
      />

      <NotificationModal
        open={open}
        onClose={() => setOpen(false)}
        friendRequestsReceived={friendRequestsReceived}
        friendRequestsSent={friendRequestsSent}
        messages={messages}
        respondRequest={respondRequest}
      />
    </>
  );
};

export default Notification;
