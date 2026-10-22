/** D4 · Buscar y cortar: la guía recorre un ADN de ejemplo (nunca un embrión). */
import { useId, useState } from 'react';
import { fmt } from '../../../../lib/text.ts';
import { lab, useDoneWhen, type LabProps } from './common.ts';
import { GUIDE_LENGTH, makeGenome, matchesAt, SEQUENCE_LENGTH } from './models.ts';

const t = lab.crispr;
const LAST = SEQUENCE_LENGTH - GUIDE_LENGTH;
const CUT_AT = 3;
/** «ACGT» → «A C G T»: el lector de pantalla deletrea las bases. */
const spaced = (bases: string) => bases.replace(/(.)(?=.)/g, '$1 ');

export function Crispr(props: LabProps) {
  const id = useId();
  const [genome] = useState(() => makeGenome(Math.random));
  const [position, setPosition] = useState(0);
  const [cut, setCut] = useState(false);
  const matches = matchesAt(genome.sequence, genome.guide, position);
  const whole = matches === GUIDE_LENGTH;
  useDoneWhen(cut, props);

  const inWindow = (i: number, start: number) => i >= start && i < start + GUIDE_LENGTH;

  return (
    <div className="lab stack">
      <div className="lab-dna" aria-hidden="true">
        <div className="lab-dna-row lab-dna-guide">
          {Array.from({ length: SEQUENCE_LENGTH }, (_, i) => (
            <span key={i} className="lab-base">
              {inWindow(i, position) ? genome.guide[i - position] : ''}
            </span>
          ))}
        </div>
        <div className="lab-dna-row">
          {Array.from({ length: SEQUENCE_LENGTH }, (_, i) => genome.sequence.charAt(i)).map(
            (base, i) => {
              const inGuide = inWindow(i, position);
              const same = inGuide && genome.guide[i - position] === base;
              const classes = [
                'lab-base',
                inGuide ? 'is-window' : '',
                same ? 'is-match' : '',
                cut && inWindow(i, genome.offTarget) ? 'is-similar' : '',
                // El corte cae dentro del trozo encontrado.
                cut && i === genome.target + CUT_AT ? 'is-cut' : '',
              ];
              return (
                <span key={i} className={classes.filter(Boolean).join(' ')}>
                  {base}
                </span>
              );
            },
          )}
        </div>
      </div>
      <p className="visually-hidden">
        {t.secuencia}: {spaced(genome.sequence)}. {t.guia}: {spaced(genome.guide)}.
      </p>
      <div className="field">
        <label htmlFor={`${id}-pos`}>{t.posicion}</label>
        <input
          id={`${id}-pos`}
          type="range"
          min={0}
          max={LAST}
          value={position}
          disabled={cut}
          aria-valuetext={fmt(t.posicionTexto, {
            desde: position + 1,
            hasta: position + GUIDE_LENGTH,
          })}
          onChange={(event) => {
            setPosition(Number(event.target.value));
          }}
        />
      </div>
      <p className="lab-status" aria-live="polite">
        {cut
          ? fmt(t.cortado, { n: GUIDE_LENGTH - 1, total: GUIDE_LENGTH })
          : whole
            ? t.coincide
            : fmt(t.coinciden, { n: matches, total: GUIDE_LENGTH })}
      </p>
      {!cut && (
        <button
          className="btn btn-secondary"
          type="button"
          disabled={!whole}
          onClick={() => {
            setCut(true);
          }}
        >
          {t.cortar}
        </button>
      )}
    </div>
  );
}
