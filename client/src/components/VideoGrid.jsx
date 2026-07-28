import VideoTile from "./VideoTile.jsx";
import "./VideoGrid.scss";

export default function VideoGrid({
                                      players,
                                      youId,
                                      isHostViewer,
                                      localStream,
                                      remoteStreams,
                                      showStatusOverlay,
                                      mediaError,
                                      micOn,
                                      camOn,
                                      onToggleMic,
                                      onToggleCam,
                                      onHostSetStatus,
                                      onHostKick,
                                      onHostMediaControl
                                  }) {
    return (
        <div className="video-grid-wrap">
            <div className="video-grid">
                {players.map((p) => {
                    const isSelf = p.id === youId;

                    const hostControls =
                        isHostViewer && !isSelf
                            ? {
                                onMuteMic: () => onHostMediaControl(p.id, "mute-mic"),
                                onMuteCam: () => onHostMediaControl(p.id, "mute-cam"),
                                onKill: () => onHostSetStatus(p.id, "killed"),
                                onBanish: () => onHostSetStatus(p.id, "banished"),
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
                            name={p.name}
                            isHost={p.isHost}
                            isSelf={isSelf}
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
            </div>
        </div>
    );
}