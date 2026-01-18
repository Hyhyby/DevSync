// src/components/DM/DirectMessage.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API_BASE } from "../../config";
import DirectMessageUI from "../ui/DirectMessageUI";

const BOTTOM_THRESHOLD = 48;

const DirectMessage = () => {
  const [user, setUser] = useState(null);

  const [dmId, setDmId] = useState(null);
  const [partnerName, setPartnerName] = useState("DM");

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);

  const [partnerProfileImage, setPartnerProfileImage] = useState(null);
  const [myProfileImage, setMyProfileImage] = useState(null);

  const socketRef = useRef(null);
  const messagesWrapRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 1) URL에서 dmId, 상대 이름 파싱
  useEffect(() => {
    try {
      const { pathname, search } = window.location;
      const parts = pathname.split("/").filter(Boolean);
      const idPart = parts[parts.length - 1];
      if (idPart) setDmId(idPart);

      const params = new URLSearchParams(search);
      const u = params.get("u");
      if (u) setPartnerName(decodeURIComponent(u));
    } catch (err) {
      console.error("DM_URL_PARSE_ERROR", err);
    }
  }, []);

  // 2) 토큰 / user 로딩
  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

  useEffect(() => {
    const stored =
      sessionStorage.getItem("user") || localStorage.getItem("user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        setMyProfileImage(u?.profileImage || null);
      } catch {
        console.warn("USER_PARSE_FAILED");
      }
    }
  }, []);

  // ✅ axios 인스턴스 (먼저!)
  const api = useMemo(() => {
    return axios.create({
      baseURL: API_BASE,
      timeout: 15000,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "ngrok-skip-browser-warning": "true",
      },
      withCredentials: true,
    });
  }, [token]);

  // ✅ (선택) DB 최신 user로 갱신 (auth/me가 profileImage 내려줄 때만 의미 있음)
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const me = await api.get("/api/auth/me");
        const fresh = me.data;

        setUser((prev) => {
          const next = { ...(prev || {}), ...(fresh || {}) };
          const serialized = JSON.stringify(next);
          sessionStorage.setItem("user", serialized);
          localStorage.setItem("user", serialized);

          // 내 프로필 이미지도 같이 반영
          setMyProfileImage(next?.profileImage || null);

          return next;
        });
      } catch (e) {
        console.warn("DM_GET_ME_FAILED", e?.response?.status, e?.message);
      }
    })();
  }, [api, token]);

  // 3) 기존 메시지 로딩
  const fetchMessages = useCallback(async () => {
    if (!dmId || !token) return;
    try {
      const res = await api.get(`/api/dms/${dmId}/messages`);
      if (Array.isArray(res.data)) {
        setMessages(res.data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }, 0);
      }
    } catch (err) {
      console.error("FETCH_DM_MESSAGES_ERROR", err);
    }
  }, [api, dmId, token]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ✅ 4) DM 참가자 조회해서 상대(내가 아닌 유저) 프로필/이름 세팅
  const fetchParticipants = useCallback(async () => {
    if (!dmId || !token) return;
    if (!user?.id) return; // ✅ 내 id 없으면 partner 판별 불가

    try {
      const res = await api.get(`/api/dms/${dmId}/participants`);
      const list = Array.isArray(res.data) ? res.data : [];

      const partner = list.find((p) => Number(p.userId) !== Number(user.id));

      if (partner) {
        setPartnerName(partner.username || "DM");
        setPartnerProfileImage(partner.profileImage || null);
      }
    } catch (e) {
      console.error(
        "FETCH_DM_PARTICIPANTS_ERROR",
        e?.response?.data || e?.message || e,
      );
    }
  }, [api, dmId, token, user?.id]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  // 5) socket 연결
  useEffect(() => {
    if (!dmId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
      withCredentials: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      socket.emit("join-dm", dmId);
    };

    const handleReceive = (msg) => {
      setMessages((prev) => {
        const exists = prev.some(
          (m) =>
            m.id === msg.id ||
            (m.username === msg.username &&
              m.message === msg.message &&
              m.created_at === msg.created_at),
        );
        if (exists) return prev;
        return [...prev, msg];
      });
    };

    const handleError = (err) => {
      console.error("[socket connect_error]", err?.message || err);
    };

    socket.on("connect", handleConnect);
    socket.on("receive-dm", handleReceive);
    socket.on("connect_error", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("receive-dm", handleReceive);
      socket.off("connect_error", handleError);
      socket.disconnect();
    };
  }, [dmId, token]);

  // 6) 스크롤 관리
  const handleScroll = () => {
    const el = messagesWrapRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom <= BOTTOM_THRESHOLD);
  };

  useEffect(() => {
    if (!messagesWrapRef.current) return;
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  useEffect(() => {
    setMessages([]);
    messagesEndRef.current?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
  }, [dmId]);

  // 7) 전송
  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn("Socket not connected yet");
      return;
    }

    socket.emit("send-dm", { dmId, message: text });
    setInput("");
  };

  if (!dmId) {
    return (
      <div className="w-screen h-screen bg-[#050608] text-gray-300 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">
            잘못된 DM 주소입니다.
          </div>
          <div className="text-sm text-gray-400">
            창을 닫고 다시 시도해 주세요.
          </div>
        </div>
      </div>
    );
  }

  return (
    <DirectMessageUI
      dmId={dmId}
      partnerName={partnerName}
      myUsername={user?.username}
      myProfileImage={myProfileImage}
      partnerProfileImage={partnerProfileImage}
      messages={messages}
      input={input}
      onChangeInput={setInput}
      onSubmit={sendMessage}
      onScroll={handleScroll}
      messagesWrapRef={messagesWrapRef}
      messagesEndRef={messagesEndRef}
    />
  );
};

export default DirectMessage;
