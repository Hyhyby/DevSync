// src/components/Server/VoiceChannel/VoiceChannelUI.jsx
import React from "react";

const VoiceChannelUI = ({ members }) => {
  return (
    <div className="p-3 space-y-2 text-gray-200">
      {members.length === 0 ? (
        <div className="text-sm text-gray-500">
          현재 이 채널에 사람이 없습니다.
        </div>
      ) : (
        members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center gap-2 p-2 bg-gray-800 rounded"
          >
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
              {m.username[0].toUpperCase()}
            </div>
            <span className="text-sm">{m.username}</span>
          </div>
        ))
      )}
    </div>
  );
};

export default VoiceChannelUI;
