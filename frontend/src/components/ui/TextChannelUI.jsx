// src/components/Server/TextChannel/TextChannelUI.jsx
import React from "react";

const TextChannelUI = ({
  messages,
  input,
  setInput,
  sendMessage,
  wrapRef,
  endRef,
  onScroll,
  username,
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
          const isMine = m.username === username;
          return (
            <div
              key={idx}
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
                  <div className="text-xs font-bold">{m.username}</div>
                )}
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* 입력창 */}
      <form
        onSubmit={sendMessage}
        className="p-3 border-t border-gray-700 flex gap-3"
      >
        <input
          className="flex-1 p-2 rounded bg-gray-800 text-white"
          placeholder="메시지 보내기"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="px-4 bg-blue-500 rounded text-white">전송</button>
      </form>
    </div>
  );
};

export default TextChannelUI;
