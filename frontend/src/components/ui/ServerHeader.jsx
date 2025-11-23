// src/components/ui/ServerHeader.jsx
import React from "react";
import ServersBar from "../Home/Servers";

const ServerHeader = ({ serverName, onBackHome, onSelectServer }) => {
  return (
    <header className="h-14 px-5 flex items-center justify-between border-b border-neutral-800 bg-gradient-to-r from-black via-neutral-900/80 to-black">
      <div className="flex items-center gap-3">
        {/* ← 홈으로 돌아가기 */}
        <button
          onClick={onBackHome}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-700 bg-neutral-900/80 text-xs text-gray-200 hover:bg-neutral-800 hover:border-yellow-400 hover:text-yellow-200 transition-colors"
        >
          <span className="text-lg leading-none">←</span>
        </button>

        <div className="h-6 w-px bg-neutral-700 mx-1" />

        {/* 현재 서버 아이콘 + 이름 */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-full bg-yellow-400/20 border border-yellow-400/60 flex items-center justify-center text-xs font-semibold text-yellow-300">
            {serverName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold whitespace-nowrap">
            {serverName}
          </span>
        </div>

        {/* 🔥 서버 간 이동 바 (header용, + 없음) */}
        <div className="ml-4">
          <ServersBar onSelectServer={onSelectServer} variant="header" />
        </div>
      </div>

      <div className="text-[11px] text-gray-500">
        서버 채팅 · 채널 · 멤버 관리
      </div>
    </header>
  );
};

export default ServerHeader;
