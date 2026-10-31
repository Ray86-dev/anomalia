/** Ondas temporales y Archivo real (fases 7–8 del bucle §6). */
import { dilemmas, ui, worldInfo } from '@shared/generated/content.ts';
import { sameWorld, worldHistory } from '@shared/game/history.ts';
import {
  desnivel,
  gapZone,
  GAP_TENSE,
  GAP_UNSTABLE,
  WORLD_MAX,
  WORLD_MIN,
  WORLD_VARS,
  type Deltas,
  type WorldState,
  type WorldVar,
} from '@shared/game/world.ts';
import type { Dilemma, DilemmaOption } from '@shared/schemas/content.ts';
import { useEffect, useState } from 'react';
import { assetUrl } from '../../../../engine/backdrop/Backdrop.tsx';
import { countTo } from '../../../../engine/motion.ts';
import { fmt } from '../../../../lib/text.ts';
import { useGameContext } from '../GameContext.ts';
import { findCounselor, signed, texto } from '../helpers.ts';
import { ActionBar, AdvanceButton, AriMessage, Avatar, Listen, useSubScreen } from '../parts.tsx';

const t = ui.juego;

const clamp = (n: number) => Math.min(WORLD_MAX, Math.max(WORLD_MIN, n));

/** Pausa entre barras para que se vean cambiar una detrás de otra. */
const STAGGER_MS = 220;

/** Valor que se muestra: empieza en `from` y, tras el primer pintado, pasa a `to` (transición CSS). */
function useGrow(from: number, to: number): number {
  const [shown, setShown] = useState(from);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setShown(to);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [to]);
  return shown;
}

/** Número que cuenta de un valor a otro (instantáneo con movimiento reducido). */
function useCount(from: number, to: number): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    let cancel: (() => void) | undefined;
    let active = true;
    void countTo(from, to, setValue, 1.4).then((stop) => {
      if (active) cancel = stop;
      else stop();
    });
    return () => {
      active = false;
      cancel?.();
    };
  }, [from, to]);
  return value;
}

/** Barra 0–100 que crece (o mengua) desde `from`; deja una marca donde estaba. */
function Meter({
  label,
  from,
  to,
  delay = 0,
}: {
  readonly label: string;
  readonly from: number;
  readonly to: number;
  readonly delay?: number;
}) {
  const shown = useGrow(from, to);
  return (
    <span
      className="meter"
      role="meter"
      aria-label={label}
      aria-valuemin={WORLD_MIN}
      aria-valuemax={WORLD_MAX}
      aria-valuenow={to}
    >
      {to < from && <span className="meter-lost" style={{ width: `${from}%` }} />}
      <span className="meter-fill" style={{ width: `${shown}%`, transitionDelay: `${delay}ms` }} />
      {from !== to && <span className="meter-mark" style={{ left: `${from}%` }} />}
    </span>
  );
}

/**
 * Mundo antes y después de la decisión que se acaba de cerrar (D-86). Se reproduce la partida
 * con `worldHistory`; si no cuadra con el mundo del servidor (partidas antiguas), se estima
 * restando los deltas, como antes.
 */
function useLastChange(
  dilemmaId: string,
  deltas: Deltas,
): {
  readonly before: WorldState;
  readonly after: WorldState;
  readonly first: boolean;
} {
  const { run } = useGameContext();
  const steps = worldHistory(run.progress.classDilemmas, run.progress.choices, dilemmas);
  const last = steps.at(-1);
  if (last?.dilemmaId === dilemmaId && sameWorld(last.after, run.world)) {
    return { before: last.before, after: run.world, first: steps.length === 1 };
  }
  const before = Object.fromEntries(
    WORLD_VARS.map((v) => [v, clamp(run.world[v] - (deltas[v] ?? 0))]),
  ) as Record<WorldVar, number>;
  return { before, after: run.world, first: Object.keys(run.progress.choices).length <= 1 };
}

/** Qué ha cambiado y por qué: cada barra con su definición y la razón de su cambio. */
function WorldChange({
  before,
  after,
  option,
}: {
  readonly before: WorldState;
  readonly after: WorldState;
  readonly option: DilemmaOption;
}) {
  return (
    <section className="panel stack" aria-labelledby="que-cambia">
      <p className="help">{t.ondas.queCambiaAyuda}</p>
      <ul className="changes">
        {WORLD_VARS.map((variable, i) => {
          const from = before[variable];
          const to = after[variable];
          const change = to - from;
          const intended = option.deltas[variable] ?? 0;
          const reason = option.porque[variable];
          const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'none';
          return (
            <li key={variable} className="change" data-dir={intended === 0 ? 'none' : direction}>
              <div className="change-head">
                <span className="meter-label">{t.mundo[variable]}</span>
                <span className="meter-value">
                  {change === 0 ? to : fmt(t.ondas.antesAhora, { antes: from, ahora: to })}
                </span>
                <span className={`meter-delta ${direction === 'none' ? '' : direction}`}>
                  {change !== 0
                    ? signed(change)
                    : intended !== 0
                      ? fmt(t.ondas.enElTope, { valor: to })
                      : t.ondas.sinCambio}
                </span>
              </div>
              <Meter label={t.mundo[variable]} from={from} to={to} delay={i * STAGGER_MS} />
              {reason !== undefined && <p className="change-why">{texto(reason)}</p>}
              <p className="change-def">{texto(worldInfo.variables[variable].definicion)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Posición de un Desnivel en el indicador de zonas (de −25 a +50; los extremos se recortan). */
const GAUGE_MIN = -25;
const GAUGE_MAX = 50;
const gaugePercent = (gap: number) =>
  ((Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, gap)) - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100;

/** El Desnivel prometeico explicado: barras enfrentadas, cálculo, zona y qué significa. */
export function PrometheanGap({
  before,
  after,
  explain,
}: {
  readonly before: WorldState;
  readonly after: WorldState;
  /** La explicación completa sale abierta (primera anomalía) o plegada. */
  readonly explain: boolean;
}) {
  const gapBefore = desnivel(before);
  const gapAfter = desnivel(after);
  const shownGap = useCount(gapBefore, gapAfter);
  const marker = useGrow(gaugePercent(gapBefore), gaugePercent(gapAfter));
  const zone = gapZone(gapAfter);
  const sentence =
    gapAfter > gapBefore ? t.ondas.sube : gapAfter < gapBefore ? t.ondas.baja : t.ondas.igual;
  const low = Math.min(after.poder, after.responsabilidad);
  const high = Math.max(after.poder, after.responsabilidad);
  const info = worldInfo.desnivel;

  return (
    <section className="panel stack gap-panel" aria-labelledby="desnivel-titulo" data-zone={zone}>
      <div className="gap-head">
        <h2 id="desnivel-titulo">{t.ondas.desnivel}</h2>
        <p className="gap-value" aria-hidden="true">
          {signed(shownGap)}
        </p>
      </div>
      <p className="gap-zone">{fmt(t.ondas.zona, { zona: t.ondas.zonas[zone] })}</p>

      <div className="gap-bars" aria-hidden="true">
        {(['poder', 'responsabilidad'] as const).map((variable) => (
          <div key={variable} className="gap-bar-row" data-var={variable}>
            <span className="meter-label">{t.mundo[variable]}</span>
            <span className="meter-value">{after[variable]}</span>
            <span className="meter gap-meter">
              <span className="meter-fill" style={{ width: `${after[variable]}%` }} />
              {high > low && after[variable] === high && (
                <span
                  className="gap-overhang"
                  style={{ left: `${low}%`, width: `${high - low}%` }}
                />
              )}
            </span>
          </div>
        ))}
      </div>

      <p className="gap-formula">
        {fmt(t.ondas.calculo, {
          poder: after.poder,
          responsabilidad: after.responsabilidad,
          desnivel: signed(gapAfter),
        })}
      </p>
      <p>{fmt(sentence, { antes: signed(gapBefore), ahora: signed(gapAfter) })}</p>

      <div className="gauge" aria-hidden="true">
        <span className="gauge-track">
          <span
            className="gauge-zone"
            data-zone="estable"
            style={{ width: `${gaugePercent(GAP_TENSE)}%` }}
          />
          <span
            className="gauge-zone"
            data-zone="tension"
            style={{ width: `${gaugePercent(GAP_UNSTABLE) - gaugePercent(GAP_TENSE)}%` }}
          />
          <span className="gauge-zone" data-zone="inestable" />
          {gapBefore !== gapAfter && (
            <span
              className="gauge-marker gauge-before"
              style={{ left: `${gaugePercent(gapBefore)}%` }}
            />
          )}
          <span className="gauge-marker gauge-now" style={{ left: `${marker}%` }} />
        </span>
        <span className="help">{t.ondas.leyenda}</span>
      </div>

      <details className="explain" open={explain}>
        <summary>{t.ondas.queEs}</summary>
        <p>{texto(info.definicion)}</p>
        <p>{texto(info.negativo)}</p>
        <p>{texto(info.efectos)}</p>
        <p className="help">{texto(info.origen)}</p>
      </details>
    </section>
  );
}

/** Estado del mundo sin cambios (epílogo): barras con su definición y el Desnivel. */
export function WorldMeters({ world }: { readonly world: WorldState }) {
  const gap = desnivel(world);
  return (
    <section className="panel stack" aria-labelledby="estado-mundo">
      <h2 id="estado-mundo">{t.ondas.estado}</h2>
      <ul className="changes">
        {WORLD_VARS.map((variable) => (
          <li key={variable} className="change">
            <div className="change-head">
              <span className="meter-label">{t.mundo[variable]}</span>
              <span className="meter-value">{world[variable]}</span>
            </div>
            <Meter label={t.mundo[variable]} from={world[variable]} to={world[variable]} />
            <p className="change-def">{texto(worldInfo.variables[variable].definicion)}</p>
          </li>
        ))}
      </ul>
      <div className="gap-indicator" data-zone={gapZone(gap)}>
        <p className="gap-value">{signed(gap)}</p>
        <div>
          <p className="gap-label">{t.ondas.desnivel}</p>
          <p className="help">{t.ondas.desnivelAyuda}</p>
        </div>
      </div>
    </section>
  );
}

/** Lo que oye quien usa la lectura en voz alta en el paso de los cambios. */
function changesForVoice(before: WorldState, after: WorldState, option: DilemmaOption): string {
  const lines = WORLD_VARS.flatMap((variable) => {
    const change = after[variable] - before[variable];
    const reason = option.porque[variable];
    if (change === 0 && reason === undefined) return [];
    return [
      fmt(t.ondas.resumenVoz, {
        variable: t.mundo[variable],
        cambio: change === 0 ? t.ondas.sinCambio : signed(change),
        porque: reason === undefined ? '' : texto(reason),
      }),
    ];
  });
  const gapBefore = desnivel(before);
  const gapAfter = desnivel(after);
  const sentence =
    gapAfter > gapBefore ? t.ondas.sube : gapAfter < gapBefore ? t.ondas.baja : t.ondas.igual;
  return [...lines, fmt(sentence, { antes: signed(gapBefore), ahora: signed(gapAfter) })].join(' ');
}

function Changes({
  dilemma,
  option,
}: {
  readonly dilemma: Dilemma;
  readonly option: DilemmaOption;
}) {
  const { before, after, first } = useLastChange(dilemma.id, option.deltas);
  return (
    <>
      <p className="kicker">{t.ondas.titulo}</p>
      <h1 id="que-cambia" tabIndex={-1} data-focus>
        {t.ondas.queCambia}
      </h1>
      <Listen auto text={changesForVoice(before, after, option)} />
      <WorldChange before={before} after={after} option={option} />
      <PrometheanGap before={before} after={after} explain={first} />
      <ActionBar>
        <AdvanceButton label={t.ondas.verArchivo} />
      </ActionBar>
    </>
  );
}

export function Ripples({ dilemma }: { readonly dilemma: Dilemma }) {
  const { run, answer } = useGameContext();
  const [step, setStep] = useState<'closing' | 'news' | 'changes'>('closing');
  const option = dilemma.opciones.find((o) => o.id === answer?.choice);
  const objector = findCounselor(answer?.objector);

  useSubScreen(step);

  if (step === 'closing' && objector !== undefined && answer?.closing != null) {
    return (
      <>
        <h1 tabIndex={-1} data-focus>
          {fmt(t.objecion.cierreTitulo, { nombre: objector.nombre })}
        </h1>
        <blockquote className="speech">
          <Avatar counselor={objector} />
          <p>{answer.closing}</p>
        </blockquote>
        <Listen auto text={`${objector.nombre}. ${answer.closing}`} />
        <ActionBar>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setStep('news');
            }}
          >
            {t.objecion.volver}
          </button>
        </ActionBar>
      </>
    );
  }

  if (option === undefined) {
    return (
      <ActionBar>
        <AdvanceButton label={t.ondas.verArchivo} />
      </ActionBar>
    );
  }

  if (step === 'changes') return <Changes dilemma={dilemma} option={option} />;

  return (
    <>
      <p className="kicker">{t.ondas.titulo}</p>
      <h1
        className="headline"
        tabIndex={-1}
        data-focus
        data-unstable={desnivel(run.world) >= GAP_UNSTABLE ? '' : undefined}
      >
        {texto(option.ondas.titular)}
      </h1>
      <p className="lead">{texto(option.ondas.texto)}</p>
      <AriMessage text={texto(option.ondas.ari)} />
      <Listen
        auto
        text={`${texto(option.ondas.titular)}. ${texto(option.ondas.texto)} ${t.ari.remitente}: ${texto(option.ondas.ari)}`}
      />
      <ActionBar>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setStep('changes');
          }}
        >
          {t.ondas.verCambios}
        </button>
      </ActionBar>
    </>
  );
}

export function Archive({ dilemma }: { readonly dilemma: Dilemma }) {
  const image = dilemma.assets.archivo;
  return (
    <>
      <p className="kicker">{t.archivo.subtitulo}</p>
      <h1 tabIndex={-1} data-focus>
        {t.archivo.titulo}
      </h1>
      <article className="archive-card">
        <p className="archive-text">{texto(dilemma.archivoReal.texto)}</p>
        <Listen auto text={texto(dilemma.archivoReal.texto)} />
        {image !== undefined && (
          <figure>
            <img src={assetUrl(image.src)} alt={image.pie ? texto(image.pie) : ''} loading="lazy" />
            <figcaption>
              {image.pie !== undefined && <span>{texto(image.pie)}</span>}
              <span className="credit">{image.credito}</span>
            </figcaption>
          </figure>
        )}
        {dilemma.assets.capas.length > 0 && (
          <p className="credit">{dilemma.assets.capas.map((capa) => capa.credito).join(' · ')}</p>
        )}
      </article>
      <ActionBar>
        <AdvanceButton label={t.archivo.cerrar} />
      </ActionBar>
    </>
  );
}
