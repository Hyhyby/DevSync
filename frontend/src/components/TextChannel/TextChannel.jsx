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

const TextChannel = ({ serverId, channelId, user }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);

  const socketRef = useRef(null);
  const wrapRef = useRef(null);
  const endRef = useRef(null);

  // ✅ 토큰: sessionStorage 우선, 없으면 localStorage
  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true", // ✅ 이거
        },
        withCredentials: false,
      }),
    [token]
  );

  /** ✅ DB에서 이전 메시지 불러오기 */
  const fetchMessages = useCallback(async () => {
    if (!serverId || !channelId) return;

    try {
      const res = await api.get(
        `/api/${serverId}/messages/channels/${channelId}`
      );
      console.log("HISTORY:", res.status, res.data);
      setMessages(Array.isArray(res.data) ? res.data : []);

      // 처음 로드시 맨 아래
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "instant" });
      }, 0);
    } catch (err) {
      console.error("FETCH_CHANNEL_MESSAGES_ERROR", err);
      setMessages([]); // 실패 시라도 상태는 명확히
    }
  }, [api, serverId, channelId]);

  useEffect(() => {
    if (!channelId) return;
    setMessages([]); // ✅ 채널 바뀌면 이전 채팅 섞임 방지
    fetchMessages(); // ✅ 히스토리 로드
  }, [channelId, fetchMessages]);

  /** ✅ 소켓 연결 */
  useEffect(() => {
    if (!channelId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
      withCredentials: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      // ✅ connect 된 뒤에 join-room
      socket.emit("join-room", {
        roomId: String(channelId),
        username: user?.username || "Unknown",
      });
    };

    const handleReceive = (msg) => {
      setMessages((prev) => (Array.isArray(prev) ? [...prev, msg] : [msg]));
    };

    const handleError = (err) => {
      console.error("[socket connect_error]", err?.message || err);
    };

    socket.on("connect", handleConnect);
    socket.on("receive-message", handleReceive);
    socket.on("connect_error", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("receive-message", handleReceive);
      socket.off("connect_error", handleError);
      socket.disconnect();
    };
  }, [channelId, token, user?.username]);

  /** 스크롤 관리 */
  const handleScroll = () => {
    const el = wrapRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(dist < 40);
  };

  useEffect(() => {
    if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAtBottom]);

  /** ✅ 메시지 전송 */
  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn("Socket not connected yet.");
      return;
    }

    socket.emit("send-message", {
      roomId: String(channelId),
      serverId,
      message: text,
    });

    setInput("");
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
    />
  );
};

export default TextChannel;
