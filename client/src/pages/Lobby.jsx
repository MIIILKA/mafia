import PlayerList from "../components/PlayerList.jsx";
import "./Lobby.scss";

export default function Lobby({ room, onStart, onLeave, error }) {
    const isHost = room.you?.isHost;
    // Потрібно 4 гравці БЕЗ ведучого
    const actualPlayers = room.players.filter((p) => !p.isHost);
    const canStart = actualPlayers.length >= 4;

    return (
        <div className="lobby">
            <div className="lobby__header">
                <h2>Кімната {room.code}</h2>
                <p className="lobby__hint">Поділіться кодом кімнати з друзями</p>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="lobby__card">
                <h3 className="lobby__players-title">
                    Гравці ({room.players.length})
                </h3>
                <PlayerList players={room.players} youId={room.you?.id} roleInfo={room.roleInfo} />

                <div style={{ marginTop: "1rem", display: "flex", gap: "10px", flexDirection: "column" }}>
                    {isHost ? (
                        <button className="lobby__start" disabled={!canStart} onClick={onStart}>
                            {canStart ? "Почати гру" : `Потрібно ще ${4 - actualPlayers.length} гравців (без ведучого)`}
                        </button>
                    ) : (
                        <p className="lobby__waiting">Очікуємо, поки ведучий почне гру...</p>
                    )}

                    <button
                        type="button"
                        className="lobby__start"
                        style={{ backgroundColor: "#4a5568" }}
                        onClick={onLeave}
                    >
                        🚪 Вийти з кімнати
                    </button>
                </div>
            </div>
        </div>
    );
}