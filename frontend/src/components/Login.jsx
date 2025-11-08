// src/pages/Login.jsx
import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import logo from '../../assets/devsync-logo.png';

// ✅ 환경변수로 서버 주소 주입 (없으면 동일 원본)
// 모두 같은 ngrok 서버를 사용하도록 고정
const API_BASE = "https://commensurately-preflagellate-merissa.ngrok-free.dev";


const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ axios 인스턴스 (baseURL 고정)
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE, // 예: http://localhost:5000
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }),
    []
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (loading) return;

      setLoading(true);
      setError('');

      try {
        const endpoint = isLogin ? '/api/login' : '/api/register';
        const { data } = await api.post(endpoint, formData);

        // ✅ 세션 스토리지 저장 (필요없으면 제거 가능)
        if (data?.user) sessionStorage.setItem('user', JSON.stringify(data.user));
        if (data?.token) sessionStorage.setItem('token', data.token);

        // 부모 콜백
        onLogin?.(data.user, data.token);
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          'An error occurred';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [api, formData, isLogin, loading, onLogin]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md p-8 space-y-8">
        {/* ✅ 로고 + 타이틀 */}
        <div className="flex flex-col items-center">
          <img
            src={logo}
            alt="DevSync Logo"
            className="w-48 h-auto mb-4 drop-shadow-[0_0_5px_#F9E4BC]"
          />
        </div>

        {/* ✅ 폼 */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 focus:outline-none focus:ring-yellow-400 focus:border-yellow-400 sm:text-sm"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white bg-gray-800 focus:outline-none focus:ring-yellow-400 focus:border-yellow-400 sm:text-sm"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
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
              className="w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-black bg-yellow-400 hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-50"
            >
              {loading ? 'Loading...' : isLogin ? 'Sign in' : 'Sign up'}
            </button>
          </div>

          <p className="mt-2 text-center text-sm text-gray-400">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => setIsLogin((v) => !v)}
              className="font-medium text-yellow-400 hover:text-yellow-300"
              disabled={loading}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
