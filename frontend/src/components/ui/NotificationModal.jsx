// src/components/ui/NotificationModal.jsx

const NotificationModal = ({
  open,
  onClose,
  friendRequestsReceived,
  friendRequestsSent,
  messages,
  respondRequest,
  // ✅ 서버 초대 관련 props
  serverInvitesReceived = [],
  serverInvitesSent = [],
  respondServerInvite,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-lg p-4">
        <h3 className="text-white text-lg font-semibold mb-3">Notifications</h3>

        <div className="space-y-4 max-h-72 overflow-y-auto text-sm">
          {/* 받은 친구 요청 */}
          <div>
            <h4 className="text-gray-300 text-xs mb-2">받은 친구 요청</h4>
            {friendRequestsReceived.length === 0 ? (
              <p className="text-gray-500 text-xs">받은 친구 요청이 없어요.</p>
            ) : (
              friendRequestsReceived.map((req) => (
                <div
                  key={`${req.from_user_id}-${req.created_at}`}
                  className="p-3 bg-neutral-800 rounded border border-neutral-700 flex flex-col gap-2"
                >
                  <p className="text-gray-200">
                    <span className="font-semibold">{req.from_username}</span>{" "}
                    님이 친구 요청을 보냈어요.
                  </p>
                  <div className="flex gap-2 justify-end">
                    {/* 수락 버튼 */}
                    <button
                      onClick={() => respondRequest(req.from_user_id, "accept")}
                      className="px-2 py-1 rounded bg-green-500 text-black hover:bg-green-400 text-xs font-semibold"
                    >
                      수락
                    </button>
                    {/* 거절 버튼 */}
                    <button
                      onClick={() =>
                        respondRequest(req.from_user_id, "decline")
                      }
                      className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500 text-xs font-semibold"
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 내가 보낸 진행중인 친구 요청 */}
          <div>
            <h4 className="text-gray-300 text-xs mb-2">내가 보낸 친구 요청</h4>
            {friendRequestsSent.length === 0 ? (
              <p className="text-gray-500 text-xs">
                내가 보낸 진행중인 요청이 없어요.
              </p>
            ) : (
              friendRequestsSent.map((req) => (
                <div
                  key={`${req.to_user_id}-${req.created_at}`}
                  className="p-3 bg-neutral-800 rounded border border-neutral-700"
                >
                  <p className="text-gray-200 text-sm">
                    <span className="font-semibold">{req.to_username}</span>{" "}
                    님에게 친구 요청을 보냈어요.
                  </p>
                  <p className="text-gray-500 text-[11px]">진행 중…</p>
                </div>
              ))
            )}
          </div>

          {/* ✅ 받은 서버 초대 */}
          <div>
            <h4 className="text-gray-300 text-xs mb-2">받은 서버 초대</h4>
            {serverInvitesReceived.length === 0 ? (
              <p className="text-gray-500 text-xs">받은 서버 초대가 없어요.</p>
            ) : (
              serverInvitesReceived.map((inv) => (
                <div
                  key={inv.invite_id}
                  className="p-3 bg-neutral-800 rounded border border-neutral-700 flex flex-col gap-2"
                >
                  <p className="text-gray-200 text-sm">
                    <span className="font-semibold">{inv.from_username}</span>{" "}
                    님이{" "}
                    <span className="font-semibold">{inv.server_name}</span>{" "}
                    서버로 초대했어요.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() =>
                        respondServerInvite?.(inv.invite_id, "accept")
                      }
                      className="px-2 py-1 rounded bg-green-500 text-black hover:bg-green-400 text-xs font-semibold"
                    >
                      수락
                    </button>
                    <button
                      onClick={() =>
                        respondServerInvite?.(inv.invite_id, "decline")
                      }
                      className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500 text-xs font-semibold"
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ✅ 내가 보낸 서버 초대 */}
          <div>
            <h4 className="text-gray-300 text-xs mb-2">내가 보낸 서버 초대</h4>
            {serverInvitesSent.length === 0 ? (
              <p className="text-gray-500 text-xs">
                내가 보낸 진행중인 서버 초대가 없어요.
              </p>
            ) : (
              serverInvitesSent.map((inv) => (
                <div
                  key={inv.invite_id}
                  className="p-3 bg-neutral-800 rounded border border-neutral-700"
                >
                  <p className="text-gray-200 text-xs">
                    <span className="font-semibold">{inv.to_username}</span>{" "}
                    님에게{" "}
                    <span className="font-semibold">{inv.server_name}</span>{" "}
                    서버 초대를 보냈어요.
                  </p>
                  <p className="text-gray-500 text-[11px]">진행 중…</p>
                </div>
              ))
            )}
          </div>

          {/* 일반 메시지 */}
          {messages.map((m, i) => (
            <div
              key={`msg-${i}`}
              className="p-2 bg-neutral-800 rounded text-gray-200"
            >
              {m}
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-neutral-700 text-gray-200 rounded hover:bg-neutral-600 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
