import React from "react";

const CreateServerModal = ({
  open,
  serverName,
  serverEmoji,
  onChangeServerName,
  onChangeServerEmoji,
  onClose,
  onSubmit,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-lg font-semibold mb-2">
          새 서버 만들기
        </h3>
        <p className="text-gray-400 text-xs mb-4">
          서버 이름과 (선택) 이모지를 입력하면 홈 화면 아래 서버 바에
          추가됩니다.
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-300">서버 이름</label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => onChangeServerName(e.target.value)}
              className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
              placeholder="예: 공부, 풋뱅, 롤친구방…"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-300">
              서버 아이콘 (이모지/한 글자)
            </label>
            <input
              type="text"
              value={serverEmoji}
              onChange={(e) => onChangeServerEmoji(e.target.value)}
              maxLength={2}
              className="w-24 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
              placeholder="🐥 / 스"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-neutral-800 text-xs text-gray-300 hover:bg-neutral-700"
            >
              취소
            </button>

            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-yellow-400 text-xs font-semibold text-black hover:bg-yellow-300"
            >
              만들기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateServerModal;
