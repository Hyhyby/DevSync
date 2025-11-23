// src/components/ui/ServersList.jsx
import React from "react";

const ServersList = ({
  servers,
  onClickServer,
  onOpenCreate,
  variant = "footer",
}) => {
  const isHeader = variant === "header";

  // 🔹 헤더용 서버바 (서버 이름 옆 작은 버전) - ✅ + 버튼 제거
  if (isHeader) {
    return (
      <div className="flex items-center gap-2">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => onClickServer(server)}
            className="flex-shrink-0 group relative"
            title={server.name}
          >
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-semibold text-gray-200 group-hover:bg-yellow-400 group-hover:text-black group-hover:border-yellow-300 transition-all">
              {server.short}
            </div>
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-2 py-0.5 rounded bg-black/80 text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
              {server.name}
            </span>
          </button>
        ))}
      </div>
    );
  }

  // 🔹 홈 화면 아래쪽 서버바 (footer) - 기존처럼 + 유지
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="pointer-events-auto flex items-center gap-3 overflow-x-auto no-scrollbar">
        <div className="bg-neutral-950/95 border border-neutral-800 rounded-2xl px-3 py-2 shadow-[0_0_18px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            {/* + 서버 만들기 버튼 (홈 화면 전용) */}
            <button
              onClick={onOpenCreate}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-800 border border-neutral-600 text-white text-2xl font-semibold flex items-center justify-center hover:bg-neutral-700 hover:border-yellow-400 hover:text-yellow-300 transition-all"
            >
              +
            </button>

            {/* 서버 목록 */}
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => onClickServer(server)}
                className="flex-shrink-0 group relative"
                title={server.name}
              >
                <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm font-semibold text-gray-200 group-hover:bg-yellow-400 group-hover:text-black group-hover:border-yellow-300 transition-all">
                  {server.short}
                </div>
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-2 py-0.5 rounded bg-black/80 text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                  {server.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServersList;
