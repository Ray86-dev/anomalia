import { ambients, concepts, dilemmas, ui } from '@shared/generated/content.ts';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { audio, tensionFor } from '../../engine/audio.ts';
import { assetUrl } from '../../engine/backdrop/Backdrop.tsx';
import { drone } from '../../lib/settings.ts';
import { getClient } from '../../lib/supabase.ts';
import { useTeacherSession } from '../../lib/teacher.ts';
import { fmt } from '../../lib/text.ts';
import {
  ConceptsPanel,
  DecisionsPanel,
  EndingsPanel,
  ProgressPanel,
  Ticker,
  TimelinePanel,
  WorldPanel,
} from './panels.tsx';
import { buildTicker } from './ticker.ts';
import { useSnapshot } from './useSnapshot.ts';
import '../../styles/centro.css';

const t = ui.centro;
const PANELS = 6;
const AMBIENT_VOLUME = 0.18;

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
    <p className="cc-stat">
      <span className="cc-stat-label">{t.reloj}</span>
      <time className="cc-stat-value">{`${mm}:${ss}`}</time>
    </p>
  );
}

function Dashboard({ classId }: { readonly classId: string }) {
  const { snapshot, failed, reveal } = useSnapshot(classId);
  const [revealed, setRevealed] = useState(false);
  const [featured, setFeatured] = useState<number | null>(null);
  const [help, setHelp] = useState(false);

  // Atajos del docente (§8.3). Nada de esto se ve en la proyección salvo la ayuda (H).
  useEffect(() => {
    const music = ambients.centro.musica;
    audio.setDroneMuted(drone.get() === 'no');
    let started = false;
    const startSound = () => {
      if (started || music === undefined) return;
      started = true;
      audio.play(assetUrl(music.src), AMBIENT_VOLUME);
    };
    const onKey = (event: KeyboardEvent) => {
      // Ctrl+R, Alt+F… siguen siendo del navegador.
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      startSound();
      const key = event.key.toLowerCase();
      if (key === 'r') {
        setRevealed((value) => !value);
      } else if (key === 'f') {
        const toggle =
          document.fullscreenElement === null
            ? document.documentElement.requestFullscreen()
            : document.exitFullscreen();
        toggle.catch(() => undefined);
      } else if (key === 'm') {
        audio.setMuted(!audio.isMuted());
      } else if (key === 'z') {
        drone.set(drone.get() === 'si' ? 'no' : 'si');
        audio.setDroneMuted(drone.get() === 'no');
      } else if (key === 'h' || key === '?') {
        setHelp((value) => !value);
      } else if (key === 'arrowright' || key === 'arrowleft') {
        const delta = key === 'arrowright' ? 1 : -1;
        setFeatured((value) => (value === null ? 0 : (value + delta + PANELS) % PANELS));
      } else if (key === 'escape') {
        setFeatured(null);
        setHelp(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', startSound, { once: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', startSound);
      audio.play(null);
    };
  }, []);

  // La disonancia sigue al Desnivel medio de la clase (agregado con k ≥ 5).
  const tension = tensionFor(snapshot?.results.world?.desnivel ?? 0);
  useEffect(() => {
    audio.setTension(tension);
  }, [tension]);
  useEffect(
    () => () => {
      audio.setTension(0);
    },
    [],
  );

  // Al revelar se publica lo último aunque no haya un lote completo de k decisiones nuevas.
  useEffect(() => {
    if (revealed) reveal();
  }, [revealed, reveal]);

  if (snapshot === null) {
    return (
      <main className="centro">
        <p role="status">{failed ? ui.app.errorRed : ui.app.cargando}</p>
      </main>
    );
  }

  const messages = buildTicker(snapshot, revealed, t.teletipo, dilemmas, concepts);
  const isFeatured = (index: number) => featured === index;

  return (
    <main className="cc-root">
      <header className="cc-header">
        <h1 className="cc-title">
          {t.titulo} <span className="cc-class">· {snapshot.label}</span>
        </h1>
        <SessionClock />
        <p className="cc-stat">
          <span className="cc-stat-label">{t.conectados}</span>
          <span className="cc-stat-value">
            {snapshot.live.connected}{' '}
            <span className="cc-muted">{fmt(t.deTotal, { total: snapshot.live.players })}</span>
          </span>
        </p>
      </header>

      <div className={`cc-grid${featured === null ? '' : ' cc-has-featured'}`}>
        <ProgressPanel snapshot={snapshot} featured={isFeatured(0)} />
        <TimelinePanel snapshot={snapshot} revealed={revealed} featured={isFeatured(1)} />
        <DecisionsPanel snapshot={snapshot} revealed={revealed} featured={isFeatured(2)} />
        <WorldPanel snapshot={snapshot} featured={isFeatured(3)} />
        <ConceptsPanel snapshot={snapshot} featured={isFeatured(4)} />
        <EndingsPanel snapshot={snapshot} featured={isFeatured(5)} />
      </div>

      <footer className="cc-footer">
        <Ticker messages={messages} />
        {snapshot.pendingAnswers > 0 && (
          <p className="cc-muted cc-pending">
            {fmt(t.pendientes, { n: snapshot.pendingAnswers, k: snapshot.k })}
          </p>
        )}
      </footer>

      {help && (
        <aside className="cc-help" aria-label={t.ayudaTitulo}>
          <h2>{t.ayudaTitulo}</h2>
          <ul>
            {Object.values(t.ayuda).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {ambients.centro.musica !== undefined && (
            <p className="cc-muted">{ambients.centro.musica.credito}</p>
          )}
        </aside>
      )}
    </main>
  );
}

type ClassOption = { readonly id: string; readonly label: string; readonly code: string };

function ClassPicker() {
  const [classes, setClasses] = useState<readonly ClassOption[] | null>(null);
  useEffect(() => {
    let active = true;
    void getClient('teacher')
      .from('classes')
      .select('id, label, code')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) setClasses(data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="centro">
      <h1 className="centro-title">{t.titulo}</h1>
      <p>{t.elegirClase}</p>
      {classes?.length === 0 && <p className="muted">{t.sinClases}</p>}
      <ul className="cc-picker">
        {classes?.map((c) => (
          <li key={c.id}>
            <Link className="btn btn-secondary" to={`/centro?clase=${c.id}`}>
              {c.label} · {c.code}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

/**
 * /centro: vista proyectable (16:9). Solo consume snapshots agregados con k ≥ 5 (D-08);
 * nunca alias, textos libres ni filas individuales.
 */
export function ControlCenter() {
  const session = useTeacherSession();
  const [params] = useSearchParams();
  const classId = params.get('clase');

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
  return classId === null ? <ClassPicker /> : <Dashboard classId={classId} />;
}

export default ControlCenter;
