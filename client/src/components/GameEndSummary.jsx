import "./GameEndSummary.scss";

export default function GameEndSummary({ room, isHost, onResetLobby }) {
    const isMafiaWin = room?.winnerTeam === "mafia";
    const participants = (room?.players || []).filter((p) => !p.isHost);

    return (
        <div className={`end-summary ${isMafiaWin ? "end-summary--mafia" : "end-summary--citizens"}`}>
            <div className="end-summary__icon">{isMafiaWin ? "🔫" : "🏆"}</div>
            <h2 className="end-summary__title">
                {isMafiaWin ? "ПЕРЕМОГА МАФІЇ!" : "ПЕРЕМОГА МИРНИХ ЖИТЕЛІВ!"}
            </h2>
            <p className="end-summary__subtitle">
                {room?.log?.[room.log.length - 1]}
            </p>

            <div className="end-summary__roster">
                <h4>Розкриття всіх карт столу:</h4>
                <div className="end-summary__grid">
                    {participants.map((p) => (
                        <div key={p.id} className={`end-summary__player ${!p.alive ? "end-summary__player--dead" : ""}`}>
                            <span className="end-summary__seat">№{p.number}</span>
                            <span className="end-summary__name">{p.name}</span>
                            <span className={`end-summary__role role-tag--${p.role}`}>
                {room?.roleInfo?.[p.role]?.label || p.role}
              </span>
                        </div>
                    ))}
                </div>
            </div>

            {isHost && (
                <button type="button" className="end-summary__reset-btn" onClick={onResetLobby}>
                    🔄 Нова гра (повернути всіх у лобі)
                </button>
            )}
        </div>
    );
}