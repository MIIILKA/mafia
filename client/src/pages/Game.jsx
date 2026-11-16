import { useEffect, useState } from "react";
import PlayerList from "../components/PlayerList.jsx";
import Chat from "../components/Chat.jsx";
import Timer from "../components/Timer.jsx";
import HostNotebook from "../components/HostNotebook.jsx";
import RoleRevealModal from "../components/RoleRevealModal.jsx";
import MorningNewspaper from "../components/MorningNewspaper.jsx";
import GameEndSummary from "../components/GameEndSummary.jsx";
import { playGunshot } from "../sounds.js";
import "./Game.scss";

const PHASE_LABEL = {
    intro: "🎙 Вступне слово (Знайомство)",
    night: "🌙 Ніч",
    discussion: "💬 Загальне обговорення",
    speeches: "🎙 Виступи по колу",
    voting: "🗳 Голосування",
    ended: "🏁 Гру завершено",
    shootout_speeches: "⚔️ Перестрілка: виправдання",
    shootout_voting: "⚔️ Перестрілка: фінальне голосування",
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
    const nominatedPlayers = alivePlayers.filter((p) => (room?.nominatedIds || []).includes(p.id));

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
    const canUseMafiaChat = isHost || you?.role === "mafia" || you?.role === "don";

    return (
        <div className="game">
            {/* 3D-карта ролі при старті гри */}
            <RoleRevealModal
                role={you?.role}
                number={you?.number}
                dayNumber={room?.dayNumber}
                phase={phase}
                roleInfo={room?.roleInfo}
            />

            {/* Ранкова газета після кожної ночі */}
            <MorningNewspaper report={room?.lastMorningReport} />

            <div className="game__top">
                <div className="game__phase">
                    <span className="game__phase-label">{PHASE_LABEL[phase] || phase}</span>
                    <span className="game__day">День {room?.dayNumber}</span>
                </div>
                <Timer endsAt={room?.timerEndsAt} isPaused={room?.isPaused} />
            </div>

            {/* Баннер спікера */}
            {!isHost && isMyTurnToSpeak && phase !== "night" && phase !== "ended" && (
                <div
                    style={{
                        padding: "12px 16px",
                        background: "linear-gradient(135deg, #2b6cb0, #1a365d)",
                        color: "#fff",
                        borderRadius: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        border: "1px solid rgba(99, 179, 237, 0.4)"
                    }}
                >
          <span>
            🎙 <strong>Ваш час виступати!</strong> Говоріть у мікрофон та за потреби виставте кандидата.
          </span>
                    <button
                        type="button"
                        className="action-panel__confirm"
                        style={{ width: "auto", padding: "8px 14px", fontSize: "0.85rem" }}
                        onClick={() => socket?.emit("pass-speech", { code: room?.code })}
                    >
                        Завершити промову 🛑
                    </button>
                </div>
            )}

            {/* Панель керування для ВЕДУЧОГО */}
            {isHost && phase !== "ended" && (
                <div
                    className="game__role-banner game__role-banner--host"
                    style={{ flexDirection: "column", gap: "10px", alignItems: "flex-start" }}
                >
                    <div>
                        Ви — <strong>Ведучий</strong>. Ви керуєте перебігом гри.
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: "100%" }}>
                        {phase === "night" && (
                            <>
                                <button
                                    type="button"
                                    style={{ background: "#4a5568", padding: "6px 10px", fontSize: "0.85rem" }}
                                    onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "sleep" })}
                                >
                                    💤 Усі сплять
                                </button>
                                <button
                                    type="button"
                                    style={{ background: "#e53e3e", padding: "6px 10px", fontSize: "0.85rem" }}
                                    onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "mafia" })}
                                >
                                    🔴 Мафія
                                </button>
                                <button
                                    type="button"
                                    style={{ background: "#d69e2e", padding: "6px 10px", fontSize: "0.85rem" }}
                                    onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "don" })}
                                >
                                    🟡 Дон
                                </button>

                                <button
                                    type="button"
                                    style={{ background: "#38a169", padding: "6px 10px", fontSize: "0.85rem" }}
                                    onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "doctor" })}
                                >
                                    🟢 Лікар
                                </button>
                                <button
                                    type="button"
                                    style={{ background: "#3182ce", padding: "6px 10px", fontSize: "0.85rem" }}
                                    onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "sheriff" })}
                                >
                                    🔵 Шериф
                                </button>
                                <button
                                    type="button"
                                    style={{ background: "#b83280", padding: "6px 10px", fontSize: "0.85rem" }}
                                    onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "beauty" })}
                                >
                                    💋 Красуня
                                </button>
                                <button
                                    type="button"
                                    style={{ background: "#742a2a", padding: "6px 10px", fontSize: "0.85rem" }}
                                    onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "maniac" })}
                                >
                                    🔪 Маніяк
                                </button>
                                <button
                                    type="button"
                                    style={{ background: "#dd6b20", padding: "6px 10px", fontSize: "0.85rem", fontWeight: "bold" }}
                                    onClick={() => socket?.emit("host-advance-night", { code: room?.code, step: "resolve" })}
                                >
                                    ☀️ Завершити ніч
                                </button>
                            </>
                        )}

                        {(phase === "discussion" || phase === "speeches" || phase === "voting") && (
                            <>
                                {room?.isPaused ? (
                                    <button
                                        type="button"
                                        style={{ background: "#38a169", padding: "6px 12px", fontSize: "0.85rem", color: "#fff" }}
                                        onClick={() => socket?.emit("host-resume-timer", { code: room?.code })}
                                    >
                                        ▶️ Відновити
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        style={{ background: "#dd6b20", padding: "6px 12px", fontSize: "0.85rem", color: "#fff" }}
                                        onClick={() => socket?.emit("host-pause-timer", { code: room?.code })}
                                    >
                                        ⏸ Пауза
                                    </button>
                                )}

                                <button
                                    type="button"
                                    style={{ background: "#3182ce", padding: "6px 12px", fontSize: "0.85rem", color: "#fff" }}
                                    onClick={() => socket?.emit("host-add-time", { code: room?.code, seconds: 30 })}
                                >
                                    ⏳ +30 сек
                                </button>
                            </>
                        )}

                        {phase === "speeches" && (
                            <button
                                type="button"
                                className="action-panel__confirm"
                                style={{ width: "auto", padding: "6px 12px", fontSize: "0.85rem", background: "#3182ce" }}
                                onClick={() => socket?.emit("pass-speech", { code: room?.code })}
                            >
                                🎙 Наступний
                            </button>
                        )}

                        {phase === "discussion" && (
                            <>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ width: "auto", padding: "6px 12px", fontSize: "0.85rem", background: "#e53e3e" }}
                                    onClick={() => onSetPhase("voting")}
                                >
                                    🗳 Почати голосування
                                </button>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ width: "auto", padding: "6px 12px", fontSize: "0.85rem", background: "#805ad5" }}
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
                                    style={{ width: "auto", padding: "6px 12px", fontSize: "0.85rem", background: "#718096" }}
                                    onClick={() => socket?.emit("skip-voting", { code: room?.code })}
                                >
                                    ⏩ Пропустити
                                </button>
                                <button
                                    type="button"
                                    className="action-panel__confirm"
                                    style={{ width: "auto", padding: "6px 12px", fontSize: "0.85rem", background: "#805ad5" }}
                                    onClick={() => onSetPhase("night")}
                                >
                                    🌙 Ніч
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {!isHost && you?.role && phase !== "ended" && (
                <div className={`game__role-banner game__role-banner--${you.role}`}>
                    Ваша роль: <strong>{room?.roleInfo?.[you.role]?.label || you.role}</strong>
                    {you?.number && <span style={{ opacity: 0.85 }}>(Ваш номер: №{you.number})</span>}
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

                    {/* Виставлення кандидатури під час виступу */}
                    {(isMyTurnToSpeak || isHost) && phase === "speeches" && (
                        <div className="action-panel">
                            <h3>☝️ Виставити гравця на голосування:</h3>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {alivePlayers.map((p) => {
                                    const isNominated = (room?.nominatedIds || []).includes(p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => socket?.emit("nominate-player", { code: room?.code, targetId: p.id })}
                                            style={{
                                                padding: "8px 14px",
                                                borderRadius: "8px",
                                                border: isNominated ? "1px solid #fc8181" : "1px solid rgba(255,255,255,0.15)",
                                                background: isNominated ? "#9b2c2c" : "rgba(255,255,255,0.06)",
                                                color: "#fff",
                                                fontWeight: 700,
                                                cursor: "pointer"
                                            }}
                                        >
                                            №{p.number} {p.name} {isNominated ? "✓" : ""}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Табло виставлених на голосування */}
                    {(room?.nominatedIds || []).length > 0 && (phase === "speeches" || phase === "voting") && (
                        <div className="game__info-box" style={{ borderColor: "#e53e3e" }}>
                            🎯 <strong>Виставлені на голосування:</strong>{" "}
                            {room.nominatedIds
                                .map((id) => {
                                    const p = realPlayers.find((pl) => pl.id === id);
                                    return p ? `№${p.number} ${p.name}` : null;
                                })
                                .filter(Boolean)
                                .join(", ")}
                        </div>
                    )}

                    {(phase === "speeches" || phase === "shootout_speeches" || phase === "intro") && (
                        <div className="game__info-box" style={{ borderColor: "#3182ce" }}>
                            🎙 <strong>Виступи по колу!</strong>
                            {currentSpeaker ? (
                                <div style={{ marginTop: "6px" }}>
                                    Зараз говорить:{" "}
                                    <strong>
                                        №{currentSpeaker.number} {currentSpeaker.name}
                                    </strong>
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
                        <div className="game__info-box">💬 День! Загальне обговорення.</div>
                    )}

                    {!isHost && (phase === "voting" || phase === "shootout_voting") && you?.alive && (
                        <VotingPanel
                            players={
                                phase === "shootout_voting"
                                    ? alivePlayers.filter((p) => (room?.shootoutIds || []).includes(p.id))
                                    : nominatedPlayers
                            }
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
                        <GameEndSummary
                            room={room}
                            isHost={isHost}
                            onResetLobby={() => socket?.emit("host-reset-lobby", { code: room?.code })}
                        />
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
                    <Chat
                        messages={messages}
                        onSend={onSendMessage}
                        disabled={!isHost && !you?.alive}
                        canUseMafiaChat={canUseMafiaChat}
                    />
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
                <div
                    style={{
                        padding: "8px 12px",
                        background: "#2f855a",
                        color: "#fff",
                        borderRadius: "8px",
                        marginBottom: "10px",
                        fontWeight: 700
                    }}
                >
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
            {nightStep === "beauty" && role === "beauty" && (
                <ActionPanel
                    title="💋 Кого відволікти цієї ночі? (Дія гравця буде заблокована)"
                    players={players}
                    youId={youId}
                    selection={selection}
                    onSelect={onSelect}
                    onConfirm={() => onConfirm("block")}
                    confirmLabel="Відволікти"
                />
            )}

            {nightStep === "maniac" && role === "maniac" && (
                <ActionPanel
                    title="🔪 Оберіть жертву (Маніяк):"
                    players={players}
                    youId={youId}
                    selection={selection}
                    onSelect={onSelect}
                    onConfirm={() => onConfirm("maniac-kill")}
                    confirmLabel="Вбити"
                />
            )}

            {((nightStep === "mafia" && !isMafiaType) ||
                (nightStep === "don" && role !== "don") ||
                (nightStep === "doctor" && role !== "doctor") ||
                (nightStep === "sheriff" && role !== "sheriff")) ||
                (nightStep === "beauty" && role !== "beauty") ||
                (nightStep === "maniac" && role !== "maniac")
                && (
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
            <button
                className="action-panel__confirm"
                disabled={!selection}
                onClick={onConfirm}
                style={{ marginTop: "10px" }}
            >
                {confirmLabel}
            </button>
        </div>
    );
}

function VotingPanel({ players, youId, selection, onSelect, onConfirm }) {
    const list = players.filter((p) => p.id !== youId);
    return (
        <div className="action-panel">
            <h3>🗳 Голосування (оберіть серед виставлених):</h3>
            {list.length === 0 ? (
                <p style={{ color: "#a0aec0", fontSize: "14px" }}>Немає доступних кандидатів для вашого голосу.</p>
            ) : (
                <>
                    <PlayerList players={list} selectable selectedId={selection} onSelect={onSelect} />
                    <button
                        className="action-panel__confirm"
                        disabled={!selection}
                        onClick={onConfirm}
                        style={{ marginTop: "10px" }}
                    >
                        Проголосувати
                    </button>
                </>
            )}
        </div>
    );
}