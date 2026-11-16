import { useState } from "react";
import PlayerList from "../components/PlayerList.jsx";
import "./Lobby.scss";

const CONFIGURABLE_ROLES = [
    { key: "don", label: "🎩 Дон мафії", max: 1 },
    { key: "mafia", label: "🔫 Звичайна мафія", max: 3 },
    { key: "sheriff", label: "🌟 Шериф", max: 1 },
    { key: "doctor", label: "💉 Лікар", max: 1 },
    { key: "maniac", label: "🔪 Маніяк (одинак)", max: 1 },
    { key: "beauty", label: "💋 Красуня (блок ночі)", max: 1 },
    { key: "immortal", label: "🛡️ Безсмертний", max: 1 }
];

export default function Lobby({ room, onStart, onLeave, onSetRoleConfig, error }) {
    const [copied, setCopied] = useState(false);
    const [selectedRoleKey, setSelectedRoleKey] = useState("don");
    const [builderOpen, setBuilderOpen] = useState(false);

    const isHost = room.you?.isHost;
    const actualPlayers = room.players.filter((p) => !p.isHost);
    const canStart = actualPlayers.length >= 1;
    const cfg = room.roleConfig || {};

    function copyRoomCode() {
        navigator.clipboard?.writeText(room.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function updateRoleCount(key, delta, max) {
        const nextVal = Math.max(0, Math.min(max, (cfg[key] || 0) + delta));
        onSetRoleConfig?.({ ...cfg, [key]: nextVal });
    }

    const count = actualPlayers.length;
    const specialCount = CONFIGURABLE_ROLES.reduce((sum, r) => sum + (cfg[r.key] || 0), 0);
    const citizensCount = Math.max(0, count - specialCount);

    const activeLabels = CONFIGURABLE_ROLES.filter((r) => (cfg[r.key] || 0) > 0).map(
        (r) => `${r.label.split(" ").slice(1).join(" ")} (${cfg[r.key]})`
    );
    if (citizensCount > 0) activeLabels.push(`Мирні (${citizensCount})`);

    const roleKeys = ["don", "mafia", "sheriff", "doctor", "maniac", "beauty", "immortal", "citizen"];

    return (
        <div className="lobby">
            <div className="lobby__header">
                <h2>КІМНАТА {room.code}</h2>
                <button type="button" onClick={copyRoomCode} className="lobby__copy-btn">
                    {copied ? "✅ Код скопійовано!" : "📋 Скопіювати код запрошення"}
                </button>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="lobby__card">
                <h3 className="lobby__players-title">Гравці ({room.players.length})</h3>
                <PlayerList players={room.players} youId={room.you?.id} roleInfo={room.roleInfo} />

                {/* Склад колоди */}
                {count > 0 && (
                    <div className="lobby__deck-info">
                        🎴 <strong>Колода столу ({count} гравців):</strong>{" "}
                        {activeLabels.length > 0 ? activeLabels.join(", ") : "Усі мирні"}
                    </div>
                )}

                {/* Випадаючий конструктор ролей для Ведучого */}
                {isHost && (
                    <div style={{ marginTop: "12px" }}>
                        <button
                            type="button"
                            onClick={() => setBuilderOpen((v) => !v)}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                borderRadius: "10px",
                                border: "1px solid rgba(246, 173, 85, 0.35)",
                                background: "rgba(246, 173, 85, 0.08)",
                                color: "#f6ad55",
                                fontSize: "13px",
                                fontWeight: 700,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer"
                            }}
                        >
                            <span>⚙️ Налаштування столу (Конструктор ролей)</span>
                            <span>{builderOpen ? "▲" : "▼"}</span>
                        </button>

                        {builderOpen && (
                            <div
                                style={{
                                    marginTop: "8px",
                                    padding: "12px",
                                    borderRadius: "10px",
                                    background: "rgba(12, 12, 18, 0.85)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px"
                                }}
                            >
                                {CONFIGURABLE_ROLES.map((r) => {
                                    const val = cfg[r.key] || 0;
                                    return (
                                        <div
                                            key={r.key}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                fontSize: "13px"
                                            }}
                                        >
                                            <span>{r.label}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => updateRoleCount(r.key, -1, r.max)}
                                                    disabled={val <= 0}
                                                    style={{
                                                        width: "26px",
                                                        height: "26px",
                                                        borderRadius: "6px",
                                                        border: "1px solid rgba(255,255,255,0.15)",
                                                        background: "#1a202c",
                                                        color: "#fff",
                                                        cursor: "pointer"
                                                    }}
                                                >
                                                    -
                                                </button>
                                                <strong style={{ minWidth: "16px", textAlign: "center" }}>{val}</strong>
                                                <button
                                                    type="button"
                                                    onClick={() => updateRoleCount(r.key, 1, r.max)}
                                                    disabled={val >= r.max}
                                                    style={{
                                                        width: "26px",
                                                        height: "26px",
                                                        borderRadius: "6px",
                                                        border: "1px solid rgba(255,255,255,0.15)",
                                                        background: "#1a202c",
                                                        color: "#fff",
                                                        cursor: "pointer"
                                                    }}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Дошка пошани вечора (з'являється після 1-ї зіграної партії) */}
                {(room.leaderboard || []).length > 0 && (
                    <div
                        style={{
                            marginTop: "14px",
                            padding: "12px",
                            borderRadius: "12px",
                            background: "rgba(214, 158, 46, 0.08)",
                            border: "1px solid rgba(246, 173, 85, 0.3)"
                        }}
                    >
                        <div
                            style={{
                                fontSize: "12px",
                                fontWeight: 800,
                                letterSpacing: "0.08em",
                                color: "#f6e05e",
                                marginBottom: "8px",
                                textTransform: "uppercase"
                            }}
                        >
                            🏆 Дошка пошани вечора
                        </div>
                        {room.leaderboard.map((s, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: "13px",
                                    padding: "4px 0",
                                    borderBottom: "1px solid rgba(255,255,255,0.05)"
                                }}
                            >
                <span>
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "•"} {s.name}
                </span>
                                <span style={{ color: "#cbd5e0" }}>
                  Перемог: <strong>{s.wins}</strong> / {s.games}
                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Інтерактивні картки-підказки ролей */}
                <div className="lobby__roles-guide">
                    <div className="lobby__roles-tabs">
                        {roleKeys.map((key) => (
                            <button
                                key={key}
                                type="button"
                                className={`lobby__role-pill ${selectedRoleKey === key ? "lobby__role-pill--active" : ""}`}
                                onClick={() => setSelectedRoleKey(key)}
                            >
                                {room.roleInfo?.[key]?.label || key}
                            </button>
                        ))}
                    </div>
                    {room.roleInfo?.[selectedRoleKey] && (
                        <p className="lobby__role-desc">{room.roleInfo[selectedRoleKey].description}</p>
                    )}
                </div>

                <div style={{ marginTop: "1.2rem", display: "flex", gap: "10px", flexDirection: "column" }}>
                    {isHost ? (
                        <button className="lobby__start" disabled={!canStart} onClick={onStart}>
                            {canStart ? "🔥 Почати гру" : "Очікуємо гравців..."}
                        </button>
                    ) : (
                        <p className="lobby__waiting">Очікуємо, поки ведучий почне гру...</p>
                    )}

                    <button
                        type="button"
                        className="lobby__start"
                        style={{ background: "rgba(255,255,255,0.08)", boxShadow: "none" }}
                        onClick={onLeave}
                    >
                        🚪 Вийти з кімнати
                    </button>
                </div>
            </div>
        </div>
    );
}