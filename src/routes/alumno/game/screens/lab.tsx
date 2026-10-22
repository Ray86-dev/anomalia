/** Laboratorio (M6): comprobar un dato con un experimento corto antes de decidir con razones. */
import type { LabType } from '@shared/game/milestones.ts';
import { ui } from '@shared/generated/content.ts';
import type { Dilemma } from '@shared/schemas/content.ts';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { vibrate } from '../../../../engine/motion.ts';
import { texto } from '../helpers.ts';
import { Ammonia } from '../labs/Ammonia.tsx';
import type { LabProps } from '../labs/common.ts';
import { Crispr } from '../labs/Crispr.tsx';
import { Microscope } from '../labs/Microscope.tsx';
import { Probability } from '../labs/Probability.tsx';
import { Telescope } from '../labs/Telescope.tsx';
import { ActionBar, AdvanceButton, Listen } from '../parts.tsx';

const t = ui.juego;
const NEWLINE = '\n';

const EXPERIMENTS: Record<LabType, ComponentType<LabProps>> = {
  telescopio: Telescope,
  amoniaco: Ammonia,
  microscopio: Microscope,
  crispr: Crispr,
  probabilidad: Probability,
};

export function Lab({ dilemma }: { readonly dilemma: Dilemma }) {
  const experiment = dilemma.laboratorio;
  const Experiment = EXPERIMENTS[experiment.tipo];
  const [done, setDone] = useState(false);
  const result = useRef<HTMLElement>(null);
  const onDone = useCallback(() => {
    vibrate();
    setDone(true);
  }, []);

  // El dato aparece debajo del experimento: que quede a la vista sin mover nada más.
  useEffect(() => {
    if (done) result.current?.scrollIntoView({ block: 'nearest' });
  }, [done]);

  return (
    <>
      <p className="kicker">
        {t.laboratorio.titulo} · {texto(dilemma.titulo)}
      </p>
      <h1 tabIndex={-1} data-focus>
        {texto(experiment.titulo)}
      </h1>
      {/* Instrucciones en párrafos cortos: cada salto de línea del contenido es un párrafo. */}
      {texto(experiment.instrucciones)
        .split(NEWLINE)
        .map((paragraph) => (
          <p key={paragraph} className="lead">
            {paragraph}
          </p>
        ))}
      <Listen auto text={texto(experiment.instrucciones)} />
      <Experiment done={done} onDone={onDone} />
      {done && (
        <article ref={result} className="panel stack lab-result" role="status">
          <p className="kicker">{t.laboratorio.dato}</p>
          <p className="lead">{texto(experiment.dato)}</p>
          <Listen auto text={texto(experiment.dato)} />
          <p className="help">{t.laboratorio.datoAyuda}</p>
        </article>
      )}
      {done && (
        <ActionBar>
          <AdvanceButton label={t.laboratorio.irAlAgora} />
        </ActionBar>
      )}
    </>
  );
}
