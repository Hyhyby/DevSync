// src/Home.jsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import logo from "../../assets/devsync-logo.png";
import addFriendIcon from "../../assets/person_add.png";
import bellIcon from "../../assets/notification.png";

import Friends from "./Home/Friends";
import Notification from "./Home/Notification";
import Layout from "./Home/Layout";
import ServersBar from "./Home/Servers";

import { API_BASE } from "../config"; // ✅ 경로가 다르면 맞춰줘: 예) "../config" or "./config"

const Home = ({ user, onLogout, setUser }) => {
  const navigate = useNavigate();

  const api = useMemo(() => {
    return axios.create({
      baseURL: API_BASE,
      timeout: 15000,
    });
  }, []);

  const handleSelectServer = (server) => {
    console.log("선택된 서버:", server);
    navigate(`/servers/${server.id}`);
  };

  // ✅ 프로필 이미지 업로드: DB 저장 + 전역 user/session 갱신
  const handleUploadProfileImage = useCallback(
    async (file) => {
      if (!file) return;

      const token =
        sessionStorage.getItem("token") || localStorage.getItem("token");

      if (!token) {
        console.warn("토큰이 없어 프로필 업로드를 할 수 없습니다.");
        alert("로그인이 필요합니다.");
        return;
      }

      try {
        const form = new FormData();
        form.append("image", file);

        const res = await api.post("/api/users/me/profile-image", form, {
          headers: {
            Authorization: `Bearer ${token}`,
            // FormData는 Content-Type을 axios가 자동으로 잡아줌
            "ngrok-skip-browser-warning": "true",
          },
          withCredentials: true,
        });

        const relative = res.data?.profileImage; // "/uploads/profiles/..../xxx.png"
        if (!relative) {
          throw new Error("profileImage가 응답에 없습니다.");
        }

        // ✅ user 상태/스토리지 갱신 (상대경로 그대로 저장해도 됨)
        const updatedUser = { ...(user || {}), profileImage: relative };

        sessionStorage.setItem("user", JSON.stringify(updatedUser));
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser?.(updatedUser);

        console.log("✅ 프로필 이미지 업로드 완료:", relative);

        // 친구/서버 멤버 목록은 다음 재조회 때 DB 값을 통해 자동 반영됨.
        // 즉시 갱신을 원하면 여기서 friends fetch / server members fetch를 트리거하면 됨.
      } catch (err) {
        console.error("❌ 프로필 이미지 업로드 실패:", err);
        alert("프로필 이미지 업로드에 실패했습니다.");
      }
    },
    [api, setUser, user]
  );

  return (
    <div className="min-h-screen bg-black flex">
      {/* 알림 기능 전체 */}
      <Notification bellIcon={bellIcon} />

      {/* 친구 / 사이드바 기능 전체 */}
      <Friends
        user={user}
        logo={logo}
        addFriendIcon={addFriendIcon}
        onLogout={onLogout}
        onUploadProfileImage={handleUploadProfileImage}
      />

      {/* 메인 영역 */}
      <div className="flex-1 relative flex justify-center items-center">
        <Layout logo={logo} />
        <ServersBar onSelectServer={handleSelectServer} />
      </div>
    </div>
  );
};

export default Home;
