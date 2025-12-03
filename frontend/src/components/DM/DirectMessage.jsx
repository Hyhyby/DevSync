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

const BOTTOM_THRESHOLD = 48; // px

const DirectMessage = () => {
  // ✅ 로그인 유저 정보
  const [user, setUser] = useState(null);

  // ✅ DM 방 정보
  const [dmId, setDmId] = useState(null);
  const [partnerName, setPartnerName] = useState("DM");

  // ✅ 메시지 & 입력 상태
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);

  // ✅ ref
  const socketRef = useRef(null);
  const messagesWrapRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ---------------------------------------------------------------------------
  // 1) URL에서 dmId, 상대 이름 파싱 (/dm/:dmId?u=hello1 이런 식)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      const { pathname, search } = window.location;
      const parts = pathname.split("/").filter(Boolean); // ["dm","123"]
      const idPart = parts[parts.length - 1];
      if (idPart) setDmId(idPart);

      const params = new URLSearchParams(search);
      const u = params.get("u");
      if (u) setPartnerName(decodeURIComponent(u));
    } catch (err) {
      console.error("DM_URL_PARSE_ERROR", err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 2) 로그인 유저 & 토큰 로딩
  // ---------------------------------------------------------------------------
  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

  useEffect(() => {
    const stored =
      sessionStorage.getItem("user") || localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        console.warn("USER_PARSE_FAILED");
      }
    }
  }, []);

  // axios 인스턴스
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

  // ---------------------------------------------------------------------------
  // 3) 기존 DM 메시지 로딩  GET /api/dms/:dmId/messages
  // ---------------------------------------------------------------------------
  const fetchMessages = useCallback(async () => {
    if (!dmId || !token) return;
    try {
      const res = await api.get(`/api/dms/${dmId}/messages`);
      if (Array.isArray(res.data)) {
        setMessages(res.data);
        // 첫 로딩 시 맨 아래로
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

  // ---------------------------------------------------------------------------
  // 4) Socket.IO 연결 (join-dm / receive-dm)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!dmId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: token ? { token } : undefined, // 🔐 socket.js에서 jwt.verify 쓰는 부분
      withCredentials: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      // ✅ DM 방에 join
      socket.emit("join-dm", dmId);
    };

    const handleReceive = (msg) => {
      // { id, dm_id, user_id, username, message, created_at }
      setMessages((prev) => {
        const exists = prev.some(
          (m) =>
            m.id === msg.id ||
            (m.username === msg.username &&
              m.message === msg.message &&
              m.created_at === msg.created_at)
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

  // ---------------------------------------------------------------------------
  // 5) 스크롤 상태 관리
  // ---------------------------------------------------------------------------
  const handleScroll = () => {
    const el = messagesWrapRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom <= BOTTOM_THRESHOLD);
  };

  // 새 메시지 올 때 바닥 근처면 자동 스크롤
  useEffect(() => {
    if (!messagesWrapRef.current) return;
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // DM 방 변경 시 초기화
  useEffect(() => {
    setMessages([]);
    messagesEndRef.current?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
  }, [dmId]);

  // ---------------------------------------------------------------------------
  // 6) 메시지 전송  (socket.emit('send-dm', { dmId, message }))
  // ---------------------------------------------------------------------------
  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn("Socket not connected yet");
      return;
    }

    // 🔥 socket.js에서 socket.user 를 쓰고 있으니까 userId는 안 보냄
    socket.emit("send-dm", {
      dmId,
      message: text,
    });

    setInput("");
    // 실제 메시지는 서버에서 다시 브로드캐스트(receive-dm) 해주므로
    // 여기서 직접 messages에 push할 필요 없음
  };

  // ---------------------------------------------------------------------------
  // 7) 렌더
  // ---------------------------------------------------------------------------
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

  const myUsername = user?.username;

  return (
    <div className="w-screen h-screen bg-[#050608] flex flex-col text-white">
      {/* 헤더 */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-[#202225] bg-[#18191c]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-discord-blurple flex items-center justify-center text-sm font-semibold">
            {partnerName?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{partnerName}</span>
            <span className="text-[11px] text-gray-400">Direct Message</span>
          </div>
        </div>

        {myUsername && (
          <div className="text-xs text-gray-400">Logged in as {myUsername}</div>
        )}
      </header>

      {/* 본문 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 메시지 리스트 */}
        <div
          ref={messagesWrapRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          {messages.map((msg, index) => {
            const isOwn = msg.username === myUsername;
            const initial = msg.username?.charAt(0)?.toUpperCase() || "?";

            return (
              <div
                key={msg.id || index}
                className={`flex items-start ${
                  isOwn ? "justify-end" : "justify-start"
                } gap-3`}
              >
                {/* 상대방 아바타 */}
                {!isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {initial}
                  </div>
                )}

                {/* 말풍선 */}
                <div
                  className={`p-3 rounded-lg max-w-[70%] break-words whitespace-pre-wrap ${
                    isOwn
                      ? "bg-discord-blurple text-white text-right"
                      : "bg-discord-darkest text-gray-300 text-left"
                  }`}
                >
                  {!isOwn && (
                    <div className="text-sm font-semibold text-white mb-1">
                      {msg.username}
                    </div>
                  )}
                  <div>{msg.message}</div>
                </div>

                {/* 내 아바타 */}
                {isOwn && (
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {myUsername?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
            );
          })}

          {/* 스크롤 기준점 */}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력창 */}
        <form
          onSubmit={sendMessage}
          className="p-4 border-t border-[#202225] bg-[#18191c] flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`${partnerName}에게 메시지 보내기`}
            className="flex-1 p-3 bg-discord-dark border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-discord-blurple"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-discord-blurple hover:bg-blue-600 rounded text-white font-semibold text-sm"
          >
            보내기
          </button>
        </form>
      </div>
    </div>
  );
};

export default DirectMessage;
