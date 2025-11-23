// src/components/Server/ServerPage.jsx
import React, { useEffect, useState /*, useMemo */ } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import ServerHeader from "../ui/ServerHeader";
import ServerChannels from "../ui/ServerChannels";
import ServerMembers from "../ui/ServerMembers";
// 나중에 백엔드 붙일 때 주석 해제
// import axios from "axios";
// import { API_BASE } from "../../config";

const STORAGE_KEY = "devsync_servers";

const DEFAULT_TEXT_CHANNELS = [{ id: "general", name: "일반" }];
const DEFAULT_VOICE_CHANNELS = [{ id: "voice-1", name: "일반 음성 채널" }];

const getCurrentUser = () => {
  try {
    const raw = sessionStorage.getItem("user") || localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();

  const [server, setServer] = useState(null);
  const [textChannels, setTextChannels] = useState(DEFAULT_TEXT_CHANNELS);
  const [voiceChannels, setVoiceChannels] = useState(DEFAULT_VOICE_CHANNELS);

  const currentUser = getCurrentUser();
  const displayName =
    currentUser?.username || currentUser?.name || currentUser?.id || "나";

  const members = [
    {
      id: currentUser?.id ?? "me",
      name: displayName,
    },
  ];

  // 🔹 serverId가 바뀔 때마다 로컬스토리지에서 서버 정보 다시 읽기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setServer(null);
        return;
      }

      const list = JSON.parse(saved);
      const found = list.find((s) => String(s.id) === String(serverId));
      setServer(found || null);
    } catch (e) {
      console.error("[ServerPage] 로컬 서버 로드 실패:", e);
      setServer(null);
    }

    // 채널은 지금은 더미 고정
    setTextChannels(DEFAULT_TEXT_CHANNELS);
    setVoiceChannels(DEFAULT_VOICE_CHANNELS);
  }, [serverId]);

  // 🔹 (참고용) 나중에 백엔드 붙일 때 사용할 코드
  /*
  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        timeout: 15000,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "ngrok-skip-browser-warning": "true",
        },
      }),
    [token]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!server) {
          const res = await api.get(`/api/servers/${serverId}`);
          setServer(res.data);
        }

        const chRes = await api.get(`/api/servers/${serverId}/channels`);
        const all = Array.isArray(chRes.data) ? chRes.data : [];

        const text = all.filter((c) => c.type === "text");
        const voice = all.filter((c) => c.type === "voice");

        setTextChannels(text.length ? text : DEFAULT_TEXT_CHANNELS);
        setVoiceChannels(voice.length ? voice : DEFAULT_VOICE_CHANNELS);
      } catch (err) {
        console.error(
          "[ServerPage] 서버/채널 정보 실패:",
          err?.response?.data || err?.message
        );
        setTextChannels(DEFAULT_TEXT_CHANNELS);
        setVoiceChannels(DEFAULT_VOICE_CHANNELS);
      }
    };

    fetchData();
  }, [api, serverId, server]);
  */

  const handleBackHome = () => {
    navigate("/home");
  };
  // 헤더 서버바에서 다른 서버 아이콘 눌렀을 때
  const handleSelectServer = (s) => {
    if (!s) return;
    if (String(s.id) === String(serverId)) return; // 같은 서버면 무시
    navigate(`/servers/${s.id}`);
  };

  // 🔹 최종 서버 이름 (로컬/상태/기본 순서)
  const serverName = server?.name || "서버";

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col">
      {/* 🔹 상단 헤더 (UI 컴포넌트로 분리) */}
      <ServerHeader
        serverName={serverName}
        onBackHome={handleBackHome}
        onSelectServer={handleSelectServer}
      />

      {/* 🔹 본문 */}
      <div className="flex flex-1">
        {/* 왼쪽: 채널 리스트 */}
        <ServerChannels
          textChannels={textChannels}
          voiceChannels={voiceChannels}
        />

        {/* 가운데: 채팅 영역 (나중에 Chat.jsx 붙일 자리) */}
        <main className="flex-1 flex flex-col bg-[#050608]">
          <header className="h-12 border-b border-neutral-900 px-4 flex items-center">
            <span className="text-lg mr-2 text-gray-400">#</span>
            <span className="font-semibold text-sm">
              채팅 채널을 선택해주세요
            </span>
          </header>

          <section className="flex-1 p-6 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-gray-400 mb-2">
              아직 채널을 선택하지 않았어요.
            </p>
            <p className="text-xs text-gray-500">
              왼쪽의 텍스트/음성 채널을 클릭하면, 여기에서{" "}
              <code className="text-yellow-300">Chat.jsx</code>를 사용해서
              실시간 채팅 UI가 표시될 예정입니다.
            </p>
          </section>
        </main>

        {/* 오른쪽: 멤버 리스트 */}
        <ServerMembers members={members} />
      </div>
    </div>
  );
};

export default ServerPage;
