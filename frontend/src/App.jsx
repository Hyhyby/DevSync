import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './components/Login';
import Home from './components/Home';
import Chat from './components/Chat';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const userData = sessionStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('token', token);
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-discord-darkest flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-discord-darkest">
        <Routes>
          {/* ✅ 루트('/')에 바로 로그인 페이지 연결 */}
          <Route path="/" element={<Navigate to="/login" />} />

          <Route
            path="/login"
            element={
              user ? <Navigate to="/home" /> : <Login onLogin={handleLogin} />
            }
          />
          <Route
            path="/home"
            element={
              user ? <Home user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/chat/:roomId"
            element={
              user ? <Chat user={user} /> : <Navigate to="/login" />
            }
          />

          {/* ✅ 잘못된 경로는 로그인으로 */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
