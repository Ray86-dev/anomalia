/**
 * Logros del cronista (M6): botón de la barra con el emblema y los puntos, y un panel con
 * cuatro pestañas (Logros, Constelación, Fichas, Emblema). Todo se calcula en el móvil a partir
 * del progreso que guarda el servidor; nada de esto llega al Centro ni a la consola.
 */
import { concepts, emblems, fichas, rewards, ui } from '@shared/generated/content.ts';
import type { Summary } from '@shared/game/achievements.ts';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { fmt } from '../../../lib/text.ts';
import { Emblem } from './Emblem.tsx';
import { useGameContext } from './GameContext.ts';
import { texto } from './helpers.ts';
import { ACHIEVEMENTS, emblemPieces, placeOf, summaryOf } from './rewards.ts';

const t = ui.juego.logros;
const TABS = ['logros', 'constelacion', 'fichas', 'emblema'] as const;
type Tab = (typeof TABS)[number];

const pointsFor = (count: number) =>
  count === 0 ? 0 : rewards.puntos.nuevo + rewards.puntos.repetido * (count - 1);

function AchievementList({ summary, kind }: { summary: Summary; kind: 'movimiento' | 'hito' }) {
  return (
    <ul className="achievement-list">
      {ACHIEVEMENTS.filter((a) => a.kind === kind).map((achievement) => {
        const count = summary.earned.get(achievement.id) ?? 0;
        return (
          <li key={achievement.id} className={count > 0 ? 'is-earned' : ''}>
            <p className="achievement-name">
              <span>{achievement.etiqueta}</span>
              <span className="achievement-count">
                {count > 0
                  ? `${fmt(t.veces, { n: count })} · ${fmt(t.puntos, { n: pointsFor(count) })}`
                  : t.pendiente}
              </span>
            </p>
            <p className="help">{texto(achievement.descripcion)}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** Estrellas repartidas en espiral (ángulo áureo): mismas posiciones en todos los móviles. */
const STARS = concepts.map((concept, i) => {
  const angle = i * 2.39996;
  const radius = 44 * Math.sqrt((i + 0.6) / concepts.length);
  return { concept, x: radius * Math.cos(angle), y: 0.72 * radius * Math.sin(angle) };
});

function Constellation({ summary }: { summary: Summary }) {
  const lit = STARS.filter((star) => summary.stars.includes(star.concept.id));
  return (
    <div className="stack">
      <p className="lead">
        {fmt(t.estrellas, { n: summary.stars.length, total: concepts.length })}
      </p>
      <svg className="constellation" viewBox="-50 -36 100 72" aria-hidden="true">
        {lit.length > 1 && (
          <polyline
            points={lit.map((star) => `${String(star.x)},${String(star.y)}`).join(' ')}
            className="constellation-line"
          />
        )}
        {STARS.map((star) => {
          const on = summary.stars.includes(star.concept.id);
          return (
            <circle
              key={star.concept.id}
              cx={star.x}
              cy={star.y}
              r={on ? 1.7 : 0.8}
              className={on ? 'star is-lit' : 'star'}
            />
          );
        })}
      </svg>
      <p className="help">{t.constelacionAyuda}</p>
      <ul className="star-list">
        {concepts.map((concept) => {
          const on = summary.stars.includes(concept.id);
          return (
            <li
              key={concept.id}
              className={on ? 'is-lit' : ''}
              aria-label={fmt(on ? t.encendida : t.apagada, { concepto: concept.etiqueta })}
            >
              {concept.etiqueta}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Fichas({ summary, played }: { summary: Summary; played: ReadonlySet<string> }) {
  return (
    <div className="stack">
      <p className="help">{t.fichasAyuda}</p>
      <ul className="ficha-list">
        {fichas.map((ficha) => {
          const open = summary.fichas.includes(ficha.id);
          return (
            <li key={ficha.id} className={open ? 'ficha is-open' : 'ficha'}>
              {open ? (
                <>
                  <p className="kicker">{placeOf(ficha.dilema)}</p>
                  <h3>{texto(ficha.titulo)}</h3>
                  <p>{texto(ficha.texto)}</p>
                </>
              ) : (
                <p className="muted">
                  {played.has(ficha.dilema)
                    ? fmt(t.fichaBloqueada, { lugar: placeOf(ficha.dilema), n: ficha.puntos })
                    : fmt(t.fichaSinJugar, { lugar: placeOf(ficha.dilema) })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmblemEditor({ summary }: { summary: Summary }) {
  const { run, act, pending } = useGameContext();
  const saved = emblemPieces(run.emblem);
  const [symbol, setSymbol] = useState(saved.symbol.id);
  const [color, setColor] = useState(saved.color.id);
  const [done, setDone] = useState(false);
  const name = useId();
  const preview = emblemPieces(`${symbol}:${color}`);

  return (
    <div className="stack">
      <div className="emblem-preview">
        <Emblem pieces={preview} size={88} />
      </div>
      <p className="help">{t.emblemaAyuda}</p>
      <fieldset className="emblem-choices">
        <legend>{t.simbolo}</legend>
        {emblems.simbolos.map((s) => {
          const open = summary.symbols.includes(s.id);
          return (
            <label key={s.id} className={`emblem-choice${symbol === s.id ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name={`${name}-s`}
                checked={symbol === s.id}
                disabled={!open}
                onChange={() => {
                  setSymbol(s.id);
                  setDone(false);
                }}
              />
              <Emblem pieces={{ symbol: s, color: preview.color }} size={36} />
              <span className="visually-hidden">
                {s.etiqueta}
                {!open && `, ${fmt(t.bloqueado, { n: s.puntos })}`}
              </span>
              {!open && (
                <span className="emblem-lock" aria-hidden="true">
                  {s.puntos}
                </span>
              )}
            </label>
          );
        })}
      </fieldset>
      <fieldset className="emblem-choices">
        <legend>{t.color}</legend>
        {emblems.colores.map((c) => {
          const open = summary.colors.includes(c.id);
          return (
            <label key={c.id} className={`emblem-choice${color === c.id ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name={`${name}-c`}
                checked={color === c.id}
                disabled={!open}
                onChange={() => {
                  setColor(c.id);
                  setDone(false);
                }}
              />
              <span className="swatch" style={{ background: c.hex }} aria-hidden="true" />
              <span className="visually-hidden">
                {c.etiqueta}
                {!open && `, ${fmt(t.bloqueado, { n: c.puntos })}`}
              </span>
              {!open && (
                <span className="emblem-lock" aria-hidden="true">
                  {c.puntos}
                </span>
              )}
            </label>
          );
        })}
      </fieldset>
      <button
        className="btn"
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          void act({ action: 'emblem', symbol, color }).then((response) => {
            setDone(response?.ok === true);
          });
        }}
      >
        {t.guardar}
      </button>
      <p className="help" role="status">
        {done ? t.guardado : ''}
      </p>
    </div>
  );
}

/** Botón de la barra y panel de logros. */
export function Achievements() {
  const { run } = useGameContext();
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>('logros');
  const ids = useId();
  const summary = summaryOf(run.progress);
  const played = new Set(Object.keys(run.progress.choices));
  const pieces = emblemPieces(run.emblem);

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length] ?? 'logros';
    setTab(next);
    document.getElementById(`${ids}-${next}`)?.focus();
  }

  return (
    <>
      <button
        className="rewards-button"
        type="button"
        aria-label={fmt(t.abrir, { puntos: summary.points, rango: summary.rank.label })}
        onClick={() => {
          dialog.current?.showModal();
        }}
      >
        <Emblem pieces={pieces} />
        <span className="rewards-points">{fmt(t.puntosCorto, { n: summary.points })}</span>
      </button>
      <dialog ref={dialog} className="confirm-dialog rewards-dialog" aria-labelledby={`${ids}-t`}>
        <header className="rewards-head">
          <Emblem pieces={pieces} size={56} />
          <div>
            <h2 id={`${ids}-t`}>{t.titulo}</h2>
            <p className="rewards-rank">
              {fmt(t.rangoPuntos, { rango: summary.rank.label, n: summary.points })}
            </p>
            <p className="help">
              {summary.nextRank === null
                ? t.maximo
                : fmt(t.siguiente, {
                    n: summary.nextRank.points - summary.points,
                    rango: summary.nextRank.label,
                  })}
            </p>
          </div>
        </header>
        <p className="help rewards-note">{t.nota}</p>
        <div className="tabs" role="tablist">
          {TABS.map((id) => (
            <button
              key={id}
              id={`${ids}-${id}`}
              className="tab"
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${ids}-${id}-panel`}
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={onTabKey}
              onClick={() => {
                setTab(id);
              }}
            >
              {t.pestanas[id]}
            </button>
          ))}
        </div>
        <div
          id={`${ids}-${tab}-panel`}
          className="tab-panel"
          role="tabpanel"
          aria-labelledby={`${ids}-${tab}`}
        >
          {tab === 'logros' && (
            <div className="stack">
              <h3>{t.movimientos}</h3>
              <AchievementList summary={summary} kind="movimiento" />
              <h3>{t.hitos}</h3>
              <AchievementList summary={summary} kind="hito" />
            </div>
          )}
          {tab === 'constelacion' && <Constellation summary={summary} />}
          {tab === 'fichas' && <Fichas summary={summary} played={played} />}
          {tab === 'emblema' && <EmblemEditor summary={summary} />}
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            dialog.current?.close();
          }}
        >
          {t.cerrar}
        </button>
      </dialog>
    </>
  );
}
