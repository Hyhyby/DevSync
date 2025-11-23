// src/components/ui/ServerChannels.jsx
import React from "react";

const ServerChannels = ({ textChannels, voiceChannels }) => {
  return (
    <aside className="w-64 bg-[#111214] border-r border-neutral-900 flex flex-col">
      <div className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        채널
      </div>

      <div className="flex-1 px-2 pb-4 space-y-4 text-xs overflow-y-auto">
        {/* 텍스트 채널 */}
        <div>
          <div className="px-2 mb-1 text-[11px] text-gray-500 font-semibold">
            텍스트 채널
          </div>
          {textChannels.map((ch) => (
            <button
              key={ch.id}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800 text-gray-200 text-sm transition-colors"
            >
              <span className="text-lg text-gray-500">#</span>
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
        </div>

        {/* 음성 채널 */}
        <div>
          <div className="px-2 mt-2 mb-1 text-[11px] text-gray-500 font-semibold">
            음성 채널
          </div>
          {voiceChannels.map((ch) => (
            <button
              key={ch.id}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800 text-gray-200 text-sm transition-colors"
            >
              <span className="text-lg text-gray-500">🔊</span>
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default ServerChannels;
