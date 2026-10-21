import { ui } from '@shared/generated/content.ts';
import { isPhase } from '@shared/game/phases.ts';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { getClient } from '../../lib/supabase.ts';
import { fmt, formatDate, formatRelative } from '../../lib/text.ts';
import { Notice } from '../../ui/Notice.tsx';
import type { ClassSummary } from './ClassList.tsx';

const t = ui.consola;
const POLL_MS = 15_000;

// Las columnas de una función RETURNS TABLE pueden llegar a null aunque los tipos generados digan lo contrario.
const rosterSchema = z.array(
  z.object({
    player_id: z.string(),
    alias: z.string(),
    status: z.string(),
    phase: z.string().nullable(),
    current_dilemma: z.string().nullable(),
    last_seen_at: z.string().nullable(),
    finished: z.boolean().nullable(),
  }),
);
type RosterRow = z.infer<typeof rosterSchema>[number];

async function fetchRoster(classId: string): Promise<RosterRow[]> {
  const { data, error } = await getClient('teacher').rpc('class_roster', { p_class_id: classId });
  if (error !== null) throw new Error(error.message);
  return rosterSchema.parse(data);
}

function phaseLabel(phase: string | null): string {
  return phase !== null && isPhase(phase) ? ui.fases[phase] : t.nunca;
}

type ClassDetailProps = {
  readonly schoolClass: ClassSummary;
  readonly onBack: () => void;
};

export function ClassDetail({ schoolClass, onBack }: ClassDetailProps) {
  const [roster, setRoster] = useState<readonly RosterRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      fetchRoster(schoolClass.id).then(
        (rows) => {
          if (!active) return;
          setRoster(rows);
          setLoadError(false);
        },
        () => {
          if (active) setLoadError(true);
        },
      );
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [schoolClass.id, reloads]);

  return (
    <div className="stack">
      <button className="btn btn-secondary" type="button" onClick={onBack}>
        {t.volver}
      </button>

      <section className="panel stack" aria-labelledby="clase-actual">
        <h2 id="clase-actual">{schoolClass.label}</h2>
        <p className="muted">{t.codigoClase}</p>
        <p className="code-display" aria-label={schoolClass.code.split('').join(' ')}>
          {schoolClass.code}
        </p>
        <p className="muted">{fmt(t.caduca, { fecha: formatDate(schoolClass.expires_at) })}</p>
        <p>{fmt(t.capituloDesbloqueado, { n: schoolClass.chapter_unlocked })}</p>
        <Link className="btn btn-secondary" to="/centro" target="_blank" rel="noopener">
          {t.abrirCentro}
        </Link>
      </section>

      <section className="stack" aria-labelledby="alumnado">
        <div className="row">
          <h2 id="alumnado">{fmt(t.alumnadoTitulo, { n: roster?.length ?? 0 })}</h2>
          <button
            className="btn btn-secondary btn-small"
            type="button"
            onClick={() => {
              setReloads((n) => n + 1);
            }}
          >
            {t.actualizar}
          </button>
        </div>
        {loadError && <Notice tone="error">{ui.app.errorRed}</Notice>}
        {roster === null && !loadError && <p role="status">{ui.app.cargando}</p>}
        {roster?.length === 0 && <p className="muted">{t.sinAlumnado}</p>}
        {roster !== null && roster.length > 0 && (
          <ul className="card-list">
            {roster.map((row) => (
              <li key={row.player_id} className="card roster-item">
                <span className="card-title">{row.alias}</span>
                <span>
                  <span className="visually-hidden">{t.columnas.fase}: </span>
                  {phaseLabel(row.phase)}
                </span>
                <span className="muted">
                  <span className="visually-hidden">{t.columnas.ultimaConexion}: </span>
                  {row.last_seen_at === null ? t.nunca : formatRelative(row.last_seen_at)}
                </span>
                {row.status === 'expelled' && <span className="tag">{t.estados.expelled}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
