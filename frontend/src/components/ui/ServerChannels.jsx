// src/components/ui/ServerChannels.jsx
import React from "react";

const ServerChannels = ({
  textChannels,
  voiceChannels,
  activeChannelId,
  onSelectChannel,
  onOpenCreateText,
  onOpenCreateVoice,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#111318] text-sm text-gray-200">
      {/* 🔹 텍스트 채널 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
        <span className="uppercase tracking-wide">텍스트 채널</span>
        <button
          type="button"
          onClick={onOpenCreateText}
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
            const isActive = String(ch.id) === String(activeChannelId);
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectChannel(ch)}
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
          onClick={onOpenCreateVoice}
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
            const isActive = String(ch.id) === String(activeChannelId);
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectChannel(ch)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-xs ${
                  isActive
                    ? "bg-neutral-800 text-white"
                    : "text-gray-300 hover:bg-neutral-800/60"
                }`}
              >
                <span className="text-base text-gray-400">🔊</span>
                <span className="truncate">{ch.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ServerChannels;
