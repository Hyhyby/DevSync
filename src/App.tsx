import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores';
import { AuthScreen } from './components/AuthScreen';
import { MainLayout } from './components/MainLayout';
import { HomeScreen } from './screens/HomeScreen';
import { ChatScreen } from './screens/ChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import './styles/globals.css';
import './styles/components.css';
import './styles/screens.css';

function App() {
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    // 앱 시작 시 토큰 유효성 검사
    if (token) {
      // TODO: 토큰 유효성 검사 로직 추가
      console.log('토큰이 있습니다:', token);
    }
  }, [token]);

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <Router>
      <div className="app">
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/chat" element={<ChatScreen />} />
            <Route path="/chat/:roomId" element={<ChatScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </MainLayout>
      </div>
    </Router>
  );
}

export default App;
