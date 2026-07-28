import { useEffect, useRef, useState } from "react";
import "./VideoTile.scss";

const STATUS_LABEL = {
  killed: "ВБИТО",
  banished: "ВИГНАНО"
};

export default function VideoTile({
                                    name,
                                    stream,
                                    isSelf,
                                    isHost,
                                    status,
                                    isSleeping,
                                    showStatusOverlay,
                                    disconnected,
                                    hostControls,
                                    micActive
                                  }) {
  const videoRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream, isSleeping]);

  const isEliminated = showStatusOverlay && (status === "killed" || status === "banished");

  return (
      <div className={`video-tile ${isEliminated ? "video-tile--eliminated" : ""} ${isSleeping ? "video-tile--sleeping" : ""}`}>
        {stream && !isSleeping ? (
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isSelf}
                className="video-tile__video"
            />
        ) : (
            <div className="video-tile__placeholder">
              <span>{isSleeping ? "🌙" : name?.[0]?.toUpperCase() || "?"}</span>
            </div>
        )}

        {isSleeping && (
            <div className="video-tile__overlay video-tile__overlay--sleeping">
              <span className="video-tile__overlay-text">🌙 Спить</span>
            </div>
        )}

        {isEliminated && !isSleeping && (
            <div className={`video-tile__overlay video-tile__overlay--${status}`}>
              <span className="video-tile__overlay-text">{STATUS_LABEL[status]}</span>
            </div>
        )}

        {!isEliminated && !isSleeping && disconnected && (
            <div className="video-tile__reconnecting">Перепідключення...</div>
        )}

        <div className="video-tile__label">
          <span className="video-tile__name">{name}</span>
          {isHost && <span className="video-tile__tag video-tile__tag--host">Ведучий</span>}
          {isSelf && <span className="video-tile__tag">Ви</span>}
          {micActive === false && <span className="video-tile__mic-off">🔇</span>}
        </div>

        {hostControls && (
            <div className="video-tile__host-panel">
              <button
                  type="button"
                  className="video-tile__host-toggle"
                  onClick={() => setMenuOpen((v) => !v)}
                  title="Керування гравцем"
              >
                ⚙
              </button>

              {menuOpen && (
                  <div className="video-tile__host-menu">
                    <button type="button" onClick={() => hostControls.onMuteMic()}>
                      🎤 Вимкнути мікрофон
                    </button>
                    <button type="button" onClick={() => hostControls.onMuteCam()}>
                      📷 Вимкнути камеру
                    </button>
                    <div className="video-tile__host-menu-divider" />
                    {status !== "killed" && (
                        <button type="button" className="video-tile__host-menu-danger" onClick={() => hostControls.onKill()}>
                          ☠ Позначити вбитим
                        </button>
                    )}
                    {status !== "banished" && (
                        <button type="button" className="video-tile__host-menu-danger" onClick={() => hostControls.onBanish()}>
                          🚪 Позначити вигнаним
                        </button>
                    )}
                    {status !== "alive" && (
                        <button type="button" onClick={() => hostControls.onRevive()}>
                          ♻ Повернути живим
                        </button>
                    )}
                    <div className="video-tile__host-menu-divider" />
                    <button type="button" className="video-tile__host-menu-danger" onClick={() => hostControls.onKick()}>
                      ✕ Вилучити з кімнати
                    </button>
                  </div>
              )}
            </div>
        )}
      </div>
  );
}