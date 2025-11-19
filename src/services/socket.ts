import { io, Socket } from 'socket.io-client';
import { useAuthStore, useChatStore } from '../stores';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    const { token } = useAuthStore.getState();
    
    if (!token) {
      console.error('토큰이 없어 소켓 연결을 할 수 없습니다.');
      return;
    }

    this.socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001', {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    const { setConnected, addMessage, setOnlineUsers, updateUserStatus, setTypingUsers } = useChatStore.getState();

    // 연결 성공
    this.socket.on('connect', () => {
      console.log('소켓 연결됨:', this.socket?.id);
      setConnected(true);
      this.reconnectAttempts = 0;
    });

    // 연결 해제
    this.socket.on('disconnect', () => {
      console.log('소켓 연결 해제됨');
      setConnected(false);
    });

    // 연결 오류
    this.socket.on('connect_error', (error) => {
      console.error('소켓 연결 오류:', error);
      setConnected(false);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          this.connect();
        }, 1000 * this.reconnectAttempts);
      }
    });

    // 새 메시지 수신
    this.socket.on('new_message', (data) => {
      const { message, roomId } = data;
      addMessage(roomId, message);
    });

    // 사용자 온라인 상태 변경
    this.socket.on('user_online', (data) => {
      const { userId, username, nickname } = data;
      updateUserStatus(userId, 'online');
    });

    this.socket.on('user_offline', (data) => {
      const { userId } = data;
      updateUserStatus(userId, 'offline');
    });

    // 채팅방 참여/나가기
    this.socket.on('user_joined_room', (data) => {
      console.log('사용자가 채팅방에 참여:', data);
    });

    this.socket.on('user_left_room', (data) => {
      console.log('사용자가 채팅방에서 나감:', data);
    });

    // 타이핑 상태
    this.socket.on('user_typing', (data) => {
      const { userId, username, nickname, isTyping, roomId } = data;
      
      setTypingUsers(roomId, (prevUsers) => {
        if (isTyping) {
          // 타이핑 중인 사용자 추가
          const existingUser = prevUsers.find(user => user.id === userId);
          if (!existingUser) {
            return [...prevUsers, { id: userId, username, nickname }];
          }
          return prevUsers;
        } else {
          // 타이핑 중이 아닌 사용자 제거
          return prevUsers.filter(user => user.id !== userId);
        }
      });
    });

    // 오류 처리
    this.socket.on('error', (error) => {
      console.error('소켓 오류:', error);
    });
  }

  // 채팅방 참여
  joinRoom(roomId: string) {
    if (this.socket) {
      this.socket.emit('join_room', { roomId });
    }
  }

  // 채팅방 나가기
  leaveRoom(roomId: string) {
    if (this.socket) {
      this.socket.emit('leave_room', { roomId });
    }
  }

  // 메시지 전송
  sendMessage(roomId: string, messageData: { content: string; type?: string; replyTo?: string }) {
    if (this.socket) {
      this.socket.emit('send_message', {
        roomId,
        ...messageData
      });
    }
  }

  // 타이핑 상태 전송
  sendTyping(roomId: string, isTyping: boolean) {
    if (this.socket) {
      this.socket.emit('typing', {
        roomId,
        isTyping
      });
    }
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
