// src/components/Home/ui/FriendsSidebar.jsx
import React from 'react';

const FriendsSidebar = ({
  user,
  logo,
  addFriendIcon,
  friends,
  loadingFriends,
  onAddFriendClick,
  onJoinRoom,
  onLogout,
}) => {
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
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center text-gray-400 text-sm">
            IMG
          </div>
          <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-neutral-900 rounded-full" />
        </div>
        <p className="text-white font-semibold text-sm">
          {user?.username || 'Guest'}
        </p>
        <p className="text-gray-500 text-xs">@{user?.username || 'guest'}</p>
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
              No friends yet. Click <span className="text-yellow-400">+</span>{' '}
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
                  {/* 프로필 동그라미 (이니셜) */}
                  <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-[11px] text-gray-300">
                    {friend.username?.[0]?.toUpperCase() || '?'}
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
