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

  // ✅ Gain 파이프라인용 ref
  const outgoingStreamRef = useRef(null); // RTC로 보낼 stream
  const micGainRef = useRef(null); // GainNode
  const micDestRef = useRef(null); // MediaStreamDestination

  // ✅ 자막 상태 (서버 Whisper 결과)
  const [liveCaption, setLiveCaption] = useState(""); // (우리는 final 위주라 거의 안 씀)
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
  const sttStreamOwnedRef = useRef(false); // ✅ 우리가 별도로 getUserMedia로 만든 stream인지
  const mediaRecorderRef = useRef(null);
  const sttEnabledRef = useRef(false);

  const sttChunksRef = useRef([]); // Blob[]
  const silenceTimerRef = useRef(null); // setTimeout
  const segmentTimerRef = useRef(null); // setInterval
  const sttMimeRef = useRef("audio/webm"); // "audio/webm" or "audio/ogg"
  const sttIntervalRef = useRef(null);

  const pickSupportedMimeType = useCallback(() => {
    // 브라우저마다 지원 mime이 다를 수 있어 fallback 처리
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    for (const t of candidates) {
      if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
    }
    return ""; // 브라우저가 알아서 선택
  }, []);

  const stopWhisperSTT = useCallback(() => {
    sttEnabledRef.current = false;

    if (sttIntervalRef.current) clearInterval(sttIntervalRef.current);
    sttIntervalRef.current = null;

    sttChunksRef.current = [];

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

      // 음소거면 버퍼 버리고 종료(비용 방지)
      if (micMuted) {
        sttChunksRef.current = [];
        return;
      }

      const chunks = sttChunksRef.current;
      if (!chunks.length) return;

      // 한 발화(또는 한 세그먼트)로 합치기
      const mime = sttMimeRef.current || "audio/webm";
      const blob = new Blob(chunks, { type: mime });
      sttChunksRef.current = [];

      if (!blob || blob.size === 0) return;

      const ab = await blob.arrayBuffer();

      socket.emit("voice:audio-chunk", {
        channelId: String(cid),
        mimeType: mime,
        audio: ab, // socket.io 바이너리 전송
        isFinal: true, // ✅ flush 시점만 final
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

    // STT 전용 stream (raw mic)
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

      mr.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        sttChunksRef.current.push(e.data);
      };

      mr.onerror = (e) => console.warn("[STT] MediaRecorder error:", e);

      mr.onstop = async () => {
        try {
          if (!sttEnabledRef.current) return;
          if (micMuted) return; // 비용 방지
          if (!sttChunksRef.current.length) return;

          // ✅ stop까지 모은 chunks -> 하나의 “완전한 파일 blob”
          const blob = new Blob(sttChunksRef.current, {
            type: mr.mimeType || "audio/webm",
          });
          sttChunksRef.current = [];

          const ab = await blob.arrayBuffer();
          const u8 = new Uint8Array(ab);

          socket.emit("voice:audio-chunk", {
            channelId: String(cid),
            mimeType: mr.mimeType || "audio/webm",
            audio: u8, // ✅ Uint8Array로 보내기(서버에서 Buffer.from 가능)
            isFinal: true,
          });
        } catch (err) {
          console.warn("[STT] send failed:", err);
        } finally {
          // ✅ 다음 라운드 다시 시작
          if (sttEnabledRef.current) {
            startRecorderOnce();
          }
        }
      };

      mr.start(); // ✅ timeslice 없이 start
      // ✅ 2초 후 stop -> onstop에서 전송 -> 다시 start
      // (정확도/비용 밸런스: 2000~4000ms 권장)
      setTimeout(() => {
        try {
          if (mr.state !== "inactive") mr.stop();
        } catch {}
      }, 2500);
    };

    startRecorderOnce();
    console.log("[STT] Whisper STT started (stop/restart mode)", { cid });
  }, [socket, pickSupportedMimeType, micMuted]);

  // ✅ VAD 기반 "말 끝" 감지 → 800ms 무음 유지되면 flush
  useEffect(() => {
    if (!activeVoiceChannelIdRef.current) return;
    if (!sttEnabledRef.current) return;

    if (isSpeaking) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      return;
    }

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      flushSttChunks();
    }, 800);
  }, [isSpeaking, flushSttChunks]);

  /* =========================
     ✅ voice:caption 수신
     (서버가 whisper 결과를 이 이벤트로 뿌림)
     ========================= */
  useEffect(() => {
    if (!socket) return;
    const BLOCK_EXACT = new Set([
      "시청해주셔서 감사합니다",
      "시청해주셔서 감사합니다.",
      "시청해주셔서 감사합니다!",
      "구독과 좋아요 부탁드립니다",
    ]);

    const shouldShowCaption = (text) => {
      const t = String(text || "").trim();
      if (!t) return false;
      if (t.length < 2) return false;
      if (t.length > 140) return false;
      if (BLOCK_EXACT.has(t)) return false;
      return true;
    };
    const onCaption = (p) => {
      if (!shouldShowCaption(p?.text)) {
        return; // UI 업데이트 자체를 안 함
      }
      // p: { channelId, fromSocketId, fromUsername, text, isFinal, ts, ... }

      // 내 자막: fromSocketId === socket.id 일 때만 "내 자막"으로 취급
      // (HTTP sttRoutes에서 emit할 때 fromSocketId=null이면 여기서 상대처럼 보이니,
      //  우리는 socket기반 STT만 쓰는 전제로 유지)
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

      // 상대 자막
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
     오디오/RTC/VAD (기존 유지)
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

  // ✅ raw mic -> GainNode -> destination.stream (이 stream을 RTC에 addTrack)
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
      const speaking = rms > 0.03;

      setIsSpeaking((prev) => (prev === speaking ? prev : speaking));
      localVadRafRef.current = requestAnimationFrame(loop);
    };

    loop();
  }, [ensureAudioCtx]);

  // ✅ 마이크 트랙 on/off
  const applyMicMuted = useCallback((muted) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, []);

  // ✅ 원격 오디오 엘리먼트 볼륨 적용
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

  /* =========================
     join/leave (WebSpeech 제거 + Whisper STT 시작/정지)
     ========================= */
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

      // ✅ Whisper STT 시작 (버퍼링 + 말 끝 flush)
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

    // ✅ Whisper STT 정지
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
