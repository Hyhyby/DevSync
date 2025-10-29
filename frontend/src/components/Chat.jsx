import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const Chat = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const socket = io('http://localhost:5000');
    socketRef.current = socket;

    socket.emit('join room', { roomName: roomId, nickname: user.username });

    socket.on('chat message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('system message', (message) => {
      setMessages((prev) => [...prev, { system: true, text: message }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, user.username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    socketRef.current.emit('chat message', { roomName: roomId, message: newMessage });
    setNewMessage('');
  };

  return (
    <div className="min-h-screen bg-discord-dark flex">
      {/* Sidebar */}
      <div className="w-64 bg-discord-darker p-4">
        <button
          onClick={() => navigate('/home')}
          className="text-gray-400 hover:text-white"
        >
          ← Back to Home
        </button>
        <h2 className="text-white font-semibold mt-4">Room: {roomId}</h2>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => {
            if (msg.system) {
              return (
                <div key={index} className="text-center text-gray-400 text-sm">
                  {msg.text}
                </div>
              );
            }

            const isOwn = msg.nickname === user.username;

            return (
              <div
                key={index}
                className={`flex items-start space-x-3 ${
                  isOwn ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {msg.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={`${isOwn ? 'bg-discord-blurple text-white' : 'bg-discord-darkest text-gray-300'} p-3 rounded-lg max-w-xs break-words`}>
                  {!isOwn && (
                    <div className="text-sm font-semibold text-white mb-1">{msg.nickname}</div>
                  )}
                  <div className={isOwn ? 'text-right' : 'text-left'}>{msg.message}</div>
                </div>
                {isOwn && (
                  <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {msg.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-discord-dark">
          <form onSubmit={sendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-3 bg-discord-dark border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-discord-blurple"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-discord-blurple hover:bg-blue-600 rounded text-white font-semibold"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
