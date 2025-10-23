import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const Chat = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [peers, setPeers] = useState({});
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  
  const messagesEndRef = useRef(null);
  const videoRef = useRef(null);
  const peersRef = useRef({});
  const socketRef = useRef(null);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);
    socketRef.current = newSocket;

    newSocket.emit('join-room', roomId);

    newSocket.on('receive-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('webrtc-signal', (data) => {
      if (peersRef.current[data.from]) {
        peersRef.current[data.from].signal(data.signal);
      }
    });

    newSocket.on('user-disconnected', (userId) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].destroy();
        delete peersRef.current[userId];
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[userId];
          return newPeers;
        });
      }
    });

    return () => {
      newSocket.close();
    };
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const message = {
      text: newMessage,
      userId: user.id,
      username: user.username,
      roomId
    };

    socket.emit('send-message', message);
    setNewMessage('');
  };

  const startVideoCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: isVideoEnabled, 
        audio: isAudioEnabled 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Create peer for each existing user in room
      Object.keys(peers).forEach(userId => {
        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream: stream
        });

        peer.on('signal', signal => {
          socketRef.current.emit('webrtc-signal', {
            signal,
            roomId,
            to: userId
          });
        });

        peer.on('stream', stream => {
          // Handle incoming stream
        });

        peersRef.current[userId] = peer;
      });

    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
  };

  return (
    <div className="min-h-screen bg-discord-darkest flex">
      {/* Sidebar */}
      <div className="w-64 bg-discord-darker flex flex-col">
        <div className="p-4 border-b border-discord-dark">
          <button
            onClick={() => navigate('/home')}
            className="text-gray-400 hover:text-white"
          >
            ← Back to Home
          </button>
          <h2 className="text-white font-semibold mt-2">Room: {roomId}</h2>
        </div>
        
        <div className="flex-1 p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-white font-semibold mb-2">Voice & Video</h3>
              <div className="space-y-2">
                <button
                  onClick={toggleVideo}
                  className={`w-full p-2 rounded text-sm ${
                    isVideoEnabled 
                      ? 'bg-discord-green text-white' 
                      : 'bg-discord-dark text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {isVideoEnabled ? 'Video On' : 'Video Off'}
                </button>
                <button
                  onClick={toggleAudio}
                  className={`w-full p-2 rounded text-sm ${
                    isAudioEnabled 
                      ? 'bg-discord-green text-white' 
                      : 'bg-discord-dark text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {isAudioEnabled ? 'Audio On' : 'Audio Off'}
                </button>
                <button
                  onClick={startVideoCall}
                  className="w-full p-2 bg-discord-blurple hover:bg-blue-600 rounded text-white text-sm"
                >
                  Start Call
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {message.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-semibold">{message.username}</span>
                  <span className="text-gray-400 text-sm">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-300">{message.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Video Area */}
        {isVideoEnabled && (
          <div className="h-48 bg-discord-dark border-t border-discord-dark">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

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
