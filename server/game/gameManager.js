import { customAlphabet } from "nanoid";
import { buildRoleDeck, ROLE_INFO, MAFIA_TEAM_ROLES } from "./roles.js";

const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export const PHASE = {
  LOBBY: "lobby",
  NIGHT: "night",
  DISCUSSION: "discussion", // "балаган" — вільне обговорення
  SPEECHES: "speeches", // черга виступів по колу
  VOTING: "voting",
  ENDED: "ended"
};

export const STATUS = {
  ALIVE: "alive",
  KILLED: "killed", // вбитий мафією вночі (або вручну ведучим)
  BANISHED: "banished" // вигнаний голосуванням вдень (або вручну ведучим)
};

const DISCUSSION_SECONDS = 20;
const SPEECH_SECONDS = 30;
const VOTING_SECONDS = 30;
const RECONNECT_GRACE_MS = 60_000;

export class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // code -> room
  }

  createRoom(hostSocketId, hostName, token) {
    let code;
    do {
      code = genCode();
    } while (this.rooms.has(code));

    const room = {
      code,
      hostId: hostSocketId,
      phase: PHASE.LOBBY,
      players: new Map(), // socketId -> player
      tokenIndex: new Map(), // token -> socketId
      disconnectTimers: new Map(), // socketId -> Timeout
      nightActions: {},
      nightStep: null, // "sleep" | "mafia" | "don" | "doctor" | "sheriff"
      nightActiveIds: [], // хто зараз "не спить"
      seatOrder: [], // стабільний порядок гравців
      speakerQueue: [],
      speakerIndex: 0,
      currentSpeakerId: null,
      leaderId: null,
      votes: {},
      dayNumber: 0,
      log: [],
      nightHistory: [], // блокнотик ведучого
      timer: null,
      timerEndsAt: null
    };

    this.rooms.set(code, room);
    this.addPlayer(code, hostSocketId, hostName, token);

    const host = room.players.get(hostSocketId);
    host.role = "host";

    return room;
  }

  addPlayer(code, socketId, name, token) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("Кімнати не існує");
    if (room.phase !== PHASE.LOBBY) throw new Error("Гра вже почалась");
    if ([...room.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Це ім'я вже зайняте в кімнаті");
    }

    room.players.set(socketId, {
      id: socketId,
      name,
      token,
      role: null,
      isMafiaLeader: false,
      status: STATUS.ALIVE,
      isHost: socketId === room.hostId,
      disconnected: false
    });
    if (token) room.tokenIndex.set(token, socketId);

    return room;
  }

  leaveRoom(room, socketId) {
    if (!room.players.has(socketId)) throw new Error("Вас немає в цій кімнаті");
    if (room.phase !== PHASE.LOBBY) throw new Error("Вийти можна тільки поки гра не почалась");
    this.finalizeRemoval(room, socketId);
  }

  rejoinRoom(code, token, newSocketId) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("Кімнати не існує");
    if (!token) throw new Error("Немає токена сесії");

    const oldSocketId = room.tokenIndex.get(token);
    const player = oldSocketId ? room.players.get(oldSocketId) : null;
    if (!player) throw new Error("Сесію не знайдено");

    if (oldSocketId !== newSocketId) {
      room.players.delete(oldSocketId);
      player.id = newSocketId;
      room.players.set(newSocketId, player);
      room.tokenIndex.set(token, newSocketId);
      if (room.hostId === oldSocketId) room.hostId = newSocketId;
    }
    player.disconnected = false;

    const timer = room.disconnectTimers.get(oldSocketId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(oldSocketId);
    }

    this.broadcastState(room);
    this.broadcastHostNotebook(room);
    return room;
  }

  handleDisconnect(socketId) {
    for (const room of this.rooms.values()) {
      const player = room.players.get(socketId);
      if (!player) continue;

      player.disconnected = true;
      this.broadcastState(room);

      const timer = setTimeout(() => {
        const stillThere = room.players.get(socketId);
        if (stillThere && stillThere.disconnected) {
          this.finalizeRemoval(room, socketId);
        }
      }, RECONNECT_GRACE_MS);
      room.disconnectTimers.set(socketId, timer);
      return;
    }
  }

  finalizeRemoval(room, socketId) {
    const player = room.players.get(socketId);
    if (!player) return;

    room.players.delete(socketId);
    if (player.token) room.tokenIndex.delete(player.token);
    room.disconnectTimers.delete(socketId);

    if (room.players.size === 0) {
      this.clearTimer(room);
      this.rooms.delete(room.code);
      return;
    }

    if (room.hostId === socketId) {
      const next = room.players.keys().next().value;
      room.hostId = next;
      const newHost = room.players.get(next);
      newHost.isHost = true;
      newHost.role = "host";
    }

    room.log.push(`Гравець ${player.name} вийшов з гри.`);

    if (room.phase !== PHASE.LOBBY && room.phase !== PHASE.ENDED) {
      if (this.checkWinCondition(room)) return;
    }
    this.broadcastState(room);
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  isPlayerAlive(player) {
    return Boolean(player) && player.status === STATUS.ALIVE;
  }

  isMafiaTeam(player) {
    return Boolean(player) && MAFIA_TEAM_ROLES.includes(player.role);
  }

  gamePlayers(room) {
    return [...room.players.values()].filter((p) => !p.isHost);
  }

  startGame(code, requesterId) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("Кімнати не існує");
    if (room.hostId !== requesterId) throw new Error("Тільки ведучий може почати гру");

    const participants = this.gamePlayers(room);

    // 🟢 Мінімальна кількість гравців: 7 (без ведучого)
    if (participants.length < 7) {
      throw new Error("Для гри зі спецролями (Дон, Мафія, Шериф, Лікар, 3 Мирні) потрібно щонайменше 7 гравців!");
    }

    // 🔴 2 Мафії (Дон + 1 Мафія), 🟢 5 Мирних (Шериф + Лікар + 3 Citizen)
    let roles = ["don", "mafia", "sheriff", "doctor", "citizen", "citizen", "citizen"];

    // Якщо гравців більше 7 (наприклад 8, 9 і т.д.), додаємо звичайних мирних жителів
    while (roles.length < participants.length) {
      roles.push("citizen");
    }

    // Перемішуємо ролі
    const shuffledRoles = roles.sort(() => Math.random() - 0.5);

    participants.forEach((p, i) => {
      p.role = shuffledRoles[i];
      p.status = STATUS.ALIVE;
      p.isMafiaLeader = false;
    });

    const don = participants.find((p) => p.role === "don");
    const leader = don || participants.find((p) => p.role === "mafia");
    if (leader) {
      leader.isMafiaLeader = true;
      room.leaderId = leader.id;
    }

    room.seatOrder = participants.map((p) => p.id);
    room.dayNumber = 1;
    room.log = [`Гра почалась. Гравців: ${participants.length}.`];
    room.nightHistory = [];

    this.enterDiscussion(room);
  }
  // ---------- Ніч: керується ведучим покроково ----------

  enterNight(room) {
    room.phase = PHASE.NIGHT;
    room.nightActions = {};
    room.nightStep = "sleep";
    room.nightActiveIds = [];

    // Записуємо нову ніч в історію блокнота
    room.nightHistory.push({
      day: room.dayNumber,
      mafiaTargetName: null,
      doctorHealName: null,
      sheriffCheck: null,
      donCheck: null,
      killedName: null,
      votedOutName: null
    });

    room.log.push(`Ніч ${room.dayNumber} настала. Місто засинає.`);
    this.clearTimer(room);
    this.broadcastState(room);
    this.broadcastHostNotebook(room);
  }

  hostAdvanceNight(room, requesterId, step) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");
    if (room.phase !== PHASE.NIGHT) throw new Error("Зараз не ніч");

    if (step === "resolve") {
      this.resolveNight(room);
      return;
    }

    const alive = this.gamePlayers(room).filter((p) => this.isPlayerAlive(p));

    if (step === "sleep") {
      room.nightStep = "sleep";
      room.nightActiveIds = [];
      room.log.push("Усі містяни сплять.");
    } else if (step === "mafia") {
      room.nightStep = "mafia";
      room.nightActiveIds = alive.filter((p) => this.isMafiaTeam(p)).map((p) => p.id);
      room.log.push("Прокидається Мафія.");
    } else if (step === "don") {
      const don = alive.find((p) => p.role === "don");
      room.nightStep = "don";
      room.nightActiveIds = don ? [don.id] : [];
      room.log.push(don ? "Прокидається Дон." : "Ведучий викликає Дона.");
    } else if (step === "doctor") {
      const doctor = alive.find((p) => p.role === "doctor");
      room.nightStep = "doctor";
      room.nightActiveIds = doctor ? [doctor.id] : [];
      room.log.push(doctor ? "Прокидається Лікар." : "Ведучий викликає Лікаря.");
    } else if (step === "sheriff") {
      const sheriff = alive.find((p) => p.role === "sheriff");
      room.nightStep = "sheriff";
      room.nightActiveIds = sheriff ? [sheriff.id] : [];
      room.log.push(sheriff ? "Прокидається Шериф." : "Ведучий викликає Шерифа.");
    } else {
      throw new Error("Невідомий крок ночі");
    }

    this.broadcastState(room);
    this.broadcastHostNotebook(room);
  }

  hostSetPhase(room, requesterId, newPhase) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");

    if (newPhase === PHASE.NIGHT) {
      this.enterNight(room);
    } else if (newPhase === PHASE.DISCUSSION) {
      if (room.phase === PHASE.NIGHT) {
        this.resolveNight(room);
      } else {
        this.enterDiscussion(room);
      }
    } else if (newPhase === PHASE.VOTING) {
      this.enterVoting(room);
    }
  }

  currentNightEntry(room) {
    return room.nightHistory.find((e) => e.day === room.dayNumber) || null;
  }

  resolveNight(room) {
    const actions = room.nightActions;
    const victimId = actions.mafiaTarget;
    const healedId = actions.doctorHeal;
    const entry = this.currentNightEntry(room);

    let killedName = null;
    if (victimId && victimId !== healedId) {
      const victim = room.players.get(victimId);
      if (victim && this.isPlayerAlive(victim)) {
        victim.status = STATUS.KILLED;
        killedName = victim.name;
      }
    }

    if (entry) {
      entry.mafiaTargetName = victimId ? room.players.get(victimId)?.name : null;
      entry.doctorHealName = healedId ? room.players.get(healedId)?.name : null;
      entry.killedName = killedName;
    }

    if (actions.sheriffCheck) {
      const target = room.players.get(actions.sheriffCheck.targetId);
      const sheriffSocket = actions.sheriffCheck.sheriffId;
      if (target) {
        const isMafia = this.isMafiaTeam(target);
        this.io.to(sheriffSocket).emit("sheriff-result", { targetName: target.name, isMafia });
        if (entry) entry.sheriffCheck = { targetName: target.name, isMafia };
      }
    }

    if (actions.donCheck) {
      const target = room.players.get(actions.donCheck.targetId);
      const donSocket = actions.donCheck.donId;
      if (target) {
        const isSheriff = target.role === "sheriff";
        this.io.to(donSocket).emit("don-result", { targetName: target.name, isSheriff });
        if (entry) entry.donCheck = { targetName: target.name, isSheriff };
      }
    }

    room.nightStep = null;
    room.nightActiveIds = [];

    if (killedName) {
      room.log.push(`Ніч пройшла. На жаль, вночі було вбито: ${killedName}.`);
    } else {
      room.log.push("Ніч пройшла. Усі живі!");
    }

    this.broadcastHostNotebook(room);
    if (this.checkWinCondition(room)) return;

    this.enterDiscussion(room);
  }

  // ---------- День: балаган → виступи по колу → голосування ----------

  enterDiscussion(room) {
    room.phase = PHASE.DISCUSSION;
    room.log.push(`День ${room.dayNumber}. Загальне обговорення.`);
    this.setTimer(room, DISCUSSION_SECONDS, () => this.enterSpeeches(room));
    this.broadcastState(room);
  }

  enterSpeeches(room) {
    room.phase = PHASE.SPEECHES;
    room.speakerQueue = room.seatOrder.filter((id) => {
      const p = room.players.get(id);
      return p && this.isPlayerAlive(p);
    });
    room.speakerIndex = 0;

    if (room.speakerQueue.length === 0) {
      this.enterVoting(room);
      return;
    }

    room.currentSpeakerId = room.speakerQueue[0];
    const speaker = room.players.get(room.currentSpeakerId);
    room.log.push(`Слово надається гравцю ${speaker?.name}.`);
    this.setTimer(room, SPEECH_SECONDS, () => this.advanceSpeech(room));
    this.broadcastState(room);
  }

  advanceSpeech(room) {
    room.speakerIndex += 1;
    if (room.speakerIndex >= room.speakerQueue.length) {
      room.currentSpeakerId = null;
      this.enterVoting(room);
      return;
    }
    room.currentSpeakerId = room.speakerQueue[room.speakerIndex];
    const speaker = room.players.get(room.currentSpeakerId);
    room.log.push(`Слово надається гравцю ${speaker?.name}.`);
    this.setTimer(room, SPEECH_SECONDS, () => this.advanceSpeech(room));
    this.broadcastState(room);
  }

  enterVoting(room) {
    // В День 1 за правилами немає вигнання під час голосування
    if (room.dayNumber === 1) {
      room.log.push("День 1: Голосування пропущено (перший день без вибування).");
      room.dayNumber += 1;
      this.enterNight(room);
      return;
    }

    room.phase = PHASE.VOTING;
    room.currentSpeakerId = null;
    room.votes = {};
    room.log.push("Голосування розпочалось.");
    this.setTimer(room, VOTING_SECONDS, () => this.resolveVoting(room));
    this.broadcastState(room);
  }

  skipVoting(room, requesterId) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");
    room.log.push("Ведучий скасував голосування.");
    room.dayNumber += 1;
    this.enterNight(room);
  }

  resolveVoting(room) {
    const tally = {};
    for (const targetId of Object.values(room.votes)) {
      tally[targetId] = (tally[targetId] || 0) + 1;
    }

    let maxVotes = 0;
    let candidates = [];
    for (const [targetId, count] of Object.entries(tally)) {
      if (count > maxVotes) {
        maxVotes = count;
        candidates = [targetId];
      } else if (count === maxVotes) {
        candidates.push(targetId);
      }
    }

    const entry = this.currentNightEntry(room);

    if (candidates.length === 1 && maxVotes > 0) {
      const player = room.players.get(candidates[0]);
      if (player) {
        player.status = STATUS.BANISHED;
        room.log.push(`За результатами голосування вигнано гравця ${player.name}.`);
        if (entry) entry.votedOutName = player.name;
      }
    } else {
      room.log.push("Голоси розділились порівну — цього дня ніхто не вигнаний.");
      if (entry) entry.votedOutName = null;
    }

    this.broadcastHostNotebook(room);
    if (this.checkWinCondition(room)) return;

    room.dayNumber += 1;
    this.enterNight(room);
  }

  checkWinCondition(room) {
    const alive = this.gamePlayers(room).filter((p) => this.isPlayerAlive(p));
    const aliveMafia = alive.filter((p) => this.isMafiaTeam(p)).length;
    const aliveCitizens = alive.length - aliveMafia;

    if (aliveMafia === 0) {
      room.phase = PHASE.ENDED;
      room.log.push("Мирні жителі перемогли! Мафію знищено.");
      this.clearTimer(room);
      this.broadcastState(room, true);
      return true;
    }
    if (aliveMafia >= aliveCitizens) {
      room.phase = PHASE.ENDED;
      room.log.push("Мафія перемогла!");
      this.clearTimer(room);
      this.broadcastState(room, true);
      return true;
    }
    return false;
  }

  // ---------- Дії гравців уночі ----------

  submitNightAction(room, socketId, payload) {
    const player = room.players.get(socketId);
    if (!player || !this.isPlayerAlive(player) || room.phase !== PHASE.NIGHT) return;

    const target = room.players.get(payload.targetId);
    if (!target || target.isHost) return;

    if (payload.type === "kill") {
      if (!this.isMafiaTeam(player)) return;
      room.nightActions.mafiaTarget = payload.targetId;
    } else if (payload.type === "heal") {
      if (player.role !== "doctor") return;
      room.nightActions.doctorHeal = payload.targetId;
    } else if (payload.type === "check") {
      if (player.role !== "sheriff") return;
      room.nightActions.sheriffCheck = { sheriffId: socketId, targetId: payload.targetId };
    } else if (payload.type === "check-sheriff") {
      if (player.role !== "don") return;
      room.nightActions.donCheck = { donId: socketId, targetId: payload.targetId };
    } else {
      return;
    }

    this.broadcastHostNotebook(room);
  }

  submitVote(room, socketId, targetId) {
    const player = room.players.get(socketId);
    if (!player || !this.isPlayerAlive(player) || room.phase !== PHASE.VOTING) return;
    const target = room.players.get(targetId);
    if (!target || target.isHost) return;
    room.votes[socketId] = targetId;
    this.broadcastState(room);
  }

  addChatMessage(room, socketId, text) {
    const player = room.players.get(socketId);
    if (!player) return;

    if (room.phase === PHASE.SPEECHES && !player.isHost && socketId !== room.currentSpeakerId) {
      return;
    }

    const message = {
      author: player.name,
      text: String(text).slice(0, 500),
      alive: this.isPlayerAlive(player) || player.isHost,
      ts: Date.now()
    };
    this.io.to(room.code).emit("chat-message", message);
  }

  // ---------- Модерація ведучого ----------

  hostSetStatus(room, requesterId, targetId, status) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");
    if (![STATUS.ALIVE, STATUS.KILLED, STATUS.BANISHED].includes(status)) {
      throw new Error("Невідомий статус");
    }
    const target = room.players.get(targetId);
    if (!target || target.isHost) throw new Error("Гравця не знайдено");

    target.status = status;
    const label = status === STATUS.KILLED ? "вбитим" : status === STATUS.BANISHED ? "вигнаним" : "живим";
    room.log.push(`Ведучий позначив гравця ${target.name} як ${label}.`);

    if (room.phase !== PHASE.LOBBY && room.phase !== PHASE.ENDED) {
      if (this.checkWinCondition(room)) return;
    }
    this.broadcastState(room);
  }

  hostKick(room, requesterId, targetId) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");
    const target = room.players.get(targetId);
    if (!target || target.isHost) throw new Error("Гравця не знайдено");

    room.players.delete(targetId);
    if (target.token) room.tokenIndex.delete(target.token);
    room.log.push(`Ведучий вилучив гравця ${target.name} з кімнати.`);
    this.io.to(targetId).emit("kicked-from-room");

    if (room.phase !== PHASE.LOBBY && room.phase !== PHASE.ENDED) {
      if (this.checkWinCondition(room)) return;
    }
    this.broadcastState(room);
  }

  hostMediaControl(room, requesterId, targetId, action) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");
    if (!room.players.has(targetId)) throw new Error("Гравця не знайдено");
    this.io.to(targetId).emit("forced-media-control", { action });
  }

  // ---------- Блокнотик ведучого ----------

  broadcastHostNotebook(room) {
    if (!room.hostId) return;
    this.io.to(room.hostId).emit("host-notebook", this.buildHostNotebook(room));
  }

  buildHostNotebook(room) {
    const resolveName = (id) => (id ? room.players.get(id)?.name || "?" : "ще не обрано");

    let current = null;
    if (room.phase === PHASE.NIGHT) {
      const a = room.nightActions || {};
      current = {
        day: room.dayNumber,
        step: room.nightStep,
        mafiaTargetName: resolveName(a.mafiaTarget),
        doctorHealName: resolveName(a.doctorHeal),
        sheriffCheck: a.sheriffCheck ? { targetName: resolveName(a.sheriffCheck.targetId) } : null,
        donCheck: a.donCheck ? { targetName: resolveName(a.donCheck.targetId) } : null
      };
    }

    return {
      current,
      history: room.nightHistory.slice().reverse()
    };
  }

  // ---------- Timers ----------

  setTimer(room, seconds, onEnd) {
    this.clearTimer(room);
    room.timerEndsAt = Date.now() + seconds * 1000;
    room.timer = setTimeout(() => {
      onEnd();
    }, seconds * 1000);
  }

  clearTimer(room) {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    room.timerEndsAt = null;
  }

  // ---------- State broadcasting ----------

  broadcastState(room, revealAll = false) {
    for (const [socketId, player] of room.players) {
      this.io.to(socketId).emit("room-state", this.serializeRoom(room, socketId, revealAll));
    }
  }

  serializeRoom(room, viewerSocketId, revealAll = false) {
    const viewer = room.players.get(viewerSocketId);

    const players = [...room.players.values()].map((p) => {
      const knowsRole =
          revealAll ||
          (viewer && viewer.isHost) ||
          p.id === viewerSocketId ||
          (viewer && this.isMafiaTeam(viewer) && this.isMafiaTeam(p));

      return {
        id: p.id,
        name: p.name,
        alive: p.status === STATUS.ALIVE,
        status: p.status,
        isHost: p.isHost,
        disconnected: Boolean(p.disconnected),
        role: knowsRole ? p.role : null,
        isMafiaLeader: knowsRole ? p.isMafiaLeader : false
      };
    });

    let nightVisibleIds = null;
    let isNightActive = null;
    if (room.phase === PHASE.NIGHT) {
      isNightActive = Boolean(viewer && room.nightActiveIds.includes(viewer.id));
      if (viewer && viewer.isHost) {
        nightVisibleIds = null; // Ведучий бачить усіх
      } else if (isNightActive) {
        nightVisibleIds = room.nightActiveIds;
      } else {
        nightVisibleIds = [];
      }
    }

    return {
      code: room.code,
      phase: room.phase,
      dayNumber: room.dayNumber,
      nightStep: room.nightStep,
      currentSpeakerId: room.currentSpeakerId,
      players,
      you: viewer
          ? {
            id: viewer.id,
            role: viewer.role,
            alive: viewer.status === STATUS.ALIVE,
            status: viewer.status,
            isHost: viewer.isHost,
            isMafiaLeader: viewer.isMafiaLeader,
            isNightActive,
            nightVisibleIds
          }
          : null,
      log: room.log.slice(-30),
      timerEndsAt: room.timerEndsAt,
      roleInfo: ROLE_INFO
    };
  }
}