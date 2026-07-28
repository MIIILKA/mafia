import { useEffect, useState } from "react";
import PlayerList from "../components/PlayerList.jsx";
import Chat from "../components/Chat.jsx";
import Timer from "../components/Timer.jsx";
import HostNotebook from "../components/HostNotebook.jsx";
import { playGunshot } from "../sounds.js";
import "./Game.scss";

const PHASE_LABEL = {
  night: "🌙 Ніч",
  discussion: "💬 Обговорення (Балаган)",
  speeches: "🎙 Виступи по колу",
  voting: "🗳 Голосування",
  ended: "🏁 Гру завершено"
};

const NIGHT_STEPS = [
  { id: "sleep", label: "😴 Усі сплять" },
  { id: "mafia", label: "🔴 Мафія" },
  { id: "doctor", label: "🟢 Лікар" },
  { id: "sheriff", label: "🟡 Шериф" }
];

export default function Game({
                               room,
                               messages,
                               onNightAction,
                               onAdvanceNight,
                               onVote,
                               onSendMessage,
                               sheriffResult,
                               donResult,
                               hostNotebook
                             }) {
  const [nightSelection, setNightSelection] = useState(null);
  const [donCheckSelection, setDonCheckSelection] = useState(null);
  const [voteSelection, setVoteSelection] = useState(null);

  const you = room.you;
  const alivePlayers = room.players.filter((p) => p.alive && !p.isHost);
  const phase = room.phase;
  const isHost = Boolean(you?.isHost);

  useEffect(() => {
    setNightSelection(null);
    setDonCheckSelection(null);
    setVoteSelection(null);
  }, [phase, room.dayNumber, room.nightStep]);

  function handleNightConfirm(type) {
    if (type === "check-sheriff") {
      if (!donCheckSelection) return;
      onNightAction({ type, targetId: donCheckSelection });
      return;
    }
    if (!nightSelection) return;
    if (type === "kill") playGunshot();
    onNightAction({ type, targetId: nightSelection });
  }

  function handleVoteConfirm() {
    if (!voteSelection) return;
    onVote(voteSelection);
  }

  const isMyTurnToSpeak = phase === "speeches" && room.currentSpeakerId === you?.id;

  return (
      <div className="game">
        <div className="game__top">
          <div className="game__phase">
            <span className="game__phase-label">{PHASE_LABEL[phase] || phase}</span>
            <span className="game__day">День {room.dayNumber}</span>
          </div>
          <Timer endsAt={room.timerEndsAt} />
        </div>

        {isHost && phase !== "ended" && (
            <div className="game__role-banner game__role-banner--host">
              Ви — <strong>Ведучий</strong>. Ви керуєте кроками ночі, бачите ролі та оголошуєте рішення.
            </div>
        )}

        {!isHost && you?.role && phase !== "ended" && (
            <div className={`game__role-banner game__role-banner--${you.role}`}>
              Ваша роль: <strong>{room.roleInfo[you.role]?.label}</strong>
              {you.isMafiaLeader && <strong> (Лідер мафії)</strong>}
              {!you.alive && <span className="game__dead-tag"> — ви вибули з гри</span>}
            </div>
        )}

        {sheriffResult && (
            <div className="game__sheriff-result">
              Перевірка: <strong>{sheriffResult.targetName}</strong> —{" "}
              {sheriffResult.isMafia ? "мафія 🔴" : "не мафія 🟢"}
            </div>
        )}

        {donResult && (
            <div className="game__sheriff-result">
              Перевірка дона: <strong>{donResult.targetName}</strong> —{" "}
              {donResult.isSheriff ? "шериф 🟡" : "не шериф ⚪"}
            </div>
        )}

        <div className="game__body">
          <div className="game__main">
            {/* Панель керування ночі для Ведучого */}
            {isHost && phase === "night" && (
                <div className="action-panel" style={{ backgroundColor: "#2d3748" }}>
                  <h3>Керування ходом ночі</h3>
                  <p style={{ fontSize: "0.9rem", color: "#a0aec0" }}>
                    Розбудіть потрібну роль, зачекайте їх рішення/домовленостей на пальцях, потім завершіть ніч.
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "10px 0" }}>
                    {NIGHT_STEPS.map((step) => (
                        <button
                            key={step.id}
                            type="button"
                            className="action-panel__confirm"
                            style={{
                              backgroundColor: room.nightStep === step.id ? "#3182ce" : "#4a5568",
                              padding: "8px 12px",
                              fontSize: "0.85rem"
                            }}
                            onClick={() => onAdvanceNight(step.id)}
                        >
                          {step.label}
                        </button>
                    ))}
                  </div>
                  <button
                      type="button"
                      className="action-panel__confirm"
                      style={{ backgroundColor: "#e53e3e", width: "100%" }}
                      onClick={() => onAdvanceNight("resolve")}
                  >
                    ☀️ Завершити ніч та прокинутись
                  </button>
                </div>
            )}

            {isHost && <HostNotebook notebook={hostNotebook} />}

            {!isHost && phase === "night" && you?.alive && (
                <NightPanel
                    role={you.role}
                    isMafiaLeader={you.isMafiaLeader}
                    nightStep={room.nightStep}
                    players={alivePlayers}
                    youId={you.id}
                    selection={nightSelection}
                    onSelect={setNightSelection}
                    donCheckSelection={donCheckSelection}
                    onSelectDonCheck={setDonCheckSelection}
                    onConfirm={handleNightConfirm}
                />
            )}

            {!isHost && phase === "night" && !you?.alive && (
                <div className="game__info-box">Ви спостерігаєте за грою. Дочекайтесь ранку.</div>
            )}

            {!isHost && phase === "discussion" && (
                <div className="game__info-box">
                  💬 Вільне обговорення (балаган). Шукайте підозрюваних!
                </div>
            )}

            {!isHost && phase === "speeches" && (
                <div className="game__info-box">
                  {isMyTurnToSpeak
                      ? "🎙 Зараз ВАШ виступ! Говоріть у мікрофон та чат."
                      : "Зараз черга виступу одного з гравців. Слухайте уважно."}
                </div>
            )}

            {!isHost && phase === "voting" && you?.alive && (
                <VotingPanel
                    players={alivePlayers}
                    youId={you.id}
                    selection={voteSelection}
                    onSelect={setVoteSelection}
                    onConfirm={handleVoteConfirm}
                />
            )}

            {!isHost && phase === "voting" && !you?.alive && (
                <div className="game__info-box">Голосування триває. Ви спостерігаєте.</div>
            )}

            {phase === "ended" && (
                <div className="game__info-box game__info-box--ended">
                  {room.log[room.log.length - 1]}
                </div>
            )}

            <div className="game__players">
              <h3>Гравці</h3>
              <PlayerList players={room.players} youId={you?.id} roleInfo={room.roleInfo} />
            </div>

            <div className="game__log">
              <h3>Хроніка</h3>
              <ul>
                {room.log
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                        <li key={i}>{entry}</li>
                    ))}
              </ul>
            </div>
          </div>

          <div className="game__chat">
            <Chat
                messages={messages}
                onSend={onSendMessage}
                disabled={
                    (!isHost && !you?.alive) ||
                    (phase === "speeches" && !isHost && !isMyTurnToSpeak)
                }
            />
          </div>
        </div>
      </div>
  );
}

function NightPanel({
                      role,
                      isMafiaLeader,
                      nightStep,
                      players,
                      youId,
                      selection,
                      onSelect,
                      donCheckSelection,
                      onSelectDonCheck,
                      onConfirm
                    }) {
  if (nightStep === "mafia" && (role === "mafia" || role === "don")) {
    return (
        <div className="action-panel">
          <h3>🔴 Мафія прокинулась</h3>
          <p style={{ fontSize: "0.85rem", color: "#cbd5e0" }}>
            Домовляйтесь між собою на відео та на пальцях.
          </p>
          {isMafiaLeader ? (
              <>
                <ActionPanel
                    title="Ви — Лідер Мафії! Оберіть жертву:"
                    players={players}
                    youId={youId}
                    selection={selection}
                    onSelect={onSelect}
                    onConfirm={() => onConfirm("kill")}
                    confirmLabel="Вбити ціль"
                />
                {role === "don" && (
                    <ActionPanel
                        title="Перевірте, чи гравець — шериф:"
                        players={players}
                        youId={youId}
                        selection={donCheckSelection}
                        onSelect={onSelectDonCheck}
                        onConfirm={() => onConfirm("check-sheriff")}
                        confirmLabel="Перевірити"
                    />
                )}
              </>
          ) : (
              <div className="game__info-box">
                Ваш лідер обирає ціль. Показуйте йому підказки на відео!
              </div>
          )}
        </div>
    );
  }

  if (nightStep === "doctor" && role === "doctor") {
    return (
        <ActionPanel
            title="🟢 Ккого врятувати цієї ночі?"
            players={players}
            youId={youId}
            selection={selection}
            onSelect={onSelect}
            onConfirm={() => onConfirm("heal")}
            confirmLabel="Лікувати"
            allowSelf
        />
    );
  }

  if (nightStep === "sheriff" && role === "sheriff") {
    return (
        <ActionPanel
            title="🟡 Кого перевірити?"
            players={players}
            youId={youId}
            selection={selection}
            onSelect={onSelect}
            onConfirm={() => onConfirm("check")}
            confirmLabel="Перевірити"
        />
    );
  }

  return <div className="game__info-box">🌙 Ви спите. Очікуйте на свій хід або ранок.</div>;
}

function ActionPanel({ title, players, youId, selection, onSelect, onConfirm, confirmLabel, allowSelf }) {
  const list = allowSelf ? players : players.filter((p) => p.id !== youId);
  return (
      <div className="action-panel">
        <h3>{title}</h3>
        <PlayerList
            players={list}
            youId={allowSelf ? undefined : youId}
            selectable
            selectedId={selection}
            onSelect={onSelect}
        />
        <button className="action-panel__confirm" disabled={!selection} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
  );
}

function VotingPanel({ players, youId, selection, onSelect, onConfirm }) {
  const list = players.filter((p) => p.id !== youId);
  return (
      <div className="action-panel">
        <h3>За кого голосуєте?</h3>
        <PlayerList
            players={list}
            selectable
            selectedId={selection}
            onSelect={onSelect}
        />
        <button className="action-panel__confirm" disabled={!selection} onClick={onConfirm}>
          Проголосувати
        </button>
      </div>
  );
}