// src/components/Home/Friends.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { API_BASE } from "../../config";

import FriendsSidebar from "../ui/FriendsSidebar";
import AddFriendModal from "../ui/AddFriendModal";
import FriendRequestResultModal from "../ui/FriendRequestResultModal";

const Friends = ({ user, logo, addFriendIcon, onLogout }) => {
  // 🔹 더미 데이터 (UI 테스트용)
  const dummyFriends = [
    { id: 1, username: "DevSyncUser" },
    { id: 2, username: "StudyBuddy" },
    { id: 3, username: "코딩친구" },
  ];

  const [friends, setFriends] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("friends") || "[]");
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
  const [friendIdentifier, setFriendIdentifier] = useState("");

  // ✅ 친구 요청 결과 모달
  const [requestResult, setRequestResult] = useState(null);
  // { type: 'success' | 'error', message: string }

  const navigate = useNavigate();
  const socketRef = useRef(null);

  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

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

  // 🔹 친구 목록 불러오기
  const fetchFriends = useCallback(async () => {
    console.log("[Friends] fetchFriends() 호출됨");
    try {
      const res = await api.get("/api/friends");
      console.log("[Friends] /api/friends 응답:", res.status, res.data);

      if (Array.isArray(res.data)) {
        console.log("[Friends] 배열 길이:", res.data.length);
        setFriends(res.data);
      } else {
        console.warn("[Friends] 예상치 못한 응답 형태:", res.data);
        setFriends([]);
      }
    } catch (err) {
      console.error(
        "[Friends] /api/friends 실패:",
        err?.response?.status,
        err?.response?.data || err?.message
      );
      // 실패 시 기존 값 유지
      setFriends((prev) => prev);
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
    window.addEventListener("friends-updated", handler);
    return () => window.removeEventListener("friends-updated", handler);
  }, [fetchFriends]);

  // 창 포커스 시 새로고침
  useEffect(() => {
    const onFocus = () => fetchFriends();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchFriends]);

  // 로컬 저장
  useEffect(() => {
    localStorage.setItem("friends", JSON.stringify(friends));
  }, [friends]);

  // (선택) 소켓으로 나중에 친구 수락 알림 받기
  useEffect(() => {
    if (!token) return;

    const s = io(API_BASE, {
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = s;

    s.on("connect", () => {
      console.log("[Friends SOCKET] connected:", s.id);
    });

    // 서버에서 'friend-accepted' 이벤트를 보내준다고 가정
    s.on("friend-accepted", (payload) => {
      console.log("[Friends] friend-accepted:", payload);
      fetchFriends(); // 새로 친구 목록 불러오기
    });

    return () => {
      s.off("connect");
      s.off("friend-accepted");
      s.disconnect();
    };
  }, [token, fetchFriends]);

  const openDmWindow = useCallback(
    async (friend) => {
      try {
        // 1) DM 방 생성 or 가져오기
        const res = await api.post("/api/dms", { targetUserId: friend.id });
        const { dmId } = res.data;

        // 2) 새 창에서 DM 페이지 열기
        const url = `${
          window.location.origin
        }/dm/${dmId}?u=${encodeURIComponent(friend.username)}`;

        window.open(url, "_blank", "width=900,height=600,noopener,noreferrer");
      } catch (err) {
        console.error("OPEN_DM_WINDOW_ERROR", err);
        alert("DM을 생성하는 중 오류가 발생했습니다.");
      }
    },
    [api]
  );

  const joinRoom = (friendId) => {
    const friend = friends.find((f) => f.id === friendId);
    if (!friend) return;
    openDmWindow(friend);
  };

  // ✅ 친구 추가 요청 (백엔드 연결)
  const handleAddFriend = useCallback(
    async (e) => {
      e.preventDefault();
      const identifier = friendIdentifier.trim();
      if (!identifier) return;

      try {
        const res = await api.post("/api/friends/request", { identifier });
        const target = res.data?.targetUser;

        setRequestResult({
          type: "success",
          message: target
            ? `${target.username}에게 친구 요청을 보냈어요.`
            : "친구 요청을 보냈어요.",
        });

        setFriendIdentifier("");
        setShowAddFriend(false);
        window.dispatchEvent(new Event("friend-requests-updated"));
      } catch (err) {
        const msg =
          err.response?.data?.error ||
          "친구 요청을 보내지 못했어요. 아이디를 다시 확인해 주세요.";
        setRequestResult({
          type: "error",
          message: msg,
        });
      }
    },
    [friendIdentifier, api]
  );

  return (
    <>
      <FriendsSidebar
        user={user}
        logo={logo}
        addFriendIcon={addFriendIcon}
        friends={friends}
        loadingFriends={loadingFriends}
        onAddFriendClick={() => setShowAddFriend(true)}
        onJoinRoom={joinRoom}
        onLogout={onLogout}
      />

      <AddFriendModal
        open={showAddFriend}
        friendIdentifier={friendIdentifier}
        onChangeFriendIdentifier={setFriendIdentifier}
        onClose={() => {
          setShowAddFriend(false);
          setFriendIdentifier("");
        }}
        onSubmit={handleAddFriend}
      />

      <FriendRequestResultModal
        result={requestResult}
        onClose={() => setRequestResult(null)}
      />
    </>
  );
};

export default Friends;
