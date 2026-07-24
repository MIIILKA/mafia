import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { GameManager } from "./game/gameManager.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] }
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
      const room = game.addPlayer(code.toUpperCase(), socket.id, name, token);
      socket.join(room.code);
      cb({ ok: true, code: room.code });
      game.broadcastState(room);
    } catch (err) {
      cb({ ok: false, error: err.message });
    }
  });

  socket.on("rejoin-room", ({ code, token }, cb) => {
    try {
      const room = game.rejoinRoom(code.toUpperCase(), token, socket.id);
      socket.join(room.code);
      cb?.({ ok: true, code: room.code });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("start-game", ({ code }, cb) => {
    try {
      game.startGame(code, socket.id);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("night-action", ({ code, payload }) => {
    const room = game.getRoom(code);
    if (!room) return;
    game.submitNightAction(room, socket.id, payload);
  });

  socket.on("vote", ({ code, targetId }) => {
    const room = game.getRoom(code);
    if (!room) return;
    game.submitVote(room, socket.id, targetId);
  });

  socket.on("chat-message", ({ code, text }) => {
    const room = game.getRoom(code);
    if (!room) return;
    game.addChatMessage(room, socket.id, text);
  });

  // ---- Модерація ведучого ----

  socket.on("host-set-status", ({ code, targetId, status }, cb) => {
    try {
      const room = game.getRoom(code);
      if (!room) throw new Error("Кімнати не існує");
      game.hostSetStatus(room, socket.id, targetId, status);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("host-kick", ({ code, targetId }, cb) => {
    try {
      const room = game.getRoom(code);
      if (!room) throw new Error("Кімнати не існує");
      game.hostKick(room, socket.id, targetId);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("host-media-control", ({ code, targetId, action }, cb) => {
    try {
      const room = game.getRoom(code);
      if (!room) throw new Error("Кімнати не існує");
      game.hostMediaControl(room, socket.id, targetId, action);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  // Простий relay для WebRTC сигналінгу (offer/answer/ice candidate).
  // Сервер лише передає повідомлення напряму між двома гравцями,
  // саме відео/аудіо йде peer-to-peer, не через сервер.
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
