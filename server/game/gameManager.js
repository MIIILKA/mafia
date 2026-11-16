// gameManager.js
import { customAlphabet } from "nanoid";
import { buildRoleDeck, getDefaultDeckConfig, ROLE_INFO, MAFIA_TEAM_ROLES, shuffle } from "./roles.js";

const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export const PHASE = {
  LOBBY: "lobby",
  NIGHT: "night",
  DISCUSSION: "discussion",
  SPEECHES: "speeches",
  VOTING: "voting",
  SHOOTOUT_SPEECHES: "shootout_speeches",
  SHOOTOUT_VOTING: "shootout_voting",
  ENDED: "ended"
};

export const STATUS = {
  ALIVE: "alive",
  KILLED: "killed",
  BANISHED: "banished"
};

const DISCUSSION_SECONDS = 60;
const SPEECH_SECONDS = 30;
const VOTING_SECONDS = 30;
const RECONNECT_GRACE_MS = 60_000;

export class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
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
      players: new Map(),
      tokenIndex: new Map(),
      disconnectTimers: new Map(),
      roleConfig: null, // кастомний конструктор ролей від ведучого
      stats: new Map(), // token -> { name, games, wins, mafiaWins, citizenWins, maniacWins }
      nightActions: {},
      nightStep: null,
      nightActiveIds: [],
      seatOrder: [],
      speakerQueue: [],
      speakerIndex: 0,
      currentSpeakerId: null,
      nominatedIds: [],
      nominatedBy: {},
      shootoutIds: [], // кандидати у перестрілці
      lastMorningReport: null,
      winnerTeam: null, // "citizens" | "mafia" | "maniac"
      leaderId: null,
      votes: {},
      dayNumber: 0,
      log: [],
      nightHistory: [],
      timer: null,
      timerEndsAt: null,
      isPaused: false,
      remainingSeconds: null
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
      number: null,
      isMafiaLeader: false,
      status: STATUS.ALIVE,
      isHost: socketId === room.hostId,
      disconnected: false
    });
    if (token) {
      room.tokenIndex.set(token, socketId);
      if (!room.stats.has(token)) {
        room.stats.set(token, { name, games: 0, wins: 0 });
      } else {
        room.stats.get(token).name = name;
      }
    }

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

  // Налаштування конструктора ролей у лобі
  setRoleConfig(room, requesterId, config) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може змінювати склад ролей");
    if (room.phase !== PHASE.LOBBY) throw new Error("Налаштування доступні лише в лобі");
    room.roleConfig = config;
    this.broadcastState(room);
  }

  startGame(code, requesterId) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("Кімнати не існує");
    if (room.hostId !== requesterId) throw new Error("Тільки ведучий може почати гру");

    const rawParticipants = this.gamePlayers(room);
    if (rawParticipants.length < 1) throw new Error("Потрібен щонайменше 1 гравець (без ведучого)");

    const participants = shuffle(rawParticipants);
    const activeConfig = room.roleConfig || getDefaultDeckConfig(participants.length);
    const deck = buildRoleDeck(participants.length, activeConfig);

    participants.forEach((p, i) => {
      p.number = i + 1;
      p.role = deck[i];
      p.status = STATUS.ALIVE;
      p.isMafiaLeader = false;
    });

    const host = room.players.get(room.hostId);
    if (host) host.number = null;

    const don = participants.find((p) => p.role === "don");
    const leader = don || participants.find((p) => p.role === "mafia");
    if (leader) {
      leader.isMafiaLeader = true;
      room.leaderId = leader.id;
    }

    room.seatOrder = participants.map((p) => p.id);
    room.dayNumber = 1;
    room.nominatedIds = [];
    room.nominatedBy = {};
    room.shootoutIds = [];
    room.lastMorningReport = null;
    room.winnerTeam = null;
    room.log = [`Гра почалась. Гравців: ${participants.length}.`];
    room.nightHistory = [];

    this.enterDiscussion(room);
  }

  resetToLobby(room, requesterId) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");

    this.clearTimer(room);
    room.phase = PHASE.LOBBY;
    room.nightActions = {};
    room.nightStep = null;
    room.nightActiveIds = [];
    room.seatOrder = [];
    room.speakerQueue = [];
    room.speakerIndex = 0;
    room.currentSpeakerId = null;
    room.nominatedIds = [];
    room.nominatedBy = {};
    room.shootoutIds = [];
    room.lastMorningReport = null;
    room.winnerTeam = null;
    room.leaderId = null;
    room.votes = {};
    room.dayNumber = 0;
    room.isPaused = false;
    room.remainingSeconds = null;
    room.nightHistory = [];

    for (const p of room.players.values()) {
      p.status = STATUS.ALIVE;
      p.number = null;
      p.isMafiaLeader = false;
      p.role = p.isHost ? "host" : null;
    }

    room.log.push("Ведучий повернув усіх у лобі для нової гри.");
    this.broadcastState(room);
    this.broadcastHostNotebook(room);
  }

  transferHost(room, requesterId, targetId) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може передати права");
    if (room.phase !== PHASE.LOBBY && room.phase !== PHASE.ENDED) {
      throw new Error("Передати роль ведучого можна лише в лобі або після завершення гри");
    }

    const oldHost = room.players.get(requesterId);
    const newHost = room.players.get(targetId);
    if (!newHost) throw new Error("Гравця не знайдено");

    if (oldHost) {
      oldHost.isHost = false;
      oldHost.role = null;
    }

    room.hostId = targetId;
    newHost.isHost = true;
    newHost.role = "host";
    newHost.number = null;

    room.log.push(`👑 ${newHost.name} тепер новий Ведучий!`);
    this.broadcastState(room);
    this.broadcastHostNotebook(room);
  }

  // ---------- Ніч ----------

  enterNight(room) {
    room.phase = PHASE.NIGHT;
    room.nightActions = {};
    room.nightStep = "sleep";
    room.nightActiveIds = [];
    room.nominatedIds = [];
    room.nominatedBy = {};
    room.shootoutIds = [];

    room.nightHistory.push({
      day: room.dayNumber,
      mafiaTargetName: null,
      maniacTargetName: null,
      beautyTargetName: null,
      doctorHealName: null,
      sheriffCheck: null,
      donCheck: null,
      killedNames: [],
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
    } else if (step === "beauty") {
      const beauty = alive.find((p) => p.role === "beauty");
      room.nightStep = "beauty";
      room.nightActiveIds = beauty ? [beauty.id] : [];
      room.log.push("Прокидається Красуня.");
    } else if (step === "mafia") {
      room.nightStep = "mafia";
      room.nightActiveIds = alive.filter((p) => this.isMafiaTeam(p)).map((p) => p.id);
      room.log.push("Прокидається Мафія.");
    } else if (step === "don") {
      const don = alive.find((p) => p.role === "don");
      room.nightStep = "don";
      room.nightActiveIds = don ? [don.id] : [];
      room.log.push("Прокидається Дон.");
    } else if (step === "maniac") {
      const maniac = alive.find((p) => p.role === "maniac");
      room.nightStep = "maniac";
      room.nightActiveIds = maniac ? [maniac.id] : [];
      room.log.push("Прокидається Маніяк.");
    } else if (step === "doctor") {
      const doctor = alive.find((p) => p.role === "doctor");
      room.nightStep = "doctor";
      room.nightActiveIds = doctor ? [doctor.id] : [];
      room.log.push("Прокидається Лікар.");
    } else if (step === "sheriff") {
      const sheriff = alive.find((p) => p.role === "sheriff");
      room.nightStep = "sheriff";
      room.nightActiveIds = sheriff ? [sheriff.id] : [];
      room.log.push("Прокидається Шериф.");
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
    const blockedId = actions.beautyTarget || null; // заблокований красунею
    const healedId = actions.doctorHeal || null;
    const entry = this.currentNightEntry(room);

    // Якщо лікар заблокований красунею — він не лікує
    const doctorPlayer = this.gamePlayers(room).find((p) => p.role === "doctor");
    const effectiveHealId = doctorPlayer && doctorPlayer.id === blockedId ? null : healedId;

    // Постріл мафії (якщо дон і всі мафіозі не заблоковані)
    const mafiaTargetId = actions.mafiaTarget || null;
    // Постріл маніяка (якщо маніяк не заблокований красунею)
    const maniacPlayer = this.gamePlayers(room).find((p) => p.role === "maniac");
    const maniacTargetId =
        maniacPlayer && maniacPlayer.id === blockedId ? null : actions.maniacTarget || null;

    const victimsToKill = new Set();
    for (const targetId of [mafiaTargetId, maniacTargetId]) {
      if (!targetId) continue;
      if (targetId === effectiveHealId) continue; // врятований лікарем
      const target = room.players.get(targetId);
      if (!target || !this.isPlayerAlive(target)) continue;
      if (target.role === "immortal") continue; // Безсмертний не вмирає вночі
      victimsToKill.add(target);
    }

    const killedList = [...victimsToKill];
    for (const victim of killedList) {
      victim.status = STATUS.KILLED;
    }

    if (entry) {
      entry.mafiaTargetName = mafiaTargetId ? room.players.get(mafiaTargetId)?.name : null;
      entry.maniacTargetName = maniacTargetId ? room.players.get(maniacTargetId)?.name : null;
      entry.beautyTargetName = blockedId ? room.players.get(blockedId)?.name : null;
      entry.doctorHealName = effectiveHealId ? room.players.get(effectiveHealId)?.name : null;
      entry.killedNames = killedList.map((v) => v.name);
    }

    // Перевірка Шерифа (якщо не заблокований)
    const sheriffPlayer = this.gamePlayers(room).find((p) => p.role === "sheriff");
    if (actions.sheriffCheck && (!sheriffPlayer || sheriffPlayer.id !== blockedId)) {
      const target = room.players.get(actions.sheriffCheck.targetId);
      const sheriffSocket = actions.sheriffCheck.sheriffId;
      if (target) {
        const isMafia = this.isMafiaTeam(target);
        this.io.to(sheriffSocket).emit("sheriff-result", { targetName: target.name, isMafia });
        if (entry) entry.sheriffCheck = { targetName: target.name, isMafia };
      }
    }

    // Перевірка Дона (якщо не заблокований)
    const donPlayer = this.gamePlayers(room).find((p) => p.role === "don");
    if (actions.donCheck && (!donPlayer || donPlayer.id !== blockedId)) {
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

    const killedSummary =
        killedList.length > 0
            ? killedList.map((v) => `№${v.number} ${v.name}`).join(" та ")
            : null;

    room.lastMorningReport = {
      id: `${room.dayNumber}-${Date.now()}`,
      day: room.dayNumber,
      killedName: killedSummary,
      killedNumber: killedList.length === 1 ? killedList[0].number : null,
      multipleVictims: killedList.length > 1
    };

    if (killedSummary) {
      room.log.push(`Ніч пройшла. Вночі вбито: ${killedSummary}.`);
    } else {
      room.log.push("Ніч пройшла. Усі живі!");
    }

    this.broadcastHostNotebook(room);
    if (this.checkWinCondition(room)) return;

    this.enterDiscussion(room);
  }

  // ---------- День: балаган → виступи → голосування → перестрілка ----------

  enterDiscussion(room) {
    room.phase = PHASE.DISCUSSION;
    room.isPaused = false;
    room.nominatedIds = [];
    room.nominatedBy = {};
    room.shootoutIds = [];
    room.log.push(`День ${room.dayNumber}. Загальне обговорення.`);
    this.setTimer(room, DISCUSSION_SECONDS, () => this.enterSpeeches(room));
    this.broadcastState(room);
  }

  enterSpeeches(room) {
    room.phase = PHASE.SPEECHES;
    room.isPaused = false;
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
    room.log.push(`Слово надається гравцю №${speaker?.number} ${speaker?.name}.`);
    this.setTimer(room, SPEECH_SECONDS, () => this.advanceSpeech(room));
    this.broadcastState(room);
  }

  nominatePlayer(room, socketId, targetId) {
    if (room.phase !== PHASE.SPEECHES) throw new Error("Виставляти можна лише під час виступів");
    if (room.currentSpeakerId !== socketId && room.hostId !== socketId) {
      throw new Error("Зараз не ваша черга говорити");
    }
    const target = room.players.get(targetId);
    const speaker = room.players.get(socketId);
    if (!target || target.isHost || !this.isPlayerAlive(target)) {
      throw new Error("Неможливо виставити цього гравця");
    }

    const prevTargetId = room.nominatedBy[socketId];
    room.nominatedBy[socketId] = targetId;

    const uniqueNominated = [];
    for (const id of Object.values(room.nominatedBy)) {
      if (id && !uniqueNominated.includes(id)) {
        const p = room.players.get(id);
        if (p && this.isPlayerAlive(p)) uniqueNominated.push(id);
      }
    }
    room.nominatedIds = uniqueNominated;

    if (prevTargetId !== targetId) {
      room.log.push(
          `☝️ №${speaker?.number} ${speaker?.name} виставляє на голосування гравця №${target.number} ${target.name}.`
      );
    }
    this.broadcastState(room);
  }

  advanceSpeech(room) {
    room.speakerIndex += 1;
    if (room.speakerIndex >= room.speakerQueue.length) {
      room.currentSpeakerId = null;
      if (room.phase === PHASE.SHOOTOUT_SPEECHES) {
        this.enterShootoutVoting(room);
      } else {
        this.enterVoting(room);
      }
      return;
    }
    room.currentSpeakerId = room.speakerQueue[room.speakerIndex];
    const speaker = room.players.get(room.currentSpeakerId);
    room.log.push(`Слово надається гравцю №${speaker?.number} ${speaker?.name}.`);
    this.setTimer(room, SPEECH_SECONDS, () => this.advanceSpeech(room));
    this.broadcastState(room);
  }

  enterVoting(room) {
    if (room.dayNumber === 1) {
      room.log.push("День 1: Голосування пропущено (перший день без вибування).");
      room.dayNumber += 1;
      this.enterNight(room);
      return;
    }

    room.nominatedIds = room.nominatedIds.filter((id) => {
      const p = room.players.get(id);
      return p && this.isPlayerAlive(p);
    });

    if (room.nominatedIds.length === 0) {
      room.log.push("Нікого не було виставлено на голосування — місто переходить у ніч.");
      room.dayNumber += 1;
      this.enterNight(room);
      return;
    }

    room.phase = PHASE.VOTING;
    room.isPaused = false;
    room.currentSpeakerId = null;
    room.votes = {};
    room.log.push(`🗳 Голосування розпочалось! Кандидатів: ${room.nominatedIds.length}.`);
    this.setTimer(room, VOTING_SECONDS, () => this.resolveVoting(room, false));
    this.broadcastState(room);
  }

  // Фаза 1 перестрілки: виправдальні промови рівних кандидатів
  enterShootoutSpeeches(room, tiedIds) {
    room.phase = PHASE.SHOOTOUT_SPEECHES;
    room.shootoutIds = tiedIds;
    room.speakerQueue = tiedIds.filter((id) => {
      const p = room.players.get(id);
      return p && this.isPlayerAlive(p);
    });
    room.speakerIndex = 0;
    room.currentSpeakerId = room.speakerQueue[0] || null;

    const names = room.speakerQueue
        .map((id) => {
          const p = room.players.get(id);
          return p ? `№${p.number} ${p.name}` : null;
        })
        .filter(Boolean)
        .join(" та ");

    room.log.push(`⚔️ ПЕРЕСТРІЛКА! Рівність голосів між: ${names}. Кожен отримує 30 сек на виправдання!`);
    this.setTimer(room, SPEECH_SECONDS, () => this.advanceSpeech(room));
    this.broadcastState(room);
  }

  // Фаза 2 перестрілки: повторне голосування лише між кандидатами перестрілки
  enterShootoutVoting(room) {
    room.phase = PHASE.SHOOTOUT_VOTING;
    room.currentSpeakerId = null;
    room.votes = {};
    room.log.push("⚔️ Повторне голосування (Перестрілка)! Оберіть одного з кандидатів.");
    this.setTimer(room, VOTING_SECONDS, () => this.resolveVoting(room, true));
    this.broadcastState(room);
  }

  skipVoting(room, requesterId) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");
    room.log.push("Ведучий скасував голосування.");
    room.dayNumber += 1;
    this.enterNight(room);
  }

  resolveVoting(room, isAfterShootout = false) {
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

    // Якщо нічия між 2+ кандидатами і це ще НЕ перестрілка -> вмикаємо ПЕРЕСТРІЛКУ!
    if (candidates.length > 1 && maxVotes > 0 && !isAfterShootout) {
      this.enterShootoutSpeeches(room, candidates);
      return;
    }

    if (candidates.length === 1 && maxVotes > 0) {
      const player = room.players.get(candidates[0]);
      if (player) {
        player.status = STATUS.BANISHED;
        room.log.push(`За результатами голосування вигнано гравця №${player.number} ${player.name}.`);
        if (entry) entry.votedOutName = player.name;
      }
    } else {
      room.log.push("Голоси знову розділились порівну або ніхто не голосував — ніхто не вигнаний.");
      if (entry) entry.votedOutName = null;
    }

    this.broadcastHostNotebook(room);
    if (this.checkWinCondition(room)) return;

    room.dayNumber += 1;
    this.enterNight(room);
  }

  recordSessionStats(room, winnerTeam) {
    for (const p of this.gamePlayers(room)) {
      if (!p.token) continue;
      if (!room.stats.has(p.token)) {
        room.stats.set(p.token, { name: p.name, games: 0, wins: 0 });
      }
      const stat = room.stats.get(p.token);
      stat.name = p.name;
      stat.games += 1;

      const isMafia = this.isMafiaTeam(p);
      const isManiac = p.role === "maniac";
      const isCitizen = !isMafia && !isManiac;

      if (
          (winnerTeam === "mafia" && isMafia) ||
          (winnerTeam === "maniac" && isManiac) ||
          (winnerTeam === "citizens" && isCitizen)
      ) {
        stat.wins += 1;
      }
    }
  }

  checkWinCondition(room) {
    const alive = this.gamePlayers(room).filter((p) => this.isPlayerAlive(p));
    const aliveMafia = alive.filter((p) => this.isMafiaTeam(p)).length;
    const aliveManiac = alive.filter((p) => p.role === "maniac").length;
    const aliveCitizens = alive.length - aliveMafia - aliveManiac;

    // Перемога Маніяка (залишився 1 на 1 або один)
    if (aliveManiac > 0 && alive.length <= 2 && aliveMafia === 0) {
      room.phase = PHASE.ENDED;
      room.winnerTeam = "maniac";
      room.log.push("🔪 Маніяк переміг! У місті не залишилось нікого, хто міг би його зупинити.");
      this.recordSessionStats(room, "maniac");
      this.clearTimer(room);
      this.broadcastState(room, true);
      return true;
    }

    // Перемога Мирних (ні мафії, ні маніяка)
    if (aliveMafia === 0 && aliveManiac === 0) {
      room.phase = PHASE.ENDED;
      room.winnerTeam = "citizens";
      room.log.push("🏆 Мирні жителі перемогли! Місто очищено від злочинності.");
      this.recordSessionStats(room, "citizens");
      this.clearTimer(room);
      this.broadcastState(room, true);
      return true;
    }

    // Перемога Мафії (мафії >= всіх інших разом узятих, і маніяк мертвий)
    if (aliveMafia >= aliveCitizens + aliveManiac && aliveManiac === 0) {
      room.phase = PHASE.ENDED;
      room.winnerTeam = "mafia";
      room.log.push("🔫 Мафія перемогла!");
      this.recordSessionStats(room, "mafia");
      this.clearTimer(room);
      this.broadcastState(room, true);
      return true;
    }

    return false;
  }

  // ---------- Таймер ----------

  pauseTimer(room, requesterId) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");
    if (room.isPaused || !room.timerEndsAt) return;

    room.remainingSeconds = Math.max(0, Math.ceil((room.timerEndsAt - Date.now()) / 1000));
    this.clearTimer(room);
    room.isPaused = true;
    this.broadcastState(room);
  }

  resumeTimer(room, requesterId) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");
    if (!room.isPaused) return;

    room.isPaused = false;
    const secondsLeft = room.remainingSeconds || 30;

    if (room.phase === PHASE.DISCUSSION) {
      this.setTimer(room, secondsLeft, () => this.enterSpeeches(room));
    } else if (room.phase === PHASE.SPEECHES || room.phase === PHASE.SHOOTOUT_SPEECHES) {
      this.setTimer(room, secondsLeft, () => this.advanceSpeech(room));
    } else if (room.phase === PHASE.VOTING) {
      this.setTimer(room, secondsLeft, () => this.resolveVoting(room, false));
    } else if (room.phase === PHASE.SHOOTOUT_VOTING) {
      this.setTimer(room, secondsLeft, () => this.resolveVoting(room, true));
    }

    this.broadcastState(room);
  }

  addDiscussionTime(room, requesterId, extraSeconds = 30) {
    if (room.hostId !== requesterId) throw new Error("Лише ведучий може це робити");

    const currentRemaining = room.timerEndsAt ? Math.max(0, Math.ceil((room.timerEndsAt - Date.now()) / 1000)) : 0;
    const newSeconds = (room.isPaused ? (room.remainingSeconds || 0) : currentRemaining) + extraSeconds;

    if (room.isPaused) {
      room.remainingSeconds = newSeconds;
    } else {
      if (room.phase === PHASE.DISCUSSION) {
        this.setTimer(room, newSeconds, () => this.enterSpeeches(room));
      } else if (room.phase === PHASE.SPEECHES || room.phase === PHASE.SHOOTOUT_SPEECHES) {
        this.setTimer(room, newSeconds, () => this.advanceSpeech(room));
      } else if (room.phase === PHASE.VOTING) {
        this.setTimer(room, newSeconds, () => this.resolveVoting(room, false));
      } else if (room.phase === PHASE.SHOOTOUT_VOTING) {
        this.setTimer(room, newSeconds, () => this.resolveVoting(room, true));
      }
    }

    this.broadcastState(room);
  }

  // ---------- Дії, Голосування та Чат ----------

  submitNightAction(room, socketId, payload) {
    const player = room.players.get(socketId);
    if (!player || !this.isPlayerAlive(player) || room.phase !== PHASE.NIGHT) return;

    const target = room.players.get(payload.targetId);
    if (!target || target.isHost) return;

    if (payload.type === "kill") {
      if (!this.isMafiaTeam(player)) return;
      room.nightActions.mafiaTarget = payload.targetId;
    } else if (payload.type === "maniac-kill") {
      if (player.role !== "maniac") return;
      room.nightActions.maniacTarget = payload.targetId;
    } else if (payload.type === "block") {
      if (player.role !== "beauty") return;
      room.nightActions.beautyTarget = payload.targetId;
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
    if (!player || !this.isPlayerAlive(player)) return;

    if (room.phase === PHASE.VOTING) {
      if (!room.nominatedIds.includes(targetId)) return;
      room.votes[socketId] = targetId;
      this.broadcastState(room);
    } else if (room.phase === PHASE.SHOOTOUT_VOTING) {
      if (!room.shootoutIds.includes(targetId)) return;
      room.votes[socketId] = targetId;
      this.broadcastState(room);
    }
  }

  addChatMessage(room, socketId, text, channel = "public") {
    const player = room.players.get(socketId);
    if (!player) return;

    if (channel === "mafia") {
      if (!this.isMafiaTeam(player) && !player.isHost) return;

      const message = {
        author: player.number ? `№${player.number} ${player.name}` : player.name,
        text: String(text).slice(0, 500),
        alive: this.isPlayerAlive(player) || player.isHost,
        channel: "mafia",
        ts: Date.now()
      };

      for (const [id, p] of room.players) {
        if (this.isMafiaTeam(p) || p.isHost) {
          this.io.to(id).emit("chat-message", message);
        }
      }
      return;
    }

    if (
        (room.phase === PHASE.SPEECHES || room.phase === PHASE.SHOOTOUT_SPEECHES) &&
        !player.isHost &&
        socketId !== room.currentSpeakerId
    ) {
      return;
    }

    const message = {
      author: player.number ? `№${player.number} ${player.name}` : player.name,
      text: String(text).slice(0, 500),
      alive: this.isPlayerAlive(player) || player.isHost,
      channel: "public",
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
        maniacTargetName: resolveName(a.maniacTarget),
        beautyTargetName: resolveName(a.beautyTarget),
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
    for (const [socketId] of room.players) {
      this.io.to(socketId).emit("room-state", this.serializeRoom(room, socketId, revealAll));
    }
  }

  serializeRoom(room, viewerSocketId, revealAll = false) {
    const viewer = room.players.get(viewerSocketId);
    const participantCount = this.gamePlayers(room).length;

    const players = [...room.players.values()]
        .sort((a, b) => (a.number || 999) - (b.number || 999))
        .map((p) => {
          const knowsRole =
              revealAll ||
              (viewer && viewer.isHost) ||
              p.id === viewerSocketId ||
              (viewer && this.isMafiaTeam(viewer) && this.isMafiaTeam(p));

          return {
            id: p.id,
            name: p.name,
            number: p.number,
            alive: p.status === STATUS.ALIVE,
            status: p.status,
            isHost: p.isHost,
            disconnected: Boolean(p.disconnected),
            role: knowsRole ? p.role : null,
            isMafiaLeader: knowsRole ? p.isMafiaLeader : false
          };
        });

    const leaderboard = [...room.stats.values()]
        .filter((s) => s.games > 0)
        .sort((a, b) => b.wins - a.wins || a.games - b.games);

    return {
      code: room.code,
      phase: room.phase,
      dayNumber: room.dayNumber,
      nightStep: room.nightStep,
      currentSpeakerId: room.currentSpeakerId,
      nominatedIds: room.nominatedIds,
      shootoutIds: room.shootoutIds,
      lastMorningReport: room.lastMorningReport,
      winnerTeam: room.winnerTeam,
      roleConfig: room.roleConfig || getDefaultDeckConfig(participantCount),
      leaderboard,
      isPaused: Boolean(room.isPaused),
      players,
      you: viewer
          ? {
            id: viewer.id,
            number: viewer.number,
            role: viewer.role,
            alive: viewer.status === STATUS.ALIVE,
            status: viewer.status,
            isHost: viewer.isHost,
            isMafiaLeader: viewer.isMafiaLeader
          }
          : null,
      log: room.log.slice(-30),
      timerEndsAt: room.isPaused ? Date.now() + (room.remainingSeconds || 0) * 1000 : room.timerEndsAt,
      roleInfo: ROLE_INFO
    };
  }
}