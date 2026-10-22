/** D1 · Las lunas de Júpiter: enfocar y observar varias noches, como en un cuaderno. */
import { useId, useState } from 'react';
import { fmt } from '../../../../lib/text.ts';
import { lab, useDoneWhen, type LabProps } from './common.ts';
import {
  blurFor,
  focusTarget,
  isFocused,
  moonPhases,
  moonPositions,
  NIGHTS,
  sides,
} from './models.ts';

const t = lab.telescopio;

function Night({ positions, scale = 1 }: { positions: readonly number[]; scale?: number }) {
  return (
    <>
      <circle r={12 * scale} className="lab-jupiter" />
      {positions.map((x, i) => (
        <circle key={i} cx={x * 100} r={3.2 * scale} className="lab-moon" />
      ))}
    </>
  );
}

export function Telescope(props: LabProps) {
  const id = useId();
  const [target] = useState(() => focusTarget(Math.random));
  const [phases] = useState(() => moonPhases(Math.random));
  const [focus, setFocus] = useState(0);
  const [night, setNight] = useState(0);
  const focused = isFocused(focus, target);
  const positions = moonPositions(night, phases);
  const { left, right } = sides(positions);
  const last = night === NIGHTS - 1;
  useDoneWhen(last, props);

  return (
    <div className="lab stack">
      <svg className="lab-view" viewBox="-110 -45 220 90" role="img" aria-label={t.cielo}>
        <filter id={`${id}-blur`}>
          <feGaussianBlur stdDeviation={blurFor(focus, target)} />
        </filter>
        <g filter={`url(#${id}-blur)`}>
          <Night positions={positions} />
        </g>
      </svg>
      <div className="field">
        <label htmlFor={`${id}-focus`}>{t.enfoque}</label>
        <input
          id={`${id}-focus`}
          type="range"
          min={0}
          max={100}
          value={focus}
          disabled={night > 0}
          onChange={(event) => {
            setFocus(Number(event.target.value));
          }}
        />
      </div>
      <p className="lab-status" aria-live="polite">
        {focused
          ? `${night === 0 ? `${t.enfocado} ` : ''}${fmt(t.noche, {
              n: night + 1,
              total: NIGHTS,
              izquierda: left,
              derecha: right,
            })}`
          : t.borroso}
      </p>
      {focused && (
        <section className="lab-notebook" aria-label={t.cuaderno}>
          {Array.from({ length: night + 1 }, (_, n) => (
            <div key={n} className="lab-notebook-row">
              <span>{fmt(t.fila, { n: n + 1 })}</span>
              <svg viewBox="-110 -12 220 24" aria-hidden="true">
                <Night positions={moonPositions(n, phases)} scale={0.7} />
              </svg>
            </div>
          ))}
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
