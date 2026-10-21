import { ui } from '@shared/generated/content.ts';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTeacherSession } from '../../lib/teacher.ts';

const t = ui.centro;

function SessionClock() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const elapsed = Math.floor((now - start) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return (
    <p className="centro-clock">
      <span className="muted">{t.reloj}</span> <time>{`${mm}:${ss}`}</time>
    </p>
  );
}

/**
 * /centro: vista proyectable. Solo consumirá snapshots agregados con k ≥ 5 (M3, D-08);
 * nunca alias, textos libres ni filas individuales.
 */
export function ControlCenter() {
  const session = useTeacherSession();

  if (session.status === 'loading') {
    return (
      <main className="centro">
        <p role="status">{ui.app.cargando}</p>
      </main>
    );
  }

  if (session.status !== 'teacher') {
    return (
      <main className="centro">
        <h1>{t.titulo}</h1>
        <p>{t.requiereDocente}</p>
        <Link className="btn" to="/consola">
          {t.irConsola}
        </Link>
      </main>
    );
  }

  return (
    <main className="centro">
      <h1 className="centro-title">{t.titulo}</h1>
      <SessionClock />
      <p className="muted">{t.proximamente}</p>
    </main>
  );
}

export default ControlCenter;
