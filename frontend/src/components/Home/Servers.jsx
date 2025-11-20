// src/components/Home/ServersBar.jsx
import React, { useEffect, useState } from 'react';

// 기본 예시 서버들 (나중에 백엔드 연결하면 지워도 됨)
const DEFAULT_SERVERS = [
  { id: 'devsync', name: 'DevSync', short: 'D' },
  { id: 'study', name: '스터디', short: '스' },
  { id: 'study2', name: '공부', short: '공' },
  { id: 'football', name: '풋뱅', short: '풋' },
];

const STORAGE_KEY = 'devsync_servers';

const ServersBar = ({ onSelectServer }) => {
  const [servers, setServers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SERVERS;
    } catch {
      return DEFAULT_SERVERS;
    }
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverEmoji, setServerEmoji] = useState('');

  // 서버 목록 로컬 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
    } catch {
      // 저장 실패해도 크게 문제는 없음
    }
  }, [servers]);

  const handleCreateServer = (e) => {
    e.preventDefault();
    const name = serverName.trim();
    if (!name) return;

    const emoji = serverEmoji.trim();
    const short = emoji || name.charAt(0).toUpperCase();

    const newServer = {
      id: `local-${Date.now()}`,
      name,
      short,
    };

    setServers((prev) => [...prev, newServer]);
    setServerName('');
    setServerEmoji('');
    setOpenCreate(false);
  };

  const handleClickServer = (server) => {
    if (onSelectServer) onSelectServer(server);
    // 여기서 나중에 navigate(`/servers/${server.id}`) 같은 거 연결 가능
  };

  return (
    <>
      {/* 🔹 화면 맨 아래에 깔리는 서버 바 */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
  <div className="pointer-events-auto flex items-center gap-3 overflow-x-auto no-scrollbar">
          <div className="bg-neutral-950/95 border border-neutral-800 rounded-2xl px-3 py-2 shadow-[0_0_18px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
              {/* + 서버 만들기 버튼 */}
              <button
                type="button"
                onClick={() => setOpenCreate(true)}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-800 border border-neutral-600 text-white text-2xl font-semibold flex items-center justify-center hover:bg-neutral-700 hover:border-yellow-400 hover:text-yellow-300 transition-all"
                title="서버 만들기"
              >
                +
              </button>

              {/* 서버 아이콘들 */}
              {servers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => handleClickServer(server)}
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

      {/* 🔹 서버 생성 모달 */}
      {openCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-xl p-5 shadow-xl">
            <h3 className="text-white text-lg font-semibold mb-2">
              새 서버 만들기
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              서버 이름과 (선택) 이모지를 입력하면 홈 화면 아래 서버 바에 추가됩니다.
            </p>

            <form onSubmit={handleCreateServer} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-300">서버 이름</label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
                  placeholder="예: 공부, 풋뱅, 롤친구방…"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-300">
                  서버 아이콘 (이모지/한 글자, 선택)
                </label>
                <input
                  type="text"
                  value={serverEmoji}
                  onChange={(e) => setServerEmoji(e.target.value)}
                  maxLength={2}
                  className="w-24 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
                  placeholder="🐥 / 스"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenCreate(false);
                    setServerName('');
                    setServerEmoji('');
                  }}
                  className="px-3 py-1.5 rounded bg-neutral-800 text-xs text-gray-300 hover:bg-neutral-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-yellow-400 text-xs font-semibold text-black hover:bg-yellow-300"
                >
                  만들기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ServersBar;
