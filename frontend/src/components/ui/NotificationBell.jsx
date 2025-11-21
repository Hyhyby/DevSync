// src/components/ui/NotificationBell.jsx

const NotificationBell = ({ unreadCount, onClick, bellIcon }) => {
  return (
    <div className="absolute top-4 right-4 z-50">
      <button
        onClick={onClick}
        className="relative p-2 hover:bg-neutral-800 rounded-full"
      >
        <img
          src={bellIcon}
          alt="Notifications"
          className="w-6 h-6 opacity-80 hover:opacity-100"
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 text-[10px] bg-red-600 text-white px-1.5 py-[1px] rounded-full">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default NotificationBell;
