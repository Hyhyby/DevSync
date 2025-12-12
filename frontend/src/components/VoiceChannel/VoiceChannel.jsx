// src/components/Server/VoiceChannel/VoiceChannel.jsx
import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../../config";
import VoiceChannelUI from "../ui/VoiceChannelUI";

const VoiceChannel = ({ channelId, user }) => {
  const [members, setMembers] = useState([]);
  const socketRef = useRef(null);
  const token = sessionStorage.getItem("token");

  useEffect(() => {
    if (!channelId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.emit("join-voice", { channelId });

    socket.on("voice-members", ({ members }) => {
      setMembers(members);
    });

    return () => {
      socket.emit("leave-voice");
      socket.disconnect();
    };
  }, [channelId, token]);

  return <VoiceChannelUI members={members} />;
};

export default VoiceChannel;
