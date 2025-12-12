// src/components/ui/CreateChannelModal.jsx
import React, { useEffect, useState } from "react";

const CreateChannelModal = ({ open, type, onClose, onSubmit }) => {
  const [name, setName] = useState("");

  // 모달 열릴 때마다 입력 초기화
  useEffect(() => {
    if (open) setName("");
  }, [open]);

  if (!open) return null;

  const isText = type === "text";
  const title = isText ? "텍스트 채널 만들기" : "음성 채널 만들기";
  const placeholder = isText ? "ex) 일반, 공지, 잡담" : "ex) 일반, 게임, 회의";

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm bg-neutral-900 rounded-lg border border-neutral-700 p-4">
        <h3 className="text-white text-lg font-semibold mb-2">{title}</h3>
        <p className="text-xs text-gray-400 mb-4">
          채널 이름을 입력하고 확인을 누르면 서버에 채널이 생성됩니다.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-300 mb-1">
              채널 이름
            </label>
            <input
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white outline-none focus:border-yellow-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded bg-neutral-800 text-gray-300 hover:bg-neutral-700"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
            >
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
