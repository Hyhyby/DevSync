import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Home = ({ user, onLogout }) => {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRooms(response.data);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/rooms', 
        { name: newRoomName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setRooms([...rooms, response.data]);
      setNewRoomName('');
      setShowCreateRoom(false);
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const joinRoom = (roomId) => {
    navigate(`/chat/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-discord-darkest flex">
      {/* Sidebar */}
      <div className="w-64 bg-discord-darker flex flex-col">
        <div className="p-4 border-b border-discord-dark">
          <h1 className="text-white text-xl font-bold">Discord Clone</h1>
          <p className="text-gray-400 text-sm">Welcome, {user.username}</p>
        </div>
        
        <div className="flex-1 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold">Rooms</h2>
            <button
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              className="text-discord-blurple hover:text-blue-300 text-xl"
            >
              +
            </button>
          </div>
          
          {showCreateRoom && (
            <form onSubmit={createRoom} className="mb-4">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className="w-full p-2 bg-discord-dark border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-discord-blurple"
                autoFocus
              />
            </form>
          )}
          
          <div className="space-y-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => joinRoom(room.id)}
                className="w-full text-left p-2 rounded hover:bg-discord-dark text-gray-300 hover:text-white transition-colors"
              >
                # {room.name}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-discord-dark">
          <button
            onClick={onLogout}
            className="w-full p-2 bg-discord-red hover:bg-red-600 rounded text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Welcome to Discord Clone</h2>
          <p className="text-gray-400 mb-8">Select a room from the sidebar to start chatting</p>
          <div className="text-gray-500">
            <p>Features:</p>
            <ul className="mt-2 space-y-1">
              <li>• Real-time messaging</li>
              <li>• WebRTC voice/video chat</li>
              <li>• JWT authentication</li>
              <li>• Socket.io integration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
