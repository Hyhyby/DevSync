import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../../config"; // config 경로 확인 필요 (현재 파일 위치 기준)

// ✅ 1. URL 변환 유틸리티 (상대경로 -> 절대경로)
const resolveUrlWithBase = (base, url) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("blob:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
};

// ✅ 2. BlobImage 컴포넌트 (Electron/Ngrok 환경 호환용)
const BlobImage = ({ url, alt, className = "", fallback = null, onError }) => {
  const [blobUrl, setBlobUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    let created = "";

    if (!url) {
      setBlobUrl("");
      return;
    }

    if (url.startsWith("blob:")) {
      setBlobUrl(url);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        // axios로 이미지를 blob으로 받아옴 (ngrok 헤더 포함)
        const res = await axios.get(url, {
          responseType: "blob",
          headers: { "ngrok-skip-browser-warning": "true" },
        });

        created = URL.createObjectURL(res.data);
        if (!alive) return;
        setBlobUrl(created);
      } catch (e) {
        // console.error("BLOB_IMG_LOAD_ERR", url, e);
        if (alive) setBlobUrl("");
        onError?.(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, onError]);

  if (loading) {
    // 로딩 중일 때 (원하면 스켈레톤 UI 적용 가능)
    return <div className="absolute inset-0 bg-black/20 animate-pulse" />;
  }

  if (!blobUrl) {
    return fallback;
  }

  return <img src={blobUrl} alt={alt} className={className} loading="lazy" />;
};

// ✅ 3. 메인 컴포넌트
const ServerMembers = ({ members, onInviteClick }) => {
  return (
    <aside className="w-64 bg-[#111214] border-l border-neutral-900 p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-gray-500 font-semibold">
          멤버 — {members.length}
        </div>

        {/* 서버 초대 버튼 (+) */}
        <button
          type="button"
          onClick={onInviteClick}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-neutral-800 text-gray-300 text-xs hover:bg-neutral-700 transition-colors"
          title="서버에 친구 초대"
        >
          +
        </button>
      </div>

      <div className="space-y-1 text-sm overflow-y-auto custom-scrollbar">
        {members.map((m) => {
          // 각 멤버의 프로필 이미지 절대 경로 생성
          const profileUrl = resolveUrlWithBase(API_BASE, m.profileImage);

          return (
            <div
              key={m.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800 transition-colors group cursor-pointer"
            >
              {/* 아바타 영역 */}
              <div className="w-8 h-8 rounded-full bg-[#7289DA] flex items-center justify-center text-xs font-semibold text-white overflow-hidden relative flex-shrink-0">
                {profileUrl ? (
                  <BlobImage
                    url={profileUrl}
                    alt={m.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    fallback={
                      // 이미지 로딩 실패 시 보여줄 이니셜
                      <span>{m.name?.charAt(0).toUpperCase()}</span>
                    }
                  />
                ) : (
                  // 프로필 이미지가 아예 없을 때 이니셜
                  <span>{m.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>

              <span className="truncate text-gray-300 group-hover:text-gray-100">
                {m.name}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default ServerMembers;
