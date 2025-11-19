// src/Home.jsx  (또는 src/pages/Home.jsx 인 프로젝트 구조에 맞게)
import React from 'react';

import logo from '../../assets/devsync-logo.png';
import addFriendIcon from '../../assets/person_add.png';
import bellIcon from '../../assets/notification.png';

import Friends from './Home/Friends';
import Notification from './Home/Notification';
import Layout from './Home/Layout';

const Home = ({ user, onLogout }) => {
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

      {/* 가운데 소개 화면 */}
      <Layout logo={logo} />
    </div>
  );
};

export default Home;