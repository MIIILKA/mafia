import { useEffect, useRef, useState } from "react";
import "./VideoTile.scss";

const STATUS_LABEL = {
    killed: "ВБИТО",
    banished: "ВИГНАНО"
};

export default function VideoTile({
                                      number,
                                      name,
                                      stream,
                                      isSelf,
                                      isHost,
                                      isSpeaking,
                                      isHiddenByNight,
                                      gesture,
                                      status,
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
    }, [stream, isHiddenByNight]);

    const isEliminated = showStatusOverlay && (status === "killed" || status === "banished");

    return (
        <div
            className={[
                "video-tile",
                isEliminated && "video-tile--eliminated",
                isSpeaking && "video-tile--speaking",
                isHost && "video-tile--host"
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {/* Великий золотий номер гравця в лівому верхньому куті камери */}
            {number && (
                <div className="video-tile__seat-number" title={`Гравець №${number}`}>
                    №{number}
                </div>
            )}

            {/* Спливаючий жест гравця */}
            {gesture && <div className="video-tile__gesture-bubble">{gesture}</div>}

            {/* Індикатор активного спікера */}
            {isSpeaking && <div className="video-tile__speaking-badge">🎙 ГОВОРИТЬ</div>}

            {/* Відео або заглушка / нічна маска */}
            {isHiddenByNight && !isEliminated ? (
                <div className="video-tile__night-mask">
                    <span className="video-tile__night-icon">🎭</span>
                    <span className="video-tile__night-text">МІСТО СПИТЬ</span>
                </div>
            ) : !isEliminated && stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isSelf}
                    className="video-tile__video"
                />
            ) : (
                <div className="video-tile__placeholder">
                    <span>{name?.[0]?.toUpperCase() || "?"}</span>
                </div>
            )}

            {/* Плашка, якщо гравця вбили/вигнали */}
            {isEliminated && (
                <div className={`video-tile__overlay video-tile__overlay--${status}`}>
                    <span className="video-tile__overlay-text">{STATUS_LABEL[status]}</span>
                </div>
            )}

            {!isEliminated && disconnected && (
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
                            {hostControls.onTransferHost && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            hostControls.onTransferHost();
                                        }}
                                    >
                                        👑 Зробити ведучим
                                    </button>
                                    <div className="video-tile__host-menu-divider" />
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false);
                                    hostControls.onMuteMic();
                                }}
                            >
                                🎤 Вимкнути мікрофон
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false);
                                    hostControls.onMuteCam();
                                }}
                            >
                                📷 Вимкнути камеру
                            </button>
                            <div className="video-tile__host-menu-divider" />
                            {status !== "killed" && (
                                <button
                                    type="button"
                                    className="video-tile__host-menu-danger"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        hostControls.onKill();
                                    }}
                                >
                                    ☠ Позначити вбитим
                                </button>
                            )}
                            {status !== "banished" && (
                                <button
                                    type="button"
                                    className="video-tile__host-menu-danger"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        hostControls.onBanish();
                                    }}
                                >
                                    🚪 Позначити вигнаним
                                </button>
                            )}
                            {status !== "alive" && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        hostControls.onRevive();
                                    }}
                                >
                                    ♻ Повернути живим
                                </button>
                            )}
                            <div className="video-tile__host-menu-divider" />
                            <button
                                type="button"
                                className="video-tile__host-menu-danger"
                                onClick={() => {
                                    setMenuOpen(false);
                                    hostControls.onKick();
                                }}
                            >
                                ✕ Вилучити з кімнати
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}