# Discord Clone

A minimal Discord-like web application built with React, Node.js, Socket.io, and WebRTC.

## Features

- 🔐 JWT Authentication (Login/Register)
- 💬 Real-time messaging with Socket.io
- 🎥 WebRTC voice/video chat
- 🏠 Home page with server/room list
- 💻 Modern UI with Tailwind CSS

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

## Project Structure

```
discord-clone/
├── backend/
│   ├── package.json
│   ├── server.js
│   └── env.example
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        └── components/
            ├── Login.jsx
            ├── Home.jsx
            └── Chat.jsx
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:

```bash
cd discord-clone/backend
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp env.example .env
```

4. Update the `.env` file with your settings:

```
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

5. Start the backend server:

```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd discord-clone/frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Usage

1. Open `http://localhost:3000` in your browser
2. Register a new account or login with existing credentials
3. Create or join a room from the home page
4. Start chatting and use WebRTC for voice/video calls

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

## Next Steps

- Add database integration (MongoDB/PostgreSQL)
- Implement user presence indicators
- Add file sharing capabilities
- Enhance WebRTC with better error handling
- Add room permissions and moderation features
- Implement message history persistence
