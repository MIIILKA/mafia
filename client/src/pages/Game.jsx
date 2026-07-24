import { useEffect, useState } from "react";
import PlayerList from "../components/PlayerList.jsx";
import Chat from "../components/Chat.jsx";
import Timer from "../components/Timer.jsx";
import HostNotebook from "../components/HostNotebook.jsx";
import { playGunshot } from "../sounds.js";
import "./Game.scss";

const PHASE_LABEL = {
  night: "🌙 Ніч",
  day: "☀️ День",
  voting: "🗳 Голосування",
  ended: "🏁 Гру завершено"
};

export default function Game({
  room,
  messages,
  onNightAction,
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
  // Ведучого ніколи не можна обрати ціллю дій чи голосування.
  const alivePlayers = room.players.filter((p) => p.alive && !p.isHost);
  const phase = room.phase;
  const isHost = Boolean(you?.isHost);

  useEffect(() => {
    setNightSelection(null);
    setDonCheckSelection(null);
    setVoteSelection(null);
  }, [phase, room.dayNumber]);

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

  return (
    <div className="game">
      <div className="game__top">
        <div className="game__phase">
          <span className="game__phase-label">{PHASE_LABEL[phase]}</span>
          <span className="game__day">День {room.dayNumber}</span>
        </div>
        <Timer endsAt={room.timerEndsAt} />
      </div>

      {isHost && phase !== "ended" && (
        <div className="game__role-banner game__role-banner--host">
          Ви — <strong>Ведучий</strong>. Ви бачите всі ролі та керуєте грою через панелі під камерами.
        </div>
      )}

      {!isHost && you?.role && phase !== "ended" && (
        <div className={`game__role-banner game__role-banner--${you.role}`}>
          Ваша роль: <strong>{room.roleInfo[you.role]?.label}</strong>
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
          {isHost && <HostNotebook notebook={hostNotebook} />}

          {!isHost && phase === "night" && you?.alive && (
            <NightPanel
              role={you.role}
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

          {!isHost && phase === "day" && (
            <div className="game__info-box">
              Обговорюйте у чаті, хто може бути мафією. Голосування почнеться після таймера.
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
          <Chat messages={messages} onSend={onSendMessage} disabled={!isHost && !you?.alive} />
        </div>
      </div>
    </div>
  );
}

function NightPanel({ role, players, youId, selection, onSelect, donCheckSelection, onSelectDonCheck, onConfirm }) {
  if (role === "mafia") {
    return (
      <ActionPanel
        title="Оберіть жертву"
        players={players}
        youId={youId}
        selection={selection}
        onSelect={onSelect}
        onConfirm={() => onConfirm("kill")}
        confirmLabel="Вбити"
      />
    );
  }

  if (role === "don") {
    return (
      <>
        <ActionPanel
          title="Оберіть жертву (разом з мафією)"
          players={players}
          youId={youId}
          selection={selection}
          onSelect={onSelect}
          onConfirm={() => onConfirm("kill")}
          confirmLabel="Вбити"
        />
        <ActionPanel
          title="Перевірте, чи гравець — шериф"
          players={players}
          youId={youId}
          selection={donCheckSelection}
          onSelect={onSelectDonCheck}
          onConfirm={() => onConfirm("check-sheriff")}
          confirmLabel="Перевірити"
        />
      </>
    );
  }

  if (role === "doctor") {
    return (
      <ActionPanel
        title="Кого врятувати цієї ночі?"
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
  if (role === "sheriff") {
    return (
      <ActionPanel
        title="Кого перевірити?"
        players={players}
        youId={youId}
        selection={selection}
        onSelect={onSelect}
        onConfirm={() => onConfirm("check")}
        confirmLabel="Перевірити"
      />
    );
  }
  return <div className="game__info-box">Ніч. Мирні жителі сплять. Дочекайтесь ранку.</div>;
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
