import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  MessageSquare, 
  Settings, 
  Menu, 
  X,
  User,
  LogOut
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../stores';
import { authAPI } from '../services/api';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, currentScreen, setCurrentScreen } = useUIStore();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      logout();
    } catch (error) {
      console.error('로그아웃 오류:', error);
      logout(); // 오류가 있어도 로컬에서 로그아웃
    }
  };

  const navigationItems = [
    { id: 'home', label: '홈', icon: Home, path: '/home' },
    { id: 'chat', label: '채팅', icon: MessageSquare, path: '/chat' },
    { id: 'settings', label: '설정', icon: Settings, path: '/settings' }
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setCurrentScreen(path.split('/')[1] as 'home' | 'chat' | 'settings');
  };

  return (
    <div className="main-layout">
      {/* 사이드바 */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="user-info">
            <div className="user-avatar">
              <User size={20} />
            </div>
            <div className="user-details">
              <h3>{user?.nickname || user?.username}</h3>
              <span className="status status-online">온라인</span>
            </div>
          </div>
          <button
            className="btn-icon"
            onClick={toggleSidebar}
            title={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavigation(item.path)}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-item logout-btn"
            onClick={handleLogout}
            title="로그아웃"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>로그아웃</span>}
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="main-content">
        <div className="content-wrapper">
          {children}
        </div>
      </div>
    </div>
  );
};
