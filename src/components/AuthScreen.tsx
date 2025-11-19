import React, { useState } from 'react';
import { Code, Mail, User, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores';
import { authAPI } from '../services/api';

export const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    nickname: '',
    password: '',
    passwordConfirm: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { login } = useAuthStore();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 에러 메시지 제거
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = '사용자명을 입력해주세요.';
    } else if (formData.username.length < 3) {
      newErrors.username = '사용자명은 3자 이상이어야 합니다.';
    }

    if (!isLogin) {
      if (!formData.email.trim()) {
        newErrors.email = '이메일을 입력해주세요.';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = '올바른 이메일 형식이 아닙니다.';
      }

      if (!formData.nickname.trim()) {
        newErrors.nickname = '닉네임을 입력해주세요.';
      }
    }

    if (!formData.password.trim()) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (formData.password.length < 6) {
      newErrors.password = '비밀번호는 6자 이상이어야 합니다.';
    }

    if (!isLogin && formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isLogin) {
        const response = await authAPI.login({
          username: formData.username,
          password: formData.password
        });
        
        login(response.data.user, response.data.token);
      } else {
        const response = await authAPI.register({
          username: formData.username,
          email: formData.email,
          nickname: formData.nickname,
          password: formData.password
        });
        
        login(response.data.user, response.data.token);
      }
    } catch (error: any) {
      console.error('인증 오류:', error);
      setErrors({ 
        general: error.response?.data?.message || '오류가 발생했습니다.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      username: '',
      email: '',
      nickname: '',
      password: '',
      passwordConfirm: ''
    });
    setErrors({});
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          <div className="logo">
            <Code size={48} />
            <h1>DevSync</h1>
          </div>
          <p>개발자를 위한 데스크톱 메신저</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>{isLogin ? '로그인' : '회원가입'}</h2>
          
          {errors.general && (
            <div className="error-message">
              {errors.general}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">
              <User size={16} />
              사용자명
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="사용자명을 입력하세요"
              className={errors.username ? 'error' : ''}
            />
            {errors.username && (
              <span className="field-error">{errors.username}</span>
            )}
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="email">
                  <Mail size={16} />
                  이메일
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="이메일을 입력하세요"
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && (
                  <span className="field-error">{errors.email}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="nickname">
                  <User size={16} />
                  닉네임
                </label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleInputChange}
                  placeholder="닉네임을 입력하세요"
                  className={errors.nickname ? 'error' : ''}
                />
                {errors.nickname && (
                  <span className="field-error">{errors.nickname}</span>
                )}
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password">
              <Lock size={16} />
              비밀번호
            </label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="비밀번호를 입력하세요"
                className={errors.password ? 'error' : ''}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <span className="field-error">{errors.password}</span>
            )}
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="passwordConfirm">
                <Lock size={16} />
                비밀번호 확인
              </label>
              <input
                type="password"
                id="passwordConfirm"
                name="passwordConfirm"
                value={formData.passwordConfirm}
                onChange={handleInputChange}
                placeholder="비밀번호를 다시 입력하세요"
                className={errors.passwordConfirm ? 'error' : ''}
              />
              {errors.passwordConfirm && (
                <span className="field-error">{errors.passwordConfirm}</span>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading ? (
              <div className="spinner" />
            ) : (
              isLogin ? '로그인' : '회원가입'
            )}
          </button>
        </form>

        <div className="auth-switch">
          <p>
            {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            <button
              type="button"
              className="link-button"
              onClick={toggleMode}
            >
              {isLogin ? '회원가입' : '로그인'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
