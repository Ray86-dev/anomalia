/** Piezas comunes de los laboratorios (M6). */
import { ui } from '@shared/generated/content.ts';
import { useEffect } from 'react';

export const lab = ui.juego.laboratorio;

export type LabProps = {
  /** El experimento ya ha dado su dato: se puede ir al ágora. */
  readonly done: boolean;
  readonly onDone: () => void;
};

/** Avisa una sola vez cuando el experimento cumple su condición. */
export function useDoneWhen(condition: boolean, { done, onDone }: LabProps): void {
  useEffect(() => {
    if (condition && !done) onDone();
  }, [condition, done, onDone]);
}
