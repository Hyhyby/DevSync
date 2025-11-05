# Discord Clone

A minimal Discord-like application built with React, Node.js, Socket.io, and WebRTC. Available as both web and desktop app (Electron).

## Features

- 🔐 JWT Authentication (Login/Register)
- 💬 Real-time messaging with Socket.io
- 🎥 WebRTC voice/video chat
- 🏠 Home page with server/room list
- 💻 Modern UI with Tailwind CSS
- 🖥️ Desktop app with Electron

## Tech Stack

### Frontend

- React 18
- React Router DOM
- Tailwind CSS
- Socket.io Client
- Simple Peer (WebRTC)

### Backend

- Node.js + Express
- Socket.io
- JWT Authentication
- bcryptjs for password hashing

### Desktop

- Electron
- electron-builder

## Project Structure

```
discord-clone/
├── backend/
│   ├── package.json
│   ├── server.js
│   └── env.example
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── components/
│           ├── Login.jsx
│           ├── Home.jsx
│           └── Chat.jsx
└── electron/
    ├── main.js
    └── preload.js
```

## Setup Instructions

### Full Setup

```bash
# Install all dependencies
npm run install-all

# Or manually
cd backend && npm install
cd ../frontend && npm install
cd .. && npm install
```

### Web App (Development)

#### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create environment file:
```bash
copy env.example .env
```

3. Update the `.env` file with your settings:
```
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

4. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

#### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

#### Using Batch Files (Windows)

You can use the provided batch files to manage servers:

- `start-servers.bat` - Start all servers
- `서버관리자.bat` - Server management menu
- `로그뷰어.bat` - Log viewer

### Desktop App (Electron)

#### Development Mode

Run the Electron app with hot reload:

```bash
# Start Electron app (automatically starts backend and frontend servers)
start-electron.bat

# Or using npm
npm run electron-dev
```

#### Build Desktop App

Build and package the app for distribution:

```bash
# Build for Windows
build-electron.bat

# Or using npm
npm run build-frontend
npm run dist-win
```

The installer will be created in the `dist` folder.

## Usage

### Web App

1. Open `http://localhost:3000` in your browser
2. Register a new account or login with existing credentials
3. Create or join a room from the home page
4. Start chatting and use WebRTC for voice/video calls

### Desktop App

1. Run `start-electron.bat` or `npm run electron-dev`
2. The Electron app will open automatically
3. Use it just like the web version

## API Endpoints

### Authentication

- `POST /api/register` - Register new user
- `POST /api/login` - Login user

### Rooms

- `GET /api/rooms` - Get all rooms (requires auth)
- `POST /api/rooms` - Create new room (requires auth)

### Socket.io Events

- `join-room` - Join a chat room
- `send-message` - Send a message
- `webrtc-signal` - WebRTC signaling

## Development Notes

- The app uses in-memory storage for users and rooms (replace with database in production)
- JWT tokens are stored in localStorage
- WebRTC implementation is basic and may need enhancement for production use
- CORS is configured for localhost development
- Electron app runs backend server internally
- In production build, the app includes both backend and frontend

## Build Commands

```bash
# Web development
npm run dev                    # Start backend and frontend
npm run start-backend          # Start only backend
npm run start-frontend         # Start only frontend

# Electron development
npm run electron-dev           # Start Electron app with hot reload
npm run electron               # Start Electron app

# Build
npm run build-frontend         # Build frontend for production
npm run dist                   # Build Electron app for all platforms
npm run dist-win               # Build Electron app for Windows
```

## Next Steps

- Add database integration (MongoDB/PostgreSQL)
- Implement user presence indicators
- Add file sharing capabilities
- Enhance WebRTC with better error handling
- Add room permissions and moderation features
- Implement message history persistence
- Add notification system
- Implement dark/light theme toggle