import { useEffect, useState } from "react";
import "./MorningNewspaper.scss";

export default function MorningNewspaper({ report }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!report?.id) return;
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 4800);
        return () => clearTimeout(timer);
    }, [report?.id]);

    if (!visible || !report) return null;

    return (
        <div className="newspaper-overlay" onClick={() => setVisible(false)}>
            <div className="newspaper" onClick={(e) => e.stopPropagation()}>
                <div className="newspaper__top-meta">
                    <span>СПЕЦВИПУСК • ДЕНЬ {report.day}</span>
                    <span>ЦІНА: 1 ПАТРОН</span>
                </div>
                <h2 className="newspaper__brand">THE CITY TIMES</h2>
                <div className="newspaper__divider" />

                {report.killedName ? (
                    <>
                        <div className="newspaper__stamp newspaper__stamp--blood">КРИВАВА НІЧ</div>
                        <h3 className="newspaper__headline">
                            ВБИТО ГРАВЦЯ №{report.killedNumber} {report.killedName.toUpperCase()}!
                        </h3>
                        <p className="newspaper__text">
                            Сьогодні на світанку поліція виявила тіло у темному провулку. Мафія не знає жалю — місто збирається на екстрене засідання.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="newspaper__stamp newspaper__stamp--peace">СЕНСАЦІЯ</div>
                        <h3 className="newspaper__headline">НІЧ МИНУЛА БЕЗ ЖЕРТВ!</h3>
                        <p className="newspaper__text">
                            Схоже, чиїсь ангели-охоронці сьогодні не спали. Усі мешканці міста прокинулись живими.
                        </p>
                    </>
                )}

                <button type="button" className="newspaper__close" onClick={() => setVisible(false)}>
                    Закрити газету
                </button>
            </div>
        </div>
    );
}