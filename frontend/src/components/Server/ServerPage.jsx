// src/components/Server/ServerPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import ServerHeader from "../ui/ServerHeader";
import ServerChannels from "../ui/ServerChannels";
import ServerMembers from "../ui/ServerMembers";
import ServerChat from "./ServerChat";
import ServerInviteModal from "./ServerInviteModal"; // ✅ 초대 모달
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

  // ✅ 서버 멤버 목록
  const [members, setMembers] = useState([]);

  // ✅ 어떤 채널이 선택되었는지
  const [activeChannel, setActiveChannel] = useState(null);

  // ✅ 서버 초대 모달 열림 상태
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [currentUser] = useState(() => getCurrentUser());

  const displayName =
    currentUser?.username || currentUser?.name || currentUser?.id || "나";

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

  // 🔹 serverId가 바뀔 때마다 서버 정보 + 멤버 목록 불러오기
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

        // 로컬 모드에서는 일단 나 자신만 멤버로 표시
        setMembers(
          currentUser
            ? [
                {
                  id: currentUser.id ?? "me",
                  name: displayName,
                  role: "owner",
                },
              ]
            : []
        );

        setTextChannels(DEFAULT_TEXT_CHANNELS);
        setVoiceChannels(DEFAULT_VOICE_CHANNELS);
        setActiveChannel(null); // 처음엔 채널 선택 X
        return;
      }

      // 로그인 된 경우: 백엔드 우선
      try {
        // 서버 정보 + 멤버 목록을 동시에 가져오기
        const [serverRes, membersRes] = await Promise.all([
          api.get(`/api/servers/${serverId}`),
          api.get(`/api/servers/${serverId}/members`),
        ]);

        setServer(serverRes.data);
        setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);

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
            setMembers([]);
          } else {
            const list = JSON.parse(saved);
            const found = list.find((s) => String(s.id) === String(serverId));
            setServer(found || null);

            // 로컬 저장된 서버만 있을 때는 나 자신만 멤버로
            setMembers(
              currentUser
                ? [
                    {
                      id: currentUser.id ?? "me",
                      name: displayName,
                      role: "owner",
                    },
                  ]
                : []
            );
          }
        } catch (e) {
          console.error("[ServerPage] 로컬 서버 로드 실패:", e);
          setServer(null);
          setMembers([]);
        }

        setTextChannels(DEFAULT_TEXT_CHANNELS);
        setVoiceChannels(DEFAULT_VOICE_CHANNELS);
        setActiveChannel(null);
      }
    };

    fetchData();
  }, [api, serverId, token, currentUser, displayName]);

  // ✅ 서버 멤버 변경 이벤트(server-members-updated) 수신 → 멤버 목록만 새로고침
  useEffect(() => {
    if (!token) return;

    const handler = async () => {
      try {
        const res = await api.get(`/api/servers/${serverId}/members`);
        setMembers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(
          "[ServerPage] 멤버 목록 새로고침 실패:",
          err?.response?.data || err?.message
        );
      }
    };

    window.addEventListener("server-members-updated", handler);
    return () => window.removeEventListener("server-members-updated", handler);
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
    <div className="h-screen bg-black text-gray-100 flex flex-col overflow-hidden">
      {/* 상단 헤더 */}
      <ServerHeader
        serverName={serverName}
        onBackHome={handleBackHome}
        onSelectServer={handleSelectServer}
      />

      {/* 본문 3칼럼 레이아웃 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 🔹 왼쪽 채널 영역 (자체 스크롤) */}
        <div className="w-64 flex-shrink-0 border-r border-neutral-900 flex flex-col min-h-0">
          <ServerChannels
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            activeChannelId={activeChannel?.id}
            onSelectChannel={handleSelectChannel}
          />
        </div>

        {/* 🔹 가운데 채팅 영역 (여기만 스크롤) */}
        <div className="flex-1 flex flex-col min-h-0">
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
        </div>

        {/* 🔹 오른쪽 멤버 영역 (자체 스크롤) */}
        <div className="w-64 flex-shrink-0 border-l border-neutral-900 flex flex-col min-h-0">
          <ServerMembers
            members={members}
            onInviteClick={() => setShowInviteModal(true)}
          />
        </div>
      </div>

      {/* 서버 초대 모달 */}
      <ServerInviteModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        serverId={serverId}
        api={api}
      />
    </div>
  );
};

export default ServerPage;
