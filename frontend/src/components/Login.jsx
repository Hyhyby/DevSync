// src/pages/Login.jsx
import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import logo from '../../assets/devsync-logo.png';
import { API_BASE } from '../config';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE, // e.g. 'http://127.0.0.1:3000'
        timeout: 10000,
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' },
      }),
    []
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const postWithFallback = useCallback(
    async (paths, payload) => {
      let lastErr;
      for (const p of paths) {
        try {
          const res = await api.post(p, payload);
          return res;
        } catch (e) {
          lastErr = e;
          const status = e?.response?.status;
          if (status && ![404, 405].includes(status)) break;
        }
      }
      throw lastErr;
    },
    [api]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (loading) return;

      const username = formData.username.trim();
      const password = formData.password;

      if (!username || !password) {
        setError('아이디와 비밀번호를 입력하세요.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const endpoints = isLogin
          ? ['/api/auth/login', '/api/login']
          : ['/api/auth/register', '/api/register'];

        const { data } = await postWithFallback(endpoints, { username, password });

        // ✅ accessToken과 refreshToken 저장
        const store = remember ? localStorage : sessionStorage;
        if (data?.user) store.setItem('user', JSON.stringify(data.user));
        if (data?.accessToken) store.setItem('token', data.accessToken);
        if (data?.refreshToken) store.setItem('refreshToken', data.refreshToken);

        onLogin?.(data.user, data.accessToken);
      } catch (err) {
        const status = err?.response?.status;
        const msgFromServer = err?.response?.data?.error || err?.response?.data?.message;

        let msg =
          msgFromServer ||
          (status === 400 ? '아이디 또는 비밀번호가 올바르지 않습니다.' :
            status === 401 ? '인증에 실패했습니다.' :
              status === 403 ? '접근 권한이 없습니다.' :
                status === 404 ? 'API 경로를 찾을 수 없습니다.' :
                  status === 500 ? '서버 오류가 발생했습니다.' :
                    err?.message || '로그인 중 오류가 발생했습니다.');

        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [formData, isLogin, loading, postWithFallback, onLogin, remember]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1B1F24] text-slate-300">
      <div className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="DevSync Logo" className="w-40 h-auto opacity-90" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="sr-only">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="block w-full rounded-[4px] border border-white/12 bg-[#23292F] px-3 py-2 text-[13px] text-slate-200 placeholder-slate-500 outline-none focus:border-slate-300"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="relative">
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              className="block w-full rounded-[4px] border border-white/12 bg-[#23292F] px-3 py-2 pr-10 text-[13px] text-slate-200 placeholder-slate-500 outline-none focus:border-slate-300"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-9 place-items-center text-slate-400 hover:text-slate-200"
              tabIndex={-1}
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-[12px] text-slate-400">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5 rounded-[3px] border-white/20 bg-transparent"
              />
              Remember me
            </label>

            <button
              type="button"
              onClick={() => setIsLogin((v) => !v)}
              className="text-[12px] text-slate-300 hover:text-slate-100"
              disabled={loading}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          {error && <div className="text-rose-400 text-[12px] text-center">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[4px] border border-white/12 bg-slate-400 px-3 py-2 text-[13px] font-semibold text-[#1B1F24] hover:bg-slate-300 disabled:opacity-60"
          >
            {loading ? 'Loading…' : (isLogin ? 'Sign in' : 'Sign up')}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-slate-500">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setIsLogin((v) => !v)}
            className="text-slate-300 hover:text-slate-100 underline underline-offset-4"
            disabled={loading}
          >
            {isLogin ? 'Create one' : 'Use existing'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
