import { useState } from 'react';
// import axios from 'axios'; // 추후 인증 로직용

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ===============================
      // 테스트용: 입력값 그대로 로그인
      // 추후 실제 인증 로직을 여기에 넣으면 됩니다
      // ===============================
      /*
      const response = await axios.post('/api/login', formData);
      onLogin(response.data.user, response.data.token);
      */
      onLogin({ username: formData.username, id: formData.username }, 'test-token');
    } catch (err) {
      setError('An error occurred'); // 추후 서버 에러 메시지 처리 가능
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darkest">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in (Test Mode)
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            추후 인증 기능 적용 가능
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
              {loading ? 'Loading...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
