// src/components/Server/ServerChat.jsx
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../../config";

const BOTTOM_THRESHOLD = 48; // px

const ServerChat = ({ user, roomId, roomName }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);

  const socketRef = useRef(null);
  const messagesWrapRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 소켓 연결
  useEffect(() => {
    const token = sessionStorage.getItem("token");

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
      withCredentials: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      socket.emit("join-room", {
        roomId, // 지금은 서버/채널 id를 roomId로 사용
        username: user?.username || "Unknown",
      });
    };

    const handleReceive = (msg) => {
      setMessages((prev) => [...prev, msg]);
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
  }, [roomId, user?.username]);

  // 스크롤 위치 추적
  const handleScroll = () => {
    const el = messagesWrapRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom <= BOTTOM_THRESHOLD);
  };

  // 새 메시지 들어오면 바닥에 있을 때만 자동 스크롤
  useEffect(() => {
    if (!messagesWrapRef.current) return;
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // 방/채널 바뀔 때는 바로 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
    setMessages([]); // 채널 변경 시 이전 채팅 비우고 싶으면 유지
  }, [roomId]);

  // 메시지 전송
  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn("Socket not connected yet.");
      return;
    }

    const messageData = {
      roomId,
      message: text,
      userId: user?.id || "unknown",
      username: user?.username || "Unknown",
    };

    socket.emit("send-message", messageData);

    setMessages((prev) => [
      ...prev,
      {
        ...messageData,
        id: Date.now(),
        timestamp: new Date().toISOString(),
      },
    ]);

    setInput("");
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050608]">
      {/* 상단 채널 이름 부분은 ServerPage에서 이미 있으니까 여기선 생략해도 되고,
          필요하면 아래 주석 풀어서 쓸 수도 있음 */}
      {/* 
      <header className="h-12 border-b border-neutral-900 px-4 flex items-center">
        <span className="text-lg mr-2 text-gray-400">#</span>
        <span className="font-semibold text-sm">{roomName}</span>
      </header>
      */}

      {/* 메시지 영역 */}
      <div
        ref={messagesWrapRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {messages.map((msg, index) => {
          const isOwn = msg.username === user?.username;

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
                  {msg.username?.charAt(0)?.toUpperCase() || "?"}
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
                <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {msg.username?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <form
        onSubmit={sendMessage}
        className="p-4 border-t border-discord-dark flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`${roomName || "채널"}에 메시지 보내기...`}
          className="flex-1 p-3 bg-discord-dark border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-discord-blurple"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-discord-blurple hover:bg-blue-600 rounded text-white font-semibold"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ServerChat;
