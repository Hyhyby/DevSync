// src/hooks/useVoiceChannel.js
import { useCallback, useEffect, useRef, useState } from "react";

export default function useVoiceChannel(socket) {
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);

  // (기존에 isSpeaking 쓰고 있다면 유지하고 싶어서 기본값만 둠)
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ✅ 상대 speaking: peerSocketId -> boolean
  const [remoteSpeaking, setRemoteSpeaking] = useState({});

  // ✅ 추가: 마이크 음소거, 출력 볼륨
  const [micMuted, setMicMuted] = useState(false);
  const [outputVolume, setOutputVolume] = useState(0.8); // 0.0 ~ 1.0
  const [inputVolume, setInputVolume] = useState(1.0);
  const localStreamRef = useRef(null);
  const pcsRef = useRef(new Map()); // peerId(socketId) -> RTCPeerConnection

  const audioCtxRef = useRef(null);
  const remoteVadRef = useRef(new Map()); // peerId -> { analyser, data, rafId }
  const localVadRafRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const localDataRef = useRef(null);
  // ✅ 추가: Gain 파이프라인용 ref
  const outgoingStreamRef = useRef(null); // RTC로 보낼 stream
  const micGainRef = useRef(null); // GainNode
  const micDestRef = useRef(null); // MediaStreamDestination

  const ensureAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    // 웹 정책 때문에 suspended일 수 있음
    if (audioCtxRef.current.state === "suspended") {
      try {
        await audioCtxRef.current.resume();
      } catch {}
    }
    return audioCtxRef.current;
  }, []);

  const ensureMic = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    localStreamRef.current = stream;
    return stream;
  }, []);
  // ✅ raw mic -> GainNode -> destination.stream (이 stream을 RTC에 addTrack)
  const ensureMicPipeline = useCallback(async () => {
    await ensureMic();
    await ensureAudioCtx();

    // 이미 만들어져 있으면 그대로 사용
    if (outgoingStreamRef.current && micGainRef.current && micDestRef.current) {
      return outgoingStreamRef.current;
    }

    const ctx = audioCtxRef.current;
    const raw = localStreamRef.current;
    if (!ctx || !raw) return null;

    const source = ctx.createMediaStreamSource(raw);

    const gain = ctx.createGain();
    gain.gain.value = inputVolume; // ✅ 입력 볼륨 적용

    const dest = ctx.createMediaStreamDestination();

    source.connect(gain);
    gain.connect(dest);

    micGainRef.current = gain;
    micDestRef.current = dest;
    outgoingStreamRef.current = dest.stream;

    return outgoingStreamRef.current;
  }, [ensureMic, ensureAudioCtx, inputVolume]);

  const cleanupRemoteAudio = useCallback((peerId) => {
    const el = document.getElementById(`remote-audio-${peerId}`);
    if (el) el.remove();
  }, []);

  const stopRemoteVAD = useCallback((peerId) => {
    const obj = remoteVadRef.current.get(peerId);
    if (obj?.rafId) cancelAnimationFrame(obj.rafId);
    remoteVadRef.current.delete(peerId);

    setRemoteSpeaking((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const startRemoteVAD = useCallback(
    async (peerId, remoteStream) => {
      await ensureAudioCtx();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      // 중복 방지
      if (remoteVadRef.current.has(peerId)) return;

      const source = ctx.createMediaStreamSource(remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;

      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteTimeDomainData(data);

        // RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);

        const speaking = rms > 0.03; // 필요하면 조절
        setRemoteSpeaking((prev) => {
          if (prev[peerId] === speaking) return prev;
          return { ...prev, [peerId]: speaking };
        });

        const rafId = requestAnimationFrame(loop);
        remoteVadRef.current.set(peerId, { analyser, data, rafId });
      };

      loop();
    },
    [ensureAudioCtx]
  );

  const startLocalVAD = useCallback(async () => {
    await ensureAudioCtx();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // 이미 돌고 있으면 패스
    if (localVadRafRef.current) return;
    if (!localStreamRef.current) return;

    const source = ctx.createMediaStreamSource(localStreamRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    localAnalyserRef.current = analyser;
    localDataRef.current = data;

    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const speaking = rms > 0.03;

      setIsSpeaking((prev) => (prev === speaking ? prev : speaking));

      localVadRafRef.current = requestAnimationFrame(loop);
    };

    loop();
  }, [ensureAudioCtx]);
  // ✅ 추가: 마이크 트랙 on/off
  const applyMicMuted = useCallback((muted) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, []);
  // ✅ 추가: 원격 오디오 엘리먼트 볼륨 적용
  const applyOutputVolume = useCallback((v) => {
    const vol = Math.max(0, Math.min(1, v));
    document.querySelectorAll('[id^="remote-audio-"]').forEach((el) => {
      el.volume = vol;
    });
  }, []);
  // ✅ micMuted 바뀔 때 즉시 반영
  useEffect(() => {
    applyMicMuted(micMuted);
  }, [micMuted, applyMicMuted]);

  useEffect(() => {
    if (micGainRef.current) {
      micGainRef.current.gain.value = inputVolume;
    }
  }, [inputVolume]);

  // ✅ outputVolume 바뀔 때 즉시 반영
  useEffect(() => {
    applyOutputVolume(outputVolume);
  }, [outputVolume, applyOutputVolume]);

  // createPC의 ontrack에서 remote audio 만들 때도 볼륨 적용되게 한 줄 추가
  // (너 기존 createPC 안의 pc.ontrack 부분에서 audio 만들고 나서 아래 1줄만 추가)
  //
  // audio.volume = outputVolume;
  const stopLocalVAD = useCallback(() => {
    if (localVadRafRef.current) cancelAnimationFrame(localVadRafRef.current);
    localVadRafRef.current = null;
    localAnalyserRef.current = null;
    localDataRef.current = null;
    setIsSpeaking(false);
  }, []);

  const closePeer = useCallback(
    (peerId) => {
      const pc = pcsRef.current.get(peerId);
      if (pc) pc.close();
      pcsRef.current.delete(peerId);
      stopRemoteVAD(peerId);
      cleanupRemoteAudio(peerId);
    },
    [cleanupRemoteAudio, stopRemoteVAD]
  );

  const stopAll = useCallback(() => {
    // PeerConnection 종료
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();

    // remote audio 제거
    document
      .querySelectorAll('[id^="remote-audio-"]')
      .forEach((el) => el.remove());

    // remote VAD 종료
    remoteVadRef.current.forEach((obj) => {
      if (obj?.rafId) cancelAnimationFrame(obj.rafId);
    });
    remoteVadRef.current.clear();
    setRemoteSpeaking({});

    // local VAD 종료
    stopLocalVAD();

    // mic 종료
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, [stopLocalVAD]);

  const createPC = useCallback(
    (peerId, channelId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      const stream = outgoingStreamRef.current || localStreamRef.current;
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
          // 필요하면 숨김 처리 가능
          audio.style.display = "none";
          document.body.appendChild(audio);
        }
        audio.srcObject = remoteStream;
        audio.volume = outputVolume;
        // ✅ 상대 말하기 감지 시작
        startRemoteVAD(peerId, remoteStream);
      };

      pcsRef.current.set(peerId, pc);
      return pc;
    },
    [socket, startRemoteVAD, outputVolume]
  );
  useEffect(() => {
    if (!socket) return;
    if (!activeVoiceChannelId) return;

    socket.emit("voice:mic-muted", {
      channelId: activeVoiceChannelId,
      micMuted,
    });
  }, [socket, activeVoiceChannelId, micMuted]);

  // socket 이벤트 핸들러
  useEffect(() => {
    if (!socket) return;

    const onPeers = async ({ channelId, peers }) => {
      await ensureMic();
      await startLocalVAD();

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
      await startLocalVAD();

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
  }, [socket, ensureMic, createPC, closePeer, startLocalVAD]);

  // join/leave API
  const joinVoice = useCallback(
    async (channelId) => {
      if (!socket) return;
      await ensureMic();
      await ensureMicPipeline();
      applyMicMuted(micMuted);
      await ensureAudioCtx(); // suspended 대비
      await startLocalVAD();

      setActiveVoiceChannelId(String(channelId));
      socket.emit("join-voice", { channelId: String(channelId) });
    },
    [socket, ensureMic, ensureAudioCtx, startLocalVAD, applyMicMuted, micMuted]
  );

  const leaveVoice = useCallback(() => {
    if (!socket) return;
    const cid = activeVoiceChannelId;
    if (cid) socket.emit("leave-voice", { channelId: cid });

    setActiveVoiceChannelId(null);
    setMicMuted(false);
    stopAll();
    outgoingStreamRef.current = null;
    micGainRef.current = null;
    micDestRef.current = null;
  }, [socket, activeVoiceChannelId, stopAll]);

  return {
    activeVoiceChannelId,
    joinVoice,
    leaveVoice,
    stopAll,
    localStreamRef,
    isSpeaking,
    remoteSpeaking, // ✅ 추가
    micMuted,
    setMicMuted,
    outputVolume,
    setOutputVolume,
    inputVolume,
    setInputVolume,
  };
}
