import { useEffect, useState } from "react";
import PlayerList from "../components/PlayerList.jsx";
import Chat from "../components/Chat.jsx";
import Timer from "../components/Timer.jsx";
import HostNotebook from "../components/HostNotebook.jsx";
import { playGunshot } from "../sounds.js";
import "./Game.scss";

const PHASE_LABEL = {
    intro: "🎙 Вступне слово (Знайомство)",
    night: "🌙 Ніч",
    discussion: "💬 Обговорення",
    voting: "🗳 Голосування",
    ended: "🏁 Гру завершено"
};

export default function Game({
                                 room,
                                 messages,
                                 onNightAction,
                                 onSetPhase,
                                 onVote,
                                 onSendMessage,
                                 sheriffResult,
                                 donResult,
                                 hostNotebook
                             }) {
    const [nightSelection, setNightSelection] = useState(null);
    const [donCheckSelection, setDonCheckSelection] = useState(null);
    const [voteSelection, setVoteSelection] = useState(null);
    const [actionSuccessMsg, setActionSuccessMsg] = useState("");

    const you = room.you;
    const phase = room.phase;
    const isHost = Boolean(you?.isHost);

    // Живі гравці (без ведучого)
    const alivePlayers = room.players.filter((p) => p.alive && !p.isHost);
    // Усі гравці (без ведучого)
    const realPlayers = room.players.filter((p) => !p.isHost);

    useEffect(() => {
        setNightSelection(null);
        setDonCheckSelection(null);
        setVoteSelection(null);
        setActionSuccessMsg("");
    }, [phase, room.dayNumber]);

    function handleNightConfirm(type) {
        if (type === "check-sheriff") {
            if (!donCheckSelection) return;
            onNightAction({ type, targetId: donCheckSelection });
            setActionSuccessMsg("Перевірку відправлено!");
            return;
        }
        if (!nightSelection) return;
        if (type === "kill") playGunshot();
        onNightAction({ type, targetId: nightSelection });
        setActionSuccessMsg("Вибір зафіксовано!");
    }

    function handleVoteConfirm() {
        if (!voteSelection) return;
        onVote(voteSelection);
    }

    const currentSpeaker = realPlayers.find((p) => p.id === room.currentSpeakerId);

    return (
        <div className="game">
            <div className="game__top">
                <div className="game__phase">
                    <span className="game__phase-label">{PHASE_LABEL[phase] || phase}</span>
                    <span className="game__day">День {room.dayNumber}</span>
                </div>
                <Timer endsAt={room.timerEndsAt} />
            </div>

            {/* Панель керування для ВЕДУЧОГО */}
            {isHost && phase !== "ended" && (
                <div className="game__role-banner game__role-banner--host" style={{ flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
                    <div>
                        Ви — <strong>Ведучий</strong>. Ви керуєте перебігом гри та надаєте слово.
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: "100%" }}>
                        {phase === "intro" && (
                            <>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#3182ce" }}
                                    onClick={() => {
                                        const currentIndex = alivePlayers.findIndex((p) => p.id === room.currentSpeakerId);
                                        const nextPlayer = alivePlayers[(currentIndex + 1) % alivePlayers.length];
                                        onSetPhase("intro", { speakerId: nextPlayer?.id });
                                    }}
                                >
                                    🎙 Передати слово наступному гравцю
                                </button>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#805ad5" }}
                                    onClick={() => onSetPhase("night")}
                                >
                                    🌙 Оголосити першу ніч
                                </button>
                            </>
                        )}

                        {phase === "night" && (
                            <>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#dd6b20" }}
                                    onClick={() => onSetPhase("discussion")}
                                >
                                    ☀️ Настав ранок (Завершити ніч)
                                </button>
                            </>
                        )}

                        {phase === "discussion" && (
                            <>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#e53e3e" }}
                                    onClick={() => onSetPhase("voting")}
                                >
                                    🗳 Почати голосування
                                </button>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#805ad5" }}
                                    onClick={() => onSetPhase("night")}
                                >
                                    🌙 Оголосити ніч
                                </button>
                            </>
                        )}

                        {phase === "voting" && (
                            <button
                                type="button"
                                className="action-panel__confirm"
                                style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#805ad5" }}
                                onClick={() => onSetPhase("night")}
                            >
                                🌙 Завершити голосування та оголосити ніч
                            </button>
                        )}
                    </div>
                </div>
            )}

            {!isHost && you?.role && phase !== "ended" && (
                <div className={`game__role-banner game__role-banner--${you.role}`}>
                    Ваша роль: <strong>{room.roleInfo?.[you.role]?.label || you.role}</strong>
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

                    {/* Фаза Знайомства / Вступного слова */}
                    {phase === "intro" && (
                        <div className="game__info-box" style={{ borderColor: "#3182ce" }}>
                            🎙 <strong>Знайомство / Вступне слово!</strong>
                            {currentSpeaker ? (
                                <div style={{ marginTop: "6px" }}>
                                    Зараз говорить: <strong>{currentSpeaker.name}</strong>
                                </div>
                            ) : (
                                <div style={{ marginTop: "6px" }}>Ведучий обирає, хто виступає.</div>
                            )}
                        </div>
                    )}

                    {/* Нічний блок рішень для мафії / лікаря / шерифа */}
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
                            actionSuccessMsg={actionSuccessMsg}
                        />
                    )}

                    {!isHost && phase === "night" && !you?.alive && (
                        <div className="game__info-box">Ви спостерігаєте за грою. Дочекайтесь ранку.</div>
                    )}

                    {!isHost && phase === "discussion" && (
                        <div className="game__info-box">
                            💬 Ранок! Вільне обговорення. Обговорюйте підозрюваних голосом та в чаті.
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

function NightPanel({
                        role,
                        players,
                        youId,
                        selection,
                        onSelect,
                        donCheckSelection,
                        onSelectDonCheck,
                        onConfirm,
                        actionSuccessMsg
                    }) {
    const isMafiaType = role === "mafia" || role === "don";

    return (
        <div className="action-panel">
            {actionSuccessMsg && (
                <div style={{ padding: "8px", background: "#2f855a", color: "#fff", borderRadius: "4px", marginBottom: "10px" }}>
                    ✅ {actionSuccessMsg}
                </div>
            )}

            {isMafiaType && (
                <>
                    <ActionPanel
                        title="🔴 Оберіть жертву (Мафія):"
                        players={players}
                        youId={youId}
                        selection={selection}
                        onSelect={onSelect}
                        onConfirm={() => onConfirm("kill")}
                        confirmLabel="Вбити ціль"
                    />
                    {role === "don" && (
                        <ActionPanel
                            title="🟡 Перевірка Дона (чи гравець — шериф):"
                            players={players}
                            youId={youId}
                            selection={donCheckSelection}
                            onSelect={onSelectDonCheck}
                            onConfirm={() => onConfirm("check-sheriff")}
                            confirmLabel="Перевірити"
                        />
                    )}
                </>
            )}

            {role === "doctor" && (
                <ActionPanel
                    title="🟢 Кого врятувати цієї ночі?"
                    players={players}
                    youId={youId}
                    selection={selection}
                    onSelect={onSelect}
                    onConfirm={() => onConfirm("heal")}
                    confirmLabel="Лікувати"
                    allowSelf
                />
            )}

            {role === "sheriff" && (
                <ActionPanel
                    title="🟡 Кого перевірити?"
                    players={players}
                    youId={youId}
                    selection={selection}
                    onSelect={onSelect}
                    onConfirm={() => onConfirm("check")}
                    confirmLabel="Перевірити"
                />
            )}

            {role === "civilian" && (
                <div className="game__info-box">🌙 Ніч. Закрийте очі маскою або рукою. Мирні сплять.</div>
            )}
        </div>
    );
}

function ActionPanel({ title, players, youId, selection, onSelect, onConfirm, confirmLabel, allowSelf }) {
    const list = allowSelf ? players : players.filter((p) => p.id !== youId);
    return (
        <div className="action-panel" style={{ marginTop: "10px" }}>
            <h3>{title}</h3>
            <PlayerList
                players={list}
                youId={allowSelf ? undefined : youId}
                selectable
                selectedId={selection}
                onSelect={onSelect}
            />
            <button className="action-panel__confirm" disabled={!selection} onClick={onConfirm} style={{ marginTop: "8px" }}>
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
            <button className="action-panel__confirm" disabled={!selection} onClick={onConfirm} style={{ marginTop: "8px" }}>
                Проголосувати
            </button>
        </div>
    );
}