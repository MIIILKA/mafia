import PlayerList from "../components/PlayerList.jsx";
import "./Lobby.scss";

export default function Lobby({ room, onStart, error }) {
  const isHost = room.you?.isHost;
  const canStart = room.players.length >= 4;

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

        {isHost ? (
          <button className="lobby__start" disabled={!canStart} onClick={onStart}>
            {canStart ? "Почати гру" : `Потрібно ще ${4 - room.players.length} гравців`}
          </button>
        ) : (
          <p className="lobby__waiting">Очікуємо, поки ведучий почне гру...</p>
        )}
      </div>
    </div>
  );
}
