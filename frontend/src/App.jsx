import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React, { useState, useEffect } from "react";
import Login from './components/Login';
import Home from './components/Home';
import Chat from './components/Chat';
import { io } from "socket.io-client";

/**
 * Vite/HMR 환경에서는 모듈이 여러 번 실행되어 socket이 중복 연결되는 경우가 있음.
 * window.__socket을 사용해 이미 생성된 소켓이 있으면 재사용하도록 함.
 */
const SOCKET_URL = "http://localhost:5000";
const socket = (typeof window !== "undefined")
  ? (window.__socket || (window.__socket = io(SOCKET_URL)))
  : io(SOCKET_URL);

function App() {
  const [nickname, setNickname] = useState("");
  const [room, setRoom] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 마운트 시 localStorage에서 사용자 복원 및 로딩 해제
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        // 필요 시 토큰 검증 로직 추가 가능
      }
    } catch (err) {
      // parsing 실패 등 예외 무시
      console.warn("Failed to restore user from localStorage", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 소켓 이벤트 등록 (한 번만)
  useEffect(() => {
    const onChatMessage = ({ nickname: from, message: msg }) => {
      setMessages((prev) => [...prev, `${from}: ${msg}`]);
    };

    const onSystemMessage = (msg) => {
      setMessages((prev) => [...prev, `💬 ${msg}`]);
    };

    socket.on("chat message", onChatMessage);
    socket.on("system message", onSystemMessage);

    // 언마운트 시 정리
    return () => {
      socket.off("chat message", onChatMessage);
      socket.off("system message", onSystemMessage);
    };
  }, []); // 빈 배열: 마운트/언마운트 시 한 번만 실행

  const joinRoom = () => {
    const roomName = room?.trim();
    const nick = nickname?.trim();
    if (!roomName || !nick) return;
    socket.emit("join room", { roomName, nickname: nick });
    setJoinedRoom(roomName);
    setMessages([]);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message?.trim() || !joinedRoom) return;

    socket.emit("chat message", { roomName: joinedRoom, message: message.trim() });
    setMessage("");
  };

  const handleLogin = (userData, token) => {
    setUser(userData);
    try {
      localStorage.setItem('user', JSON.stringify(userData));
      if (token) localStorage.setItem('token', token);
    } catch (err) {
      console.warn("localStorage set error", err);
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch (err) {
      console.warn("localStorage remove error", err);
    }
  };

  // 간단한 테스트를 위한 임시 컴포넌트
  const TestComponent = () => (
    <div className="min-h-screen bg-discord-darkest flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-white text-4xl font-bold mb-4">Discord Clone</h1>
        <p className="text-gray-400 mb-8">React 앱이 정상적으로 실행되었습니다!</p>
        <div className="space-y-4">
          <button 
            onClick={() => window.location.href = '/home'}
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
          {/* Chat 컴포넌트가 socket을 필요로 한다면 props로 전달 */}
          <Route 
            path="/chat/:roomId" 
            element={
              user ? <Chat user={user} socket={socket} /> : <Navigate to="/login" />
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
