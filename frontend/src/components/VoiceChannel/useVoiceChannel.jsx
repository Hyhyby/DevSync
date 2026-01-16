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
  const [liveCaption, setLiveCaption] = useState(""); // 현재 말하는 중(중간결과)
  const [finalCaption, setFinalCaption] = useState(""); // 말 끝났을 때 확정 텍스트(짧게)
  const [remoteCaptions, setRemoteCaptions] = useState({});
  const recognitionRef = useRef(null);
  const captionTimerRef = useRef(null);
  const activeVoiceChannelIdRef = useRef(null);

  useEffect(() => {
    activeVoiceChannelIdRef.current = activeVoiceChannelId;
  }, [activeVoiceChannelId]);

  const getSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return SR ? new SR() : null;
  };

  const stopRecognition = useCallback(() => {
    try {
      if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
      captionTimerRef.current = null;

      const rec = recognitionRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      }
    } catch {}
    recognitionRef.current = null;
    setLiveCaption("");
  }, []);

  const startRecognition = useCallback(
    ({ lang = "ko-KR" } = {}) => {
      // 중복 시작 방지
      if (recognitionRef.current) return true;

      const rec = getSpeechRecognition();
      if (!rec) return false;

      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event) => {
        let interim = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += text;
          else interim += text;
        }

        // 🔎 interim
        if (interim.trim()) {
          const t = interim.trim();
          console.log("[CAPTION EMIT][INTERIM]", {
            cid: activeVoiceChannelIdRef.current,
            text: t,
          });

          setLiveCaption(t);
          socket?.emit("voice:caption", {
            channelId: activeVoiceChannelIdRef.current,
            text: t,
            isFinal: false,
          });
        }

        // 🔎 final
        if (finalText.trim()) {
          const t = finalText.trim();
          console.log("[CAPTION EMIT][FINAL]", {
            cid: activeVoiceChannelIdRef.current,
            text: t,
          });

          setFinalCaption(t);
          setLiveCaption("");

          socket?.emit("voice:caption", {
            channelId: activeVoiceChannelIdRef.current,
            text: t,
            isFinal: true,
          });

          if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
          captionTimerRef.current = setTimeout(() => setFinalCaption(""), 2500);
        }
      };

      rec.onerror = (e) => {
        // not-allowed / no-speech / network 등 케이스가 있음
        console.warn("[SpeechRecognition] error:", e?.error || e);
      };

      rec.onend = () => {
        if (activeVoiceChannelIdRef.current) {
          try {
            rec.start();
          } catch {}
        }
      };

      try {
        rec.start();
        recognitionRef.current = rec;
        return true;
      } catch (e) {
        console.warn("[SpeechRecognition] start failed:", e);
        return false;
      }
    },
    [activeVoiceChannelId]
  );
  useEffect(() => {
    if (!socket) return;

    const onCaption = (p) => {
      console.log("[CAPTION IN]", p);

      if (p.fromSocketId === socket.id) return;

      setRemoteCaptions((prev) => {
        const cur = prev[p.fromSocketId] || {
          username: p.fromUsername,
          live: "",
          final: "",
        };
        const next = { ...prev };

        if (p.isFinal) {
          next[p.fromSocketId] = {
            ...cur,
            username: p.fromUsername,
            live: "",
            final: p.text,
          };

          setTimeout(() => {
            setRemoteCaptions((pp) => {
              const cc = pp[p.fromSocketId];
              if (!cc) return pp;
              return { ...pp, [p.fromSocketId]: { ...cc, final: "" } };
            });
          }, 2500);
        } else {
          next[p.fromSocketId] = {
            ...cur,
            username: p.fromUsername,
            live: p.text,
          };
        }
        return next;
      });
    };

    socket.on("voice:caption", onCaption);
    return () => socket.off("voice:caption", onCaption);
  }, [socket]);
  useEffect(() => {
    console.log("[REMOTE CAPTIONS STATE]", remoteCaptions);
  }, [remoteCaptions]);

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

      const cid = String(channelId);
      console.log("[JOIN VOICE]", {
        cid,
        socketId: socket.id,
      });

      await ensureMic();
      await ensureMicPipeline();
      applyMicMuted(micMuted);
      await ensureAudioCtx();
      await startLocalVAD();

      setActiveVoiceChannelId(cid);
      activeVoiceChannelIdRef.current = cid;

      socket.emit("join-voice", { channelId: cid });

      startRecognition({ lang: "ko-KR" });
    },
    [
      socket,
      ensureMic,
      ensureMicPipeline,
      ensureAudioCtx,
      startLocalVAD,
      applyMicMuted,
      micMuted,
      startRecognition,
    ]
  );

  const leaveVoice = useCallback(() => {
    if (!socket) return;
    const cid = activeVoiceChannelId;
    if (cid) socket.emit("leave-voice", { channelId: cid });

    setActiveVoiceChannelId(null);
    setMicMuted(false);
    stopAll();
    stopRecognition();
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
    liveCaption,
    finalCaption,
    remoteCaptions,
  };
}
