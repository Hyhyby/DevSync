// src/components/Home/Layout.jsx
import React from 'react';

const Layout = ({ logo }) => {
  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <img
          src={logo}
          alt="DevSync Logo"
          className="w-40 h-auto mx-auto mb-4 drop-shadow-[0_0_8px_#F9E4BC]"
        />
        <p className="text-gray-400 mb-6">
          Select a friend from the sidebar to start chatting
        </p>
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
    </main>
  );
};

export default Layout;