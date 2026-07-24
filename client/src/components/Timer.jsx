import { useEffect, useState } from "react";
import "./Timer.scss";

export default function Timer({ endsAt }) {
  const [remaining, setRemaining] = useState(getRemaining(endsAt));

  useEffect(() => {
    setRemaining(getRemaining(endsAt));
    if (!endsAt) return;

    const interval = setInterval(() => {
      setRemaining(getRemaining(endsAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  if (!endsAt) return null;

  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const isLow = seconds <= 10;

  return (
    <div className={`timer ${isLow ? "timer--low" : ""}`}>
      <span className="timer__value">{seconds}s</span>
    </div>
  );
}

function getRemaining(endsAt) {
  if (!endsAt) return 0;
  return endsAt - Date.now();
}
