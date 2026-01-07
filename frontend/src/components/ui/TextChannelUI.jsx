// src/components/Server/TextChannel/TextChannelUI.jsx
import React from "react";
import arrowDown from "../../../assets/arrow_down.png";
const formatDate = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const isDifferentDay = (a, b) => {
  if (!a || !b) return true;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  );
};

const TextChannelUI = ({
  messages,
  input,
  setInput,
  sendMessage,
  wrapRef,
  endRef,
  onScroll,
  username,
  hasMore,
  showJumpToBottom,
  onJumpToBottom,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#1E1F22]">
      {/* 메시지 목록 */}
      <div
        ref={wrapRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {messages.map((m, idx) => {
          const prev = messages[idx - 1];
          const showDateDivider = isDifferentDay(prev?.timestamp, m.timestamp);
          const shouldHideTopDivider = idx === 0 && hasMore;
          const isMine = m.username === username;

          return (
            <React.Fragment key={m.id ?? `${m.username}-${m.timestamp}-${idx}`}>
              {showDateDivider && !shouldHideTopDivider && (
                <div className="flex items-center my-4">
                  <div className="flex-1 h-px bg-gray-700" />
                  <span className="px-3 text-xs text-gray-400">
                    {formatDate(m.timestamp)}
                  </span>
                  <div className="flex-1 h-px bg-gray-700" />
                </div>
              )}

              <div
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-3 py-2 rounded-lg max-w-[70%] ${
                    isMine
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-200"
                  }`}
                >
                  {!isMine && (
                    <div className="text-xs font-bold mb-1">{m.username}</div>
                  )}
                  {m.message}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* ✅ 입력창 영역 (항상 아래 고정) */}
      <div className="relative p-3 border-t border-gray-700">
        {/* ✅ ↓ 버튼: 위로 많이 스크롤했을 때만 "입력창 위 중앙" */}
        {showJumpToBottom && (
          <button
            type="button"
            onClick={onJumpToBottom}
            className="absolute -top-7 left-1/2 -translate-x-1/2
               w-9 h-9 rounded-full
               bg-[#2B2D31] hover:bg-[#3A3C43]
               flex items-center justify-center
               shadow-lg transition"
            title="맨 아래로"
          >
            <img
              src={arrowDown}
              alt="맨 아래로"
              className="w-4 h-4 opacity-80"
            />
          </button>
        )}

        <form onSubmit={sendMessage} className="flex gap-3">
          <input
            className="flex-1 p-2 rounded bg-gray-800 text-white"
            placeholder="메시지 보내기"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="px-4 bg-blue-500 rounded text-white">전송</button>
        </form>
      </div>
    </div>
  );
};

export default TextChannelUI;
