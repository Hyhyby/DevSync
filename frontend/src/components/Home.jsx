// src/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/devsync-logo.png";
import addFriendIcon from "../../assets/person_add.png";
import bellIcon from "../../assets/notification.png";

import Friends from "./Home/Friends";
import Notification from "./Home/Notification";
import Layout from "./Home/Layout";
import ServersBar from "./Home/Servers";

// user 상태를 업데이트하기 위해 setUser를 props로 받을 수 있다면 가장 좋습니다.
// 여기서는 user 객체와 저장소를 갱신하는 로직을 포함합니다.
const Home = ({ user, onLogout, setUser }) => {
  const navigate = useNavigate();

  const handleSelectServer = (server) => {
    console.log("선택된 서버:", server);
    navigate(`/servers/${server.id}`);
  };

  // ✅ 프로필 이미지 업로드 핸들러 추가
  const handleUploadProfileImage = (file) => {
    if (!file) return;

    // 1. 파일을 읽어서 Base64 문자열로 변환 (서버 없이 로컬 저장용)
    // 실제 백엔드가 있다면 여기서 formData를 API로 전송하면 됩니다.
    const reader = new FileReader();

    reader.onloadend = () => {
      const base64Image = reader.result;

      console.log("이미지 변환 완료, 저장소 업데이트 중...");

      // 2. 현재 user 정보 복사 후 프로필 이미지 업데이트
      // (user가 null일 경우를 대비해 기본값 처리)
      const updatedUser = { ...(user || {}), profileImage: base64Image };

      // 3. localStorage 및 sessionStorage 갱신 (새로고침 시 유지되도록)
      // 기존에 저장된 키값('user' 등)에 맞춰서 저장해주세요.
      localStorage.setItem("user", JSON.stringify(updatedUser));
      sessionStorage.setItem("user", JSON.stringify(updatedUser));

      // 4. 상위 상태(App.js 등) 업데이트 (props로 setUser를 받았다면 실행)
      if (setUser) {
        setUser(updatedUser);
      }

      // 알림 등을 띄우고 싶다면 여기에 추가
      // alert("프로필 이미지가 변경되었습니다.");
    };

    reader.readAsDataURL(file);
  };

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
        // ✅ 여기서 핸들러를 내려줍니다.
        onUploadProfileImage={handleUploadProfileImage}
      />

      {/* ⭐ 메인 영역 Wrapper 추가 ⭐ */}
      <div className="flex-1 relative flex justify-center items-center">
        <Layout logo={logo} />
        {/* 화면 아래 가로 서버 바 */}
        <ServersBar onSelectServer={handleSelectServer} />
      </div>
    </div>
  );
};

export default Home;
