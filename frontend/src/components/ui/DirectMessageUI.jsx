// src/components/ui/DirectMessageUI.jsx
import React from "react";

const DirectMessageUI = ({
  dmId,
  partnerName,
  myUsername,
  messages,
  input,
  onChangeInput,
  onSubmit,
  onScroll,
  messagesWrapRef,
  messagesEndRef,
}) => {
  if (!dmId) {
    // 보통 여기까지 오기 전에 DirectMessage 컨테이너에서 걸러지지만
    // 방어용으로 한 번 더
    return null;
  }

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
          onScroll={onScroll}
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
          onSubmit={onSubmit}
          className="p-4 border-t border-[#202225] bg-[#18191c] flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => onChangeInput(e.target.value)}
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

export default DirectMessageUI;
