// src/components/ui/ServerChannels.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../../config";

import callEndIcon from "../../../assets/call_end.png";
import micOn from "../../../assets/mic_on.png";
import micOff from "../../../assets/mic_off.png";
import headsetIcon from "../../../assets/headsetIcon.png";

// ✅ 1) URL 변환 유틸
const resolveUrlWithBase = (base, url) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("blob:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
};

// ✅ 2) BlobImage (ngrok 헤더 포함해서 blob으로 로딩)
const BlobImage = ({ url, alt, className = "", fallback = null }) => {
  const [blobUrl, setBlobUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    let created = "";

    if (!url) {
      setBlobUrl("");
      return;
    }

    // 이미 blob URL이면 그대로 사용
    if (url.startsWith("blob:")) {
      setBlobUrl(url);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(url, {
          responseType: "blob",
          headers: { "ngrok-skip-browser-warning": "true" },
        });

        created = URL.createObjectURL(res.data);
        if (!alive) return;
        setBlobUrl(created);
      } catch (e) {
        if (alive) setBlobUrl("");
        // 필요하면 여기서 console.warn 찍어도 됨
        // console.warn("BLOB_IMAGE_LOAD_FAIL", url, e?.message || e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  // 로딩 중엔 fallback(이니셜) 유지
  if (loading) return fallback;
  if (!blobUrl) return fallback;

  return <img src={blobUrl} alt={alt} className={className} loading="lazy" />;
};

const ServerChannels = ({
  textChannels,
  voiceChannels,
  activeTextChannelId,
  activeVoiceChannelId,
  voiceMembersByChannel,
  currentUserId,
  isSpeaking,
  remoteSpeaking,
  micMuted,
  onToggleMic,
  outputVolume,
  onChangeOutputVolume,
  inputVolume,
  onChangeInputVolume,
  onLeaveVoice,
  onSelectChannel,
  onDeleteChannel,
  onOpenCreateText,
  onOpenCreateVoice,
}) => {
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = (e, channel) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, channel });
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <div
      className="flex flex-col h-full bg-[#111318] text-sm text-gray-200"
      onClick={closeContextMenu}
    >
      {/* 텍스트 채널 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
        <span className="uppercase tracking-wide">텍스트 채널</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCreateText();
          }}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 text-white text-base leading-none"
        >
          +
        </button>
      </div>

      {/* 텍스트 채널 리스트 */}
      <div className="px-2 space-y-1">
        {textChannels.length === 0 ? (
          <div className="px-2 py-1 text-[11px] text-gray-500">
            아직 텍스트 채널이 없어요.
          </div>
        ) : (
          textChannels.map((ch) => {
            const isActive = String(ch.id) === String(activeTextChannelId);
            return (
              <button
                key={ch.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChannel(ch);
                }}
                onContextMenu={(e) => handleContextMenu(e, ch)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-xs ${
                  isActive
                    ? "bg-neutral-800 text-white"
                    : "text-gray-300 hover:bg-neutral-800/60"
                }`}
              >
                <span className="text-base text-gray-400">#</span>
                <span className="truncate">{ch.name}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-3 mb-2 border-b border-neutral-800" />

      {/* 음성 채널 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
        <span className="uppercase tracking-wide">음성 채널</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCreateVoice();
          }}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 text-white text-base leading-none"
        >
          +
        </button>
      </div>

      {/* 음성 채널 리스트 */}
      <div className="px-2 space-y-1 mb-2">
        {voiceChannels.length === 0 ? (
          <div className="px-2 py-1 text-[11px] text-gray-500">
            아직 음성 채널이 없어요.
          </div>
        ) : (
          voiceChannels.map((ch) => {
            const isActive = String(ch.id) === String(activeVoiceChannelId);
            const voiceMembers = voiceMembersByChannel?.[String(ch.id)] || [];

            return (
              <div key={ch.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChannel(ch);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, ch)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-xs ${
                    isActive
                      ? "bg-neutral-800 text-white"
                      : "text-gray-300 hover:bg-neutral-800/60"
                  }`}
                >
                  <span className="text-base text-gray-400">🔊</span>
                  <span className="truncate">{ch.name}</span>
                </button>

                {/* 참여자 목록 */}
                {isActive && (
                  <div className="ml-8 mt-1 space-y-1">
                    {voiceMembers.length === 0 ? (
                      <div className="text-[11px] text-gray-500 px-2 py-1">
                        (참여자 없음)
                      </div>
                    ) : (
                      voiceMembers.map((m) => {
                        const isMe = String(m.userId) === String(currentUserId);

                        // ✅ 말하는중 판정:
                        // - 나는 local isSpeaking
                        // - 상대는 remoteSpeaking[socketId]
                        const speaking = isMe
                          ? !!isSpeaking
                          : !!remoteSpeaking?.[String(m.socketId)];

                        const initial = (m.username || "?")
                          .charAt(0)
                          .toUpperCase();

                        // ✅ profileImage -> absolute URL
                        const profileUrl = resolveUrlWithBase(
                          API_BASE,
                          m.profileImage,
                        );

                        return (
                          <div
                            key={m.socketId || m.userId}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-800/40"
                          >
                            {/* ✅ 아바타 (blob) */}
                            <div
                              className={`w-6 h-6 rounded-full relative overflow-hidden flex items-center justify-center
                                text-[11px] font-semibold text-white flex-shrink-0
                                ${speaking ? "ring-2 ring-green-500" : ""}
                              `}
                              style={{ backgroundColor: "#5865F2" }}
                              title={m.username}
                            >
                              {profileUrl ? (
                                <BlobImage
                                  url={profileUrl}
                                  alt={m.username || "user"}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  fallback={<span>{initial}</span>}
                                />
                              ) : (
                                <span>{initial}</span>
                              )}
                            </div>

                            <div className="flex-1 text-[12px] text-gray-200 truncate">
                              {m.username}
                            </div>

                            {/* 마이크 꺼짐 아이콘 */}
                            {m.micMuted && (
                              <img
                                src={micOff}
                                alt="muted"
                                title="마이크 꺼짐"
                                className="w-4 h-4 opacity-80"
                                draggable={false}
                              />
                            )}

                            {/* 본인일 때 나가기 버튼 */}
                            {isMe && (
                              <button
                                type="button"
                                title="음성 채널 나가기"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLeaveVoice?.(ch.id);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-full
                                  bg-neutral-700 hover:bg-neutral-600
                                  transition transform hover:scale-105 active:scale-95"
                              >
                                <img
                                  src={callEndIcon}
                                  alt="leave voice"
                                  className="w-4 h-4 opacity-70 hover:opacity-100 transition"
                                  draggable={false}
                                />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded shadow-lg text-xs"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onDeleteChannel?.(contextMenu.channel);
              closeContextMenu();
            }}
            className="block w-full px-4 py-2 text-red-400 hover:bg-neutral-800 text-left"
          >
            채널 삭제
          </button>
        </div>
      )}

      {/* ✅ 음성 채널 컨트롤 (하단) */}
      {activeVoiceChannelId && (
        <div className="mt-auto p-3 border-t border-neutral-800 bg-[#0f1115]">
          <div className="flex items-center gap-3">
            {/* 🎤 마이크 토글 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMic?.();
              }}
              className={[
                "w-12 h-12 rounded-full flex items-center justify-center",
                "transition-all duration-150 ease-out active:scale-95",
                micMuted
                  ? "bg-red-600 ring-4 ring-red-400/40 animate-pulse"
                  : "bg-neutral-700 hover:bg-neutral-600 ring-1 ring-white/10",
              ].join(" ")}
            >
              <img src={micMuted ? micOff : micOn} className="w-6 h-6" alt="" />
            </button>

            {/* 볼륨 슬라이더 그룹 */}
            <div className="flex-1 flex flex-col justify-center gap-[6px] px-1">
              {/* 🎧 출력 볼륨 */}
              <div className="flex items-center gap-2 group">
                <img
                  src={headsetIcon}
                  className="w-3.5 h-3.5 opacity-50"
                  alt="out"
                />
                <div className="relative flex-1 h-1 bg-[#404249] rounded-full">
                  <div
                    className="absolute top-0 left-0 h-full bg-indigo-400 rounded-full"
                    style={{ width: `${(outputVolume ?? 0.8) * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((outputVolume ?? 0.8) * 100)}
                    onChange={(e) =>
                      onChangeOutputVolume?.(Number(e.target.value) / 100)
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* 🎙️ 입력 볼륨 */}
              <div className="flex items-center gap-2 group">
                <img src={micOn} className="w-3.5 h-3.5 opacity-50" alt="in" />
                <div className="relative flex-1 h-1 bg-[#404249] rounded-full">
                  <div
                    className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        ((inputVolume ?? 1.0) / 2) * 100,
                        100,
                      )}%`,
                    }} // 200% max 기준
                  />
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={Math.round((inputVolume ?? 1.0) * 100)}
                    onChange={(e) =>
                      onChangeInputVolume?.(Number(e.target.value) / 100)
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerChannels;
