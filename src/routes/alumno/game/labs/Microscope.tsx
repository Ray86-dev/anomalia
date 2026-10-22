/** D3 · Células que no mueren: dos cultivos, día a día. */
import { useState } from 'react';
import { fmt } from '../../../../lib/text.ts';
import { lab, useDoneWhen, type LabProps } from './common.ts';
import { DAYS, dishPoints, normalCells, sampleCells } from './models.ts';

const t = lab.microscopio;
/** Más puntos no se distinguen en una placa de móvil: el número dice el resto. */
const MAX_DOTS = 160;

function Dish({
  name,
  count,
  points,
}: {
  name: string;
  count: number;
  points: [number, number][];
}) {
  return (
    <figure className="lab-dish">
      <svg
        viewBox="-1.05 -1.05 2.1 2.1"
        role="img"
        aria-label={fmt(t.placa, { nombre: name, n: count })}
      >
        <circle r={1} className="lab-dish-plate" />
        {points.slice(0, Math.min(count, MAX_DOTS)).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={0.045} className="lab-cell" />
        ))}
      </svg>
      <figcaption>
        <span>{name}</span>
        <strong>{fmt(t.recuento, { n: count })}</strong>
      </figcaption>
    </figure>
  );
}

export function Microscope(props: LabProps) {
  const [day, setDay] = useState(0);
  const [normalPoints] = useState(() => dishPoints(MAX_DOTS, Math.random));
  const [samplePoints] = useState(() => dishPoints(MAX_DOTS, Math.random));
  useDoneWhen(day === DAYS, props);

  return (
    <div className="lab stack">
      <p className="lab-status" aria-live="polite">
        {fmt(t.dia, { n: day, total: DAYS })} · {t.normales}: {normalCells(day)} · {t.muestra}:{' '}
        {sampleCells(day)}
      </p>
      <div className="lab-dishes">
        <Dish name={t.normales} count={normalCells(day)} points={normalPoints} />
        <Dish name={t.muestra} count={sampleCells(day)} points={samplePoints} />
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
      <p className="help">{lab.modelo}</p>
    </div>
  );
}
