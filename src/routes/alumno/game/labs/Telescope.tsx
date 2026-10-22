/**
 * D1 · Las lunas de Júpiter: enfocar cada noche y anotar, como en los cuadernos de Galileo.
 * Júpiter con bandas, mancha roja y oscurecimiento del borde; cuatro lunas de distinto tono.
 */
import { useId, useState } from 'react';
import { fmt } from '../../../../lib/text.ts';
import { lab, useDoneWhen, type LabProps } from './common.ts';
import {
  blurFor,
  focusTargets,
  isFocused,
  moonPhases,
  moonPositions,
  NIGHTS,
  sides,
  starField,
} from './models.ts';

const t = lab.telescopio;

/** Bandas de Júpiter de polo a polo (zonas claras y cinturones oscuros). */
const BANDS: readonly [number, string][] = [
  [0, '#d9c6a3'],
  [0.16, '#cdb08a'],
  [0.24, '#a97a52'],
  [0.3, '#e6d7bb'],
  [0.38, '#bf8e5f'],
  [0.45, '#a26c46'],
  [0.5, '#efe4cd'],
  [0.58, '#f1e6d0'],
  [0.64, '#b88457'],
  [0.7, '#9b6844'],
  [0.76, '#e3d3b4'],
  [0.86, '#c7a37a'],
  [1, '#cdb593'],
];

/** Ío, Europa, Ganímedes y Calisto: tamaño relativo y tono. */
const MOON_LOOK: readonly [number, string][] = [
  [1.7, '#f1dc8f'],
  [1.5, '#efe8dc'],
  [2.1, '#d6cdbd'],
  [1.9, '#a99b86'],
];

/** Vista del ocular: cielo, estrellas, Júpiter y lunas; `blur` desenfoca todo menos el borde. */
function Eyepiece({ positions, blur }: { positions: readonly number[]; blur: number }) {
  const id = useId();
  const [stars] = useState(() => starField(60, Math.random));
  return (
    <svg className="lab-view" viewBox="-110 -45 220 90" role="img" aria-label={t.cielo}>
      <defs>
        <linearGradient id={`${id}-bands`} x1="0" y1="0" x2="0" y2="1">
          {BANDS.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        <radialGradient id={`${id}-limb`}>
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
        <radialGradient id={`${id}-moon`} cx="0.35" cy="0.35">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-vignette`}>
          <stop offset="0.72" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.95" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={blur} />
        </filter>
      </defs>
      <rect x="-110" y="-45" width="220" height="90" fill="#03050b" />
      <g filter={`url(#${id}-blur)`}>
        {stars.map(([x, y, r, opacity], i) => (
          <circle key={i} cx={x * 108} cy={y * 44} r={r * 60} fill="#e8eeff" opacity={opacity} />
        ))}
        <g>
          <ellipse rx="13" ry="12.2" fill={`url(#${id}-bands)`} />
          <ellipse cx="4.2" cy="3.6" rx="2.3" ry="1.25" fill="#b9553a" opacity="0.85" />
          <ellipse rx="13" ry="12.2" fill={`url(#${id}-limb)`} />
        </g>
        {positions.map((x, i) => {
          const [radius, color] = MOON_LOOK[i] ?? [1.6, '#eee'];
          return (
            <g key={i} transform={`translate(${String(x * 100)} 0)`}>
              <circle r={radius * 2.2} fill={color} opacity="0.12" />
              <circle r={radius} fill={color} />
              <circle r={radius} fill={`url(#${id}-moon)`} />
            </g>
          );
        })}
      </g>
      <ellipse rx="124" ry="64" fill={`url(#${id}-vignette)`} />
    </svg>
  );
}

/** Una fila del cuaderno: O para Júpiter y * para cada punto de luz, como dibujaba Galileo. */
function NotebookRow({ positions }: { positions: readonly number[] }) {
  return (
    <svg viewBox="-110 -9 220 18" aria-hidden="true">
      <circle r="5" className="lab-notebook-planet" />
      {positions.map((x, i) => (
        <text key={i} x={x * 100} y="4.5" className="lab-notebook-moon" textAnchor="middle">
          {t.marcaLuna}
        </text>
      ))}
    </svg>
  );
}

export function Telescope(props: LabProps) {
  const id = useId();
  const [targets] = useState(() => focusTargets(Math.random));
  const [phases] = useState(() => moonPhases(Math.random));
  const [focus, setFocus] = useState(0);
  const [night, setNight] = useState(0);
  const target = targets[night] ?? 50;
  const focused = isFocused(focus, target);
  const positions = moonPositions(night, phases);
  const { left, right } = sides(positions);
  const last = night === NIGHTS - 1;
  useDoneWhen(last && focused, props);

  // Noches anotadas: las anteriores y la actual en cuanto se ve nítida.
  const noted = focused ? night + 1 : night;
  const status = focused
    ? `${t.enfocado} ${fmt(t.noche, { n: night + 1, total: NIGHTS, izquierda: left, derecha: right })}`
    : night === 0
      ? t.borroso
      : t.reenfocar;

  return (
    <div className="lab stack">
      <Eyepiece positions={positions} blur={blurFor(focus, target)} />
      <div className="field">
        <label htmlFor={`${id}-focus`}>{t.enfoque}</label>
        <input
          id={`${id}-focus`}
          type="range"
          min={0}
          max={100}
          value={focus}
          onChange={(event) => {
            setFocus(Number(event.target.value));
          }}
        />
      </div>
      <p className="lab-status" aria-live="polite">
        {status}
      </p>
      {noted > 0 && (
        <section className="lab-notebook" aria-label={t.cuaderno}>
          <p className="lab-notebook-title">{t.cuaderno}</p>
          {Array.from({ length: noted }, (_, n) => (
            <div key={n} className="lab-notebook-row">
              <span>{fmt(t.fila, { n: n + 1 })}</span>
              <NotebookRow positions={moonPositions(n, phases)} />
            </div>
          ))}
          <p className="lab-notebook-help">{t.cuadernoAyuda}</p>
        </section>
      )}
      {focused && !last && (
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setNight(night + 1);
          }}
        >
          {t.observar}
        </button>
      )}
    </div>
  );
}
