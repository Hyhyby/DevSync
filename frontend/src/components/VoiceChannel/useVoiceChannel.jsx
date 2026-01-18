// src/hooks/useVoiceChannel.js
import { useCallback, useEffect, useRef, useState } from "react";

export default function useVoiceChannel(socket) {
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);

  const [isSpeaking, setIsSpeaking] = useState(false);

  // ✅ 상대 speaking: peerSocketId -> boolean
  const [remoteSpeaking, setRemoteSpeaking] = useState({});

  // ✅ 마이크 음소거, 출력 볼륨
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

  // ✅ Gain 파이프라인용 ref
  const outgoingStreamRef = useRef(null); // RTC로 보낼 stream
  const micGainRef = useRef(null); // GainNode
  const micDestRef = useRef(null); // MediaStreamDestination

  // ✅ 자막 상태 (서버 Whisper 결과)
  const [liveCaption, setLiveCaption] = useState("");
  const [finalCaption, setFinalCaption] = useState(""); // 내 final(짧게)
  const [remoteCaptions, setRemoteCaptions] = useState({}); // 상대들
  const captionTimerRef = useRef(null);

  const activeVoiceChannelIdRef = useRef(null);
  useEffect(() => {
    activeVoiceChannelIdRef.current = activeVoiceChannelId;
  }, [activeVoiceChannelId]);

  /* =========================
     ✅ Whisper(STT) : MediaRecorder (buffer) -> VAD end -> socket.emit("voice:audio-chunk")
     ========================= */
  const sttStreamRef = useRef(null);
  const sttEnabledRef = useRef(false);

  const sttChunksRef = useRef([]); // Blob[]
  const silenceTimerRef = useRef(null); // setTimeout

  // ✅ [수정] 발화 유효성 검사 플래그
  // 버퍼가 쌓이는 동안 "진짜 말소리(RMS 임계값 초과)"가 한 번이라도 있었는지 체크
  const hasSpeakingActivityRef = useRef(false);

  const sttMimeRef = useRef("audio/webm");
  const sttIntervalRef = useRef(null);

  const mediaRecorderRef = useRef(null);

  const pickSupportedMimeType = useCallback(() => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    for (const t of candidates) {
      if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
    }
    return "";
  }, []);

  const stopWhisperSTT = useCallback(() => {
    sttEnabledRef.current = false;

    if (sttIntervalRef.current) clearInterval(sttIntervalRef.current);
    sttIntervalRef.current = null;

    sttChunksRef.current = [];
    hasSpeakingActivityRef.current = false;

    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
    } catch {}
    mediaRecorderRef.current = null;

    try {
      if (sttStreamRef.current) {
        sttStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    sttStreamRef.current = null;

    setLiveCaption("");
    setFinalCaption("");
  }, []);

  const flushSttChunks = useCallback(async () => {
    try {
      if (!socket) return;
      const cid = activeVoiceChannelIdRef.current;
      if (!cid) return;

      // 음소거 상태면 버림
      if (micMuted) {
        sttChunksRef.current = [];
        hasSpeakingActivityRef.current = false;
        return;
      }

      const chunks = sttChunksRef.current;
      if (!chunks.length) return;

      // ✅ [핵심 수정] Whisper 환각 방지 로직
      // 1. 이번 녹음 구간 동안 유의미한 볼륨(VAD)이 감지되지 않았다면 전송하지 않음 (단순 숨소리/배경음 무시)
      if (!hasSpeakingActivityRef.current) {
        console.log(
          "[STT] Skipped flush: No speaking activity detected (Ghost audio prevention)"
        );
        sttChunksRef.current = [];
        return;
      }

      // 2. 블롭 생성
      const mime = sttMimeRef.current || "audio/webm";
      const blob = new Blob(chunks, { type: mime });
      sttChunksRef.current = [];
      hasSpeakingActivityRef.current = false; // 플래그 리셋

      // 3. 파일 크기가 너무 작으면(예: 0.5초 미만 잡음) 무시
      if (blob.size < 1500) {
        console.log("[STT] Skipped flush: Audio too short/small");
        return;
      }

      const ab = await blob.arrayBuffer();

      socket.emit("voice:audio-chunk", {
        channelId: String(cid),
        mimeType: mime,
        audio: ab,
        isFinal: true, // flush 시점은 문장이 끝난 것으로 간주
      });
    } catch (e) {
      console.warn("[STT] flush failed:", e);
    }
  }, [socket, micMuted]);

  const startWhisperSTT = useCallback(async () => {
    if (!socket) return;
    const cid = activeVoiceChannelIdRef.current;
    if (!cid) return;

    if (sttEnabledRef.current) return;
    sttEnabledRef.current = true;

    // STT 전용 stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    sttStreamRef.current = stream;

    const startRecorderOnce = () => {
      if (!sttEnabledRef.current) return;

      const mimeType = pickSupportedMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      sttChunksRef.current = [];
      hasSpeakingActivityRef.current = false; // 시작 시 초기화

      mr.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        sttChunksRef.current.push(e.data);
      };

      mr.onerror = (e) => console.warn("[STT] MediaRecorder error:", e);

      mr.onstop = async () => {
        try {
          if (!sttEnabledRef.current) return;
          if (micMuted) return;
          if (!sttChunksRef.current.length) return;

          // [수정] onstop 시점에도 환각 방지 로직 적용
          if (!hasSpeakingActivityRef.current) {
            sttChunksRef.current = [];
            return;
          }

          const blob = new Blob(sttChunksRef.current, {
            type: mr.mimeType || "audio/webm",
          });
          sttChunksRef.current = [];
          hasSpeakingActivityRef.current = false;

          // 너무 작은 파일 무시
          if (blob.size < 1500) return;

          const ab = await blob.arrayBuffer();
          const u8 = new Uint8Array(ab);

          socket.emit("voice:audio-chunk", {
            channelId: String(cid),
            mimeType: mr.mimeType || "audio/webm",
            audio: u8,
            isFinal: true,
          });
        } catch (err) {
          console.warn("[STT] send failed:", err);
        } finally {
          // 다음 라운드 다시 시작
          if (sttEnabledRef.current) {
            startRecorderOnce();
          }
        }
      };

      mr.start();
      // 안전장치: 3초가 지나면 강제로 잘라서 전송 (너무 길어지는 것 방지)
      setTimeout(() => {
        try {
          if (mr.state !== "inactive") mr.stop();
        } catch {}
      }, 2000);
    };

    startRecorderOnce();
    console.log("[STT] Whisper STT started (Ghost protection enabled)", {
      cid,
    });
  }, [socket, pickSupportedMimeType, micMuted]);

  // ✅ VAD 기반 "말 끝" 감지 → 무음 유지되면 flush
  useEffect(() => {
    if (!activeVoiceChannelIdRef.current) return;
    if (!sttEnabledRef.current) return;

    // 말하고 있는 중이면 타이머 해제 (계속 녹음)
    if (isSpeaking) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;

      // ✅ [수정] 말하는 중이라고 감지되면, 이번 청크는 "유효함"으로 마킹
      hasSpeakingActivityRef.current = true;
      return;
    }

    // ✅ [수정] 무음 감지 조건을 더 어렵게(길게) 설정
    // 기존 800ms -> 1500ms (1.5초)
    // 이유: 잠깐 생각하느라 1초 정도 멈췄을 때 문장이 잘리는 것을 방지
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      flushSttChunks();
    }, 1500);
  }, [isSpeaking, flushSttChunks]);

  /* =========================
     ✅ voice:caption 수신
     ========================= */
  useEffect(() => {
    if (!socket) return;

    const onCaption = (p) => {
      if (p?.fromSocketId && p.fromSocketId === socket.id) {
        if (p.isFinal && p.text?.trim()) {
          setFinalCaption(p.text.trim());
          setLiveCaption("");
          if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
          captionTimerRef.current = setTimeout(() => setFinalCaption(""), 2500);
        } else if (!p.isFinal && p.text?.trim()) {
          setLiveCaption(p.text.trim());
        }
        return;
      }

      const key = p.fromSocketId || String(p.fromUserId || "unknown");
      setRemoteCaptions((prev) => {
        const cur = prev[key] || {
          username: p.fromUsername,
          live: "",
          final: "",
        };
        const next = { ...prev };

        if (p.isFinal) {
          next[key] = {
            ...cur,
            username: p.fromUsername,
            live: "",
            final: p.text,
          };

          setTimeout(() => {
            setRemoteCaptions((pp) => {
              const cc = pp[key];
              if (!cc) return pp;
              return { ...pp, [key]: { ...cc, final: "" } };
            });
          }, 2500);
        } else {
          next[key] = { ...cur, username: p.fromUsername, live: p.text };
        }
        return next;
      });
    };

    socket.on("voice:caption", onCaption);
    return () => socket.off("voice:caption", onCaption);
  }, [socket]);

  /* =========================
     오디오/RTC/VAD
     ========================= */
  const ensureAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
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

  const ensureMicPipeline = useCallback(async () => {
    await ensureMic();
    await ensureAudioCtx();

    if (outgoingStreamRef.current && micGainRef.current && micDestRef.current) {
      return outgoingStreamRef.current;
    }

    const ctx = audioCtxRef.current;
    const raw = localStreamRef.current;
    if (!ctx || !raw) return null;

    const source = ctx.createMediaStreamSource(raw);
    const gain = ctx.createGain();
    gain.gain.value = inputVolume;
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

      if (remoteVadRef.current.has(peerId)) return;

      const source = ctx.createMediaStreamSource(remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);

        // 상대방은 좀 더 민감하게(0.03) 보여줘도 됨
        const speaking = rms > 0.03;
        setRemoteSpeaking((prev) =>
          prev[peerId] === speaking ? prev : { ...prev, [peerId]: speaking }
        );

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

      // ✅ [수정] VAD 임계값 상향 조정 (0.03 -> 0.05)
      // 배경 소음이나 작은 숨소리는 무시하고, 확실히 말할 때만 인식하도록 함
      const speaking = rms > 0.05;

      setIsSpeaking((prev) => (prev === speaking ? prev : speaking));

      // 만약 말하고 있다면 플래그 세팅 (Whisper 전송 허용)
      if (speaking) {
        hasSpeakingActivityRef.current = true;
      }

      localVadRafRef.current = requestAnimationFrame(loop);
    };

    loop();
  }, [ensureAudioCtx]);

  const applyMicMuted = useCallback((muted) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, []);

  const applyOutputVolume = useCallback((v) => {
    const vol = Math.max(0, Math.min(1, v));
    document.querySelectorAll('[id^="remote-audio-"]').forEach((el) => {
      el.volume = vol;
    });
  }, []);

  useEffect(() => {
    applyMicMuted(micMuted);
  }, [micMuted, applyMicMuted]);

  useEffect(() => {
    if (micGainRef.current) micGainRef.current.gain.value = inputVolume;
  }, [inputVolume]);

  useEffect(() => {
    applyOutputVolume(outputVolume);
  }, [outputVolume, applyOutputVolume]);

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
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();

    document
      .querySelectorAll('[id^="remote-audio-"]')
      .forEach((el) => el.remove());

    remoteVadRef.current.forEach((obj) => {
      if (obj?.rafId) cancelAnimationFrame(obj.rafId);
    });
    remoteVadRef.current.clear();
    setRemoteSpeaking({});

    stopLocalVAD();

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
          audio.style.display = "none";
          document.body.appendChild(audio);
        }
        audio.srcObject = remoteStream;
        audio.volume = outputVolume;

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
          if (data.candidate)
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn("addIceCandidate failed:", e);
        }
      }
    };

    const onPeerLeft = ({ peerId }) => closePeer(peerId);

    socket.on("voice:peers", onPeers);
    socket.on("voice:signal", onSignal);
    socket.on("voice:peer-left", onPeerLeft);

    return () => {
      socket.off("voice:peers", onPeers);
      socket.off("voice:signal", onSignal);
      socket.off("voice:peer-left", onPeerLeft);
    };
  }, [socket, ensureMic, createPC, closePeer, startLocalVAD]);

  const joinVoice = useCallback(
    async (channelId) => {
      if (!socket) return;

      const cid = String(channelId);
      console.log("[JOIN VOICE]", { cid, socketId: socket.id });

      await ensureMic();
      await ensureMicPipeline();
      applyMicMuted(micMuted);
      await ensureAudioCtx();
      await startLocalVAD();

      setActiveVoiceChannelId(cid);
      activeVoiceChannelIdRef.current = cid;

      socket.emit("join-voice", { channelId: cid });

      try {
        await startWhisperSTT();
      } catch (e) {
        console.warn("[STT] startWhisperSTT failed:", e);
      }
    },
    [
      socket,
      ensureMic,
      ensureMicPipeline,
      ensureAudioCtx,
      startLocalVAD,
      applyMicMuted,
      micMuted,
      startWhisperSTT,
    ]
  );

  const leaveVoice = useCallback(() => {
    if (!socket) return;
    const cid = activeVoiceChannelId;
    if (cid) socket.emit("leave-voice", { channelId: cid });

    setActiveVoiceChannelId(null);
    setMicMuted(false);

    stopWhisperSTT();

    stopAll();

    outgoingStreamRef.current = null;
    micGainRef.current = null;
    micDestRef.current = null;
  }, [socket, activeVoiceChannelId, stopAll, stopWhisperSTT]);

  return {
    activeVoiceChannelId,
    joinVoice,
    leaveVoice,
    stopAll,
    localStreamRef,
    isSpeaking,
    remoteSpeaking,
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
