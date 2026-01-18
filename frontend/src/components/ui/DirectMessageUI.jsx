// src/components/ui/DirectMessageUI.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config";

// ✅ ngrok 헤더 포함해서 이미지 blob으로 로딩 → objectURL로 표시
const AvatarImage = ({ url, alt, className }) => {
  const [blobUrl, setBlobUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let created = "";

    // url 없으면 초기화
    if (!url) {
      setBlobUrl("");
      setFailed(false);
      return;
    }

    (async () => {
      try {
        setFailed(false);

        const res = await axios.get(url, {
          responseType: "blob",
          headers: { "ngrok-skip-browser-warning": "true" },
        });

        created = URL.createObjectURL(res.data);
        if (!alive) return;
        setBlobUrl(created);
      } catch (e) {
        console.error("DM_AVATAR_LOAD_ERR", url, e?.message || e);
        if (!alive) return;
        setFailed(true);
        setBlobUrl("");
      }
    })();

    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  if (!url || failed || !blobUrl) return null;

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      loading="lazy"
      draggable={false}
    />
  );
};

const DirectMessageUI = ({
  dmId,
  partnerName,
  myUsername,
  // ✅ 추가: 컨테이너에서 내려주기
  myProfileImage,
  partnerProfileImage,

  messages,
  input,
  onChangeInput,
  onSubmit,
  onScroll,
  messagesWrapRef,
  messagesEndRef,
}) => {
  if (!dmId) return null;

  // ✅ "/api/..." 또는 "/uploads/..." 같은 상대경로면 API_BASE 붙여서 절대 URL로
  const resolveUrl = useMemo(() => {
    return (u) => {
      if (!u || typeof u !== "string") return null;
      if (u.startsWith("blob:")) return u;
      if (u.startsWith("http://") || u.startsWith("https://")) return u;
      if (u.startsWith("/")) return `${API_BASE}${u}`;
      return `${API_BASE}/${u}`;
    };
  }, []);

  const myAvatarUrl = resolveUrl(myProfileImage);
  const partnerAvatarUrl = resolveUrl(partnerProfileImage);

  const partnerInitial = partnerName?.charAt(0)?.toUpperCase() || "?";
  const myInitial = myUsername?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="w-screen h-screen bg-[#050608] flex flex-col text-white">
      {/* 헤더 */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-[#202225] bg-[#18191c]">
        <div className="flex items-center gap-2">
          {/* ✅ 상대 아바타: 이미지 있으면 이미지, 없으면 이니셜 */}
          <div className="w-7 h-7 rounded-full bg-discord-blurple overflow-hidden flex items-center justify-center text-sm font-semibold relative">
            <AvatarImage
              url={partnerAvatarUrl}
              alt={partnerName || "partner"}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {!partnerAvatarUrl && partnerInitial}
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold">{partnerName}</span>
            <span className="text-[11px] text-gray-400">Direct Message</span>
          </div>
        </div>

        {myUsername && (
          <div className="flex items-center gap-2">
            {/* ✅ 내 아바타도 헤더에서 같이 보여주고 싶으면 */}
            <div className="w-6 h-6 rounded-full bg-slate-600 overflow-hidden flex items-center justify-center text-[11px] font-semibold relative">
              <AvatarImage
                url={myAvatarUrl}
                alt={myUsername || "me"}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {!myAvatarUrl && myInitial}
            </div>

            <div className="text-xs text-gray-400">
              Logged in as {myUsername}
            </div>
          </div>
        )}
      </header>

      {/* 본문 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 메시지 리스트 */}
        <div
          ref={messagesWrapRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={onScroll}
        >
          {messages.map((msg, index) => {
            const isOwn = msg.username === myUsername;
            const initial = msg.username?.charAt(0)?.toUpperCase() || "?";

            return (
              <div
                key={msg.id || index}
                className={`flex items-start ${
                  isOwn ? "justify-end" : "justify-start"
                } gap-3`}
              >
                {/* 상대 아바타 */}
                {!isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-semibold relative">
                    {/* ✅ 상대 메시지 아바타: partnerAvatarUrl 있으면 사용 */}
                    <AvatarImage
                      url={partnerAvatarUrl}
                      alt={partnerName || msg.username}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {!partnerAvatarUrl && initial}
                  </div>
                )}

                {/* 말풍선 */}
                <div
                  className={`p-3 rounded-lg max-w-[70%] break-words whitespace-pre-wrap ${
                    isOwn
                      ? "bg-discord-blurple text-white text-right"
                      : "bg-discord-darkest text-gray-300 text-left"
                  }`}
                >
                  {!isOwn && (
                    <div className="text-sm font-semibold text-white mb-1">
                      {msg.username}
                    </div>
                  )}
                  <div>{msg.message}</div>
                </div>

                {/* 내 아바타 */}
                {isOwn && (
                  <div className="w-8 h-8 bg-slate-600 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-semibold relative">
                    <AvatarImage
                      url={myAvatarUrl}
                      alt={myUsername || "me"}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {!myAvatarUrl && myInitial}
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* 입력창 */}
        <form
          onSubmit={onSubmit}
          className="p-4 border-t border-[#202225] bg-[#18191c] flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => onChangeInput(e.target.value)}
            placeholder={`${partnerName}에게 메시지 보내기`}
            className="flex-1 p-3 bg-discord-dark border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-discord-blurple"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-discord-blurple hover:bg-blue-600 rounded text-white font-semibold text-sm"
          >
            보내기
          </button>
        </form>
      </div>
    </div>
  );
};

export default DirectMessageUI;
