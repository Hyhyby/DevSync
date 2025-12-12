// src/components/Server/ServerChat.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API_BASE } from "../../config";
import ServerChatUI from "../ui/ServerChatUI";

const BOTTOM_THRESHOLD = 48; // px

const ServerChat = ({ user, roomId, roomName }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [resolvedRoomName, setResolvedRoomName] = useState(roomName || "#채팅");

  const socketRef = useRef(null);
  const messagesWrapRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --- 토큰 & axios 인스턴스 ---
  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

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

  // roomName prop이 바뀌면 header 텍스트 갱신
  useEffect(() => {
    if (roomName) setResolvedRoomName(roomName);
  }, [roomName]);

  // ---------------------------------------------------------------------------
  // 1) 채널 이전 메시지 로딩 (REST)
  //    GET /api/channels/:channelId/messages
  // ---------------------------------------------------------------------------
  const fetchMessages = useCallback(async () => {
    if (!roomId || !token) return;

    try {
      const res = await api.get(`/api/channels/${roomId}/messages`, {
        params: { limit: 50 },
      });

      if (!Array.isArray(res.data)) {
        setMessages([]);
        return;
      }

      // 서버는 최신순(desc)으로 주니까 오래된 것부터 보이도록 reverse
      const ordered = [...res.data].reverse();

      // REST에서는 content, socket에서는 message를 쓰므로 통일
      const normalized = ordered.map((m) => ({
        id: m.id,
        message: m.content ?? m.message ?? "",
        userId: m.userId,
        username: m.username,
        timestamp: m.timestamp,
        isSystem: m.isSystem || m.userId === "system",
      }));

      setMessages(normalized);

      // 첫 로딩 시 맨 아래로
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 0);
    } catch (err) {
      console.error("FETCH_CHANNEL_MESSAGES_ERROR", err);
    }
  }, [api, roomId, token]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ---------------------------------------------------------------------------
  // 2) Socket.IO 연결 & 이벤트
  //    - join-room
  //    - room-info
  //    - receive-message
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!roomId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
      withCredentials: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      // 방 입장
      socket.emit("join-room", {
        roomId,
        username: user?.username,
      });
    };

    const handleRoomInfo = (room) => {
      if (room?.name) {
        setResolvedRoomName(room.name);
      }
    };

    const handleReceive = (msg) => {
      // socket.js: { id, message, userId, username, timestamp, isSystem? }
      setMessages((prev) => [...prev, msg]);
    };

    const handleError = (err) => {
      console.error("[socket connect_error]", err?.message || err);
    };

    socket.on("connect", handleConnect);
    socket.on("room-info", handleRoomInfo);
    socket.on("receive-message", handleReceive);
    socket.on("connect_error", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room-info", handleRoomInfo);
      socket.off("receive-message", handleReceive);
      socket.off("connect_error", handleError);
      socket.disconnect();
    };
  }, [roomId, token, user?.username]);

  // ---------------------------------------------------------------------------
  // 3) 스크롤 감지 & 자동 스크롤
  // ---------------------------------------------------------------------------
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

  // room이 바뀌면 메시지 초기화 & 맨 아래로
  useEffect(() => {
    setMessages([]);
    messagesEndRef.current?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
  }, [roomId]);

  // ---------------------------------------------------------------------------
  // 4) 메시지 전송 (Socket)
  //    socket.emit("send-message", { roomId, message })
  // ---------------------------------------------------------------------------
  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !roomId) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn("Socket not connected yet");
      return;
    }

    socket.emit("send-message", {
      roomId,
      message: text,
    });

    setInput("");
    // 실제 추가는 receive-message 이벤트에서 처리
  };

  // roomId 없으면 에러 화면
  if (!roomId) {
    return (
      <div className="flex-1 bg-[#050608] text-gray-300 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">
            채널 정보를 찾을 수 없습니다.
          </div>
          <div className="text-sm text-gray-400">
            다른 채널을 선택하거나 다시 시도해 주세요.
          </div>
        </div>
      </div>
    );
  }

  const myUsername = user?.username;

  return (
    <ServerChatUI
      roomName={resolvedRoomName}
      myUsername={myUsername}
      messages={messages}
      input={input}
      onChangeInput={setInput}
      onSubmit={handleSendMessage}
      onScroll={handleScroll}
      messagesWrapRef={messagesWrapRef}
      messagesEndRef={messagesEndRef}
    />
  );
};

export default ServerChat;
