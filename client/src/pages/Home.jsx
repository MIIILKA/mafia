import { useEffect, useState } from "react";
import "./Home.scss";

const MAFIA_ALIASES = [
  "Аль Капоне",
  "Дон Корлеоне",
  "Консильєрі",
  "Лаки Лучано",
  "Тінь Міста",
  "Чорний Туз",
  "Комісар Каттані",
  "Хрещений Батько",
  "Френк Костелло",
  "Вінченцо"
];

const TELEGRAM_TEXT = "МІСТО ЗАСИНАЄ... ЧАС ОБРАТИ СВОЮ СТОРОНУ.";

export default function Home({ onCreate, onJoin, error }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState("create");
  const [typedText, setTypedText] = useState("");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Ефект друкарської машинки
  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      setTypedText(TELEGRAM_TEXT.slice(0, idx));
      if (idx >= TELEGRAM_TEXT.length) clearInterval(interval);
    }, 45);
    return () => clearInterval(interval);
  }, []);

  // 3D-паралакс від руху миші
  function handleMouseMove(e) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const x = ((e.clientX - cx) / cx) * 14;
    const y = ((e.clientY - cy) / cy) * -14;
    setTilt({ x, y });
  }

  function pickRandomAlias() {
    const random = MAFIA_ALIASES[Math.floor(Math.random() * MAFIA_ALIASES.length)];
    setName(random);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === "create") {
      onCreate(name.trim());
    } else {
      if (!roomCode.trim()) return;
      onJoin(roomCode.trim().toUpperCase(), name.trim());
    }
  }

  return (
      <div className="home-stage" onMouseMove={handleMouseMove}>
        {/* Іскри попелу сигари на фоні */}
        <div className="home-embers" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className={`ember ember--${i + 1}`} />
          ))}
        </div>

        {/* Декоративна 3D-карта зліва (Туз Пік) */}
        <div
            className="floating-card floating-card--left"
            style={{
              transform: `perspective(900px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg) rotateZ(-12deg)`
            }}
            aria-hidden="true"
        >
          <span className="floating-card__corner">A♠</span>
          <span className="floating-card__center">♠</span>
          <span className="floating-card__label">MAFIA</span>
        </div>

        {/* Декоративна 3D-карта справа (Маска) */}
        <div
            className="floating-card floating-card--right"
            style={{
              transform: `perspective(900px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg) rotateZ(12deg)`
            }}
            aria-hidden="true"
        >
          <span className="floating-card__corner">K♥</span>
          <span className="floating-card__center">🎭</span>
          <span className="floating-card__label">NOIR</span>
        </div>

        <div className="home">
          <div className="home__badge">ЗАКРИТИЙ КЛУБ • VIP ДОСТУП</div>
          <h1 className="home__title">🎭 MAFIA NOIR</h1>

          <p className="home__telegram">
            {typedText}
            <span className="home__cursor">|</span>
          </p>

          <div className="home__card">
            <div className="home__card-sheen" />
            <div className="home__stamp">ЦІЛКОМ ТАЄМНО</div>

            <div className="home__tabs">
              <button
                  className={`home__tab ${mode === "create" ? "home__tab--active" : ""}`}
                  onClick={() => setMode("create")}
                  type="button"
              >
                Створити стіл
              </button>
              <button
                  className={`home__tab ${mode === "join" ? "home__tab--active" : ""}`}
                  onClick={() => setMode("join")}
                  type="button"
              >
                Увійти за кодом
              </button>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <form className="home__form" onSubmit={handleSubmit}>
              <label className="home__label">
                <span>Ваш позивний</span>
                <div className="home__input-row">
                  <input
                      className="home__input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Введіть ім'я або згенеруйте..."
                      maxLength={20}
                  />
                  <button
                      type="button"
                      className="home__alias-btn"
                      onClick={pickRandomAlias}
                      title="Випадковий мафіозний позивний"
                  >
                    🎲
                  </button>
                </div>
              </label>

              {mode === "join" && (
                  <label className="home__label">
                    Код кімнати
                    <input
                        className="home__input home__input--code"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        placeholder="XXXXX"
                        maxLength={5}
                    />
                  </label>
              )}

              <button className="home__submit" type="submit">
                {mode === "create" ? "🔥 Відкрити кімнату" : "🚪 Сісти за стіл"}
              </button>
            </form>
          </div>
        </div>
      </div>
  );
}