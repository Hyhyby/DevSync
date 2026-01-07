// src/components/Server/TextChannel/TextChannel.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API_BASE } from "../../config";
import TextChannelUI from "../ui/TextChannelUI";

const PAGE_SIZE = 50;

const TextChannel = ({ serverId, channelId, user }) => {
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // 무한 스크롤 상태
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const socketRef = useRef(null);
  const wrapRef = useRef(null);
  const endRef = useRef(null);

  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        withCredentials: false,
      }),
    [token]
  );

  /* ===============================
   * 최초 진입: 최신 메시지 50개
   * =============================== */
  const fetchInitialMessages = useCallback(async () => {
    if (!serverId || !channelId) return;

    try {
      const res = await api.get(
        `/api/${serverId}/messages/channels/${channelId}`,
        { params: { limit: PAGE_SIZE } }
      );

      const data = Array.isArray(res.data) ? res.data : [];
      setMessages(data);
      setHasMore(data.length === PAGE_SIZE);

      // ✅ 렌더/레이아웃 완료 후 맨 아래로 (setTimeout(0)보다 안정적)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          endRef.current?.scrollIntoView({ behavior: "instant" });
          setShowJumpToBottom(false); // 버튼 쓰고 있다면 같이 꺼주기
        });
      });
    } catch (err) {
      console.error("FETCH_INITIAL_MESSAGES_ERROR", err);
      setMessages([]);
      setHasMore(false);
    }
  }, [api, serverId, channelId]);

  useEffect(() => {
    if (!channelId) return;
    setMessages([]);
    setHasMore(true);
    fetchInitialMessages();
  }, [channelId, fetchInitialMessages]);

  /* ===============================
   * 과거 메시지 로드 (무한 스크롤)
   * =============================== */
  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;

    setLoadingMore(true);
    const oldestId = messages[0].id;

    const el = wrapRef.current;
    const prevHeight = el?.scrollHeight ?? 0;

    try {
      const res = await api.get(
        `/api/${serverId}/messages/channels/${channelId}`,
        {
          params: {
            before: oldestId,
            limit: PAGE_SIZE,
          },
        }
      );

      if (!Array.isArray(res.data) || res.data.length === 0) {
        setHasMore(false);
      } else {
        // prepend
        setMessages((prev) => [...res.data, ...prev]);

        // 스크롤 위치 유지
        requestAnimationFrame(() => {
          if (!el) return;
          const nextHeight = el.scrollHeight;
          el.scrollTop = nextHeight - prevHeight;
        });
      }
    } catch (err) {
      console.error("LOAD_MORE_MESSAGES_ERROR", err);
    } finally {
      setLoadingMore(false);
    }
  };

  /* ===============================
   * 스크롤 이벤트
   * =============================== */
  const handleScroll = () => {
    const el = wrapRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist < 80; // 80px 이내면 '맨 아래'

    setShowJumpToBottom(!atBottom);

    // 위쪽에 거의 닿으면 과거 메시지 로드
    if (el.scrollTop < 40) {
      loadMoreMessages();
    }
  };
  const jumpToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowJumpToBottom(false);
  }, []);

  /* ===============================
   * 소켓 연결 (실시간 메시지)
   * =============================== */
  useEffect(() => {
    if (!channelId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: { token },
      withCredentials: false,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", {
        roomId: String(channelId),
        username: user.username,
      });
    });

    socket.on("receive-message", (msg) => {
      setMessages((prev) => [...prev, msg]);

      // ✅ 내가 보낸 메시지는 무조건 맨 아래로
      if (msg.username === user.username) {
        requestAnimationFrame(() => {
          endRef.current?.scrollIntoView({ behavior: "smooth" });
        });
        setShowJumpToBottom(false);
        return;
      }

      // ✅ 남이 보낸 메시지는: 내가 아래 근처일 때만 자동 스크롤
      const el = wrapRef.current;
      if (!el) return;

      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = dist < 80;

      if (nearBottom) {
        requestAnimationFrame(() => {
          endRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      } else {
        setShowJumpToBottom(true);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("SOCKET_CONNECT_ERROR", err.message);
    });

    return () => {
      socket.emit("leave-room", { roomId: String(channelId) });
      socket.disconnect();
    };
  }, [channelId, token, user.username]);

  /* ===============================
   * 메시지 전송
   * =============================== */
  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    if (!socketRef.current?.connected) return;

    socketRef.current.emit("send-message", {
      roomId: String(channelId),
      serverId,
      message: text,
    });

    setInput("");
    // ✅ 내가 보낸 순간은 무조건 맨 아래로
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    // ✅ 아래로 내려갔으니 버튼 숨김
    setShowJumpToBottom(false);
  };

  return (
    <TextChannelUI
      messages={messages}
      input={input}
      setInput={setInput}
      sendMessage={sendMessage}
      wrapRef={wrapRef}
      endRef={endRef}
      onScroll={handleScroll}
      username={user.username}
      hasMore={hasMore}
      showJumpToBottom={showJumpToBottom}
      onJumpToBottom={jumpToBottom}
    />
  );
};

export default TextChannel;
