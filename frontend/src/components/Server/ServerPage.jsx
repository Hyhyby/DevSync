// src/components/Server/ServerPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import ServerHeader from "../ui/ServerHeader";
import ServerChannels from "../ui/ServerChannels";
import ServerMembers from "../ui/ServerMembers";
// import ServerChat from "./ServerChat"; // ❌ 기존 통합 채팅
import ServerInviteModal from "./ServerInviteModal";
import TextChannel from "../TextChannel/TextChannel";
import VoiceChannel from "../VoiceChannel/VoiceChannel";
import CreateChannelModal from "../ui/CreateChannelModal";

import { API_BASE } from "../../config";

const STORAGE_KEY = "devsync_servers";

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
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [createChannelType, setCreateChannelType] = useState("text");

  const [server, setServer] = useState(null);

  // 🔹 텍스트 / 음성 채널
  const [textChannels, setTextChannels] = useState([]);
  const [voiceChannels, setVoiceChannels] = useState([]);

  // 🔹 서버 멤버
  const [members, setMembers] = useState([]);

  // 🔹 선택된 채널 (text or voice)
  const [activeChannel, setActiveChannel] = useState(null);

  // 🔹 서버 초대 모달
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

  // 🔹 serverId가 바뀔 때마다 서버 정보 + 멤버 + 채널 목록 불러오기
  useEffect(() => {
    const fetchData = async () => {
      // 로그인 안 된 경우: 백엔드 못 쓰니까 로컬 스토리지만 사용
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
        await fetchChannels();
        setActiveChannel(null);
        return;
      }

      // 로그인 된 경우: 백엔드 우선
      try {
        // 서버, 멤버, 채널을 동시에 요청
        const [serverRes, membersRes, channelsRes] = await Promise.all([
          api.get(`/api/servers/${serverId}`),
          api.get(`/api/servers/${serverId}/members`),
          api.get(`/api/${serverId}/channels`), // ← channelRoutes에서 반환
        ]);

        setServer(serverRes.data);
        setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);

        const allChannels = Array.isArray(channelsRes.data)
          ? channelsRes.data
          : [];

        const texts = allChannels.filter((c) => c.type === "text");
        const voices = allChannels.filter((c) => c.type === "voice");

        setTextChannels(texts);
        setVoiceChannels(voices);

        // 채널이 하나도 선택 안되어 있으면 기본 채널 선택

        // 기존에 선택되었던 채널이 목록에 없으면 리셋
        const stillExists = allChannels.find(
          (c) => String(c.id) === String(activeChannel.id)
        );
        if (!stillExists) {
          if (texts.length > 0) setActiveChannel(texts[0]);
          else if (voices.length > 0) setActiveChannel(voices[0]);
          else setActiveChannel(null);
        }
      } catch (err) {
        console.error(
          "[ServerPage] 서버 정보/채널 불러오기 실패:",
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

        setTextChannels([]);
        setVoiceChannels([]);
        setActiveChannel(null);
      }
    };

    fetchData();
    // activeChannel은 여기서 내부에서 조건적으로 갱신하니까 dependency에 넣지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, serverId, token, currentUser, displayName]);

  // 🔹 서버 멤버 변경 이벤트(server-members-updated) 수신 → 멤버 목록만 새로고침
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

  // 🔹 채널 클릭했을 때
  const handleSelectChannel = (channel) => {
    if (!channel) return;
    setActiveChannel(channel);
  };
  // 텍스트 채널 + 버튼
  const handleOpenCreateText = () => {
    setCreateChannelType("text");
    setShowCreateChannel(true);
  };

  // 음성 채널 + 버튼
  const handleOpenCreateVoice = () => {
    setCreateChannelType("voice");
    setShowCreateChannel(true);
  };
  const handleCreateChannel = async (channelName) => {
    // 로그인 안 된 디자인 모드일 때는 프론트에서만 추가
    if (!token) {
      const fake = {
        id: `local-${Date.now()}`,
        name: channelName,
        type: createChannelType,
      };
      // 📌 DB에서 다시 전체 가져오기
      await fetchChannels();

      // 새로 만든 채널 선택
      const refreshed = await api.get(`/api/${serverId}/channels`);
      const all = refreshed.data;
      const newOne = all.find((c) => c.name === channelName);
      if (newOne) setActiveChannel(newOne);
      setActiveChannel(fake);
      setShowCreateChannel(false);
      return;
    }

    try {
      const res = await api.post(`/api/${serverId}/channels`, {
        name: channelName,
        type: createChannelType,
      });
      const ch = res.data;

      if (ch.type === "text") {
        setTextChannels((prev) => [...prev, ch]);
      } else {
        setVoiceChannels((prev) => [...prev, ch]);
      }

      // 새로 만든 채널로 바로 이동
      setActiveChannel(ch);
      setShowCreateChannel(false);
    } catch (err) {
      console.error(
        "[ServerPage] 채널 생성 실패:",
        err?.response?.data || err?.message
      );
      alert(err?.response?.data?.error || "채널 생성 중 오류가 발생했어요.");
    }
  };
  const fetchChannels = async () => {
    try {
      const res = await api.get(`/api/${serverId}/channels`);
      const all = Array.isArray(res.data) ? res.data : [];

      setTextChannels(all.filter((c) => c.type === "text"));
      setVoiceChannels(all.filter((c) => c.type === "voice"));
    } catch (err) {
      console.error("[ServerPage] 채널 목록 불러오기 실패:", err);
      setTextChannels([]);
      setVoiceChannels([]);
    }
  };
  const serverName = server?.name || "서버";

  const serverNameForHeader = activeChannel
    ? activeChannel.type === "text"
      ? `# ${activeChannel.name}`
      : `🔊 ${activeChannel.name}`
    : serverName;

  return (
    <div className="h-screen bg-black text-gray-100 flex flex-col overflow-hidden">
      {/* 상단 헤더 */}
      <ServerHeader
        serverName={serverNameForHeader}
        onBackHome={handleBackHome}
        onSelectServer={handleSelectServer}
      />

      {/* 본문 3칼럼 레이아웃 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 🔹 왼쪽 채널 영역 */}
        <div className="w-64 flex-shrink-0 border-r border-neutral-900 flex flex-col min-h-0">
          <ServerChannels
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            activeChannelId={activeChannel?.id}
            onSelectChannel={handleSelectChannel}
            onOpenCreateText={handleOpenCreateText}
            onOpenCreateVoice={handleOpenCreateVoice}
          />
        </div>

        {/* 🔹 가운데 영역: 텍스트 채널 / 음성 채널 분기 */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeChannel ? (
            activeChannel.type === "text" ? (
              <TextChannel
                serverId={serverId}
                channelId={activeChannel.id}
                user={currentUser}
              />
            ) : (
              <VoiceChannel channelId={activeChannel.id} user={currentUser} />
            )
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
                  왼쪽의 채널을 클릭하면, 여기에서 실시간 채팅이 표시됩니다.
                </p>
              </section>
            </main>
          )}
        </div>

        {/* 🔹 오른쪽 멤버 영역 */}
        <div className="w-64 flex-shrink-0 border-l border-neutral-900 flex flex-col min-h-0">
          <ServerMembers
            members={members}
            onInviteClick={() => setShowInviteModal(true)}
          />
        </div>
      </div>
      {/* 채널 생성 모달 */}
      <CreateChannelModal
        open={showCreateChannel}
        type={createChannelType}
        onClose={() => setShowCreateChannel(false)}
        onSubmit={handleCreateChannel}
      />

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
