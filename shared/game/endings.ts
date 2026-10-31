import { desnivel, type WorldState, type WorldVar } from './world.ts';

/** Variables que puede consultar una condición de final. */
export type EndingVar = WorldVar | 'desnivel';
export type ComparisonOp = '<' | '<=' | '>' | '>=';

export type Comparison = {
  readonly var: EndingVar;
  readonly op: ComparisonOp;
  readonly valor: number;
};

/** `null` = final por defecto («resto de casos»). */
export type EndingCondition = { readonly todas: readonly Comparison[] } | null;

export type EndingRule = {
  readonly id: string;
  readonly condicion: EndingCondition;
};

function read(state: WorldState, variable: EndingVar): number {
  return variable === 'desnivel' ? desnivel(state) : state[variable];
}

function holds(state: WorldState, { var: variable, op, valor }: Comparison): boolean {
  const value = read(state, variable);
  switch (op) {
    case '<':
      return value < valor;
    case '<=':
      return value <= valor;
    case '>':
      return value > valor;
    case '>=':
      return value >= valor;
  }
}

/**
 * Devuelve el primer final cuya condición se cumple, en el orden de la lista
 * (orden de la tabla §5.6; ver decisión D-09). Un final con `condicion: null`
 * se cumple siempre y actúa como caso por defecto.
 */
export function computeEnding<T extends EndingRule>(state: WorldState, endings: readonly T[]): T {
  const match = endings.find(
    ({ condicion }) => condicion === null || condicion.todas.every((c) => holds(state, c)),
  );
  if (match === undefined) {
    throw new Error('No ending matched: the list needs a default ending (condicion: null).');
  }
  return match;
}

/** Una condición de un final, con el valor que tenía el mundo. */
export type EndingReason = Comparison & { readonly actual: number };

/**
 * Por qué se llegó a un final (D-89): las comparaciones de su condición con el valor real de
 * cada variable. El final por defecto no tiene ninguna: se llega a él cuando no se cumple
 * ninguno de los anteriores.
 */
export function explainEnding(ending: EndingRule, state: WorldState): EndingReason[] {
  if (ending.condicion === null) return [];
  return ending.condicion.todas.map((c) => ({ ...c, actual: read(state, c.var) }));
}
