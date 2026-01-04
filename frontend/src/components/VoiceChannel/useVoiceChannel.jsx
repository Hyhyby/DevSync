// src/hooks/useVoiceChannel.js
import { useCallback, useEffect, useRef, useState } from "react";

export default function useVoiceChannel(socket) {
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const localStreamRef = useRef(null);
  const pcsRef = useRef(new Map()); // peerId -> RTCPeerConnection

  const ensureMic = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStreamRef.current = stream;
    startSpeakingDetection();
    return stream;
  }, []);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const startSpeakingDetection = useCallback(() => {
    if (!localStreamRef.current) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(localStreamRef.current);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const checkVolume = () => {
      analyser.getByteFrequencyData(data);

      // 평균 볼륨 계산
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;

      // 🔥 임계값 (환경 따라 조절)
      setIsSpeaking(avg > 20);

      requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }, []);

  const cleanupRemoteAudio = useCallback((peerId) => {
    const el = document.getElementById(`remote-audio-${peerId}`);
    if (el) el.remove();
  }, []);

  const closePeer = useCallback(
    (peerId) => {
      const pc = pcsRef.current.get(peerId);
      if (pc) pc.close();
      pcsRef.current.delete(peerId);
      cleanupRemoteAudio(peerId);
    },
    [cleanupRemoteAudio]
  );

  const stopAll = useCallback(() => {
    // 모든 PeerConnection 종료
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();

    // remote audio 제거
    document
      .querySelectorAll('[id^="remote-audio-"]')
      .forEach((el) => el.remove());

    // mic 종료
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const createPC = useCallback(
    (peerId, channelId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      const stream = localStreamRef.current;
      if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit("voice:signal", {
            to: peerId,
            channelId,
            data: { type: "ice", candidate: e.candidate },
          });
        }
      };

      pc.ontrack = (e) => {
        const [remoteStream] = e.streams;

        let audio = document.getElementById(`remote-audio-${peerId}`);
        if (!audio) {
          audio = document.createElement("audio");
          audio.id = `remote-audio-${peerId}`;
          audio.autoplay = true;
          audio.playsInline = true;
          document.body.appendChild(audio);
        }
        audio.srcObject = remoteStream;
      };

      pcsRef.current.set(peerId, pc);
      return pc;
    },
    [socket]
  );

  // ✅ socket 이벤트 핸들러 (훅 내부에서 한번만 등록)
  useEffect(() => {
    if (!socket) return;

    const onPeers = async ({ channelId, peers }) => {
      await ensureMic();

      for (const peerId of peers) {
        const pc = createPC(peerId, channelId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("voice:signal", {
          to: peerId,
          channelId,
          data: { type: "offer", sdp: offer },
        });
      }
    };

    const onSignal = async ({ from, channelId, data }) => {
      await ensureMic();

      let pc = pcsRef.current.get(from);
      if (!pc) pc = createPC(from, channelId);

      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("voice:signal", {
          to: from,
          channelId,
          data: { type: "answer", sdp: answer },
        });
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === "ice") {
        try {
          if (data.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } catch (e) {
          console.warn("addIceCandidate failed:", e);
        }
      }
    };

    const onPeerLeft = ({ peerId }) => {
      closePeer(peerId);
    };

    socket.on("voice:peers", onPeers);
    socket.on("voice:signal", onSignal);
    socket.on("voice:peer-left", onPeerLeft);

    return () => {
      socket.off("voice:peers", onPeers);
      socket.off("voice:signal", onSignal);
      socket.off("voice:peer-left", onPeerLeft);
    };
  }, [socket, ensureMic, createPC, closePeer]);

  // ✅ join/leave API를 ServerPage가 호출
  const joinVoice = useCallback(
    async (channelId) => {
      if (!socket) return;

      const next = String(channelId);

      // ✅ 이미 다른 음성 채널에 있었다면 WebRTC 정리 + 서버 leave 먼저
      if (activeVoiceChannelId && activeVoiceChannelId !== next) {
        socket.emit("leave-voice", { channelId: activeVoiceChannelId });
        stopAll();
      }

      await ensureMic();
      setActiveVoiceChannelId(next);
      socket.emit("join-voice", { channelId: next });
    },
    [socket, ensureMic, activeVoiceChannelId, stopAll]
  );

  const leaveVoice = useCallback(() => {
    if (!socket) return;
    const cid = activeVoiceChannelId;
    if (cid) socket.emit("leave-voice", { channelId: cid });

    setActiveVoiceChannelId(null);
    stopAll();
  }, [socket, activeVoiceChannelId, stopAll]);

  return {
    activeVoiceChannelId,
    joinVoice,
    leaveVoice,
    stopAll, // 필요시
    localStreamRef, // (나중에 mute 구현할 때 사용)
    isSpeaking,
  };
}
