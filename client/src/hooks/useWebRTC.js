import { useEffect, useRef, useState } from "react";

// TURN потрібен, коли пряме P2P з'єднання неможливе (жорсткий NAT/файрвол).
// Безплатний TURN можна отримати, наприклад, на metered.ca (безплатний тариф ~50GB/міс)
// і прописати дані у client/.env — див. README, розділ "TURN-сервер".
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(import.meta.env.VITE_TURN_URL
      ? [
        {
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL
        }
      ]
      : [])
];

// Перевірка, чи є ICE-кандидат локальним (щоб Chrome не питав дозвіл Local Network Access)
function isLocalCandidate(candidateObj) {
  const cand = candidateObj?.candidate || "";
  return cand.includes(".local") || cand.includes("typ host");
}

// Керує локальною камерою і peer-з'єднаннями з усіма іншими гравцями кімнати.
export function useWebRTC(socket, playerIds, youId, enabled) {
  const [localStream, setLocalStream] = useState(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [mediaError, setMediaError] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const pendingCandidatesRef = useRef({}); // socketId -> RTCIceCandidateInit[]

  // 1. Захопити локальну камеру/мікрофон один раз, коли з'єднання увімкнене.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function acquireMedia() {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        // немає камери, або вона зайнята іншим застосунком — пробуємо тільки звук
      }
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setMediaError("Камеру не знайдено — увімкнено тільки мікрофон");
        return audioOnly;
      } catch (err) {
        setMediaError(
            err.name === "NotFoundError"
                ? "Камеру і мікрофон не знайдено на цьому пристрої"
                : err.message || "Не вдалось отримати доступ до камери/мікрофона"
        );
        return null;
      }
    }

    acquireMedia().then((stream) => {
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCamOn(stream.getVideoTracks().length > 0);
        setMicOn(stream.getAudioTracks().length > 0);
      }
      setMediaReady(true);
    });

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      pendingCandidatesRef.current = {};
    };
  }, [enabled]);

  function createPeerConnection(otherId, isInitiator) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({ ...prev, [otherId]: event.streams[0] }));
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      // Відсікаємо локальні мережеві адреси, щоб Chrome не показував запит доступу до локальної мережі
      if (isLocalCandidate(event.candidate)) return;

      socket.emit("webrtc-signal", {
        to: otherId,
        data: { type: "candidate", payload: event.candidate }
      });
    };

    pc.onconnectionstatechange = () => {
      if (["closed", "failed", "disconnected"].includes(pc.connectionState)) {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[otherId];
          return next;
        });
      }
    };

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-signal", {
            to: otherId,
            data: { type: "offer", payload: offer }
          });
        } catch {
          // ігноруємо гонку негоціації
        }
      };
    }

    peersRef.current[otherId] = pc;
    return pc;
  }

  // 2. Синхронізувати peer-з'єднання зі списком гравців у кімнаті.
  useEffect(() => {
    if (!enabled || !mediaReady || !youId) return;

    const others = playerIds.filter((id) => id !== youId);

    others.forEach((otherId) => {
      if (!peersRef.current[otherId]) {
        const isInitiator = youId < otherId;
        createPeerConnection(otherId, isInitiator);
      }
    });

    Object.keys(peersRef.current).forEach((id) => {
      if (!others.includes(id)) {
        peersRef.current[id].close();
        delete peersRef.current[id];
        delete pendingCandidatesRef.current[id];
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mediaReady, youId, playerIds.join(",")]);

  // 3. Обробка вхідних сигналів.
  useEffect(() => {
    if (!enabled) return;

    async function flushPendingCandidates(from, pc) {
      const queue = pendingCandidatesRef.current[from];
      if (!queue?.length) return;
      delete pendingCandidatesRef.current[from];
      for (const cand of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // ігноруємо невалідний кандидат
        }
      }
    }

    async function handleSignal({ from, data }) {
      let pc = peersRef.current[from];
      if (!pc) {
        pc = createPeerConnection(from, false);
      }

      try {
        if (data.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
          await flushPendingCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc-signal", { to: from, data: { type: "answer", payload: answer } });
        } else if (data.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
          await flushPendingCandidates(from, pc);
        } else if (data.type === "candidate") {
          if (isLocalCandidate(data.payload)) return;
          if (!pc.remoteDescription) {
            pendingCandidatesRef.current[from] = pendingCandidatesRef.current[from] || [];
            pendingCandidatesRef.current[from].push(data.payload);
          } else {
            await pc.addIceCandidate(new RTCIceCandidate(data.payload));
          }
        }
      } catch {
        // ігноруємо помилки негоціації, що виникають при паралельних offer'ах
      }
    }

    socket.on("webrtc-signal", handleSignal);
    return () => socket.off("webrtc-signal", handleSignal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, socket]);

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  function forceMuteMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = false;
    setMicOn(false);
  }

  function forceMuteCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) track.enabled = false;
    setCamOn(false);
  }

  return {
    localStream,
    remoteStreams,
    mediaError,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    forceMuteMic,
    forceMuteCam
  };
}