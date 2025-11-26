// src/components/Server/Servers.jsx

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config";
import ServersList from "../ui/ServersList";
import CreateServerModal from "../ui/CreateServerModal";

const STORAGE_KEY = "devsync_servers";

// 🔹 이제 백엔드 + 로컬스토리지 폴백 모드
const ServersBar = ({ onSelectServer, variant = "footer" }) => {
  // ----- 상태 -----
  const [servers, setServers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SERVERS;
    } catch {
      return DEFAULT_SERVERS;
    }
  });
  const [loading, setLoading] = useState(true);

  const [openCreate, setOpenCreate] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverEmoji, setServerEmoji] = useState("");

  // ----- 토큰 / axios 인스턴스 -----
  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        timeout: 15000,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "ngrok-skip-browser-warning": "true",
        },
      }),
    [token]
  );

  // ----- 서버 목록 불러오기 -----
  useEffect(() => {
    const fetchServers = async () => {
      // 로그인 안 된 경우: 그냥 로컬/더미 사용
      if (!token) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            setServers(JSON.parse(saved));
          } else {
            setServers(DEFAULT_SERVERS);
          }
        } catch {
          setServers(DEFAULT_SERVERS);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const res = await api.get("/api/servers");
        const list = Array.isArray(res.data) ? res.data : [];

        const mapped = list.map((s) => ({
          ...s,
          short: s.iconUrl || s.name?.trim()?.charAt(0)?.toUpperCase() || "?",
        }));

        setServers(mapped);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      } catch (err) {
        console.error(
          "[Servers] GET /api/servers 실패:",
          err?.response?.data || err?.message
        );

        // 실패하면 로컬/기본 서버로 폴백
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          setServers(saved ? JSON.parse(saved) : DEFAULT_SERVERS);
        } catch {
          setServers(DEFAULT_SERVERS);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, [api, token]);

  // ----- 서버 생성 (+ 버튼, 백엔드 연동) -----
  const handleCreateServer = async (e) => {
    e.preventDefault();
    const name = serverName.trim();
    if (!name) return;

    const emoji = serverEmoji.trim();
    try {
      let created;

      if (token) {
        // 백엔드에 실제 서버 생성
        const res = await api.post("/api/servers", {
          name,
          iconUrl: emoji || null,
        });
        const s = res.data;
        created = {
          ...s,
          short: emoji || s.name?.charAt(0)?.toUpperCase() || "?",
        };
      } else {
        // 로그인 안 된 디자인 모드일 때는 프론트에서만 더미로
        created = {
          id: `local-${Date.now()}`,
          name,
          iconUrl: null,
          short: emoji || name.charAt(0).toUpperCase(),
        };
      }

      setServers((prev) => {
        const next = [...prev, created];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      setServerName("");
      setServerEmoji("");
      setOpenCreate(false);
    } catch (err) {
      console.error(
        "[Servers] POST /api/servers 실패:",
        err?.response?.data || err?.message
      );
    }
  };

  return (
    <>
      {/* 서버 리스트 + + 버튼 UI */}
      <ServersList
        servers={servers}
        loading={loading}
        onClickServer={onSelectServer}
        onOpenCreate={() => setOpenCreate(true)}
        variant={variant}
      />

      {/* 서버 생성 모달 */}
      <CreateServerModal
        open={openCreate}
        serverName={serverName}
        serverEmoji={serverEmoji}
        onChangeServerName={setServerName}
        onChangeServerEmoji={setServerEmoji}
        onClose={() => setOpenCreate(false)}
        onSubmit={handleCreateServer}
      />
    </>
  );
};

export default ServersBar;