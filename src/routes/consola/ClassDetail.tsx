import { dilemmas, ui } from '@shared/generated/content.ts';
import { ALIAS_PATTERN, cleanAlias } from '@shared/game/alias.ts';
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

const consoleSchema = z
  .object({
    roster: z.array(
      z.object({
        playerId: z.string(),
        alias: z.string(),
        status: z.enum(['active', 'expelled']),
        phase: z.string().nullable(),
        currentDilemma: z.string().nullable(),
        lastSeenAt: z.string().nullable(),
        finished: z.boolean(),
      }),
    ),
    requests: z.array(z.object({ id: z.string(), alias: z.string(), createdAt: z.string() })),
    alerts: z.array(
      z.object({
        id: z.string(),
        createdAt: z.string(),
        seenAt: z.string().nullable(),
        alias: z.string(),
        dilemmaId: z.string(),
        text: z.string().nullable(),
        justification: z.string().nullable(),
        reply: z.string().nullable(),
      }),
    ),
  })
  .nullable();
type ConsoleData = NonNullable<z.infer<typeof consoleSchema>>;

async function fetchConsole(classId: string): Promise<ConsoleData> {
  const { data, error } = await getClient('teacher').rpc('class_console', { p_class_id: classId });
  if (error !== null) throw new Error(error.message);
  const parsed = consoleSchema.parse(data);
  if (parsed === null) throw new Error('forbidden');
  return parsed;
}

function phaseLabel(phase: string | null): string {
  return phase !== null && isPhase(phase) ? ui.fases[phase] : t.nunca;
}

function dilemmaLabel(id: string): string {
  const dilemma = dilemmas.find((d) => d.id === id);
  return dilemma === undefined ? id : `${dilemma.lugar}, ${String(dilemma.anio)}`;
}

type ClassDetailProps = {
  readonly schoolClass: ClassSummary;
  readonly onBack: () => void;
};

/** Detalle de una clase en /consola (pensado para el móvil del docente, nunca para el proyector). */
export function ClassDetail({ schoolClass, onBack }: ClassDetailProps) {
  const db = getClient('teacher');
  const [data, setData] = useState<ConsoleData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [chapter, setChapter] = useState(schoolClass.chapter_unlocked);
  const reload = () => {
    setReloads((n) => n + 1);
  };

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      fetchConsole(schoolClass.id).then(
        (next) => {
          if (!active) return;
          setData(next);
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

  /** Ejecuta una acción del docente y recarga; muestra un aviso si falla. */
  async function run(
    action: () => PromiseLike<{ error: unknown }>,
    failure: string = ui.app.errorInesperado,
  ) {
    setActionError(null);
    const { error } = await action();
    if (error !== null) setActionError(failure);
    reload();
  }

  async function toggleChapter() {
    const next = chapter === 2 ? 1 : 2;
    if (next === 2 && !window.confirm(t.confirmarAbrir)) return;
    await run(() => db.rpc('unlock_chapter', { p_class_id: schoolClass.id, p_chapter: next }));
    setChapter(next);
  }

  async function rename(playerId: string, alias: string) {
    const answer = window.prompt(fmt(t.renombrarPregunta, { alias }), alias);
    if (answer === null) return;
    const next = cleanAlias(answer);
    if (!ALIAS_PATTERN.test(next)) {
      setActionError(t.aliasNoValido);
      return;
    }
    await run(() => db.from('players').update({ alias: next }).eq('id', playerId), t.aliasNoValido);
  }

  async function setStatus(playerId: string, alias: string, status: 'active' | 'expelled') {
    if (status === 'expelled' && !window.confirm(fmt(t.confirmarRetirar, { alias }))) return;
    await run(() => db.from('players').update({ status }).eq('id', playerId));
  }

  async function deleteClass() {
    const typed = window.prompt(fmt(t.confirmarBorrar, { codigo: schoolClass.code }));
    if (typed?.trim().toUpperCase() !== schoolClass.code) return;
    const { error } = await db.rpc('delete_class', { p_class_id: schoolClass.id });
    if (error !== null) {
      setActionError(ui.app.errorInesperado);
      return;
    }
    window.alert(t.borrada);
    onBack();
  }

  const unseen = data?.alerts.filter((a) => a.seenAt === null).length ?? 0;
  const hasChapterTwo = schoolClass.chapter_2.length > 0;

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
        <Link
          className="btn btn-secondary"
          to={`/centro?clase=${schoolClass.id}`}
          target="_blank"
          rel="noopener"
        >
          {t.abrirCentro}
        </Link>
      </section>

      {actionError !== null && <Notice tone="error">{actionError}</Notice>}
      {loadError && <Notice tone="error">{ui.app.errorRed}</Notice>}

      <section className="panel stack" aria-labelledby="capitulo-ii">
        <h2 id="capitulo-ii">{t.capituloII}</h2>
        {hasChapterTwo ? (
          <>
            <p>{chapter === 2 ? t.capituloAbierto : t.capituloCerrado}</p>
            <button
              className={chapter === 2 ? 'btn btn-secondary btn-small' : 'btn'}
              type="button"
              onClick={() => void toggleChapter()}
            >
              {chapter === 2 ? t.cerrarCapitulo : t.abrirCapitulo}
            </button>
          </>
        ) : (
          <p className="muted">{t.sinCapituloII}</p>
        )}
      </section>

      <section className="stack" aria-labelledby="alertas">
        <h2 id="alertas">{fmt(t.alertasTitulo, { n: unseen })}</h2>
        <p className="help">{t.alertaAyuda}</p>
        {data?.alerts.length === 0 && <p className="muted">{t.sinAlertas}</p>}
        <ul className="card-list">
          {data?.alerts.map((alert) => (
            <li
              key={alert.id}
              className={`card alert-card${alert.seenAt === null ? ' unseen' : ''}`}
            >
              <span className="card-title">
                {alert.alias} · {dilemmaLabel(alert.dilemmaId)}
              </span>
              <span className="muted">{formatRelative(alert.createdAt)}</span>
              <blockquote className="alert-text">
                {alert.text ?? alert.justification ?? ''}
              </blockquote>
              {alert.reply !== null && (
                <blockquote className="alert-text">
                  <span className="muted">{t.alertaRespuesta}: </span>
                  {alert.reply}
                </blockquote>
              )}
              {alert.seenAt === null ? (
                <button
                  className="btn btn-secondary btn-small"
                  type="button"
                  onClick={() =>
                    void run(() =>
                      db
                        .from('alerts')
                        .update({ seen_at: new Date().toISOString() })
                        .eq('id', alert.id),
                    )
                  }
                >
                  {t.marcarVista}
                </button>
              ) : (
                <span className="tag tag-ok">{t.vista}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-labelledby="recuperaciones">
        <h2 id="recuperaciones">{fmt(t.solicitudesTitulo, { n: data?.requests.length ?? 0 })}</h2>
        {data?.requests.length === 0 ? (
          <p className="muted">{t.sinSolicitudes}</p>
        ) : (
          <p className="help">{t.solicitudAyuda}</p>
        )}
        <ul className="card-list">
          {data?.requests.map((request) => (
            <li key={request.id} className="card">
              <span className="card-title">{request.alias}</span>
              <span className="muted">{formatRelative(request.createdAt)}</span>
              <div className="row">
                <button
                  className="btn btn-small"
                  type="button"
                  onClick={() =>
                    void run(() =>
                      db.rpc('resolve_recovery', { p_request_id: request.id, p_approve: true }),
                    )
                  }
                >
                  {t.aprobar}
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  type="button"
                  onClick={() =>
                    void run(() =>
                      db.rpc('resolve_recovery', { p_request_id: request.id, p_approve: false }),
                    )
                  }
                >
                  {t.rechazar}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-labelledby="alumnado">
        <div className="row">
          <h2 id="alumnado">{fmt(t.alumnadoTitulo, { n: data?.roster.length ?? 0 })}</h2>
          <button className="btn btn-secondary btn-small" type="button" onClick={reload}>
            {t.actualizar}
          </button>
        </div>
        {data === null && !loadError && <p role="status">{ui.app.cargando}</p>}
        {data?.roster.length === 0 && <p className="muted">{t.sinAlumnado}</p>}
        <ul className="card-list">
          {data?.roster.map((row) => (
            <li key={row.playerId} className="card roster-item">
              <span className="card-title">{row.alias}</span>
              <span>
                <span className="visually-hidden">{t.columnas.fase}: </span>
                {phaseLabel(row.phase)}
                {row.currentDilemma !== null && ` · ${dilemmaLabel(row.currentDilemma)}`}
              </span>
              <span className="muted">
                <span className="visually-hidden">{t.columnas.ultimaConexion}: </span>
                {row.lastSeenAt === null ? t.nunca : formatRelative(row.lastSeenAt)}
              </span>
              {row.status === 'expelled' && <span className="tag">{t.estados.expelled}</span>}
              <div className="row row-start">
                <button
                  className="btn btn-secondary btn-small"
                  type="button"
                  onClick={() => void rename(row.playerId, row.alias)}
                >
                  {t.renombrar}
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  type="button"
                  onClick={() =>
                    void setStatus(
                      row.playerId,
                      row.alias,
                      row.status === 'active' ? 'expelled' : 'active',
                    )
                  }
                >
                  {row.status === 'active' ? t.retirar : t.readmitir}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack danger-zone" aria-labelledby="peligro">
        <h2 id="peligro">{t.peligro}</h2>
        <p className="help">{t.borrarAyuda}</p>
        <button className="btn btn-danger" type="button" onClick={() => void deleteClass()}>
          {t.borrar}
        </button>
      </section>
    </div>
  );
}
