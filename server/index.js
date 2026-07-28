import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { GameManager } from "./game/gameManager.js";

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors({ origin: "*" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const game = new GameManager(io);

io.on("connection", (socket) => {
  socket.on("create-room", ({ name, token }, cb) => {
    try {
      const room = game.createRoom(socket.id, name, token);
      socket.join(room.code);
      cb({ ok: true, code: room.code });
      game.broadcastState(room);
    } catch (err) {
      cb({ ok: false, error: err.message });
    }
  });

  socket.on("join-room", ({ code, name, token }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.addPlayer(cleanCode, socket.id, name, token);
      socket.join(room.code);
      cb({ ok: true, code: room.code });
      game.broadcastState(room);
    } catch (err) {
      cb({ ok: false, error: err.message });
    }
  });

  socket.on("leave-room", ({ code }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.getRoom(cleanCode);
      if (room) {
        game.leaveRoom(room, socket.id);
        socket.leave(cleanCode);
      }
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("rejoin-room", ({ code, token }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.rejoinRoom(cleanCode, token, socket.id);
      socket.join(room.code);
      cb?.({ ok: true, code: room.code });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("start-game", ({ code }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      game.startGame(cleanCode, socket.id);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  // 🎙 Передати слово наступному (гравець або ведучий)
  socket.on("pass-speech", ({ code }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.getRoom(cleanCode);
      if (!room) throw new Error("Кімнати не існує");

      // Слово може передати або поточний спікер, або ведучий
      if (socket.id === room.currentSpeakerId || socket.id === room.hostId) {
        game.advanceSpeech(room);
      }
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  // ⏩ Пропустити голосування (ведучий)
  socket.on("skip-voting", ({ code }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.getRoom(cleanCode);
      if (!room) throw new Error("Кімнати не існує");
      game.skipVoting(room, socket.id);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("host-advance-night", ({ code, step }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.getRoom(cleanCode);
      if (!room) throw new Error("Кімнати не існує");
      game.hostAdvanceNight(room, socket.id, step);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("host-set-phase", ({ code, phase }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.getRoom(cleanCode);
      if (!room) throw new Error("Кімнати не існує");
      game.hostSetPhase(room, socket.id, phase);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("night-action", ({ code, payload }) => {
    const cleanCode = code ? code.toUpperCase() : "";
    const room = game.getRoom(cleanCode);
    if (!room) return;
    game.submitNightAction(room, socket.id, payload);
  });

  socket.on("vote", ({ code, targetId }) => {
    const cleanCode = code ? code.toUpperCase() : "";
    const room = game.getRoom(cleanCode);
    if (!room) return;
    game.submitVote(room, socket.id, targetId);
  });

  socket.on("chat-message", ({ code, text }) => {
    const cleanCode = code ? code.toUpperCase() : "";
    const room = game.getRoom(cleanCode);
    if (!room) return;
    game.addChatMessage(room, socket.id, text);
  });

  socket.on("host-set-status", ({ code, targetId, status }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.getRoom(cleanCode);
      if (!room) throw new Error("Кімнати не існує");
      game.hostSetStatus(room, socket.id, targetId, status);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("host-kick", ({ code, targetId }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.getRoom(cleanCode);
      if (!room) throw new Error("Кімнати не існує");
      game.hostKick(room, socket.id, targetId);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("host-media-control", ({ code, targetId, action }, cb) => {
    try {
      const cleanCode = code ? code.toUpperCase() : "";
      const room = game.getRoom(cleanCode);
      if (!room) throw new Error("Кімнати не існує");
      game.hostMediaControl(room, socket.id, targetId, action);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("webrtc-signal", ({ to, data }) => {
    if (!to) return;
    io.to(to).emit("webrtc-signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    game.handleDisconnect(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Mafia server running on port ${PORT}`);
});