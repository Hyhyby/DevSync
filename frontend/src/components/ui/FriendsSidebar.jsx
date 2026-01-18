// src/components/Home/ui/FriendsSidebar.jsx
import React, { useRef, useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE } from "../../config";

// ✅ 상대경로(/api..., /uploads...) → 절대경로(API_BASE + ...)로 변환
const resolveUrlWithBase = (base, url) => {
  if (!url || typeof url !== "string") return null;

  // blob/objectURL은 그대로
  if (url.startsWith("blob:")) return url;

  // 이미 절대경로면 그대로
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // /로 시작하면 base 붙이기
  if (url.startsWith("/")) return `${base}${url}`;

  // 그 외도 base 붙이기
  return `${base}/${url}`;
};

// ✅ ngrok 우회: url을 axios로 blob 받아서 blob: URL로 바꿔서 <img>에 사용
const BlobImage = ({ url, alt, className = "", fallback = null, onError }) => {
  const [blobUrl, setBlobUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    let created = "";

    // url이 없으면 초기화
    if (!url) {
      setBlobUrl("");
      return;
    }

    // blob: 이면 그대로 쓰기 (로컬 미리보기)
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
          // 필요하면 withCredentials: true,
        });

        created = URL.createObjectURL(res.data);
        if (!alive) return;
        setBlobUrl(created);
      } catch (e) {
        console.error("BLOB_IMG_LOAD_ERR", url, e);
        if (alive) setBlobUrl("");
        onError?.(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      // 우리가 만든 objectURL만 revoke (blob: 미리보기는 revoke하면 안 됨)
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, onError]);

  if (loading) {
    // 로딩 UI 필요하면 바꿔도 됨
    return <div className="absolute inset-0 bg-black/20 animate-pulse" />;
  }

  if (!blobUrl) {
    return fallback;
  }

  return <img src={blobUrl} alt={alt} className={className} loading="lazy" />;
};

const FriendsSidebar = ({
  user,
  logo,
  addFriendIcon,
  friends,
  loadingFriends,
  onAddFriendClick,
  onJoinRoom,
  onLogout,
  onUploadProfileImage,
}) => {
  const fileInputRef = useRef(null);

  // ✅ 업로드 직후에는 로컬 미리보기를 즉시 보여주기 위한 상태
  // (서버 저장된 URL은 user.profileImage로 들어오고, 여긴 "임시 미리보기" 용)
  const [localPreview, setLocalPreview] = useState(null);
  const localPreviewRef = useRef(null);

  // ✅ user.profileImage를 절대 URL로 변환
  const profileUrl = useMemo(() => {
    const resolved = resolveUrlWithBase(API_BASE, user?.profileImage);
    console.log("🖼️ PROFILE IMAGE URL =", resolved);
    return resolved;
  }, [user?.profileImage]);

  // ✅ 업로드 성공 후 user.profileImage가 들어오면 로컬 미리보기는 정리
  useEffect(() => {
    if (user?.profileImage) {
      // 서버 URL이 생겼으니 로컬 미리보기 제거
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
      setLocalPreview(null);
    }
  }, [user?.profileImage]);

  // 언마운트 시 로컬 미리보기 objectURL 정리
  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
    };
  }, []);

  const handleProfileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 기존 로컬 미리보기 objectURL 제거
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }

    // 1) 즉시 로컬 미리보기
    const objectUrl = URL.createObjectURL(file);
    localPreviewRef.current = objectUrl;
    setLocalPreview(objectUrl);

    // 2) 실제 업로드 (부모에서 처리)
    onUploadProfileImage?.(file);

    e.target.value = "";
  };

  // ✅ 화면에 보여줄 최종 프로필 소스
  // 로컬 미리보기가 있으면 그걸 우선, 없으면 서버 URL
  const displayProfileUrl = localPreview || profileUrl;

  return (
    <aside className="w-64 bg-neutral-900 flex flex-col border-r border-neutral-800">
      {/* Logo */}
      <div className="p-4 pb-2 border-b border-neutral-800">
        <img
          src={logo}
          alt="DevSync Logo"
          className="w-10 h-10 object-contain drop-shadow-[0_0_6px_#F9E4BC]"
        />
      </div>

      {/* Profile */}
      <div className="p-4 border-b border-neutral-800 flex flex-col items-center gap-2">
        <div className="relative group">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div
            onClick={handleProfileClick}
            className="w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-transparent group-hover:border-yellow-400 transition-all relative"
            title="Click to change profile image"
          >
            {displayProfileUrl ? (
              <BlobImage
                url={displayProfileUrl}
                alt="Profile"
                className="absolute inset-0 w-full h-full object-cover block"
                fallback={<span className="text-gray-400 text-sm">IMG</span>}
                onError={() => {
                  console.log("❌ PROFILE IMG ERROR", displayProfileUrl);
                }}
              />
            ) : (
              <span className="text-gray-400 text-sm">IMG</span>
            )}

            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
              <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-bold">
                EDIT
              </span>
            </div>
          </div>

          <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-neutral-900 rounded-full z-10" />
        </div>

        <p className="text-white font-semibold text-sm">
          {user?.username || "Guest"}
        </p>
        <p className="text-gray-500 text-xs">@{user?.username || "guest"}</p>
      </div>

      {/* Friends List */}
      <div className="flex-1 p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-semibold">Friends</h2>
          <button
            onClick={onAddFriendClick}
            className="p-1 hover:bg-neutral-800 rounded transition"
            aria-label="Add friend"
            title="Add friend"
          >
            <img
              src={addFriendIcon}
              alt="Add Friend"
              className="w-5 h-5 opacity-80 hover:opacity-100"
            />
          </button>
        </div>

        <div className="space-y-1">
          {loadingFriends ? (
            <div className="text-gray-500 text-sm">Loading friends…</div>
          ) : friends.length === 0 ? (
            <div className="text-gray-500 text-sm">
              No friends yet. Click <span className="text-yellow-400">+</span>{" "}
              to add one.
            </div>
          ) : (
            friends.map((friend) => {
              const friendAbs = resolveUrlWithBase(
                API_BASE,
                friend.profileImage,
              );

              return (
                <button
                  key={friend.id}
                  onClick={() => onJoinRoom(friend.id)}
                  className="w-full p-2 rounded hover:bg-neutral-800 text-gray-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-[11px] text-gray-300 overflow-hidden relative">
                      {friendAbs ? (
                        <BlobImage
                          url={friendAbs}
                          alt={friend.username}
                          className="absolute inset-0 w-full h-full object-cover block"
                          fallback={
                            <span>
                              {friend.username?.[0]?.toUpperCase() || "?"}
                            </span>
                          }
                        />
                      ) : (
                        friend.username?.[0]?.toUpperCase() || "?"
                      )}
                    </div>

                    <span className="text-sm font-medium truncate">
                      {friend.username}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="p-4 border-t border-neutral-800">
        <button
          onClick={onLogout}
          className="w-full p-2 bg-red-600 hover:bg-red-500 rounded text-white transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
};

export default FriendsSidebar;
