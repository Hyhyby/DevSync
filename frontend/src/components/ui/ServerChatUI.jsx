// src/components/ui/ServerChatUI.jsx
import React from "react";

const ServerChatUI = ({
  roomName,
  myUsername,
  messages,
  input,
  onChangeInput,
  onSubmit,
  onScroll,
  messagesWrapRef,
  messagesEndRef,
}) => {
  return (
    <div className="flex flex-col flex-1 bg-[#2f3136] text-white min-h-0">
      {/* 헤더 */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-[#202225] bg-[#202225]">
        <div className="flex items-center gap-2">
          <span className="text-xl text-gray-400">#</span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{roomName || "채팅"}</span>
            <span className="text-[11px] text-gray-400">서버 텍스트 채널</span>
          </div>
        </div>
        {myUsername && (
          <div className="text-xs text-gray-400">Logged in as {myUsername}</div>
        )}
      </header>

      {/* 메시지 리스트 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div
          ref={messagesWrapRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={onScroll}
        >
          {messages.map((msg, index) => {
            const isSystem = msg.isSystem || msg.userId === "system";
            const isOwn = msg.username === myUsername;

            if (isSystem) {
              return (
                <div
                  key={msg.id || index}
                  className="flex justify-center text-[11px] text-gray-400"
                >
                  <div className="px-3 py-1 bg-[#202225] rounded-full">
                    {msg.message}
                  </div>
                </div>
              );
            }

            const initial = msg.username?.charAt(0)?.toUpperCase() || "?";

            return (
              <div
                key={msg.id || index}
                className={`flex items-start ${
                  isOwn ? "justify-end" : "justify-start"
                } gap-3`}
              >
                {/* 상대 아바타 */}
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
                    <div className="text-xs font-semibold text-white mb-1">
                      {msg.username}
                    </div>
                  )}
                  <div className="text-sm">{msg.message}</div>
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

          {/* 스크롤 끝 기준점 */}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력창 */}
        <form
          onSubmit={onSubmit}
          className="p-4 border-t border-[#202225] bg-[#202225] flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => onChangeInput(e.target.value)}
            placeholder="#채널에 메시지 보내기"
            className="flex-1 p-3 bg-discord-dark border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-discord-blurple"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-discord-blurple hover:bg-blue-600 rounded text-white font-semibold text-sm"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ServerChatUI;
