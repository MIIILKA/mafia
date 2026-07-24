import "./HostNotebook.scss";

export default function HostNotebook({ notebook }) {
  if (!notebook) return null;
  const { current, history } = notebook;

  return (
    <div className="host-notebook">
      <h3>📓 Блокнот ведучого</h3>

      {current && (
        <div className="host-notebook__current">
          <div className="host-notebook__current-title">Ніч {current.day} — зараз</div>
          <ul>
            <li>
              Мафія/Дон обирають: <strong>{current.mafiaTargetName || "ще не обрано"}</strong>
            </li>
            <li>
              Лікар лікує: <strong>{current.doctorHealName || "ще не обрано"}</strong>
            </li>
            <li>
              Шериф перевіряє: <strong>{current.sheriffCheck?.targetName || "ще не обрано"}</strong>
            </li>
            <li>
              Дон перевіряє на шерифа: <strong>{current.donCheck?.targetName || "ще не обрано"}</strong>
            </li>
          </ul>
        </div>
      )}

      {history.length > 0 && (
        <div className="host-notebook__history">
          <div className="host-notebook__current-title">Історія ночей</div>
          <ul>
            {history.map((entry) => (
              <li key={entry.day} className="host-notebook__entry">
                <div className="host-notebook__entry-day">Ніч {entry.day}</div>
                <div>
                  Ціль мафії: <strong>{entry.mafiaTargetName || "—"}</strong>
                  {entry.doctorHealName && entry.doctorHealName === entry.mafiaTargetName && (
                    <span className="host-notebook__saved"> (врятовано лікарем)</span>
                  )}
                </div>
                <div>Вбито: <strong>{entry.killedName || "ніхто"}</strong></div>
                {entry.sheriffCheck && (
                  <div>
                    Шериф перевірив {entry.sheriffCheck.targetName}:{" "}
                    <strong>{entry.sheriffCheck.isMafia ? "мафія" : "не мафія"}</strong>
                  </div>
                )}
                {entry.donCheck && (
                  <div>
                    Дон перевірив {entry.donCheck.targetName}:{" "}
                    <strong>{entry.donCheck.isSheriff ? "шериф" : "не шериф"}</strong>
                  </div>
                )}
                {"votedOutName" in entry && (
                  <div>Вигнано голосуванням: <strong>{entry.votedOutName || "ніхто"}</strong></div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
