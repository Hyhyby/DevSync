// src/Home.jsx  (또는 src/pages/Home.jsx 인 프로젝트 구조에 맞게)
import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/devsync-logo.png";
import addFriendIcon from "../../assets/person_add.png";
import bellIcon from "../../assets/notification.png";

import Friends from "./Home/Friends";
import Notification from "./Home/Notification";
import Layout from "./Home/Layout";
import ServersBar from "./Home/Servers";

const Home = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const handleSelectServer = (server) => {
    console.log("선택된 서버:", server);
    navigate(`/servers/${server.id}`);
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
