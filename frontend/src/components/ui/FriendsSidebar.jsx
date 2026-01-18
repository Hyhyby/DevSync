// src/components/Home/ui/FriendsSidebar.jsx
import React, { useRef, useState, useEffect, useMemo } from "react";
import { API_BASE } from "../../config"; // ✅ 경로가 다르면 맞춰줘 (예: ../../config)

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

  // previewImage에는 "로컬 objectURL" 또는 "서버 이미지 URL" 둘 다 들어갈 수 있음
  const [previewImage, setPreviewImage] = useState(null);

  // ✅ objectURL 메모리 누수 방지용
  const objectUrlRef = useRef(null);

  // ✅ 상대경로(/uploads/...) → 절대경로(API_BASE + ...)로 변환
  const resolveImageUrl = useMemo(() => {
    return (url) => {
      if (!url) return null;
      if (typeof url !== "string") return null;

      // 이미 blob/objectURL이거나 http(s)면 그대로
      if (url.startsWith("blob:")) return url;
      if (url.startsWith("http://") || url.startsWith("https://")) return url;

      // "/uploads/..." 같은 상대경로면 API_BASE 붙이기
      if (url.startsWith("/")) return `${API_BASE}${url}`;

      // 그 외(상대경로)도 일단 붙여줌
      return `${API_BASE}/${url}`;
    };
  }, []);
  useEffect(() => {
    const resolved = resolveImageUrl(user?.profileImage);
    console.log("🖼️ PROFILE IMAGE URL =", resolved);
    setPreviewImage(resolved);
  }, [user, resolveImageUrl]);
  console.log("API_BASE =", API_BASE);
  console.log("resolved profile =", resolveImageUrl(user?.profileImage));

  // ✅ user 변경 시 서버에 저장된 프로필 이미지 반영
  useEffect(() => {
    // 기존 objectURL 정리
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const next = resolveImageUrl(user?.profileImage);
    setPreviewImage(next);
  }, [user, resolveImageUrl]);

  // 컴포넌트 언마운트 시 objectURL 정리
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleProfileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ✅ 기존 objectURL 정리
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    // 1) 즉시 미리보기
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreviewImage(objectUrl);

    // 2) 실제 업로드(부모에서 처리)
    onUploadProfileImage?.(file);

    // 같은 파일 다시 선택해도 onChange가 뜨게 초기화
    e.target.value = "";
  };

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
            // ✅ PNG만 고집하면 유지해도 됨. 일반적으로는 image/* 추천
            accept="image/*"
            className="hidden"
          />

          <div
            onClick={handleProfileClick}
            className="w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-transparent group-hover:border-yellow-400 transition-all relative"
            title="Click to change profile image"
          >
            {previewImage ? (
              <img
                src={previewImage}
                alt="Profile"
                className="absolute inset-0 w-full h-full object-cover block"
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
              const friendImg = resolveImageUrl(friend.profileImage);

              return (
                <button
                  key={friend.id}
                  onClick={() => onJoinRoom(friend.id)}
                  className="w-full p-2 rounded hover:bg-neutral-800 text-gray-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-[11px] text-gray-300 overflow-hidden relative">
                      {friendImg ? (
                        <img
                          src={friendImg}
                          alt={friend.username}
                          className="absolute inset-0 w-full h-full object-cover block"
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
