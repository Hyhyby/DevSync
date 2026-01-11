// src/components/Server/TextChannel/TextChannelUI.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import axios from "axios";
import arrowDown from "../../../assets/arrow_down.png";
import { API_BASE } from "../../config";

const formatDate = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const isDifferentDay = (a, b) => {
  if (!a || !b) return true;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  );
};

const formatBytes = (n) => {
  if (!Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const downloadFileViaAxios = async (url, filename = "file") => {
  const res = await axios.get(url, {
    responseType: "blob",
    headers: { "ngrok-skip-browser-warning": "true" },
  });

  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
};

// ✅ 썸네일 이미지 로더(ngrok 헤더 포함 → blob → objectURL)
const AttachmentImage = ({ url, fileName, onOpen }) => {
  const [blobUrl, setBlobUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let created = "";

    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(url, {
          responseType: "blob",
          headers: { "ngrok-skip-browser-warning": "true" },
        });

        created = URL.createObjectURL(res.data);
        if (!alive) return;
        setBlobUrl(created);
      } catch (e) {
        console.error("IMG_THUMB_LOAD_ERR", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  if (loading) {
    return <div className="w-56 h-32 rounded bg-black/20 animate-pulse" />;
  }

  if (!blobUrl) {
    return (
      <button
        type="button"
        onClick={() => downloadFileViaAxios(url, fileName)}
        className="px-3 py-2 text-xs underline opacity-80"
      >
        이미지 다운로드
      </button>
    );
  }

  return (
    <button
      type="button"
      className="block"
      onClick={() => onOpen({ blobUrl, url, fileName })}
      title={fileName}
    >
      <img
        src={blobUrl}
        alt={fileName}
        className="max-w-full max-h-64 object-cover rounded"
        loading="lazy"
      />
    </button>
  );
};

const TextChannelUI = ({
  messages,
  input,
  setInput,
  sendMessage,
  wrapRef,
  endRef,
  onScroll,
  username,
  hasMore,
  showJumpToBottom,
  onJumpToBottom,

  selectedFiles = [],
  onPickFiles,
  removeSelectedFile,
  clearSelectedFiles,
}) => {
  const fileInputRef = useRef(null);

  // ✅ 모달 상태
  const [imageModal, setImageModal] = useState(null);

  const handlePick = (e) => {
    onPickFiles?.(e.target.files);
    e.target.value = "";
  };

  const canSend = useMemo(() => {
    return (input || "").trim().length > 0 || (selectedFiles?.length ?? 0) > 0;
  }, [input, selectedFiles]);

  return (
    <div className="flex flex-col h-full bg-[#1E1F22]">
      {/* 메시지 목록 */}
      <div
        ref={wrapRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {messages.map((m, idx) => {
          const prev = messages[idx - 1];
          const showDateDivider = isDifferentDay(prev?.timestamp, m.timestamp);
          const shouldHideTopDivider = idx === 0 && hasMore;
          const isMine = m.username === username;

          const files = Array.isArray(m.files) ? m.files : [];

          return (
            <React.Fragment key={m.id ?? `${m.username}-${m.timestamp}-${idx}`}>
              {showDateDivider && !shouldHideTopDivider && (
                <div className="flex items-center my-4">
                  <div className="flex-1 h-px bg-gray-700" />
                  <span className="px-3 text-xs text-gray-400">
                    {formatDate(m.timestamp)}
                  </span>
                  <div className="flex-1 h-px bg-gray-700" />
                </div>
              )}

              <div
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-3 py-2 rounded-lg max-w-[70%] ${
                    isMine
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-200"
                  }`}
                >
                  {!isMine && (
                    <div className="text-xs font-bold mb-1">{m.username}</div>
                  )}

                  {m.message && (
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  )}

                  {files.length > 0 && (
                    <div className={`${m.message ? "mt-2" : ""} space-y-2`}>
                      {files.map((f, fidx) => {
                        const url = `${API_BASE}${f.fileUrl}`;
                        const mime = (f.mimeType || "").toLowerCase();
                        const isImg = mime.startsWith("image/");

                        return (
                          <div
                            key={f.id ?? `${f.fileUrl}-${fidx}`}
                            className={`rounded-md overflow-hidden border border-white/10 ${
                              isMine ? "bg-white/10" : "bg-black/10"
                            }`}
                          >
                            {isImg ? (
                              <AttachmentImage
                                url={url}
                                fileName={f.fileName}
                                onOpen={(payload) => setImageModal(payload)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadFileViaAxios(url, f.fileName)
                                }
                                className="block w-full text-left px-3 py-2 hover:bg-white/5"
                              >
                                <div className="text-xs font-semibold truncate">
                                  {f.fileName}
                                </div>
                                <div className="text-[11px] opacity-80">
                                  {mime || "file"}{" "}
                                  {Number.isFinite(f.fileSize)
                                    ? `• ${formatBytes(f.fileSize)}`
                                    : ""}
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* 입력창 영역 */}
      <div className="relative p-3 border-t border-gray-700">
        {showJumpToBottom && (
          <button
            type="button"
            onClick={onJumpToBottom}
            className="absolute -top-7 left-1/2 -translate-x-1/2
               w-9 h-9 rounded-full
               bg-[#2B2D31] hover:bg-[#3A3C43]
               flex items-center justify-center
               shadow-lg transition"
            title="맨 아래로"
          >
            <img
              src={arrowDown}
              alt="맨 아래로"
              className="w-4 h-4 opacity-80"
            />
          </button>
        )}

        {selectedFiles?.length > 0 && (
          <div className="mb-2 p-2 rounded bg-[#15161a] border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-300">
                첨부파일 {selectedFiles.length}개
              </div>
              <button
                type="button"
                onClick={clearSelectedFiles}
                className="text-xs text-gray-400 hover:text-white underline"
              >
                모두 제거
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="flex items-center gap-2 px-2 py-1 rounded bg-neutral-800 text-xs text-gray-200"
                >
                  <span className="max-w-[220px] truncate">{f.name}</span>
                  <span className="text-[11px] text-gray-400">
                    {formatBytes(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSelectedFile?.(idx)}
                    className="text-gray-300 hover:text-white"
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-3 items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center"
            title="파일 첨부"
          >
            📎
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handlePick}
          />

          <input
            className="flex-1 p-2 rounded bg-gray-800 text-white"
            placeholder="메시지 보내기"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <button
            className={`px-4 rounded text-white ${
              canSend
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-blue-500/40 cursor-not-allowed"
            }`}
            disabled={!canSend}
            title={!canSend ? "메시지 또는 파일을 선택하세요" : "전송"}
          >
            전송
          </button>
        </form>
      </div>

      {/* ✅ 이미지 모달 */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setImageModal(null)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute right-0 -top-10 flex gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
                onClick={() =>
                  downloadFileViaAxios(imageModal.url, imageModal.fileName)
                }
              >
                다운로드
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
                onClick={() => setImageModal(null)}
              >
                닫기 ✕
              </button>
            </div>

            <img
              src={imageModal.blobUrl}
              alt={imageModal.fileName}
              className="w-full max-h-[80vh] object-contain rounded"
            />

            <div className="mt-2 text-xs text-gray-200 opacity-80 truncate">
              {imageModal.fileName}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextChannelUI;
