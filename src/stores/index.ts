import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 사용자 상태 관리
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      // 로그인
      login: (userData, token) => {
        set({
          user: userData,
          token,
          isAuthenticated: true
        });
      },
      
      // 로그아웃
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false
        });
      },
      
      // 사용자 정보 업데이트
      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData }
        }));
      }
    }),
    {
      name: 'devsync-auth',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      })
    }
  )
);

// 채팅 상태 관리
export const useChatStore = create((set, get) => ({
  // 채팅방 목록
  chatRooms: [],
  currentRoom: null,
  
  // 메시지들
  messages: {},
  
  // 온라인 사용자들
  onlineUsers: [],
  
  // 타이핑 상태
  typingUsers: {},
  
  // 소켓 연결 상태
  isConnected: false,
  
  // 채팅방 목록 설정
  setChatRooms: (rooms) => {
    set({ chatRooms: rooms });
  },
  
  // 현재 채팅방 설정
  setCurrentRoom: (room) => {
    set({ currentRoom: room });
  },
  
  // 메시지 추가
  addMessage: (roomId, message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: [...(state.messages[roomId] || []), message]
      }
    }));
  },
  
  // 메시지 목록 설정
  setMessages: (roomId, messages) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: messages
      }
    }));
  },
  
  // 온라인 사용자 설정
  setOnlineUsers: (users) => {
    set({ onlineUsers: users });
  },
  
  // 사용자 온라인 상태 업데이트
  updateUserStatus: (userId, status) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.map(user => 
        user.id === userId ? { ...user, status } : user
      )
    }));
  },
  
  // 타이핑 상태 업데이트
  setTypingUsers: (roomId, users) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [roomId]: users
      }
    }));
  },
  
  // 소켓 연결 상태 설정
  setConnected: (connected) => {
    set({ isConnected: connected });
  },
  
  // 채팅방 추가
  addChatRoom: (room) => {
    set((state) => ({
      chatRooms: [...state.chatRooms, room]
    }));
  },
  
  // 채팅방 업데이트
  updateChatRoom: (roomId, updates) => {
    set((state) => ({
      chatRooms: state.chatRooms.map(room =>
        room.id === roomId ? { ...room, ...updates } : room
      )
    }));
  }
}));

// UI 상태 관리
export const useUIStore = create(
  persist(
    (set, get) => ({
      // 현재 화면
      currentScreen: 'home', // 'home', 'chat', 'settings'
      
      // 테마
      theme: 'dark', // 'dark', 'light'
      
      // 사이드바 상태
      sidebarOpen: true,
      
      // 모달 상태
      modals: {
        createRoom: false,
        settings: false,
        profile: false
      },
  
      // 화면 변경
      setCurrentScreen: (screen) => {
        set({ currentScreen: screen });
      },
      
      // 테마 변경
      setTheme: (theme) => {
        set({ theme });
      },
      
      // 사이드바 토글
      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },
      
      // 모달 열기/닫기
      openModal: (modalName) => {
        set((state) => ({
          modals: {
            ...state.modals,
            [modalName]: true
          }
        }));
      },
      
      closeModal: (modalName) => {
        set((state) => ({
          modals: {
            ...state.modals,
            [modalName]: false
          }
        }));
      },
      
      closeAllModals: () => {
        set({
          modals: {
            createRoom: false,
            settings: false,
            profile: false
          }
        });
      }
    }),
    {
      name: 'devsync-ui',
      partialize: (state) => ({ 
        theme: state.theme,
        sidebarOpen: state.sidebarOpen
      })
    }
  )
);

// 알림 상태 관리
export const useNotificationStore = create((set, get) => ({
  notifications: [],
  
  // 알림 추가
  addNotification: (notification) => {
    const id = Date.now().toString();
    const newNotification = {
      id,
      timestamp: new Date(),
      ...notification
    };
    
    set((state) => ({
      notifications: [...state.notifications, newNotification]
    }));
    
    // 5초 후 자동 제거
    setTimeout(() => {
      get().removeNotification(id);
    }, 5000);
  },
  
  // 알림 제거
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },
  
  // 모든 알림 제거
  clearNotifications: () => {
    set({ notifications: [] });
  }
}));
