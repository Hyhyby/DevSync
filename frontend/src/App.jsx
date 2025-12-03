import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "./components/Login";
import Home from "./components/Home";
import ServerPage from "./components/Server/ServerPage";
import DirectMessage from "./components/DM/DirectMessage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔥 새 탭/창에서도 읽을 수 있게 localStorage까지 확인
    const token =
      sessionStorage.getItem("token") || localStorage.getItem("token");
    const userData =
      sessionStorage.getItem("user") || localStorage.getItem("user");

    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        console.warn("USER_PARSE_FAILED");
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);

    // 🔥 둘 다에 저장 (간단 버전)
    const serialized = JSON.stringify(userData);
    sessionStorage.setItem("user", serialized);
    sessionStorage.setItem("token", token);
    localStorage.setItem("user", serialized);
    localStorage.setItem("token", token);
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
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
          {/* 루트('/')는 로그인으로 리다이렉트 */}
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
              user ? (
                <Home user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />

          <Route
            path="/servers/:serverId"
            element={
              user ? <ServerPage user={user} /> : <Navigate to="/login" />
            }
          />

          {/* 🔥 DM 페이지 - 이제 새 창에서도 user가 채워지므로 통과됨 */}
          <Route
            path="/dm/:dmId"
            element={user ? <DirectMessage /> : <Navigate to="/login" />}
          />

          {/* 나머지는 로그인으로 */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
