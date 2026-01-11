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

  // ✅ 파일 첨부 상태
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]

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
   * ✅ 파일 선택/삭제 핸들러
   * =============================== */
  const onPickFiles = useCallback((fileList) => {
    const arr = Array.from(fileList || []);
    if (arr.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...arr]);
  }, []);

  const removeSelectedFile = useCallback((idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearSelectedFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

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

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          endRef.current?.scrollIntoView({ behavior: "instant" });
          setShowJumpToBottom(false);
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
    clearSelectedFiles(); // ✅ 채널 바뀌면 첨부 초기화
    fetchInitialMessages();
  }, [channelId, fetchInitialMessages, clearSelectedFiles]);

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
        setMessages((prev) => [...res.data, ...prev]);

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
    const atBottom = dist < 80;

    setShowJumpToBottom(!atBottom);

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

      // 내가 보낸 메시지면 무조건 맨 아래
      if (msg.username === user.username) {
        requestAnimationFrame(() => {
          endRef.current?.scrollIntoView({ behavior: "smooth" });
        });
        setShowJumpToBottom(false);
        return;
      }

      // 남이 보낸 메시지는 아래 근처일 때만 자동 스크롤
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
   * ✅ 메시지 전송 (텍스트는 소켓, 파일 있으면 HTTP 업로드)
   * =============================== */
  const sendMessage = async (e) => {
    e.preventDefault();

    const text = input.trim();
    const hasFiles = selectedFiles.length > 0;

    // 아무것도 없으면 전송 X
    if (!text && !hasFiles) return;

    // ✅ 파일이 있으면: HTTP 업로드로 처리 (백엔드가 저장 후 receive-message emit 해줌)
    if (hasFiles) {
      try {
        const form = new FormData();
        if (text) form.append("message", text);
        selectedFiles.forEach((f) => form.append("files", f)); // upload.array("files", ...)

        await api.post(
          `/api/${serverId}/messages/channels/${channelId}/files`,
          form
        );

        setInput("");
        clearSelectedFiles();

        // 업로드 후에도 UX상 맨 아래로
        requestAnimationFrame(() => {
          endRef.current?.scrollIntoView({ behavior: "smooth" });
        });
        setShowJumpToBottom(false);
        return;
      } catch (err) {
        console.error(
          "UPLOAD_MESSAGE_ERROR",
          err?.response?.data || err?.message
        );
        alert(err?.response?.data?.error || "파일 업로드 실패");
        return;
      }
    }

    // ✅ 파일 없으면: 기존 소켓 텍스트 전송
    if (!socketRef.current?.connected) return;

    socketRef.current.emit("send-message", {
      roomId: String(channelId),
      serverId,
      message: text,
    });

    setInput("");
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
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
      loadingMore={loadingMore}
      // ✅ 파일첨부 props 추가
      selectedFiles={selectedFiles}
      onPickFiles={onPickFiles}
      removeSelectedFile={removeSelectedFile}
      clearSelectedFiles={clearSelectedFiles}
    />
  );
};

export default TextChannel;
