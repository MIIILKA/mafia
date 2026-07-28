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
      setMessages((prev) => [...prev, message]);
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

  function handleSendMessage(text) {
    socket.emit("chat-message", { code: room.code, text });
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
      <div className="app-shell">
        {!room && <Home onCreate={handleCreate} onJoin={handleJoin} error={error || kickedNotice} />}

        {room && (
            <VideoGrid
                players={room.players}
                youId={room.you?.id}
                isHostViewer={Boolean(room.you?.isHost)}
                localStream={localStream}
                remoteStreams={remoteStreams}
                showStatusOverlay={room.phase !== "lobby"}
                mediaError={mediaError}
                micOn={micOn}
                camOn={camOn}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                onHostSetStatus={handleHostSetStatus}
                onHostKick={handleHostKick}
                onHostMediaControl={handleHostMediaControl}
            />
        )}

        {room && room.phase === "lobby" && (
            <Lobby room={room} onStart={handleStart} onLeave={handleLeave} error={error} />
        )}
        {room && room.phase !== "lobby" && (
            <Game
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