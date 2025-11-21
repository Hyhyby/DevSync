// src/components/Home/ui/FriendRequestResultModal.jsx
import React from 'react';

const FriendRequestResultModal = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-full max-w-xs bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-center">
        <p
          className={
            result.type === 'success'
              ? 'text-green-400 text-sm'
              : 'text-red-400 text-sm'
          }
        >
          {result.message}
        </p>
        <button
          onClick={onClose}
          className="mt-4 px-3 py-1.5 bg-neutral-700 rounded text-xs text-gray-200 hover:bg-neutral-600"
        >
          확인
        </button>
      </div>
    </div>
  );
};

export default FriendRequestResultModal;
