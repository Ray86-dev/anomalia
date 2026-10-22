/**
 * D3 · Células que no mueren: dos cultivos vistos al microscopio, día a día.
 * Campo claro con células teñidas (citoplasma rosado y núcleo violeta); las normales mueren y
 * quedan como restos grises, y las de la muestra se dividen hasta llenar el campo.
 */
import { useId, useState } from 'react';
import { fmt } from '../../../../lib/text.ts';
import { lab, useDoneWhen, type LabProps } from './common.ts';
import {
  cellLayout,
  DAYS,
  deadNormalCells,
  normalCells,
  sampleCells,
  type Cell,
} from './models.ts';

const t = lab.microscopio;
/** Más células no caben en el campo de un móvil: el número dice el resto. */
const MAX_CELLS = 70;

function LivingCell({ cell, dividing, ids }: { cell: Cell; dividing: boolean; ids: string }) {
  const { x, y, rx, ry, angle, nx, ny } = cell;
  // Célula en división: dos mitades con su núcleo, como un ocho.
  const halves = dividing ? [-0.55, 0.55] : [0];
  const scale = dividing ? 0.72 : 1;
  return (
    <g transform={`translate(${String(x)} ${String(y)}) rotate(${String(angle)})`}>
      {halves.map((offset) => (
        <g key={offset} transform={`translate(${String(offset * rx)} 0)`}>
          <ellipse
            rx={rx * scale}
            ry={ry * scale}
            fill={`url(#${ids}-cytoplasm)`}
            stroke="#a8638f"
            strokeWidth="0.006"
          />
          <ellipse
            cx={nx * scale}
            cy={ny * scale}
            rx={rx * 0.38 * scale}
            ry={ry * 0.42 * scale}
            fill="#5b2b70"
          />
          <circle
            cx={nx * scale + rx * 0.08}
            cy={ny * scale - ry * 0.06}
            r={rx * 0.08 * scale}
            fill="#33103f"
          />
        </g>
      ))}
    </g>
  );
}

function DeadCell({ cell }: { cell: Cell }) {
  const { x, y, rx, angle } = cell;
  return (
    <g transform={`translate(${String(x)} ${String(y)}) rotate(${String(angle)})`} opacity="0.85">
      <ellipse rx={rx * 0.55} ry={rx * 0.42} fill="#a99e8f" stroke="#7d7366" strokeWidth="0.006" />
      <circle cx={rx * 0.75} cy={-rx * 0.3} r={rx * 0.14} fill="#a99e8f" />
      <circle cx={-rx * 0.7} cy={rx * 0.35} r={rx * 0.1} fill="#a99e8f" />
      <circle r={rx * 0.16} fill="#6e6458" />
    </g>
  );
}

function Field({
  label,
  living,
  dead,
  cells,
  dividingEvery,
}: {
  label: string;
  living: number;
  dead: number;
  cells: readonly Cell[];
  dividingEvery: number | null;
}) {
  const ids = useId();
  const shownLiving = Math.min(living, MAX_CELLS);
  return (
    <svg viewBox="-1.05 -1.05 2.1 2.1" role="img" aria-label={label}>
      <defs>
        <radialGradient id={`${ids}-light`}>
          <stop offset="0" stopColor="#fbf6ea" />
          <stop offset="0.8" stopColor="#efe4cc" />
          <stop offset="1" stopColor="#cdbd9c" />
        </radialGradient>
        <radialGradient id={`${ids}-cytoplasm`} cx="0.45" cy="0.4">
          <stop offset="0" stopColor="#f2c9e0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#cf8fbb" stopOpacity="0.9" />
        </radialGradient>
        <clipPath id={`${ids}-clip`}>
          <circle r="1" />
        </clipPath>
      </defs>
      <rect x="-1.05" y="-1.05" width="2.1" height="2.1" fill="#05070c" />
      <circle r="1" fill={`url(#${ids}-light)`} />
      <g clipPath={`url(#${ids}-clip)`}>
        {cells.slice(shownLiving, shownLiving + dead).map((cell, i) => (
          <DeadCell key={`d${String(i)}`} cell={cell} />
        ))}
        {cells.slice(0, shownLiving).map((cell, i) => (
          <LivingCell
            key={i}
            cell={cell}
            ids={ids}
            dividing={dividingEvery !== null && i % dividingEvery === dividingEvery - 1}
          />
        ))}
      </g>
      <circle r="1" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.05" />
    </svg>
  );
}

export function Microscope(props: LabProps) {
  const [day, setDay] = useState(0);
  const [normalLayout] = useState(() => cellLayout(8, Math.random));
  const [sampleLayout] = useState(() => cellLayout(MAX_CELLS, Math.random));
  useDoneWhen(day === DAYS, props);
  const living = normalCells(day);
  const dead = deadNormalCells(day);
  const sample = sampleCells(day);

  return (
    <div className="lab stack">
      <p className="lab-status" aria-live="polite">
        {fmt(t.dia, { n: day, total: DAYS })} · {t.normales}: {living} · {t.muestra}: {sample}
      </p>
      <div className="lab-dishes">
        <figure className="lab-dish">
          <Field
            label={fmt(t.placa, { nombre: t.normales, n: living })}
            living={living}
            dead={dead}
            cells={normalLayout}
            dividingEvery={null}
          />
          <figcaption>
            <span>{t.normales}</span>
            <strong>{fmt(t.recuento, { n: living })}</strong>
            {dead > 0 && <span className="lab-dead">{fmt(t.muertas, { n: dead })}</span>}
          </figcaption>
        </figure>
        <figure className="lab-dish">
          <Field
            label={fmt(t.placa, { nombre: t.muestra, n: sample })}
            living={sample}
            dead={0}
            cells={sampleLayout}
            dividingEvery={day > 0 ? 6 : null}
          />
          <figcaption>
            <span>{t.muestra}</span>
            <strong>{fmt(t.recuento, { n: sample })}</strong>
          </figcaption>
        </figure>
      </div>
      {day < DAYS && (
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setDay(day + 1);
          }}
        >
          {t.pasarDia}
        </button>
      )}
    </div>
  );
}
