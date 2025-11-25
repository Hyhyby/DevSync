// src/components/Server/ServerPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import ServerHeader from "../ui/ServerHeader";
import ServerChannels from "../ui/ServerChannels";
import ServerMembers from "../ui/ServerMembers";
import ServerChat from "./ServerChat";
import { API_BASE } from "../../config";

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

  // ✅ 어떤 채널이 선택되었는지
  const [activeChannel, setActiveChannel] = useState(null);

  const currentUser = getCurrentUser();
  const displayName =
    currentUser?.username || currentUser?.name || currentUser?.id || "나";

  const members = [
    {
      id: currentUser?.id ?? "me",
      name: displayName,
    },
  ];

  // 🔹 토큰 + axios 인스턴스
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

  // 🔹 serverId가 바뀔 때마다 서버 정보 불러오기
  useEffect(() => {
    const fetchData = async () => {
      // 로그인 안 된 경우: 백엔드 못 쓰니까 로컬 스토리지에서만 시도
      if (!token) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved) {
            setServer(null);
          } else {
            const list = JSON.parse(saved);
            const found = list.find((s) => String(s.id) === String(serverId));
            setServer(found || null);
          }
        } catch (e) {
          console.error("[ServerPage] 로컬 서버 로드 실패:", e);
          setServer(null);
        }

        setTextChannels(DEFAULT_TEXT_CHANNELS);
        setVoiceChannels(DEFAULT_VOICE_CHANNELS);
        setActiveChannel(null); // 처음엔 채널 선택 X
        return;
      }

      // 로그인 된 경우: 백엔드 우선
      try {
        const res = await api.get(`/api/servers/${serverId}`);
        setServer(res.data);

        // 채널은 아직 더미 데이터 사용
        setTextChannels(DEFAULT_TEXT_CHANNELS);
        setVoiceChannels(DEFAULT_VOICE_CHANNELS);
        setActiveChannel(null);
      } catch (err) {
        console.error(
          "[ServerPage] 서버 정보 불러오기 실패:",
          err?.response?.data || err?.message
        );

        // 🔁 백엔드 실패 시: localStorage 폴백
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved) {
            setServer(null);
          } else {
            const list = JSON.parse(saved);
            const found = list.find((s) => String(s.id) === String(serverId));
            setServer(found || null);
          }
        } catch (e) {
          console.error("[ServerPage] 로컬 서버 로드 실패:", e);
          setServer(null);
        }

        setTextChannels(DEFAULT_TEXT_CHANNELS);
        setVoiceChannels(DEFAULT_VOICE_CHANNELS);
        setActiveChannel(null);
      }
    };

    fetchData();
  }, [api, serverId, token]);

  const handleBackHome = () => {
    navigate("/home");
  };

  // 헤더 서버바에서 다른 서버 아이콘 눌렀을 때
  const handleSelectServer = (s) => {
    if (!s) return;
    if (String(s.id) === String(serverId)) return;
    navigate(`/servers/${s.id}`);
  };

  // ✅ 채널 클릭했을 때
  const handleSelectChannel = (channel) => {
    if (!channel) return;
    setActiveChannel(channel);
  };

  const serverName = server?.name || "서버";

  // ✅ 선택된 채널 기준 room 정보
  const activeRoomId = activeChannel?.id || null;
  const activeRoomName = activeChannel?.name || `${serverName} · 채널 미선택`;

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col">
      {/* 🔹 상단 헤더 */}
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
          activeChannelId={activeChannel?.id}
          onSelectChannel={handleSelectChannel}
        />

        {/* 가운데: 채팅 영역 (채널 선택 전/후 분기) */}
        {activeChannel ? (
          <ServerChat
            user={currentUser}
            roomId={activeRoomId}
            roomName={activeRoomName}
          />
        ) : (
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
                왼쪽의 <span className="text-yellow-300">일반</span> 채널을
                클릭하면, 여기에서 실시간 채팅이 표시됩니다.
              </p>
            </section>
          </main>
        )}

        {/* 오른쪽: 멤버 리스트 */}
        <ServerMembers members={members} />
      </div>
    </div>
  );
};

export default ServerPage;
