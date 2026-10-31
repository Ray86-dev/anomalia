/** Cómo se ve cada plano de las cinemáticas (D-87): forma, paleta, cámara y movimiento. */
import type { ShotId } from '@shared/game/shots.ts';
import type { ShapeId } from './shapes.ts';

export type Vec3 = readonly [number, number, number];

export type ShotConfig = {
  readonly shape: ShapeId;
  /** Profundo, medio y acento: el tono de cada partícula elige entre ellos. */
  readonly palette: readonly [string, string, string];
  readonly camera: Vec3;
  readonly target: Vec3;
  /** Giro continuo alrededor del eje vertical (rad/s). */
  readonly spin: number;
  /** Vaivén alrededor del eje vertical (rad) para formas que deben verse de frente. */
  readonly sway: number;
  /** Giro sobre el eje de la cámara (rad/s): el túnel del viaje. */
  readonly roll: number;
  /** Respiración de las partículas en reposo (0–1). */
  readonly drift: number;
  /** Fallos de imagen propios del plano (0–1); el Desnivel puede subirlos. */
  readonly instability: number;
};

const still = { spin: 0, sway: 0, roll: 0 } as const;

export const SHOT_CONFIG: Record<ShotId, ShotConfig> = {
  canarias: {
    ...still,
    shape: 'canarias',
    palette: ['#13284a', '#5d9cc0', '#f4f8ff'],
    camera: [0, 1.1, 4.6],
    target: [0, -0.1, 0],
    spin: 0.04,
    drift: 0.6,
    instability: 0,
  },
  ciudad: {
    ...still,
    shape: 'ciudad',
    palette: ['#0d2a3a', '#2fa39a', '#ffe2a8'],
    camera: [1.3, 0.7, 4.2],
    target: [0, -0.2, 0],
    sway: 0.25,
    drift: 0.4,
    instability: 0,
  },
  calor: {
    ...still,
    shape: 'calor',
    palette: ['#3a1206', '#e0662c', '#ffd479'],
    camera: [0, 0.2, 4.4],
    target: [0, 0, 0],
    sway: 0.12,
    drift: 1,
    instability: 0.08,
  },
  parpadeo: {
    ...still,
    shape: 'parpadeo',
    palette: ['#0d2a3a', '#2fa39a', '#ff6a5a'],
    camera: [-1.1, 0.6, 4.2],
    target: [0, -0.2, 0],
    sway: 0.2,
    drift: 0.5,
    instability: 0.85,
  },
  archivo: {
    ...still,
    shape: 'archivo',
    palette: ['#0e1838', '#5a7bd8', '#bff7ee'],
    camera: [0, 0.7, 5.4],
    target: [0, 0.2, 0],
    spin: 0.18,
    drift: 0.5,
    instability: 0,
  },
  hilo: {
    ...still,
    shape: 'hilo',
    palette: ['#14112e', '#7f6ad8', '#ffd479'],
    camera: [0, 0.3, 5.6],
    target: [0, 0.15, 0],
    spin: 0.35,
    drift: 0.6,
    instability: 0.3,
  },
  'datos-razones': {
    ...still,
    shape: 'balanza',
    palette: ['#0b1a2a', '#7fe0d0', '#ffd479'],
    camera: [0, 0.2, 4.4],
    target: [0, 0, 0],
    sway: 0.3,
    drift: 0.4,
    instability: 0,
  },
  cronistas: {
    ...still,
    shape: 'cronistas',
    palette: ['#0b1a2a', '#2fa39a', '#ffffff'],
    camera: [0, 0.5, 4.9],
    target: [0, 0.3, 0],
    spin: 0.12,
    drift: 0.6,
    instability: 0,
  },
  portal: {
    ...still,
    shape: 'portal',
    palette: ['#14112e', '#5a7bd8', '#bff7ee'],
    camera: [0, 0.3, 4.2],
    target: [0, 0.3, -3],
    roll: 0.45,
    drift: 0.3,
    instability: 0.1,
  },
  ari: {
    ...still,
    shape: 'ari',
    palette: ['#0d1b2e', '#3d6f8f', '#ffe2a8'],
    camera: [0, 0.35, 5.2],
    target: [0, 0.15, 0],
    sway: 0.15,
    drift: 0.5,
    instability: 0,
  },

  // ── Epílogo (D-89) ──
  recap: {
    ...still,
    shape: 'hilo-cerrado',
    palette: ['#0e1838', '#7fe0d0', '#ffd479'],
    camera: [0, 0.3, 5.6],
    target: [0, 0.15, 0],
    spin: 0.25,
    drift: 0.4,
    instability: 0,
  },
  'final-tecnocracia': {
    ...still,
    shape: 'tecnocracia',
    palette: ['#0a1020', '#5f7da8', '#f0f6ff'],
    camera: [1.3, 1, 4.4],
    target: [0, -0.15, 0],
    sway: 0.2,
    drift: 0.2,
    instability: 0.15,
  },
  'final-cuidado': {
    ...still,
    shape: 'cuidado',
    palette: ['#0f2418', '#5fbf7a', '#ffe2a8'],
    camera: [-1.1, 0.7, 4.3],
    target: [0, -0.3, 0],
    sway: 0.25,
    drift: 0.6,
    instability: 0,
  },
  'final-fractura': {
    ...still,
    shape: 'fractura',
    palette: ['#1a0c18', '#a04a6a', '#ff8f7a'],
    camera: [0, 0.7, 5.6],
    target: [0, -0.2, 0],
    spin: 0.05,
    drift: 0.7,
    instability: 0.45,
  },
  'final-estancamiento': {
    ...still,
    shape: 'estancamiento',
    palette: ['#2a1c0c', '#b08a4e', '#f2d49a'],
    camera: [0, 0.5, 4.4],
    target: [0, -0.4, 0],
    sway: 0.1,
    drift: 0.15,
    instability: 0,
  },
  'final-equilibrio': {
    ...still,
    shape: 'equilibrio',
    palette: ['#0d1b2e', '#2fa39a', '#ffd479'],
    camera: [0, 0.5, 4.5],
    target: [0, -0.05, 0],
    sway: 0.2,
    drift: 0.5,
    instability: 0.05,
  },
};
