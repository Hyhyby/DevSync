// src/components/ui/ServerMembers.jsx
import React from "react";

const ServerMembers = ({ members }) => {
  return (
    <aside className="w-64 bg-[#111214] border-l border-neutral-900 p-3 flex flex-col">
      <div className="text-[11px] text-gray-500 font-semibold mb-2">
        멤버 — {members.length}
      </div>
      <div className="space-y-1 text-sm overflow-y-auto">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#7289DA] flex items-center justify-center text-xs font-semibold">
              {m.name.charAt(0).toUpperCase()}
            </div>
            <span className="truncate">{m.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ServerMembers;
