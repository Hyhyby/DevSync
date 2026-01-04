// src/components/ui/ServerChannels.jsx
import React, { useState } from "react";
import callEndIcon from "../../../assets/call_end.png";
const ServerChannels = ({
  textChannels,
  voiceChannels,
  activeTextChannelId,
  activeVoiceChannelId,
  voiceMembersByChannel,
  currentUserId,
  onLeaveVoice,
  onSelectChannel,
  onDeleteChannel,
  onOpenCreateText,
  onOpenCreateVoice,
  isSpeaking,
}) => {
  const [contextMenu, setContextMenu] = useState(null);
  // contextMenu: { x, y, channel }

  const handleContextMenu = (e, channel) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      channel,
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <div
      className="flex flex-col h-full bg-[#111318] text-sm text-gray-200"
      onClick={closeContextMenu}
    >
      {/* 🔹 텍스트 채널 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
        <span className="uppercase tracking-wide">텍스트 채널</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCreateText();
          }}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 text-white text-base leading-none"
        >
          +
        </button>
      </div>

      {/* 🔹 텍스트 채널 리스트 */}
      <div className="px-2 space-y-1">
        {textChannels.length === 0 ? (
          <div className="px-2 py-1 text-[11px] text-gray-500">
            아직 텍스트 채널이 없어요.
          </div>
        ) : (
          textChannels.map((ch) => {
            const isActive = String(ch.id) === String(activeTextChannelId);
            return (
              <button
                key={ch.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChannel(ch);
                }}
                onContextMenu={(e) => handleContextMenu(e, ch)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-xs ${
                  isActive
                    ? "bg-neutral-800 text-white"
                    : "text-gray-300 hover:bg-neutral-800/60"
                }`}
              >
                <span className="text-base text-gray-400">#</span>
                <span className="truncate">{ch.name}</span>
              </button>
            );
          })
        )}
      </div>

      {/* 🔹 구분선 */}
      <div className="mt-3 mb-2 border-b border-neutral-800" />

      {/* 🔹 음성 채널 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
        <span className="uppercase tracking-wide">음성 채널</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCreateVoice();
          }}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 text-white text-base leading-none"
        >
          +
        </button>
      </div>

      {/* 🔹 음성 채널 리스트 */}
      <div className="px-2 space-y-1 mb-2">
        {voiceChannels.length === 0 ? (
          <div className="px-2 py-1 text-[11px] text-gray-500">
            아직 음성 채널이 없어요.
          </div>
        ) : (
          voiceChannels.map((ch) => {
            const isActive = String(ch.id) === String(activeVoiceChannelId);
            const voiceMembers = voiceMembersByChannel?.[String(ch.id)] || [];

            return (
              <div key={ch.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChannel(ch);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, ch)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-xs ${
                    isActive
                      ? "bg-neutral-800 text-white"
                      : "text-gray-300 hover:bg-neutral-800/60"
                  }`}
                >
                  <span className="text-base text-gray-400">🔊</span>
                  <span className="truncate">{ch.name}</span>
                </button>

                {/* ✅ 디코처럼: 활성 음성 채널 아래에 참여자 목록 */}
                {isActive && (
                  <div className="ml-8 mt-1 space-y-1">
                    {voiceMembers.length === 0 ? (
                      <div className="text-[11px] text-gray-500 px-2 py-1">
                        (참여자 없음)
                      </div>
                    ) : (
                      voiceMembers.map((m) => {
                        const isMe = String(m.userId) === String(currentUserId);

                        return (
                          <div
                            key={m.userId}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-800/40"
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white
    ${
      isMe && isSpeaking
        ? "ring-2 ring-green-400 ring-offset-2 ring-offset-[#111318]"
        : ""
    }
    bg-[#5865F2]
  `}
                            >
                              {(m.username || "?").charAt(0).toUpperCase()}
                            </div>

                            {/* ✅ 이름 영역을 flex-1로 */}
                            <div className="flex-1 text-[12px] text-gray-200 truncate">
                              {m.username}
                            </div>

                            {/* ✅ 내 이름 오른쪽에 통화 종료(나가기) 버튼 */}
                            {isMe && (
                              <button
                                type="button"
                                title="음성 채널 나가기"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLeaveVoice?.(ch.id);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-full
           bg-neutral-700 hover:bg-neutral-600
           transition transform hover:scale-105 active:scale-95"
                              >
                                <img
                                  src={callEndIcon}
                                  alt="leave voice"
                                  className="w-4 h-4"
                                  draggable={false}
                                />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ✅ 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded shadow-lg text-xs"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onDeleteChannel?.(contextMenu.channel);
              closeContextMenu();
            }}
            className="block w-full px-4 py-2 text-red-400 hover:bg-neutral-800 text-left"
          >
            채널 삭제
          </button>
        </div>
      )}
    </div>
  );
};

export default ServerChannels;
