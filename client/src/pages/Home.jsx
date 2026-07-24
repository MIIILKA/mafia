import { useState } from "react";
import "./Home.scss";

export default function Home({ onCreate, onJoin, error }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState("create");

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
    <div className="home">
      <h1 className="home__title">🔪 Мафія Онлайн</h1>
      <p className="home__subtitle">Створіть кімнату або приєднайтесь до друзів</p>

      <div className="home__card">
        <div className="home__tabs">
          <button
            className={`home__tab ${mode === "create" ? "home__tab--active" : ""}`}
            onClick={() => setMode("create")}
            type="button"
          >
            Створити кімнату
          </button>
          <button
            className={`home__tab ${mode === "join" ? "home__tab--active" : ""}`}
            onClick={() => setMode("join")}
            type="button"
          >
            Приєднатись
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="home__form" onSubmit={handleSubmit}>
          <label className="home__label">
            Ваше ім'я
            <input
              className="home__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, Олег"
              maxLength={20}
            />
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
            {mode === "create" ? "Створити" : "Приєднатись"}
          </button>
        </form>
      </div>
    </div>
  );
}
