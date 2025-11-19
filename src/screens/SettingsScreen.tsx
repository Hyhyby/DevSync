import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Lock, 
  Palette, 
  Bell, 
  Shield, 
  LogOut,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../stores';
import { authAPI } from '../services/api';

export const SettingsScreen: React.FC = () => {
  const { user, updateUser, logout } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    nickname: user?.nickname || '',
    email: user?.email || ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const tabs = [
    { id: 'profile', label: '프로필', icon: User },
    { id: 'security', label: '보안', icon: Shield },
    { id: 'appearance', label: '외관', icon: Palette },
    { id: 'notifications', label: '알림', icon: Bell }
  ];

  const handleProfileUpdate = async () => {
    try {
      setLoading(true);
      const response = await authAPI.updateProfile(profileData);
      updateUser(response.data);
      alert('프로필이 업데이트되었습니다.');
    } catch (error: any) {
      console.error('프로필 업데이트 오류:', error);
      alert(error.response?.data?.message || '프로필 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    try {
      setLoading(true);
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      alert('비밀번호가 변경되었습니다.');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      console.error('비밀번호 변경 오류:', error);
      alert(error.response?.data?.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('정말 로그아웃하시겠습니까?')) {
      try {
        await authAPI.logout();
      } catch (error) {
        console.error('로그아웃 오류:', error);
      } finally {
        logout();
      }
    }
  };

  const renderProfileTab = () => (
    <div className="settings-content">
      <h2>프로필 설정</h2>
      <p>계정 정보를 관리하세요.</p>
      
      <div className="form-section">
        <div className="form-group">
          <label htmlFor="username">
            <User size={16} />
            사용자명
          </label>
          <input
            type="text"
            id="username"
            value={user?.username || ''}
            disabled
            className="input"
          />
          <small>사용자명은 변경할 수 없습니다.</small>
        </div>

        <div className="form-group">
          <label htmlFor="email">
            <Mail size={16} />
            이메일
          </label>
          <input
            type="email"
            id="email"
            value={profileData.email}
            onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
            className="input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="nickname">
            <User size={16} />
            닉네임
          </label>
          <input
            type="text"
            id="nickname"
            value={profileData.nickname}
            onChange={(e) => setProfileData(prev => ({ ...prev, nickname: e.target.value }))}
            className="input"
            placeholder="닉네임을 입력하세요"
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleProfileUpdate}
          disabled={loading}
        >
          {loading ? <div className="spinner" /> : <Save size={16} />}
          프로필 저장
        </button>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="settings-content">
      <h2>보안 설정</h2>
      <p>계정 보안을 관리하세요.</p>
      
      <div className="form-section">
        <div className="form-group">
          <label htmlFor="current-password">
            <Lock size={16} />
            현재 비밀번호
          </label>
          <div className="password-input">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              id="current-password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
              className="input"
              placeholder="현재 비밀번호를 입력하세요"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="new-password">
            <Lock size={16} />
            새 비밀번호
          </label>
          <div className="password-input">
            <input
              type={showNewPassword ? 'text' : 'password'}
              id="new-password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              className="input"
              placeholder="새 비밀번호를 입력하세요"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">
            <Lock size={16} />
            새 비밀번호 확인
          </label>
          <input
            type="password"
            id="confirm-password"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            className="input"
            placeholder="새 비밀번호를 다시 입력하세요"
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handlePasswordChange}
          disabled={loading || !passwordData.currentPassword || !passwordData.newPassword}
        >
          {loading ? <div className="spinner" /> : <Lock size={16} />}
          비밀번호 변경
        </button>
      </div>

      <div className="danger-zone">
        <h3>위험 구역</h3>
        <p>이 작업들은 되돌릴 수 없습니다.</p>
        <button
          className="btn btn-danger"
          onClick={handleLogout}
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="settings-content">
      <h2>외관 설정</h2>
      <p>앱의 외관을 사용자 정의하세요.</p>
      
      <div className="form-section">
        <div className="form-group">
          <label>테마</label>
          <div className="theme-options">
            <button
              className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <div className="theme-preview dark"></div>
              <span>다크</span>
            </button>
            <button
              className={`theme-option ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <div className="theme-preview light"></div>
              <span>라이트</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="settings-content">
      <h2>알림 설정</h2>
      <p>알림을 관리하세요.</p>
      
      <div className="form-section">
        <div className="notification-item">
          <div className="notification-info">
            <h3>메시지 알림</h3>
            <p>새 메시지가 올 때 알림을 받습니다.</p>
          </div>
          <label className="toggle">
            <input type="checkbox" defaultChecked />
            <span className="slider"></span>
          </label>
        </div>

        <div className="notification-item">
          <div className="notification-info">
            <h3>사운드 알림</h3>
            <p>알림 소리를 재생합니다.</p>
          </div>
          <label className="toggle">
            <input type="checkbox" defaultChecked />
            <span className="slider"></span>
          </label>
        </div>

        <div className="notification-item">
          <div className="notification-info">
            <h3>데스크톱 알림</h3>
            <p>데스크톱 알림을 표시합니다.</p>
          </div>
          <label className="toggle">
            <input type="checkbox" defaultChecked />
            <span className="slider"></span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="settings-screen">
      <div className="settings-header">
        <h1>설정</h1>
        <p>계정과 앱 설정을 관리하세요</p>
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          <nav className="settings-nav">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={20} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="settings-main">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'security' && renderSecurityTab()}
          {activeTab === 'appearance' && renderAppearanceTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
        </div>
      </div>
    </div>
  );
};
