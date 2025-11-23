// src/components/Server/Servers.jsx

import React, { useEffect, useState /*, useMemo */ } from "react";
// 🔽 나중에 백엔드 붙일 때 주석 해제
// import axios from "axios";
// import { API_BASE } from "../../config";
import ServersList from "../ui/ServersList";
import CreateServerModal from "../ui/CreateServerModal";

const DEFAULT_SERVERS = [
  { id: "devsync", name: "DevSync", short: "D" },
  { id: "study", name: "스터디", short: "스" },
  { id: "study2", name: "공부", short: "공" },
  { id: "football", name: "풋뱅", short: "풋" },
];

const STORAGE_KEY = "devsync_servers";

// 🔹 지금은 프론트 전용 모드 (로컬스토리지만 사용)
//    나중에 백엔드 붙일 때 참고용 코드도 아래에 주석으로 넣어둠
const ServersBar = ({ onSelectServer, variant = "footer" }) => {
  // ----- 상태 -----
  const [servers, setServers] = useState(() => {
    // 앱 처음 켜질 때: localStorage에 있으면 그걸 쓰고, 없으면 기본 서버 사용
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SERVERS;
    } catch {
      return DEFAULT_SERVERS;
    }
  });
  const [loading] = useState(false); // 지금은 프론트 전용이라 로딩X

  const [openCreate, setOpenCreate] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverEmoji, setServerEmoji] = useState("");

  // ----- 로컬스토리지 동기화 -----
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
    } catch (e) {
      console.error("[Servers] localStorage 저장 실패:", e);
    }
  }, [servers]);

  // ----- 서버 생성 (+ 버튼) -----
  const handleCreateServer = (e) => {
    e.preventDefault();
    const name = serverName.trim();
    if (!name) return;

    const emoji = serverEmoji.trim();
    const short = emoji || name.charAt(0).toUpperCase();

    const newServer = {
      id: `local-${Date.now()}`, // 임시 ID (로컬 전용)
      name,
      short,
    };

    setServers((prev) => [...prev, newServer]);

    setServerName("");
    setServerEmoji("");
    setOpenCreate(false);
  };

  // =====================================================================
  // 🧩 [참고용] 나중에 백엔드 붙일 때 쓸 코드 (지금은 전부 주석 처리)
  // =====================================================================

  /*
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

  // 🔹 서버 목록 불러오기 (백엔드 버전)
  useEffect(() => {
    const fetchServers = async () => {
      // 로그인 안 되어 있으면 그냥 로컬/더미 사용
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

  // 🔹 서버 생성 (+ 버튼 눌렀을 때, 백엔드 버전)
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
        // 로그인 안된 디자인 모드일 때는 프론트에서만 더미로
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
  */

  // =====================================================================

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
