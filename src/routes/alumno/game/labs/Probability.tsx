/** D5 · ¿Predice el índice? Un índice inventado frente a personas inventadas. */
import { useId, useState } from 'react';
import { fmt } from '../../../../lib/text.ts';
import { lab, useDoneWhen, type LabProps } from './common.ts';
import { classify, makePeople, THRESHOLD, THRESHOLDS_TO_TRY } from './models.ts';

const t = lab.probabilidad;
const START = 50;

export function Probability(props: LabProps) {
  const id = useId();
  const [people] = useState(() => makePeople(Math.random));
  const [threshold, setThreshold] = useState(START);
  const [tried, setTried] = useState<ReadonlySet<number>>(() => new Set([START]));
  const result = classify(people, threshold);
  useDoneWhen(tried.size >= THRESHOLDS_TO_TRY, props);

  return (
    <div className="lab stack">
      <p className="lab-question">{t.pregunta}</p>
      <p className="help" aria-hidden="true">
        {t.leyenda}
      </p>
      <ul className="lab-people">
        {people.map((person, i) => {
          const inside = person.index >= threshold;
          const label = fmt(t.persona, {
            indice: person.index,
            estado: inside ? t.dentro : t.fuera,
            resultado: person.success ? t.loConsigue : t.noLoConsigue,
          });
          return (
            <li
              key={i}
              className={`lab-person ${inside ? 'is-inside' : 'is-outside'}`}
              aria-label={label}
            >
              <span className="lab-person-index">{person.index}</span>
              <span className="lab-person-result" aria-hidden="true">
                {person.success ? t.simboloSi : t.simboloNo}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="field">
        <label htmlFor={`${id}-u`}>
          {t.umbral}: <strong>{threshold}</strong>
        </label>
        <input
          id={`${id}-u`}
          type="range"
          {...THRESHOLD}
          value={threshold}
          onChange={(event) => {
            const value = Number(event.target.value);
            setThreshold(value);
            setTried(new Set([...tried, value]));
          }}
        />
      </div>
      <ul className="lab-tally" aria-live="polite">
        <li>{fmt(t.pasanYLoConsiguen, { n: result.admittedSuccess })}</li>
        <li>{fmt(t.pasanYNo, { n: result.admittedFail })}</li>
        <li className="is-lost">{fmt(t.fueraYLoHabrian, { n: result.rejectedSuccess })}</li>
        <li>{fmt(t.fueraYNo, { n: result.rejectedFail })}</li>
      </ul>
      {!props.done && (
        <p className="help">
          {fmt(t.prueba, { n: Math.min(tried.size, THRESHOLDS_TO_TRY), total: THRESHOLDS_TO_TRY })}
        </p>
      )}
      <p className="help">{t.ficticio}</p>
    </div>
  );
}
