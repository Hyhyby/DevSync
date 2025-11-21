// src/components/Home/ui/AddFriendModal.jsx
import React from 'react';

const AddFriendModal = ({
  open,
  friendIdentifier,
  onChangeFriendIdentifier,
  onClose,
  onSubmit,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-full max-w-sm rounded-lg bg-neutral-900 border border-neutral-700 p-5 shadow-xl">
        <h3 className="text-white text-lg font-semibold mb-2">Add Friend</h3>
        <p className="text-sm text-gray-400 mb-4">
          Enter your friend&apos;s DevSync tag or email to send a friend
          request.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            value={friendIdentifier}
            onChange={(e) => onChangeFriendIdentifier(e.target.value)}
            placeholder="e.g. username#0001 or email"
            className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-sm"
            autoFocus
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-neutral-800 text-gray-300 text-sm hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-yellow-400 text-black text-sm font-semibold hover:bg-yellow-300"
            >
              Send Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFriendModal;
