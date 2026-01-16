// src/components/Home/ui/FriendsSidebar.jsx
import React, { useRef, useState, useEffect } from "react";

const FriendsSidebar = ({
  user,
  logo,
  addFriendIcon,
  friends,
  loadingFriends,
  onAddFriendClick,
  onJoinRoom,
  onLogout,
  onUploadProfileImage, // (새로 추가됨) 부모 컴포넌트에서 이미지 업로드를 처리할 함수
}) => {
  const fileInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);

  // user 정보가 변경되거나 초기 로드 시 기존 프로필 이미지가 있다면 설정 (user 객체에 profileImage 속성이 있다고 가정)
  useEffect(() => {
    if (user?.profileImage) {
      setPreviewImage(user.profileImage);
    }
  }, [user]);

  // 프로필 영역 클릭 시 숨겨진 input 클릭 트리거
  const handleProfileClick = () => {
    fileInputRef.current.click();
  };

  // 파일 선택 시 처리
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 1. 미리보기용 URL 생성 (즉각적인 UI 반영)
      const objectUrl = URL.createObjectURL(file);
      setPreviewImage(objectUrl);

      // 2. 부모 컴포넌트로 파일 전달 (실제 서버 업로드 로직은 부모에서 처리 권장)
      if (onUploadProfileImage) {
        onUploadProfileImage(file);
      }
    }
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
          {/* 숨겨진 파일 입력 필드 (PNG만 허용) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png"
            className="hidden"
          />

          {/* 클릭 가능한 프로필 영역 */}
          <div
            onClick={handleProfileClick}
            className="w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-transparent group-hover:border-yellow-400 transition-all relative"
            title="Click to change profile image"
          >
            {previewImage ? (
              <img
                src={previewImage}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-sm">IMG</span>
            )}

            {/* 호버 시 오버레이 효과 (변경 가능함을 시각적으로 표시) */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
              <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-bold">
                EDIT
              </span>
            </div>
          </div>

          {/* 온라인 상태 표시 등 */}
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
            friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => onJoinRoom(friend.id)}
                className="w-full p-2 rounded hover:bg-neutral-800 text-gray-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* 친구 프로필 (여기서는 로직 유지) */}
                  <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-[11px] text-gray-300 overflow-hidden">
                    {friend.profileImage ? (
                      <img
                        src={friend.profileImage}
                        alt={friend.username}
                        className="w-full h-full object-cover"
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
            ))
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
