/**
 * Constantes de la jugabilidad (M6) que comparten el contenido, la lógica y el servidor.
 * Viven aparte para que los esquemas de contenido no dependan de la lógica de logros.
 */

/** Cómo responde el alumno a la objeción (réplica guiada). */
export const REPLY_STANCES = ['concede', 'matiza', 'rebate'] as const;
export type ReplyStance = (typeof REPLY_STANCES)[number];

/** Minijuego de laboratorio de cada dilema: comprobar (datos) antes de decidir (razones). */
export const LAB_TYPES = [
  'telescopio',
  'amoniaco',
  'microscopio',
  'crispr',
  'probabilidad',
] as const;
export type LabType = (typeof LAB_TYPES)[number];

/** Hitos del juego: se calculan con reglas fijas a partir del progreso (shared/game/achievements.ts). */
export const MILESTONE_IDS = [
  'laboratorio',
  'mantiene',
  'cambia',
  'tres-posturas',
  'estrellas-a',
  'estrellas-b',
  'constelacion',
  'anomalias',
  'expediente',
] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];
