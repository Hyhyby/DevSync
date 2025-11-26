// src/components/Home/Notification.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API_BASE } from "../../config";
import NotificationBell from "../ui/NotificationBell";
import NotificationModal from "../ui/NotificationModal";

const Notification = ({ bellIcon, socket: externalSocket }) => {
  const [open, setOpen] = useState(false);

  // 🔹 받은 / 보낸 친구 요청
  const [friendRequestsReceived, setFriendRequestsReceived] = useState([]);
  const [friendRequestsSent, setFriendRequestsSent] = useState([]);

  // 🔹 서버 초대 (받은 / 보낸)
  const [serverInvitesReceived, setServerInvitesReceived] = useState([]);
  const [serverInvitesSent, setServerInvitesSent] = useState([]);

  // 일반 메시지(시스템 알림용)
  const [messages] = useState(["DevSync에 오신 것을 환영합니다."]);

  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

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
          "ngrok-skip-browser-warning": "true",
        },
      }),
    [token]
  );

  // 🔹 친구 요청 목록 불러오기
  const fetchRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get("/api/friends/requests");

      const received = Array.isArray(res.data?.received)
        ? res.data.received
        : [];
      const sent = Array.isArray(res.data?.sent) ? res.data.sent : [];

      setFriendRequestsReceived(received);
      setFriendRequestsSent(sent);
    } catch (err) {
      console.error(
        "[Notification] 친구 요청 목록 실패:",
        err?.response?.data || err?.message
      );
    }
  }, [api, token]);

  // 🔹 서버 초대 목록 불러오기
  const fetchServerInvites = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get("/api/servers/invites");

      const received = Array.isArray(res.data?.received)
        ? res.data.received
        : [];
      const sent = Array.isArray(res.data?.sent) ? res.data.sent : [];

      setServerInvitesReceived(received);
      setServerInvitesSent(sent);
    } catch (err) {
      console.error(
        "[Notification] 서버 초대 목록 실패:",
        err?.response?.data || err?.message
      );
    }
  }, [api, token]);

  // 최초 마운트 시 친구 요청 + 서버 초대 둘 다 불러오기
  useEffect(() => {
    fetchRequests();
    fetchServerInvites();
  }, [fetchRequests, fetchServerInvites]);

  // 다른 컴포넌트에서 friend-requests-updated 이벤트 쏘면 새로고침
  useEffect(() => {
    const handler = () => {
      fetchRequests();
      fetchServerInvites();
    };

    window.addEventListener("friend-requests-updated", handler);
    return () => window.removeEventListener("friend-requests-updated", handler);
  }, [fetchRequests, fetchServerInvites]);

  // ✅ Socket.IO 연결: 실시간 친구 요청 / 서버 초대 이벤트
  useEffect(() => {
    if (!token) return;

    // 1) 부모에서 socket을 넘겨준 경우 그걸 사용
    let s = externalSocket || socketRef.current;

    // 2) 없으면 여기서 새로 생성
    if (!s) {
      s = io(API_BASE, {
        transports: ["websocket"],
        auth: { token },
      });
      socketRef.current = s;
    }

    const handleConnect = () => {
      console.log("[Notification SOCKET] connected:", s.id);
    };

    const handleFriendRequest = (payload) => {
      console.log("[Notification] friend-request 이벤트 수신:", payload);
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
      console.log("[Notification] friend-accepted 이벤트 수신:", payload);
      fetchRequests();
    };

    // 🔹 거절 이벤트: 보낸 사람이 이걸 받아서 목록 새로고침
    const handleFriendDeclined = (payload) => {
      console.log("[Notification] friend-declined 이벤트 수신:", payload);
      fetchRequests();
    };

    // 🔹 서버 초대 도착
    const handleServerInvite = (payload) => {
      console.log("[Notification] server-invite 이벤트 수신:", payload);
      setServerInvitesReceived((prev) => [
        {
          invite_id: payload.inviteId,
          server_id: payload.serverId,
          server_name: payload.serverName,
          from_user_id: payload.fromUserId,
          from_username: payload.fromUsername,
          status: "pending",
          created_at: payload.createdAt,
        },
        ...prev,
      ]);
    };

    // 🔹 서버 초대 수락/거절 → 그냥 서버 기준으로 목록 새로고침
    const handleServerInviteAccepted = (payload) => {
      console.log(
        "[Notification] server-invite-accepted 이벤트 수신:",
        payload
      );
      fetchServerInvites();
    };

    const handleServerInviteDeclined = (payload) => {
      console.log(
        "[Notification] server-invite-declined 이벤트 수신:",
        payload
      );
      fetchServerInvites();
    };

    s.on("connect", handleConnect);
    s.on("friend-request", handleFriendRequest);
    s.on("friend-accepted", handleFriendAccepted);
    s.on("friend-declined", handleFriendDeclined);

    s.on("server-invite", handleServerInvite);
    s.on("server-invite-accepted", handleServerInviteAccepted);
    s.on("server-invite-declined", handleServerInviteDeclined);

    // cleanup
    return () => {
      s.off("connect", handleConnect);
      s.off("friend-request", handleFriendRequest);
      s.off("friend-accepted", handleFriendAccepted);
      s.off("friend-declined", handleFriendDeclined);

      s.off("server-invite", handleServerInvite);
      s.off("server-invite-accepted", handleServerInviteAccepted);
      s.off("server-invite-declined", handleServerInviteDeclined);

      if (!externalSocket) {
        s.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, externalSocket, fetchRequests, fetchServerInvites]);

  // 읽지 않은 개수 (친구 요청 + 서버 초대)
  const unreadCount =
    friendRequestsReceived.length +
    friendRequestsSent.length +
    serverInvitesReceived.length;

  // 받은 친구 요청 수락/거절
  const respondRequest = async (fromUserId, action) => {
    try {
      if (action === "accept") {
        await api.post("/api/friends/requests/accept", { fromUserId });
      } else if (action === "decline") {
        await api.post("/api/friends/requests/decline", { fromUserId });
      }

      setFriendRequestsReceived((prev) =>
        prev.filter((r) => r.from_user_id !== fromUserId)
      );

      if (action === "accept") {
        window.dispatchEvent(new Event("friends-updated"));
      }
      fetchRequests();
    } catch (err) {
      console.error(
        "[Notification] 요청 응답 실패:",
        err?.response?.data || err?.message
      );
    }
  };

  // 받은 서버 초대 수락/거절
  const respondServerInvite = async (inviteId, action) => {
    try {
      if (action === "accept") {
        await api.post("/api/servers/invites/accept", { inviteId });
      } else if (action === "decline") {
        await api.post("/api/servers/invites/decline", { inviteId });
      }

      setServerInvitesReceived((prev) =>
        prev.filter((inv) => inv.invite_id !== inviteId)
      );

      if (action === "accept") {
        // 서버 멤버 UI 갱신에 쓰고 싶으면 이 이벤트를 ServerPage에서 리스닝
        window.dispatchEvent(new Event("server-members-updated"));
      }

      fetchServerInvites();
    } catch (err) {
      console.error(
        "[Notification] 서버 초대 응답 실패:",
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
        // ✅ 서버 초대 관련 props 전달
        serverInvitesReceived={serverInvitesReceived}
        serverInvitesSent={serverInvitesSent}
        respondServerInvite={respondServerInvite}
      />
    </>
  );
};

export default Notification;
