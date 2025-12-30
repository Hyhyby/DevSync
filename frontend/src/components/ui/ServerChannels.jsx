// src/components/ui/ServerChannels.jsx
import React, { useState } from "react"; // ✅ useState 추가

const ServerChannels = ({
  textChannels,
  voiceChannels,
  activeChannelId,
  onSelectChannel,
  onDeleteChannel,
  onOpenCreateText,
  onOpenCreateVoice,
}) => {
  const [contextMenu, setContextMenu] = useState(null);
  // contextMenu: { x, y, channel }

  const handleContextMenu = (e, channel) => {
    e.preventDefault();
    e.stopPropagation(); // ✅ 바깥 클릭으로 바로 닫히는 것 방지
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      channel,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <div
      className="flex flex-col h-full bg-[#111318] text-sm text-gray-200"
      onClick={closeContextMenu} // ✅ 아무 데나 클릭하면 닫힘
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
            const isActive = String(ch.id) === String(activeChannelId);
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
            const isActive = String(ch.id) === String(activeChannelId);
            return (
              <button
                key={ch.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChannel(ch);
                }}
                onContextMenu={(e) => handleContextMenu(e, ch)} // ✅ 음성도 우클릭 가능
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

      {/* ✅ 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded shadow-lg text-xs"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} // ✅ 메뉴 클릭이 바깥 클릭으로 처리되지 않게
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
