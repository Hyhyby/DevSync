import axios from 'axios';
import { useAuthStore } from '../stores';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 요청 인터셉터 - 토큰 자동 추가
api.interceptors.request.use(
  (config) => {
    const { token } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 토큰 만료 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 토큰이 만료되었거나 유효하지 않은 경우
      const { logout } = useAuthStore.getState();
      logout();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// 인증 API
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/auth/login', credentials),
  
  register: (userData: { 
    username: string; 
    email: string; 
    nickname: string; 
    password: string; 
  }) =>
    api.post('/auth/register', userData),
  
  logout: () =>
    api.post('/auth/logout'),
  
  getProfile: () =>
    api.get('/users/profile'),
  
  updateProfile: (data: { nickname?: string; profileImage?: string }) =>
    api.put('/users/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/users/password', data),
};

// 채팅 API
export const chatAPI = {
  getChatRooms: () =>
    api.get('/chat/rooms'),
  
  createChatRoom: (data: { 
    name: string; 
    description?: string; 
    type?: 'private' | 'group' | 'public';
    participantIds?: string[];
  }) =>
    api.post('/chat/rooms', data),
  
  joinChatRoom: (roomId: string) =>
    api.post(`/chat/rooms/${roomId}/join`),
  
  getMessages: (roomId: string, page = 1, limit = 50) =>
    api.get(`/chat/rooms/${roomId}/messages`, {
      params: { page, limit }
    }),
  
  sendMessage: (roomId: string, data: { 
    content: string; 
    type?: 'text' | 'image' | 'file' | 'system';
    replyTo?: string;
  }) =>
    api.post(`/chat/rooms/${roomId}/messages`, data),
};

// 사용자 API
export const userAPI = {
  searchUsers: (query: string) =>
    api.get('/users/search', { params: { query } }),
  
  getOnlineUsers: () =>
    api.get('/users/online'),
};

export default api;
