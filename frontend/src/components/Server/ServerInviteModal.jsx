// src/components/Server/ServerInviteModal.jsx
import React, { useEffect, useState } from "react";

/**
 * 서버에 친구를 초대하는 모달
 *
 * props:
 * - open: boolean
 * - onClose: () => void
 * - serverId: string | number
 * - api: axios 인스턴스 (Authorization 포함)
 */
const ServerInviteModal = ({ open, onClose, serverId, api }) => {
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sendingIds, setSendingIds] = useState([]); // 초대 보내는 중인 친구 id
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!open) return;

    const fetchFriends = async () => {
      setLoadingFriends(true);
      setError("");
      setInfo("");

      try {
        const res = await api.get("/api/friends");
        const list = Array.isArray(res.data) ? res.data : [];
        setFriends(list);
      } catch (err) {
        console.error("[ServerInviteModal] 친구 목록 불러오기 실패:", err);
        setError("친구 목록을 불러오지 못했어요.");
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [open, api]);

  const handleInvite = async (friendId) => {
    if (!serverId) return;
    setError("");
    setInfo("");

    setSendingIds((prev) => [...prev, friendId]);
    try {
      await api.post(`/api/servers/${serverId}/invites`, {
        targetUserId: friendId,
      });
      setInfo("초대가 전송되었어요!");
    } catch (err) {
      console.error(
        "[ServerInviteModal] 서버 초대 실패:",
        err?.response?.data || err
      );
      const msg =
        err?.response?.data?.error || "초대 전송 중 오류가 발생했어요.";
      setError(msg);
    } finally {
      setSendingIds((prev) => prev.filter((id) => id !== friendId));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-full max-w-sm bg-neutral-900 rounded-lg border border-neutral-700 p-4">
        <h3 className="text-white text-lg font-semibold mb-2">
          서버에 친구 초대
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          친구 목록에서 이 서버로 초대할 사람을 선택하세요.
        </p>

        {error && (
          <div className="mb-2 text-xs text-red-400 bg-red-900/40 border border-red-700 rounded px-2 py-1">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-2 text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-700 rounded px-2 py-1">
            {info}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto space-y-2">
          {loadingFriends ? (
            <p className="text-xs text-gray-400">친구 목록 불러오는 중...</p>
          ) : friends.length === 0 ? (
            <p className="text-xs text-gray-500">
              친구 목록이 비어 있어요. 먼저 친구를 추가해보세요.
            </p>
          ) : (
            friends.map((f) => {
              const isSending = sendingIds.includes(f.id);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-2 py-2 bg-neutral-800 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-[11px] text-gray-200">
                      {f.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm text-gray-100">{f.username}</span>
                  </div>

                  <button
                    disabled={isSending}
                    onClick={() => handleInvite(f.id)}
                    className={`px-2 py-1 text-xs rounded font-semibold ${
                      isSending
                        ? "bg-yellow-800 text-yellow-200 cursor-not-allowed"
                        : "bg-yellow-400 text-black hover:bg-yellow-300"
                    }`}
                  >
                    {isSending ? "보내는 중..." : "초대"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded bg-neutral-800 text-gray-300 hover:bg-neutral-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// ✅ default export 꼭 있어야 한다
export default ServerInviteModal;
