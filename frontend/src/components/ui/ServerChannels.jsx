// src/components/ui/ServerChannels.jsx
import React, { useState } from "react";
import callEndIcon from "../../../assets/call_end.png";
import micOn from "../../../assets/mic_on.png";
import micOff from "../../../assets/mic_off.png";
const ServerChannels = ({
  textChannels,
  voiceChannels,
  activeTextChannelId,
  activeVoiceChannelId,
  voiceMembersByChannel,
  currentUserId,
  isSpeaking,
  remoteSpeaking, // ✅ 추가
  micMuted,
  onToggleMic,
  outputVolume,
  onChangeOutputVolume,
  onLeaveVoice,
  onSelectChannel,
  onDeleteChannel,
  onOpenCreateText,
  onOpenCreateVoice,
}) => {
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = (e, channel) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, channel });
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <div
      className="flex flex-col h-full bg-[#111318] text-sm text-gray-200"
      onClick={closeContextMenu}
    >
      {/* 텍스트 채널 헤더 */}
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

      {/* 텍스트 채널 리스트 */}
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

      <div className="mt-3 mb-2 border-b border-neutral-800" />

      {/* 음성 채널 헤더 */}
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

      {/* 음성 채널 리스트 */}
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

                {/* 참여자 목록 */}
                {isActive && (
                  <div className="ml-8 mt-1 space-y-1">
                    {voiceMembers.length === 0 ? (
                      <div className="text-[11px] text-gray-500 px-2 py-1">
                        (참여자 없음)
                      </div>
                    ) : (
                      voiceMembers.map((m) => {
                        const isMe = String(m.userId) === String(currentUserId);

                        // ✅ 말하는중 판정:
                        // - 나는 local isSpeaking
                        // - 상대는 remoteSpeaking[socketId]
                        const speaking = isMe
                          ? !!isSpeaking
                          : !!remoteSpeaking?.[String(m.socketId)];

                        return (
                          <div
                            key={m.socketId || m.userId}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-800/40"
                          >
                            {/* ✅ 아바타 링 */}
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white
                                ${speaking ? "ring-2 ring-green-500" : ""}
                              `}
                              style={{ backgroundColor: "#5865F2" }}
                            >
                              {(m.username || "?").charAt(0).toUpperCase()}
                            </div>

                            <div className="flex-1 text-[12px] text-gray-200 truncate">
                              {m.username}
                            </div>

                            {isMe && (
                              <button
                                type="button"
                                title="음성 채널 나가기"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLeaveVoice?.(ch.id);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-full
           bg-netural-700 hover:bg-netural-600
           transition transform hover:scale-105 active:scale-95"
                              >
                                {/* 너가 바꾼 call_end 아이콘 쓰는 자리 */}
                                <img
                                  src={callEndIcon}
                                  alt="leave voice"
                                  className="w-4 h-4 opacity-70 hover:opacity-100 transition"
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

      {/* 컨텍스트 메뉴 */}
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
      {/* ✅ 음성 채널 컨트롤: 음성 채널에 들어가 있을 때만 표시 */}
      {activeVoiceChannelId && (
        <div className="mt-auto p-3 border-t border-neutral-800 bg-[#0f1115]">
          <div className="flex items-center gap-3">
            {/* ✅ 마이크 토글 (왼쪽) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMic?.();
              }}
              className={[
                "w-11 h-11 rounded-lg flex items-center justify-center",
                "transition-all duration-150 ease-out active:scale-[0.98]",
                micMuted
                  ? "bg-red-600/90 hover:bg-red-600 ring-2 ring-red-400/50 animate-pulse"
                  : "bg-neutral-700 hover:bg-neutral-600 ring-1 ring-white/10",
              ].join(" ")}
              title={micMuted ? "마이크 켜기" : "마이크 끄기"}
            >
              <img
                src={micMuted ? micOff : micOn}
                alt={micMuted ? "mic off" : "mic on"}
                className={[
                  "w-6 h-6",
                  "transition-transform duration-200",
                  micMuted ? "scale-110" : "scale-100",
                ].join(" ")}
              />
            </button>

            {/* ✅ 볼륨 (오른쪽, 남은 공간 채움) */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">🔊</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((outputVolume ?? 0.8) * 100)}
                  onChange={(e) =>
                    onChangeOutputVolume?.(Number(e.target.value) / 100)
                  }
                  className="w-full accent-gray-300"
                />
                <span className="w-10 text-right text-[11px] text-gray-400 tabular-nums">
                  {Math.round((outputVolume ?? 0.8) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerChannels;
