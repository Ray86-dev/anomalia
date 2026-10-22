/** D2 · Del aire al abono: presión, temperatura y catalizador hasta llegar a la meta. */
import { useId, useState } from 'react';
import { fmt } from '../../../../lib/text.ts';
import { lab, useDoneWhen, type LabProps } from './common.ts';
import {
  AMMONIA_GOAL,
  ammoniaProduction,
  ammoniaYield,
  PRESSURE,
  REACTOR_START,
  reactionSpeed,
  TEMPERATURE,
} from './models.ts';

const t = lab.amoniaco;

function Bar({ label, value, goal }: { label: string; value: number; goal?: number }) {
  return (
    <li className="meter-row">
      <span className="meter-label">{label}</span>
      <span className="meter-value">{value}</span>
      <span
        className="meter lab-meter"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span className="meter-fill" style={{ width: `${String(value)}%` }} />
        {goal !== undefined && <span className="lab-goal" style={{ left: `${String(goal)}%` }} />}
      </span>
    </li>
  );
}

export function Ammonia(props: LabProps) {
  const id = useId();
  const [reactor, setReactor] = useState(REACTOR_START);
  const production = ammoniaProduction(reactor);
  const reached = production >= AMMONIA_GOAL;
  useDoneWhen(reached, props);

  return (
    <div className="lab stack">
      <div className="field">
        <label htmlFor={`${id}-p`}>
          {t.presion}: <strong>{fmt(t.atm, { n: reactor.pressure })}</strong>
        </label>
        <input
          id={`${id}-p`}
          type="range"
          {...PRESSURE}
          value={reactor.pressure}
          aria-valuetext={fmt(t.atm, { n: reactor.pressure })}
          onChange={(event) => {
            setReactor({ ...reactor, pressure: Number(event.target.value) });
          }}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-t`}>
          {t.temperatura}: <strong>{fmt(t.grados, { n: reactor.temperature })}</strong>
        </label>
        <input
          id={`${id}-t`}
          type="range"
          {...TEMPERATURE}
          value={reactor.temperature}
          aria-valuetext={fmt(t.grados, { n: reactor.temperature })}
          onChange={(event) => {
            setReactor({ ...reactor, temperature: Number(event.target.value) });
          }}
        />
      </div>
      <label className="lab-check">
        <input
          type="checkbox"
          checked={reactor.catalyst}
          onChange={(event) => {
            setReactor({ ...reactor, catalyst: event.target.checked });
          }}
        />
        <span>{t.catalizador}</span>
      </label>
      <ul className="meters panel">
        <Bar label={t.rendimiento} value={ammoniaYield(reactor)} />
        <Bar label={t.velocidad} value={reactionSpeed(reactor)} />
        <Bar label={t.produccion} value={production} goal={AMMONIA_GOAL} />
      </ul>
      <p className="lab-status" aria-live="polite">
        {fmt(t.meta, { n: AMMONIA_GOAL })} · {reached ? t.conseguido : t.falta}
      </p>
    </div>
  );
}
