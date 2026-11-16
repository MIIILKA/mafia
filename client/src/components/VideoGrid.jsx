import VideoTile from "./VideoTile.jsx";
import "./VideoGrid.scss";

export default function VideoGrid({
                                      players,
                                      youId,
                                      isHostViewer,
                                      localStream,
                                      remoteStreams,
                                      showStatusOverlay,
                                      currentSpeakerId,
                                      phase,
                                      nightVisibleIds,
                                      gestures,
                                      mediaError,
                                      micOn,
                                      camOn,
                                      canTransferHost,
                                      onToggleMic,
                                      onToggleCam,
                                      onSendGesture,
                                      onHostSetStatus,
                                      onHostKick,
                                      onHostMediaControl,
                                      onHostTransferHost
                                  }) {
    return (
        <div className="video-grid-wrap">
            <div className="video-grid">
                {players.map((p) => {
                    const isSelf = p.id === youId;
                    const isSpeaking = phase === "speeches" && currentSpeakerId === p.id;
                    // Вночі бачимо камеру лише якщо ми ведучий, це наша камера, або гравець зараз прокинувся (наприклад, мафія)
                    const isHiddenByNight = false;
                    const hostControls =
                        isHostViewer && !isSelf
                            ? {
                                onMuteMic: () => onHostMediaControl(p.id, "mute-mic"),
                                onMuteCam: () => onHostMediaControl(p.id, "mute-cam"),
                                onKill: () => onHostSetStatus(p.id, "killed"),
                                onBanish: () => onHostSetStatus(p.id, "banished"),
                                onTransferHost:
                                    canTransferHost && onHostTransferHost
                                        ? () => {
                                            if (window.confirm(`Передати роль Ведучого гравцю ${p.name}?`)) {
                                                onHostTransferHost(p.id);
                                            }
                                        }
                                        : null,
                                onRevive: () => onHostSetStatus(p.id, "alive"),
                                onKick: () => {
                                    if (window.confirm(`Вилучити гравця ${p.name} з кімнати?`)) {
                                        onHostKick(p.id);
                                    }
                                }
                            }
                            : null;

                    return (
                        <VideoTile
                            key={p.id}
                            number={p.number}
                            name={p.name}
                            isHost={p.isHost}
                            isSelf={isSelf}
                            isSpeaking={isSpeaking}
                            isHiddenByNight={isHiddenByNight}
                            gesture={gestures?.[p.id]}
                            status={p.status}
                            disconnected={p.disconnected}
                            showStatusOverlay={showStatusOverlay}
                            stream={isSelf ? localStream : remoteStreams[p.id]}
                            hostControls={hostControls}
                        />
                    );
                })}
            </div>

            <div className="video-grid-controls">
                {mediaError && <span className="video-grid-controls__error">{mediaError}</span>}

                {localStream && (
                    <>
                        <button
                            className={`video-grid-controls__btn ${!micOn ? "video-grid-controls__btn--off" : ""}`}
                            onClick={onToggleMic}
                            disabled={localStream.getAudioTracks().length === 0}
                            type="button"
                        >
                            {micOn ? "🎤 Мікрофон" : "🔇 Мікрофон вимкнено"}
                        </button>
                        <button
                            className={`video-grid-controls__btn ${!camOn ? "video-grid-controls__btn--off" : ""}`}
                            onClick={onToggleCam}
                            disabled={localStream.getVideoTracks().length === 0}
                            type="button"
                        >
                            {camOn ? "📷 Камера" : "🚫 Камера вимкнена"}
                        </button>
                    </>
                )}

                {onSendGesture && (
                    <div className="video-grid-controls__gestures">
                        {[
                            { icon: "👍", label: "Вірю" },
                            { icon: "👎", label: "Підозрюю" },
                            { icon: "❓", label: "Хто ти?" },
                            { icon: "🤝", label: "Підтримую" }
                        ].map((g) => (
                            <button
                                key={g.icon}
                                type="button"
                                className="video-grid-controls__gesture-btn"
                                onClick={() => onSendGesture(`${g.icon} ${g.label}`)}
                                title={g.label}
                            >
                                {g.icon}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}