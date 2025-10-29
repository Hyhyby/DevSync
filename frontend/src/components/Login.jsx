import { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000'; // ✅ 서버 주소 맞게 변경

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false); // ✅ 로그인/회원가입 모드 전환

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        // ✅ 회원가입 요청
        const res = await axios.post(`${API_BASE}/api/register`, formData);
        const { user, token } = res.data;
        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('token', token);
        onLogin(user, token);
      } else {
        // ✅ 로그인 요청
        const res = await axios.post(`${API_BASE}/api/login`, formData);
        const { user, token } = res.data;
        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('token', token);
        onLogin(user, token);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || '요청 실패';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darkest">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            {isRegisterMode ? '회원가입' : '로그인'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            {isRegisterMode ? '새 계정을 만들어주세요' : '계정이 없나요? 아래에서 가입'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-discord-dark focus:outline-none focus:ring-discord-blurple focus:border-discord-blurple focus:z-10 sm:text-sm"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-discord-dark focus:outline-none focus:ring-discord-blurple focus:border-discord-blurple focus:z-10 sm:text-sm"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-discord-blurple hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-discord-blurple disabled:opacity-50"
            >
              {loading ? '처리 중...' : isRegisterMode ? '회원가입' : '로그인'}
            </button>
          </div>
        </form>

        {/* ✅ 로그인 ↔ 회원가입 전환 버튼 */}
        <div className="text-center mt-4">
          <button
            onClick={() => setIsRegisterMode(!isRegisterMode)}
            className="text-gray-400 hover:text-white text-sm underline"
          >
            {isRegisterMode
              ? '이미 계정이 있으신가요? 로그인으로 이동'
              : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
