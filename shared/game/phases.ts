/**
 * Fases de una partida. Las de dilema siguen el bucle del §6; las globales
 * cubren lo que pasa antes, entre capítulos y después.
 * Deben coincidir con el CHECK de `runs.phase` en la migración core.
 */

export const GLOBAL_PHASES = [
  'prologue',
  'waiting', // fin del capítulo I, a la espera de que el docente desbloquee el II
  'epilogue',
  'reflection',
  'dossier',
  'done',
] as const;

export const DILEMMA_PHASES = [
  'travel', // 1. Viaje
  'scene', // 2. Escena
  'lab', // 2b. Laboratorio: comprobar antes de decidir (M6)
  'council', // 3. Consejo
  'decision', // 4. Decisión
  'twist', // 4b. Giro: llega información nueva; se mantiene o se cambia la decisión (M6)
  'justification', // 5. Justificación
  'objection', // 6. Objeción socrática
  'ripples', // 7. Ondas temporales
  'archive', // 8. Archivo real
] as const;

export type GlobalPhase = (typeof GLOBAL_PHASES)[number];
export type DilemmaPhase = (typeof DILEMMA_PHASES)[number];
export type Phase = GlobalPhase | DilemmaPhase;

export const PHASES: readonly Phase[] = [...GLOBAL_PHASES, ...DILEMMA_PHASES];

export function isPhase(value: string): value is Phase {
  return (PHASES as readonly string[]).includes(value);
}
