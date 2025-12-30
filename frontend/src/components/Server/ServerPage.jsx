// src/components/Server/ServerPage.jsx
import { io } from "socket.io-client";
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import ServerHeader from "../ui/ServerHeader";
import ServerChannels from "../ui/ServerChannels";
import ServerMembers from "../ui/ServerMembers";
import ServerInviteModal from "./ServerInviteModal";
import TextChannel from "../TextChannel/TextChannel";
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
  const socketRef = useRef(null);
  const navigate = useNavigate();

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [createChannelType, setCreateChannelType] = useState("text");

  const [server, setServer] = useState(null);

  // 🔹 텍스트 / 음성 채널
  const [textChannels, setTextChannels] = useState([]);
  const [voiceChannels, setVoiceChannels] = useState([]);

  // 🔹 서버 멤버
  const [members, setMembers] = useState([]);

  // ✅ 선택된 채널 분리
  const [activeTextChannel, setActiveTextChannel] = useState(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);

  // ✅ 음성 채널 참여자 목록: { [channelId]: [{ userId, username }] }
  const [voiceMembersByChannel, setVoiceMembersByChannel] = useState({});

  // 🔹 서버 초대 모달
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [currentUser] = useState(() => getCurrentUser());

  const displayName =
    currentUser?.username || currentUser?.name || currentUser?.id || "나";
  const currentUserId = currentUser?.userId ?? currentUser?.id ?? null;
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

  // ✅ 소켓 준비 + voice-members 수신
  useEffect(() => {
    if (!token) return;

    if (!socketRef.current) {
      socketRef.current = io(API_BASE, {
        transports: ["websocket"],
        auth: { token },
      });
    }

    const s = socketRef.current;

    const onVoiceMembers = ({ channelId, members }) => {
      setVoiceMembersByChannel((prev) => ({
        ...prev,
        [String(channelId)]: Array.isArray(members) ? members : [],
      }));
    };

    s.on("voice-members", onVoiceMembers);

    return () => {
      s.off("voice-members", onVoiceMembers);
    };
  }, [token]);

  // 🔹 채널 목록 불러오기 함수
  const fetchChannels = useCallback(async () => {
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
  }, [api, serverId]);

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
        setActiveTextChannel(null);
        setActiveVoiceChannel(null);
        return;
      }

      // 로그인 된 경우: 백엔드 우선
      try {
        const [serverRes, membersRes, channelsRes] = await Promise.all([
          api.get(`/api/servers/${serverId}`),
          api.get(`/api/servers/${serverId}/members`),
          api.get(`/api/${serverId}/channels`),
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

        // ✅ 텍스트 채널 선택 유지 (없으면 null)
        if (activeTextChannel) {
          const stillExists = texts.some(
            (c) => String(c.id) === String(activeTextChannel.id)
          );
          if (!stillExists) setActiveTextChannel(null);
        }

        // ✅ 음성 채널 선택 유지 (없으면 null)
        if (activeVoiceChannel) {
          const stillExists = voices.some(
            (c) => String(c.id) === String(activeVoiceChannel.id)
          );
          if (!stillExists) setActiveVoiceChannel(null);
        }
      } catch (err) {
        console.error(
          "[ServerPage] 서버 정보/채널 불러오기 실패:",
          err?.response?.data || err?.message
        );

        // 폴백
        setTextChannels([]);
        setVoiceChannels([]);
        setActiveTextChannel(null);
        setActiveVoiceChannel(null);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, serverId, token, currentUser, displayName, fetchChannels]);

  // 🔹 채널 변경 이벤트(channels-updated) 수신 → 채널 목록 새로고침
  useEffect(() => {
    if (!token) return;

    if (!socketRef.current) {
      socketRef.current = io(API_BASE, {
        transports: ["websocket"],
        auth: { token },
      });
    }

    const s = socketRef.current;

    const onChannelsUpdated = async (payload) => {
      if (String(payload?.serverId) !== String(serverId)) return;

      console.log("[ServerPage] channels-updated 수신 → 채널 갱신", payload);
      await fetchChannels();
    };

    s.on("channels-updated", onChannelsUpdated);

    return () => {
      s.off("channels-updated", onChannelsUpdated);
    };
  }, [token, serverId, fetchChannels]);

  // 🔹 서버 멤버 변경 이벤트(server-members-updated) 수신 → 멤버 목록만 새로고침
  useEffect(() => {
    if (!token) return;

    if (!socketRef.current) {
      socketRef.current = io(API_BASE, {
        transports: ["websocket"],
        auth: { token },
      });
    }

    const s = socketRef.current;

    const onMembersUpdated = async (payload) => {
      if (String(payload?.serverId) !== String(serverId)) return;

      console.log(
        "[ServerPage] server-members-updated 수신 → 멤버 갱신",
        payload
      );

      try {
        const res = await api.get(`/api/servers/${serverId}/members`);
        setMembers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(
          "[ServerPage] 멤버 갱신 실패:",
          err?.response?.data || err?.message
        );
      }
    };

    s.on("server-members-updated", onMembersUpdated);

    return () => {
      s.off("server-members-updated", onMembersUpdated);
    };
  }, [token, serverId, api]);

  const handleBackHome = () => navigate("/home");

  const handleSelectServer = (s) => {
    if (!s) return;
    if (String(s.id) === String(serverId)) return;
    navigate(`/servers/${s.id}`);
  };

  // ✅ 채널 클릭했을 때 (텍스트/음성 분기)
  const handleSelectChannel = (channel) => {
    if (!channel) return;

    if (channel.type === "text") {
      setActiveTextChannel(channel);
      return;
    }

    // ✅ 음성 채널: 가운데 화면 전환 X / 소켓 join만
    setActiveVoiceChannel((prev) => {
      const prevId = prev?.id ? String(prev.id) : null;
      const nextId = String(channel.id);

      const s = socketRef.current;

      if (s && s.connected) {
        // 디코처럼 "이전 음성 채널" 있으면 leave
        if (prevId && prevId !== nextId) {
          s.emit("leave-voice", { channelId: prevId });
        }
        // 새 음성 채널 join
        s.emit("join-voice", { channelId: nextId });
      }

      return channel;
    });
  };

  const handleOpenCreateText = () => {
    setCreateChannelType("text");
    setShowCreateChannel(true);
  };

  const handleOpenCreateVoice = () => {
    setCreateChannelType("voice");
    setShowCreateChannel(true);
  };

  const handleCreateChannel = async (channelName) => {
    // 로그인 안 된 디자인 모드일 때는 프론트에서만 추가
    if (!token) {
      await fetchChannels();
      setShowCreateChannel(false);
      return;
    }

    try {
      await api.post(`/api/${serverId}/channels`, {
        name: channelName,
        type: createChannelType,
      });

      await fetchChannels();
      setShowCreateChannel(false);
    } catch (err) {
      console.error(
        "[ServerPage] 채널 생성 실패:",
        err?.response?.data || err?.message
      );
      alert(err?.response?.data?.error || "채널 생성 중 오류가 발생했어요.");
    }
  };

  const handleDeleteChannel = async (channel) => {
    if (!window.confirm(`"${channel.name}" 채널을 삭제할까요?`)) return;

    try {
      await api.delete(`/api/${serverId}/channels/${channel.id}`);
      await fetchChannels();

      // ✅ 텍스트 active 정리
      if (
        activeTextChannel &&
        String(activeTextChannel.id) === String(channel.id)
      ) {
        setActiveTextChannel(null);
      }

      // ✅ 음성 active 정리 + leave
      if (
        activeVoiceChannel &&
        String(activeVoiceChannel.id) === String(channel.id)
      ) {
        socketRef.current?.emit("leave-voice", {
          channelId: String(channel.id),
        });
        setActiveVoiceChannel(null);
      }
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "채널 삭제 실패";

      console.error("[ServerPage] 채널 삭제 실패:", status, msg);
      alert(`채널 삭제 실패 (${status ?? "?"})\n${msg}`);
    }
  };

  const handleLeaveServer = async () => {
    if (!token) return;
    if (!window.confirm("정말 이 서버에서 나갈까요?")) return;

    try {
      // ✅ 음성 채널 들어가 있으면 leave 먼저
      if (activeVoiceChannel?.id) {
        socketRef.current?.emit("leave-voice", {
          channelId: String(activeVoiceChannel.id),
        });
        setActiveVoiceChannel(null);
      }

      await api.post(`/api/servers/${serverId}/leave`);
      navigate("/home");
      window.dispatchEvent(new Event("servers-updated"));
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "서버 나가기에 실패했어요.";
      alert(msg);
    }
  };

  const serverName = server?.name || "서버";

  // ✅ 헤더는 텍스트 채널 기준으로
  const serverNameForHeader = activeTextChannel
    ? `# ${activeTextChannel.name}`
    : serverName;

  return (
    <div className="h-screen bg-black text-gray-100 flex flex-col overflow-hidden">
      {/* 상단 헤더 */}
      <ServerHeader
        serverName={serverNameForHeader}
        onBackHome={handleBackHome}
        onSelectServer={handleSelectServer}
        onLeaveServer={handleLeaveServer}
      />

      {/* 본문 3칼럼 레이아웃 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 왼쪽 채널 영역 */}
        <div className="w-64 flex-shrink-0 border-r border-neutral-900 flex flex-col min-h-0">
          <ServerChannels
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            // ✅ active 분리
            activeTextChannelId={activeTextChannel?.id}
            activeVoiceChannelId={activeVoiceChannel?.id}
            // ✅ 음성 참여자 목록 전달
            voiceMembersByChannel={voiceMembersByChannel}
            onSelectChannel={handleSelectChannel}
            onDeleteChannel={handleDeleteChannel}
            onOpenCreateText={handleOpenCreateText}
            onOpenCreateVoice={handleOpenCreateVoice}
            currentUserId={currentUserId}
            onLeaveVoice={(channelId) => {
              const s = socketRef.current;
              if (s && s.connected) {
                s.emit("leave-voice", { channelId: String(channelId) });
              }
              setActiveVoiceChannel(null);
            }}
          />
        </div>

        {/* ✅ 가운데 영역: 텍스트 채널만 표시 (음성 클릭해도 안 바뀜) */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeTextChannel ? (
            <TextChannel
              serverId={serverId}
              channelId={activeTextChannel.id}
              user={currentUser}
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
                  왼쪽의 채널을 클릭하면, 여기에서 실시간 채팅이 표시됩니다.
                </p>
              </section>
            </main>
          )}
        </div>

        {/* 오른쪽 멤버 영역 */}
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
