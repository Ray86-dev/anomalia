/**
 * Planos de las cinemáticas (D-87): cada panel de la intro o de un final elige uno y el motor
 * de partículas (`src/engine/cinematic/`) sabe dibujarlo. La lista vive aquí porque la valida
 * el esquema del contenido.
 */
export const SHOTS = [
  'canarias',
  'ciudad',
  'calor',
  'parpadeo',
  'archivo',
  'hilo',
  'datos-razones',
  'cronistas',
  'portal',
  'ari',
  // Epílogo (D-89): el hilo con las anomalías cerradas y un 2077 por final.
  'recap',
  'final-tecnocracia',
  'final-cuidado',
  'final-fractura',
  'final-estancamiento',
  'final-equilibrio',
] as const;

export type ShotId = (typeof SHOTS)[number];

/** Quién habla en un panel: el narrador (rótulo), Mnemósine o Ari. */
export const VOICES = ['narrador', 'mnemosine', 'ari'] as const;
export type Voice = (typeof VOICES)[number];
