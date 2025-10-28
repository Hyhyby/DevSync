import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './components/Login';
import Home from './components/Home';
import Chat from './components/Chat';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  // 간단한 테스트를 위한 임시 컴포넌트
  const TestComponent = () => (
    <div className="min-h-screen bg-discord-darkest flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-white text-4xl font-bold mb-4">Discord Clone</h1>
        <p className="text-gray-400 mb-8">React 앱이 정상적으로 실행되었습니다!</p>
        <div className="space-y-4">
          <button 
            onClick={() => window.location.href = '/login'}
            className="block w-full max-w-xs mx-auto px-6 py-3 bg-discord-blurple hover:bg-blue-600 rounded text-white font-semibold"
          >
            로그인 페이지로 이동
          </button>
          <button 
            onClick={() => window.location.href = '/home'}
            className="block w-full max-w-xs mx-auto px-6 py-3 bg-discord-green hover:bg-green-600 rounded text-white font-semibold"
          >
            홈 페이지로 이동
          </button>
        </div>
      </div>
    </div>
  );

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
          <Route path="/" element={<TestComponent />} />
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
