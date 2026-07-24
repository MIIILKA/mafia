import { useEffect, useRef, useState } from "react";
import "./Chat.scss";

export default function Chat({ messages, onSend, disabled, placeholder }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <div className="chat">
      <div className="chat__list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat__message ${!m.alive ? "chat__message--dead" : ""}`}>
            <span className="chat__author">{m.author}:</span> {m.text}
          </div>
        ))}
        {messages.length === 0 && <div className="chat__empty">Повідомлень поки немає</div>}
      </div>
      <form className="chat__form" onSubmit={handleSubmit}>
        <input
          className="chat__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || "Написати повідомлення..."}
          disabled={disabled}
          maxLength={500}
        />
        <button className="chat__send" type="submit" disabled={disabled || !text.trim()}>
          →
        </button>
      </form>
    </div>
  );
}
