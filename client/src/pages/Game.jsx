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
    discussion: "💬 Загальне обговорення",
    speeches: "🎙 Виступи по колу",
    voting: "🗳 Голосування",
    ended: "🏁 Гру завершено"
};

export default function Game({
                                 socket,
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

    const you = room?.you;
    const phase = room?.phase;
    const isHost = Boolean(you?.isHost);

    const alivePlayers = (room?.players || []).filter((p) => p.alive && !p.isHost);
    const realPlayers = (room?.players || []).filter((p) => !p.isHost);

    useEffect(() => {
        setNightSelection(null);
        setDonCheckSelection(null);
        setVoteSelection(null);
        setActionSuccessMsg("");
    }, [phase, room?.dayNumber, room?.nightStep]);

    function handleNightConfirm(type) {
        if (type === "check-sheriff") {
            if (!donCheckSelection) return;
            onNightAction({ type, targetId: donCheckSelection });
            setActionSuccessMsg("Перевірку відправлено!");
            return;
        }
        if (!nightSelection) return;
        if (type === "kill") playGunshot?.();
        onNightAction({ type, targetId: nightSelection });
        setActionSuccessMsg("Вибір зафіксовано!");
    }

    function handleVoteConfirm() {
        if (!voteSelection) return;
        onVote(voteSelection);
    }

    const currentSpeaker = realPlayers.find((p) => p.id === room?.currentSpeakerId);
    const isMyTurnToSpeak = room?.currentSpeakerId === you?.id;

    return (
        <div className="game">
            <div className="game__top">
                <div className="game__phase">
                    <span className="game__phase-label">{PHASE_LABEL[phase] || phase}</span>
                    <span className="game__day">День {room?.dayNumber}</span>
                </div>
                <Timer endsAt={room?.timerEndsAt} />
            </div>

            {/* Баннер спікера (кнопка Завершити промову) */}
            {!isHost && isMyTurnToSpeak && phase !== "night" && phase !== "ended" && (
                <div style={{ padding: "12px", background: "#2b6cb0", color: "#fff", borderRadius: "8px", marginBottom: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🎙 <strong>Ваш час виступати!</strong> Говоріть у мікрофон.</span>
                    <button
                        type="button"
                        className="action-panel__confirm"
                        style={{ background: "#e53e3e", padding: "6px 14px", fontSize: "0.9rem" }}
                        onClick={() => socket?.emit("pass-speech", { code: room?.code })}
                    >
                        Завершити промову 🛑
                    </button>
                </div>
            )}

            {/* Панель керування для ВЕДУЧОГО */}
            {isHost && phase !== "ended" && (
                <div className="game__role-banner game__role-banner--host" style={{ flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
                    <div>
                        Ви — <strong>Ведучий</strong>. Ви керуєте перебігом гри.
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: "100%" }}>
                        {phase === "night" && (
                            <>
                                <button type="button" style={{ background: "#4a5568", padding: "6px 10px", fontSize: "0.85rem" }} onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "sleep" })}>
                                    💤 Усі сплять
                                </button>
                                <button type="button" style={{ background: "#e53e3e", padding: "6px 10px", fontSize: "0.85rem" }} onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "mafia" })}>
                                    🔴 Мафія
                                </button>
                                <button type="button" style={{ background: "#d69e2e", padding: "6px 10px", fontSize: "0.85rem" }} onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "don" })}>
                                    🟡 Дон
                                </button>
                                <button type="button" style={{ background: "#38a169", padding: "6px 10px", fontSize: "0.85rem" }} onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "doctor" })}>
                                    🟢 Лікар
                                </button>
                                <button type="button" style={{ background: "#3182ce", padding: "6px 10px", fontSize: "0.85rem" }} onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "sheriff" })}>
                                    🔵 Шериф
                                </button>
                                <button type="button" style={{ background: "#dd6b20", padding: "6px 10px", fontSize: "0.85rem", fontWeight: "bold" }} onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "resolve" })}>
                                    ☀️ Завершити ніч
                                </button>
                            </>
                        )}

                        {phase === "speeches" && (
                            <button
                                type="button"
                                className="action-panel__confirm"
                                style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#3182ce" }}
                                onClick={() => socket?.emit("pass-speech", { code: room?.code })}
                            >
                                🎙 Передати слово наступному
                            </button>
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
                            <>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#718096" }}
                                    onClick={() => socket?.emit("skip-voting", { code: room?.code })}
                                >
                                    ⏩ Пропустити голосування
                                </button>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#805ad5" }}
                                    onClick={() => onSetPhase("night")}
                                >
                                    🌙 Завершити голосування та оголосити ніч
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {!isHost && you?.role && phase !== "ended" && (
                <div className={`game__role-banner game__role-banner--${you.role}`}>
                    Ваша роль: <strong>{room?.roleInfo?.[you.role]?.label || you.role}</strong>
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

                    {(phase === "speeches" || phase === "intro") && (
                        <div className="game__info-box" style={{ borderColor: "#3182ce" }}>
                            🎙 <strong>Виступи по колу!</strong>
                            {currentSpeaker ? (
                                <div style={{ marginTop: "6px" }}>
                                    Зараз говорить: <strong>{currentSpeaker.name}</strong>
                                </div>
                            ) : (
                                <div style={{ marginTop: "6px" }}>Очікування виступу...</div>
                            )}
                        </div>
                    )}

                    {!isHost && phase === "night" && you?.alive && (
                        <NightStepPanel
                            role={you.role}
                            nightStep={room?.nightStep}
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
                            💬 День! Загальне обговорення.
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
                            {room?.log?.[room.log.length - 1]}
                        </div>
                    )}

                    <div className="game__players">
                        <h3>Гравці</h3>
                        <PlayerList players={room?.players || []} youId={you?.id} roleInfo={room?.roleInfo} />
                    </div>

                    <div className="game__log">
                        <h3>Хроніка</h3>
                        <ul>
                            {(room?.log || [])
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

function NightStepPanel({
                            role,
                            nightStep,
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

            {nightStep === "sleep" && (
                <div className="game__info-box">🌙 Ніч. Місто спить. Очікуйте своєї черги.</div>
            )}

            {nightStep === "mafia" && isMafiaType && (
                <ActionPanel
                    title="🔴 Оберіть жертву (Мафія):"
                    players={players}
                    youId={youId}
                    selection={selection}
                    onSelect={onSelect}
                    onConfirm={() => onConfirm("kill")}
                    confirmLabel="Вбити ціль"
                />
            )}

            {nightStep === "don" && role === "don" && (
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

            {nightStep === "doctor" && role === "doctor" && (
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

            {nightStep === "sheriff" && role === "sheriff" && (
                <ActionPanel
                    title="🔵 Кого перевірити?"
                    players={players}
                    youId={youId}
                    selection={selection}
                    onSelect={onSelect}
                    onConfirm={() => onConfirm("check")}
                    confirmLabel="Перевірити"
                />
            )}

            {((nightStep === "mafia" && !isMafiaType) ||
                (nightStep === "don" && role !== "don") ||
                (nightStep === "doctor" && role !== "doctor") ||
                (nightStep === "sheriff" && role !== "sheriff")) && (
                <div className="game__info-box">🌙 Ніч. Закрийте очі, ведучий викликає іншу роль...</div>
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