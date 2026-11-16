import { useEffect, useRef, useState } from "react";
import "./Chat.scss";

export default function Chat({ messages, onSend, disabled, placeholder, canUseMafiaChat }) {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("public");
  const listRef = useRef(null);

  const visibleMessages = messages.filter((m) => (m.channel || "public") === channel);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [visibleMessages.length, channel]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim(), channel);
    setText("");
  }

  return (
      <div className={`chat ${channel === "mafia" ? "chat--mafia" : ""}`}>
        {canUseMafiaChat && (
            <div className="chat__tabs">
              <button
                  type="button"
                  className={`chat__tab ${channel === "public" ? "chat__tab--active" : ""}`}
                  onClick={() => setChannel("public")}
              >
                💬 Загальний
              </button>
              <button
                  type="button"
                  className={`chat__tab chat__tab--mafia ${channel === "mafia" ? "chat__tab--active" : ""}`}
                  onClick={() => setChannel("mafia")}
              >
                🔴 Рація Мафії
              </button>
            </div>
        )}

        <div className="chat__list" ref={listRef}>
          {visibleMessages.map((m, i) => (
              <div key={i} className={`chat__message ${!m.alive ? "chat__message--dead" : ""}`}>
                <span className="chat__author">{m.author}:</span> {m.text}
              </div>
          ))}
          {visibleMessages.length === 0 && (
              <div className="chat__empty">
                {channel === "mafia" ? "Таємний канал мафії порожній..." : "Повідомлень поки немає"}
              </div>
          )}
        </div>

        <form className="chat__form" onSubmit={handleSubmit}>
          <input
              className="chat__input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                channel === "mafia" ? "Написати спільникам..." : placeholder || "Написати повідомлення..."
              }
              disabled={channel === "public" ? disabled : false}
              maxLength={500}
          />
          <button
              className="chat__send"
              type="submit"
              disabled={(channel === "public" && disabled) || !text.trim()}
          >
            →
          </button>
        </form>
      </div>
  );
}