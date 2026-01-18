// src/Home.jsx
import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import logo from "../../assets/devsync-logo.png";
import addFriendIcon from "../../assets/person_add.png";
import bellIcon from "../../assets/notification.png";

import Friends from "./Home/Friends";
import Notification from "./Home/Notification";
import Layout from "./Home/Layout";
import ServersBar from "./Home/Servers";

// ✅ 여기 경로만 너 프로젝트에 맞춰
// Home.jsx가 src/Home.jsx면 보통 "./config"
// Home.jsx가 src/pages/Home.jsx면 "../config"
import { API_BASE } from "../config";

const Home = ({ user, onLogout, setUser }) => {
  const navigate = useNavigate();

  const handleSelectServer = (server) => {
    navigate(`/servers/${server.id}`);
  };

  const handleUploadProfileImage = useCallback(
    async (file) => {
      if (!file) return;

      const token =
        sessionStorage.getItem("token") || localStorage.getItem("token");

      if (!token) {
        alert("로그인이 필요합니다.");
        return;
      }

      try {
        const form = new FormData();
        form.append("image", file); // ✅ 백엔드 upload.single("image")와 같아야 함

        console.log(
          "📌 업로드 요청:",
          `${API_BASE}/api/users/me/profile-image`,
        );
        console.log("📌 파일:", file.name, file.type, file.size);

        const res = await axios.post(
          `${API_BASE}/api/users/me/profile-image`,
          form,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "ngrok-skip-browser-warning": "true",
            },
            withCredentials: true,
          },
        );

        console.log("✅ 업로드 응답:", res.data);

        const relative = res.data?.profileImage; // "/uploads/profiles/..../xxx.png"
        if (!relative) throw new Error("profileImage가 응답에 없습니다.");

        const updatedUser = { ...(user || {}), profileImage: relative };

        sessionStorage.setItem("user", JSON.stringify(updatedUser));
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser?.(updatedUser);

        console.log("✅ 저장 완료:", updatedUser);
      } catch (err) {
        // ✅ 여기서 실제 이유가 뜸
        console.error("❌ 프로필 업로드 실패:", err);
        console.error("❌ 서버 응답:", err?.response?.data);
        alert(err?.response?.data?.error || "프로필 이미지 업로드 실패");
      }
    },
    [user, setUser],
  );

  return (
    <div className="min-h-screen bg-black flex">
      <Notification bellIcon={bellIcon} />

      <Friends
        user={user}
        logo={logo}
        addFriendIcon={addFriendIcon}
        onLogout={onLogout}
        onUploadProfileImage={handleUploadProfileImage}
      />

      <div className="flex-1 relative flex justify-center items-center">
        <Layout logo={logo} />
        <ServersBar onSelectServer={handleSelectServer} />
      </div>
    </div>
  );
};

export default Home;
