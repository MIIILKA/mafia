import "./PlayerList.scss";

const ROLE_CLASS = {
  mafia: "role-mafia",
  don: "role-mafia",
  doctor: "role-doctor",
  sheriff: "role-sheriff",
  citizen: "role-citizen",
  host: "role-host"
};

const STATUS_MARK = {
  killed: { symbol: "☠", label: "Вбитий", className: "player-list__status-mark--killed" },
  banished: { symbol: "🚪", label: "Вигнаний", className: "player-list__status-mark--banished" }
};

export default function PlayerList({
  players,
  youId,
  roleInfo,
  selectable = false,
  selectedId,
  onSelect,
  disabledIds = []
}) {
  return (
    <ul className="player-list">
      {players.map((p) => {
        const isDisabled = !p.alive || p.id === youId || disabledIds.includes(p.id);
        const isSelected = selectedId === p.id;
        const statusMark = p.status && STATUS_MARK[p.status];

        return (
          <li
            key={p.id}
            className={[
              "player-list__item",
              !p.alive && "player-list__item--dead",
              isSelected && "player-list__item--selected",
              selectable && !isDisabled && "player-list__item--clickable"
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              if (selectable && !isDisabled) onSelect?.(p.id);
            }}
          >
            <span className="player-list__name">
              {p.name}
              {p.isHost && <span className="player-list__badge">Ведучий</span>}
              {p.id === youId && <span className="player-list__badge">Ви</span>}
              {p.disconnected && <span className="player-list__badge">Перепідключення</span>}
            </span>
            {p.role && (
              <span className={`player-list__role ${ROLE_CLASS[p.role] || ""}`}>
                {roleInfo?.[p.role]?.label || p.role}
              </span>
            )}
            {statusMark && (
              <span className={`player-list__status-mark ${statusMark.className}`} title={statusMark.label}>
                {statusMark.symbol}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
