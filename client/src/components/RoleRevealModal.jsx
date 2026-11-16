import { useEffect, useState } from "react";
import "./RoleRevealModal.scss";

const ROLE_VISUALS = {
    don: {
        icon: "🎩",
        title: "ДОН МАФІЇ",
        subtitle: "Хрещений батько тіньового міста",
        theme: "mafia"
    },
    mafia: {
        icon: "🔫",
        title: "МАФІЯ",
        subtitle: "Дій у темряві. Не залишай свідків.",
        theme: "mafia"
    },
    sheriff: {
        icon: "🌟",
        title: "ШЕРИФ",
        subtitle: "Остання надія правосуддя",
        theme: "sheriff"
    },
    doctor: {
        icon: "💉",
        title: "ЛІКАР",
        subtitle: "Твої руки рятують життя вночі",
        theme: "doctor"
    },
    citizen: {
        icon: "🕯️",
        title: "МИРНИЙ ЖИТЕЛЬ",
        subtitle: "Викрий брехню за столом переговорів",
        theme: "citizen"
    },
    maniac: {
        icon: "🔪",
        title: "МАНІЯК",
        subtitle: "Нікому не довіряй. Залишся останнім.",
        theme: "mafia"
    },
    beauty: {
        icon: "💋",
        title: "КРАСУНЯ",
        subtitle: "Твоя чарівність зупиняє будь-кого вночі",
        theme: "doctor"
    },
    immortal: {
        icon: "🛡️",
        title: "БЕЗСМЕРТНИЙ",
        subtitle: "Кулі вночі тобі не страшні",
        theme: "citizen"
    }
};

export default function RoleRevealModal({ role, number, dayNumber, phase, roleInfo }) {
    const [visible, setVisible] = useState(false);
    const [flipped, setFlipped] = useState(false);

    // Показуємо картку автоматично при старті 1-го дня
    useEffect(() => {
        if (dayNumber === 1 && phase === "discussion" && role && role !== "host") {
            setVisible(true);
            const timer = setTimeout(() => setFlipped(true), 350);
            return () => clearTimeout(timer);
        }
    }, [dayNumber, phase, role]);

    if (!visible || !role || role === "host") return null;

    const visual = ROLE_VISUALS[role] || {
        icon: "🎭",
        title: roleInfo?.[role]?.label || role,
        subtitle: "",
        theme: "citizen"
    };

    return (
        <div className="role-modal-backdrop" onClick={() => setVisible(false)}>
            <div
                className={`role-card ${flipped ? "role-card--flipped" : ""} role-card--${visual.theme}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setFlipped((v) => !v);
                }}
            >
                <div className="role-card__inner">
                    {/* Сорочка карти */}
                    <div className="role-card__front">
                        <div className="role-card__crest">🎭</div>
                        <div className="role-card__brand">MAFIA NOIR</div>
                        <div className="role-card__tap">Натисніть, щоб відкрити карту</div>
                    </div>

                    {/* Лицьова сторона з роллю */}
                    <div className="role-card__back">
                        <div className="role-card__shine" />
                        {number && <div className="role-card__seat">ГРАВЕЦЬ №{number}</div>}
                        <div className="role-card__icon">{visual.icon}</div>
                        <h2 className="role-card__title">{visual.title}</h2>
                        <p className="role-card__subtitle">{visual.subtitle}</p>
                        <p className="role-card__desc">{roleInfo?.[role]?.description}</p>

                        <button
                            type="button"
                            className="role-card__btn"
                            onClick={() => setVisible(false)}
                        >
                            Прийняти роль
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}