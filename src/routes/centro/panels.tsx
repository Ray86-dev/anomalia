/** Paneles del Centro de Control. Solo pintan agregados; los grupos < k se muestran como «<k». */
import { concepts, dilemmas, endings, ui } from '@shared/generated/content.ts';
import { WORLD_VARS } from '@shared/game/world.ts';
import type { Dilemma } from '@shared/schemas/content.ts';
import type { ReactNode } from 'react';
import { fmt } from '../../lib/text.ts';
import { majority, OPTION_IDS, type Snapshot } from './snapshot.ts';
import { signed, UNSTABLE_GAP } from './ticker.ts';

const t = ui.centro;

export function dilemmaOf(id: string): Dilemma | undefined {
  return dilemmas.find((d) => d.id === id);
}

const placeLabel = (id: string) => {
  const d = dilemmaOf(id);
  return d === undefined ? id.toUpperCase() : `${d.lugar} · ${String(d.anio)}`;
};

type PanelProps = {
  readonly title: string;
  readonly featured: boolean;
  readonly className?: string;
  readonly children: ReactNode;
};

export function Panel({ title, featured, className = '', children }: PanelProps) {
  return (
    <section
      className={`cc-panel ${className}${featured ? ' cc-featured' : ''}`}
      aria-label={title}
    >
      <h2 className="cc-panel-title">{title}</h2>
      {children}
    </section>
  );
}

/** Cifra enmascarada: «<5» si es un grupo pequeño. */
function Count({ value, k }: { readonly value: number | null; readonly k: number }) {
  return <>{value ?? fmt(t.menosDeK, { k })}</>;
}

export function ProgressPanel({
  snapshot,
  featured,
}: {
  readonly snapshot: Snapshot;
  readonly featured: boolean;
}) {
  const { live, k } = snapshot;
  const total = Math.max(live.players, 1);
  const ids = [...snapshot.chapter1, ...snapshot.chapter2];
  return (
    <Panel title={t.progreso} featured={featured}>
      <p className="cc-legend" aria-hidden="true">
        <span className="cc-swatch cc-bar-done" /> {t.hechos}
        <span className="cc-swatch cc-bar-here" /> {t.aqui}
      </p>
      <ul className="cc-progress">
        {ids.map((id) => {
          const row = live.dilemmas[id] ?? { here: 0, done: 0 };
          const done = row.done ?? 0;
          const here = row.here ?? 0;
          // Un grupo enmascarado tiene entre 1 y k−1 personas: se dibuja como franja rayada.
          const masked = (row.done === null ? 1 : 0) + (row.here === null ? 1 : 0);
          return (
            <li key={id}>
              <span className="cc-row-label">{placeLabel(id)}</span>
              <span className="cc-bar" aria-hidden="true">
                <span
                  className="cc-bar-done"
                  style={{ width: `${String((done / total) * 100)}%` }}
                />
                <span
                  className="cc-bar-here"
                  style={{ width: `${String((here / total) * 100)}%` }}
                />
                {masked > 0 && (
                  <span
                    className="cc-bar-masked"
                    style={{ width: `${String(((masked * (k - 1)) / total) * 100)}%` }}
                  />
                )}
              </span>
              <span className="cc-row-value">
                <Count value={row.done} k={k} />
                <span className="visually-hidden"> {t.hechos}</span> ·{' '}
                <Count value={row.here} k={k} />
                <span className="visually-hidden"> {t.aqui}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <dl className="cc-phases">
        <div>
          <dt>{t.prologo}</dt>
          <dd>
            <Count value={live.phases.prologue} k={k} />
          </dd>
        </div>
        <div>
          <dt>{t.espera}</dt>
          <dd>
            <Count value={live.phases.waiting} k={k} />
          </dd>
        </div>
        <div>
          <dt>{t.final}</dt>
          <dd>
            <Count value={live.phases.final} k={k} />
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

type RevealProps = {
  readonly snapshot: Snapshot;
  readonly revealed: boolean;
  readonly featured: boolean;
};

export function DecisionsPanel({ snapshot, revealed, featured }: RevealProps) {
  const ids = [...snapshot.chapter1, ...snapshot.chapter2];
  return (
    <Panel title={t.decisiones} featured={featured}>
      {!revealed ? (
        <p className="cc-hidden">{t.ocultas}</p>
      ) : (
        <ul className="cc-decisions">
          {ids.map((id) => {
            const counts = snapshot.results.decisions[id];
            const dilemma = dilemmaOf(id);
            if (counts === undefined) return null;
            return (
              <li key={id}>
                <p className="cc-row-label">{placeLabel(id)}</p>
                {counts.n === null ? (
                  <p className="cc-muted">{fmt(t.faltan, { k: snapshot.k })}</p>
                ) : (
                  <>
                    {OPTION_IDS.map((option) => {
                      const n = counts[option] ?? 0;
                      const share = counts.n === null || counts.n === 0 ? 0 : n / counts.n;
                      const label = dilemma?.opciones.find((o) => o.id === option)?.corto ?? option;
                      return (
                        <div key={option} className="cc-option">
                          <span className="cc-option-letter">{option}</span>
                          <span className="cc-option-label">{label}</span>
                          <span className="cc-bar" aria-hidden="true">
                            <span
                              className="cc-bar-done"
                              style={{ width: `${String(share * 100)}%` }}
                            />
                          </span>
                          <span className="cc-row-value">{Math.round(share * 100)}%</span>
                        </div>
                      );
                    })}
                    <p className="cc-muted">{fmt(t.respuestas, { n: counts.n })}</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function WorldPanel({
  snapshot,
  featured,
}: {
  readonly snapshot: Snapshot;
  readonly featured: boolean;
}) {
  const world = snapshot.results.world;
  return (
    <Panel title={t.mundo} featured={featured} className="cc-world">
      {world === null ? (
        <p className="cc-muted">{fmt(t.sinDatos, { k: snapshot.k })}</p>
      ) : (
        <>
          <div
            className="cc-gap"
            data-level={
              world.desnivel >= UNSTABLE_GAP ? 'high' : world.desnivel >= 10 ? 'mid' : 'low'
            }
          >
            <span className="cc-gap-value">{signed(world.desnivel)}</span>
            <span className="cc-gap-label">{t.desnivel}</span>
          </div>
          <ul className="cc-meters">
            {WORLD_VARS.map((variable) => (
              <li key={variable}>
                <span className="cc-row-label">{ui.juego.mundo[variable]}</span>
                <span className="cc-bar" aria-hidden="true">
                  <span className="cc-bar-done" style={{ width: `${String(world[variable])}%` }} />
                </span>
                <span className="cc-row-value">{world[variable]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/** Parte un texto en líneas de como mucho `max` caracteres (sin cortar palabras). */
export function wrapWords(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= max) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

const LINE = { width: 640, height: 280, margin: 82, maxTwist: 36, labelChars: 16 } as const;

/**
 * Línea 1633 → 2077 con la decisión mayoritaria de cada anomalía; se retuerce más cuanto
 * mayor es el Desnivel. Las etiquetas alternan arriba y abajo para que no se pisen.
 */
export function TimelinePanel({ snapshot, revealed, featured }: RevealProps) {
  const points = [...snapshot.chapter1, ...snapshot.chapter2, '2077'];
  const { width, height, margin, maxTwist, labelChars } = LINE;
  const step = (width - 2 * margin) / Math.max(points.length - 1, 1);
  const gap = snapshot.results.world?.desnivel ?? 0;
  const twist = (Math.min(Math.abs(gap), 50) / 50) * maxTwist;
  const x = (i: number) => margin + i * step;
  const y = (i: number) => height / 2 + (i === 0 ? 0 : i % 2 === 0 ? -twist : twist);
  // Curvas con tangentes horizontales: una onda suave que se acentúa con el Desnivel.
  const path = points
    .map((_, i) => {
      if (i === 0) return `M ${String(x(0))} ${String(y(0))}`;
      const c1 = x(i - 1) + step / 2;
      const c2 = x(i) - step / 2;
      return `C ${String(c1)} ${String(y(i - 1))} ${String(c2)} ${String(y(i))} ${String(x(i))} ${String(y(i))}`;
    })
    .join(' ');
  return (
    <Panel title={t.linea} featured={featured} className="cc-timeline">
      <svg viewBox={`0 0 ${String(width)} ${String(height)}`} role="img" aria-label={t.linea}>
        <path d={path} className={`cc-line${gap >= UNSTABLE_GAP ? ' cc-line-unstable' : ''}`} />
        {points.map((id, i) => {
          const dilemma = dilemmaOf(id);
          const winner = revealed ? majority(snapshot.results.decisions[id]) : null;
          const label = dilemma?.opciones.find((o) => o.id === winner)?.corto ?? '?';
          const lines = dilemma === undefined ? [] : wrapWords(label, labelChars);
          const above = i % 2 === 0;
          const yearY = above ? y(i) + 42 : y(i) - 24;
          // Arriba, la última línea queda pegada al nodo; abajo, la primera.
          const labelY = above ? y(i) - 26 - (lines.length - 1) * 21 : y(i) + 40;
          return (
            <g key={id}>
              <circle cx={x(i)} cy={y(i)} r={9} className="cc-node" />
              <text x={x(i)} y={yearY} textAnchor="middle" className="cc-year">
                {dilemma === undefined ? id.toUpperCase() : dilemma.anio}
              </text>
              <text x={x(i)} y={labelY} textAnchor="middle" className="cc-node-label">
                {lines.map((line, j) => (
                  <tspan key={line} x={x(i)} dy={j === 0 ? 0 : 21}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}

/** Constelación: los conceptos más invocados, con tamaño según su uso y el mayor en el centro. */
export function ConceptsPanel({
  snapshot,
  featured,
}: {
  readonly snapshot: Snapshot;
  readonly featured: boolean;
}) {
  const list = snapshot.results.concepts.slice(0, 12);
  const max = Math.max(...list.map((c) => c.n), 1);
  const centred = list.reduce<typeof list>(
    (acc, concept, i) => (i % 2 === 0 ? [...acc, concept] : [concept, ...acc]),
    [],
  );
  return (
    <Panel title={t.conceptos} featured={featured} className="cc-concepts">
      {list.length === 0 ? (
        <p className="cc-muted">{fmt(t.sinConceptos, { k: snapshot.k })}</p>
      ) : (
        <ul className="cc-cloud">
          {centred.map((concept) => {
            const weight = concept.n / max;
            return (
              <li
                key={concept.id}
                style={{
                  fontSize: `${String(0.9 + 1.5 * Math.sqrt(weight))}em`,
                  opacity: 0.5 + 0.5 * weight,
                }}
              >
                {concepts.find((c) => c.id === concept.id)?.etiqueta ?? concept.id}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function EndingsPanel({
  snapshot,
  featured,
}: {
  readonly snapshot: Snapshot;
  readonly featured: boolean;
}) {
  const counts = snapshot.results.endings;
  const total = counts === null ? 0 : Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <Panel title={t.finales} featured={featured}>
      {counts === null ? (
        <p className="cc-muted">{t.sinFinales}</p>
      ) : (
        <ul className="cc-meters">
          {endings.map((ending) => {
            const n = counts[ending.id] ?? 0;
            return (
              <li key={ending.id}>
                <span className="cc-row-label">{ending.titulo.normal}</span>
                <span className="cc-bar" aria-hidden="true">
                  <span
                    className="cc-bar-done"
                    style={{ width: `${String((n / Math.max(total, 1)) * 100)}%` }}
                  />
                </span>
                <span className="cc-row-value">{n}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function Ticker({ messages }: { readonly messages: readonly string[] }) {
  // Se duplica la lista para que el desplazamiento sea continuo; la velocidad no depende
  // de cuántos mensajes haya.
  const length = messages.reduce((sum, message) => sum + message.length, 0);
  const duration = Math.max(20, Math.round(length * 0.25));
  return (
    <div className="cc-ticker" role="marquee" aria-live="off">
      <div className="cc-ticker-track" style={{ animationDuration: `${String(duration)}s` }}>
        {[...messages, ...messages].map((message, i) => (
          <span
            key={`${String(i)}-${message}`}
            className="cc-ticker-item"
            aria-hidden={i >= messages.length}
          >
            {message}
          </span>
        ))}
      </div>
    </div>
  );
}
