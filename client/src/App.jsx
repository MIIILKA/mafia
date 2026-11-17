import { useEffect, useMemo, useState } from "react";
import { socket } from "./socket.js";
import { getDeviceToken, saveRoomCode, getSavedRoomCode, clearSavedRoomCode } from "./session.js";
import Home from "./pages/Home.jsx";
import Lobby from "./pages/Lobby.jsx";
import Game from "./pages/Game.jsx";
import VideoGrid from "./components/VideoGrid.jsx";
import { useWebRTC } from "./hooks/useWebRTC.js";
import "./App.scss";

const deviceToken = getDeviceToken();

export default function App() {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [sheriffResult, setSheriffResult] = useState(null);
  const [donResult, setDonResult] = useState(null);
  const [kickedNotice, setKickedNotice] = useState("");
  const [hostNotebook, setHostNotebook] = useState(null);
  const [gestures, setGestures] = useState({});

  const playerIds = useMemo(() => (room ? room.players.map((p) => p.id) : []), [room]);

  const {
    localStream,
    remoteStreams,
    mediaError,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    forceMuteMic,
    forceMuteCam
  } = useWebRTC(socket, playerIds, room?.you?.id, Boolean(room));

  useEffect(() => {
    function handleRoomState(state) {
      setRoom(state);
    }
    function handleChat(message) {
      setMessages((prev) => {
        const isDuplicate = prev.some(
            (m) => m.ts === message.ts && m.author === message.author && m.text === message.text
        );
        return isDuplicate ? prev : [...prev, message];
      });
    }
    function handleSheriffResult(result) {
      setSheriffResult(result);
      setTimeout(() => setSheriffResult(null), 8000);
    }
    function handleDonResult(result) {
      setDonResult(result);
      setTimeout(() => setDonResult(null), 8000);
    }
    function handleKicked() {
      setRoom(null);
      setMessages([]);
      clearSavedRoomCode();
      setKickedNotice("Ведучий вилучив вас із кімнати.");
    }
    function handleForcedMedia({ action }) {
      if (action === "mute-mic") forceMuteMic();
      if (action === "mute-cam") forceMuteCam();
    }
    function handleHostNotebook(notebook) {
      setHostNotebook(notebook);
    }
    function handleGesture({ playerId, gesture }) {
      setGestures((prev) => ({ ...prev, [playerId]: gesture }));
      setTimeout(() => {
        setGestures((prev) => {
          const next = { ...prev };
          if (next[playerId] === gesture) delete next[playerId];
          return next;
        });
      }, 3500);
    }
    function attemptRejoin() {
      const savedCode = getSavedRoomCode();
      if (!savedCode) return;
      socket.emit("rejoin-room", { code: savedCode, token: deviceToken }, (res) => {
        if (!res?.ok) clearSavedRoomCode();
      });
    }

    socket.on("room-state", handleRoomState);
    socket.on("chat-message", handleChat);
    socket.on("sheriff-result", handleSheriffResult);
    socket.on("don-result", handleDonResult);
    socket.on("kicked-from-room", handleKicked);
    socket.on("forced-media-control", handleForcedMedia);
    socket.on("host-notebook", handleHostNotebook);
    socket.on("player-gesture", handleGesture);
    socket.on("connect", attemptRejoin);

    attemptRejoin();

    return () => {
      socket.off("room-state", handleRoomState);
      socket.off("chat-message", handleChat);
      socket.off("sheriff-result", handleSheriffResult);
      socket.off("don-result", handleDonResult);
      socket.off("kicked-from-room", handleKicked);
      socket.off("forced-media-control", handleForcedMedia);
      socket.off("host-notebook", handleHostNotebook);
      socket.off("player-gesture", handleGesture);
      socket.off("connect", attemptRejoin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreate(name) {
    setError("");
    setKickedNotice("");
    socket.emit("create-room", { name, token: deviceToken }, (res) => {
      if (!res.ok) setError(res.error);
      else saveRoomCode(res.code);
    });
  }

  function handleJoin(code, name) {
    setError("");
    setKickedNotice("");
    socket.emit("join-room", { code, name, token: deviceToken }, (res) => {
      if (!res.ok) setError(res.error);
      else saveRoomCode(res.code);
    });
  }

  function handleLeave() {
    if (!room) return;
    socket.emit("leave-room", { code: room.code }, () => {
      setRoom(null);
      setMessages([]);
      clearSavedRoomCode();
    });
  }

  function handleStart() {
    setError("");
    socket.emit("start-game", { code: room.code }, (res) => {
      if (res && !res.ok) setError(res.error);
    });
  }

  function handleSetRoleConfig(config) {
    if (!room) return;
    socket.emit("host-set-role-config", { code: room.code, config });
  }

  function handleTransferHost(targetId) {
    if (!room) return;
    socket.emit("host-transfer-host", { code: room.code, targetId }, (res) => {
      if (res && !res.ok) setError(res.error);
    });
  }

  function handleSendGesture(gesture) {
    if (!room) return;
    socket.emit("player-gesture", { code: room.code, gesture });
  }

  function handleHostSetPhase(phase, extraPayload = {}) {
    if (!room) return;
    socket.emit("host-set-phase", { code: room.code, phase, ...extraPayload });
  }

  function handleNightAction(payload) {
    socket.emit("night-action", { code: room.code, payload });
  }

  function handleVote(targetId) {
    socket.emit("vote", { code: room.code, targetId });
  }

  function handleSendMessage(text, channel = "public") {
    socket.emit("chat-message", { code: room.code, text, channel });
  }

  function handleHostSetStatus(targetId, status) {
    socket.emit("host-set-status", { code: room.code, targetId, status });
  }

  function handleHostKick(targetId) {
    socket.emit("host-kick", { code: room.code, targetId });
  }

  function handleHostMediaControl(targetId, action) {
    socket.emit("host-media-control", { code: room.code, targetId, action });
  }

  return (
      <div className={`app-shell ${room?.phase === "night" ? "app-shell--night" : ""}`}>
        {!room && <Home onCreate={handleCreate} onJoin={handleJoin} error={error || kickedNotice} />}

        {room && (
            <VideoGrid
                players={room.players}
                youId={room.you?.id}
                isHostViewer={Boolean(room.you?.isHost)}
                localStream={localStream}
                remoteStreams={remoteStreams}
                showStatusOverlay={room.phase !== "lobby"}
                currentSpeakerId={room.currentSpeakerId}
                phase={room.phase}
                nightVisibleIds={room.you?.nightVisibleIds}
                gestures={gestures}
                mediaError={mediaError}
                micOn={micOn}
                camOn={camOn}
                canTransferHost={room.phase === "lobby" || room.phase === "ended"}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                onSendGesture={room.you?.alive || room.you?.isHost ? handleSendGesture : null}
                onHostSetStatus={handleHostSetStatus}
                onHostKick={handleHostKick}
                onHostMediaControl={handleHostMediaControl}
                onHostTransferHost={handleTransferHost}
            />
        )}

        {room && room.phase === "lobby" && (
            <Lobby
                onSetRoleConfig={handleSetRoleConfig}
                room={room}
                onStart={handleStart}
                onLeave={handleLeave}
                error={error}
            />
        )}
        {room && room.phase !== "lobby" && (
            <Game
                socket={socket}
                room={room}
                messages={messages}
                sheriffResult={sheriffResult}
                donResult={donResult}
                hostNotebook={hostNotebook}
                onNightAction={handleNightAction}
                onSetPhase={handleHostSetPhase}
                onVote={handleVote}
                onSendMessage={handleSendMessage}
            />
        )}
      </div>
  );
}