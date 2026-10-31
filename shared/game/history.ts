/**
 * Historia del mundo de una partida (D-86): reproduce las decisiones confirmadas en el orden en
 * que se juegan para saber cómo estaba el 2077 antes y después de cada una. Así las Ondas
 * temporales y el epílogo muestran los cambios reales, con el recorte a 0–100 incluido.
 */
import { applyDeltas, INITIAL_WORLD, type Deltas, type WorldState } from './world.ts';

export type HistoryDilemma = {
  readonly id: string;
  readonly opciones: readonly { readonly id: string; readonly deltas: Deltas }[];
};

export type HistoryStep = {
  readonly dilemmaId: string;
  readonly choice: string;
  readonly before: WorldState;
  readonly after: WorldState;
};

/**
 * @param order Dilemas de la clase en el orden en que se juegan (`progress.classDilemmas`).
 * @param choices Decisión confirmada de cada dilema jugado (`progress.choices`).
 */
export function worldHistory(
  order: readonly string[],
  choices: Readonly<Record<string, string>>,
  dilemmas: readonly HistoryDilemma[],
): HistoryStep[] {
  const steps: HistoryStep[] = [];
  let world = INITIAL_WORLD;
  for (const dilemmaId of order) {
    const choice = choices[dilemmaId];
    const option = dilemmas.find((d) => d.id === dilemmaId)?.opciones.find((o) => o.id === choice);
    if (choice === undefined || option === undefined) continue;
    const after = applyDeltas(world, option.deltas);
    steps.push({ dilemmaId, choice, before: world, after });
    world = after;
  }
  return steps;
}

export function sameWorld(a: WorldState, b: WorldState): boolean {
  return (
    a.poder === b.poder &&
    a.responsabilidad === b.responsabilidad &&
    a.equidad === b.equidad &&
    a.confianza === b.confianza
  );
}
