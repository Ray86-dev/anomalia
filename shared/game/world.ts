/** Estado del mundo (§4.3): cuatro variables 0–100 que empiezan en 50. */

export const WORLD_VARS = ['poder', 'responsabilidad', 'equidad', 'confianza'] as const;
export type WorldVar = (typeof WORLD_VARS)[number];

export type WorldState = Readonly<Record<WorldVar, number>>;
export type Deltas = Readonly<Partial<Record<WorldVar, number>>>;

export const WORLD_MIN = 0;
export const WORLD_MAX = 100;

export const INITIAL_WORLD: WorldState = {
  poder: 50,
  responsabilidad: 50,
  equidad: 50,
  confianza: 50,
};

function clamp(value: number): number {
  return Math.min(WORLD_MAX, Math.max(WORLD_MIN, value));
}

/** Aplica los deltas de una decisión, recortando cada variable al rango 0–100. */
export function applyDeltas(state: WorldState, deltas: Deltas): WorldState {
  return {
    poder: clamp(state.poder + (deltas.poder ?? 0)),
    responsabilidad: clamp(state.responsabilidad + (deltas.responsabilidad ?? 0)),
    equidad: clamp(state.equidad + (deltas.equidad ?? 0)),
    confianza: clamp(state.confianza + (deltas.confianza ?? 0)),
  };
}

/** Desnivel prometeico = PODER − RESPONSABILIDAD (puede ser negativo). */
export function desnivel(state: WorldState): number {
  return state.poder - state.responsabilidad;
}
