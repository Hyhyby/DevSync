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

const TextChannel = ({ serverId, channelId, user }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);

  const socketRef = useRef(null);
  const wrapRef = useRef(null);
  const endRef = useRef(null);

  const token = sessionStorage.getItem("token");

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  /** 📌 DB에서 이전 메시지 불러오기 */
  const fetchMessages = useCallback(async () => {
    if (!channelId) return;

    const res = await api.get(
      `/api/${serverId}/messages/channels/${channelId}`
    );
    setMessages(Array.isArray(res.data) ? res.data : []);

    setTimeout(
      () => endRef.current?.scrollIntoView({ behavior: "instant" }),
      0
    );
  }, [api, serverId, channelId]);

  useEffect(() => {
    if (!channelId) return;
    fetchMessages();
  }, [fetchMessages]);

  /** 📌 소켓 연결 */
  useEffect(() => {
    if (!channelId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: { token },
    });

    socketRef.current = socket;
    socket.emit("join-room", { roomId: channelId });

    socket.on("receive-message", (msg) => {
      setMessages((prev) => (Array.isArray(prev) ? [...prev, msg] : [msg]));
    });

    return () => {
      socket.emit("leave-room", { roomId: channelId });
      socket.disconnect();
    };
  }, [channelId, token]);

  /** 📌 스크롤 관리 */
  const handleScroll = () => {
    const el = wrapRef.current;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(dist < 40);
  };

  useEffect(() => {
    if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAtBottom]);

  /** 📌 메시지 전송 */
  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    socketRef.current.emit("send-message", {
      roomId: channelId,
      serverId,
      message: input,
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
