/**
 * Modelos de los laboratorios (M6): lógica pura y con azar inyectable para poder probarla.
 * Son modelos simplificados para comprobar una idea, no simulaciones exactas.
 */

/** Número entre 0 y 1, como `Math.random`. */
export type Random = () => number;

/** Generador con semilla (mulberry32): mismo resultado en cada prueba. */
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickInt = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

// ── D1 · Telescopio: las lunas de Júpiter ──

export const FOCUS_TOLERANCE = 6;
export const NIGHTS = 4;

/** Punto de enfoque nítido, lejos de los extremos y del valor inicial (0). */
export const focusTarget = (random: Random) => pickInt(random, 35, 85);

/** Desenfoque en píxeles: crece con la distancia al punto nítido. */
export const blurFor = (focus: number, target: number) =>
  Math.min(8, Math.max(0, Math.abs(focus - target) - FOCUS_TOLERANCE) / 4);

export const isFocused = (focus: number, target: number) =>
  Math.abs(focus - target) <= FOCUS_TOLERANCE;

/** Cuatro lunas: periodo aproximado en días y distancia relativa a Júpiter. */
const MOONS = [
  { period: 1.77, radius: 0.24 },
  { period: 3.55, radius: 0.38 },
  { period: 7.15, radius: 0.6 },
  { period: 16.7, radius: 0.97 },
] as const;

export const moonPhases = (random: Random) => MOONS.map(() => random() * 2 * Math.PI);

/** Posición horizontal de cada luna (de −1 a 1, Júpiter en 0) en una noche dada. */
export function moonPositions(night: number, phases: readonly number[]): number[] {
  return MOONS.map((moon, i) => {
    const x = moon.radius * Math.sin((phases[i] ?? 0) + (2 * Math.PI * night) / moon.period);
    // Nunca justo delante de Júpiter: así siempre se ve a qué lado está.
    return Math.abs(x) < 0.12 ? Math.sign(x || 1) * 0.12 : x;
  });
}

export const sides = (positions: readonly number[]) => ({
  left: positions.filter((x) => x < 0).length,
  right: positions.filter((x) => x > 0).length,
});

// ── D2 · Amoníaco: del aire al abono ──

export const PRESSURE = { min: 50, max: 300, step: 25 } as const;
export const TEMPERATURE = { min: 200, max: 700, step: 50 } as const;
export const AMMONIA_GOAL = 25;

export type Reactor = {
  readonly pressure: number;
  readonly temperature: number;
  readonly catalyst: boolean;
};

export const REACTOR_START: Reactor = { pressure: 100, temperature: 600, catalyst: false };

/** Amoníaco en la mezcla (%): sube con la presión y baja con la temperatura. */
export function ammoniaYield({ pressure, temperature }: Reactor): number {
  const k = 15 * Math.exp((temperature - TEMPERATURE.min) / 95);
  return Math.round((100 * pressure) / (pressure + k));
}

/** Velocidad (%): sube con la temperatura; el catalizador la acelera mucho. */
export function reactionSpeed({ temperature, catalyst }: Reactor): number {
  const scale = catalyst ? 150 : 600;
  return Math.round(100 * (1 - Math.exp(-(temperature - 150) / scale)));
}

/** Producción: lo que se obtiene de verdad, porque hace falta rendimiento y velocidad. */
export const ammoniaProduction = (reactor: Reactor) =>
  Math.round((ammoniaYield(reactor) * reactionSpeed(reactor)) / 100);

// ── D3 · Microscopio: células que no mueren ──

export const DAYS = 5;

/** Células normales: crecen un poco y mueren en pocos días. */
export const normalCells = (day: number) =>
  Math.max(0, Math.round(8 * 1.3 ** day * Math.max(0, 1 - day / DAYS)));

/** Células de la muestra: se duplican cada día. */
export const sampleCells = (day: number) => 8 * 2 ** day;

/** Puntos dentro de una placa redonda (radio 1) para dibujar un cultivo. */
export function dishPoints(count: number, random: Random): [number, number][] {
  return Array.from({ length: count }, () => {
    const angle = random() * 2 * Math.PI;
    const distance = 0.88 * Math.sqrt(random());
    return [distance * Math.cos(angle), distance * Math.sin(angle)];
  });
}

// ── D4 · CRISPR: buscar, cortar… y los sitios parecidos ──

export const GUIDE_LENGTH = 5;
export const SEQUENCE_LENGTH = 16;
const BASES = ['A', 'C', 'G', 'T'] as const;

export type Genome = {
  readonly sequence: string;
  readonly guide: string;
  /** Donde la guía coincide entera. */
  readonly target: number;
  /** Trozo casi igual (una letra distinta): donde CRISPR también podría cortar. */
  readonly offTarget: number;
};

export function matchesAt(sequence: string, guide: string, position: number): number {
  let count = 0;
  for (let i = 0; i < guide.length; i++) {
    if (sequence.charAt(position + i) === guide.charAt(i)) count += 1;
  }
  return count;
}

export function makeGenome(random: Random): Genome {
  for (;;) {
    const bases = Array.from(
      { length: SEQUENCE_LENGTH },
      () => BASES[pickInt(random, 0, 3)] ?? 'A',
    );
    const last = SEQUENCE_LENGTH - GUIDE_LENGTH;
    const target = pickInt(random, 0, last);
    const guide = bases.slice(target, target + GUIDE_LENGTH);
    // El trozo parecido no se solapa con el de verdad.
    const free = Array.from({ length: last + 1 }, (_, i) => i).filter(
      (i) => i + GUIDE_LENGTH <= target || i >= target + GUIDE_LENGTH,
    );
    const offTarget = free[pickInt(random, 0, free.length - 1)];
    if (offTarget === undefined) continue;
    const changed = pickInt(random, 0, GUIDE_LENGTH - 1);
    guide.forEach((base, i) => {
      bases[offTarget + i] =
        i === changed ? (BASES.filter((b) => b !== base)[pickInt(random, 0, 2)] ?? 'A') : base;
    });
    const sequence = bases.join('');
    const guideText = guide.join('');
    // Una sola coincidencia exacta (la buena) y el trozo parecido con cuatro de cinco letras.
    const exact = Array.from({ length: last + 1 }, (_, i) => i).filter(
      (i) => matchesAt(sequence, guideText, i) === GUIDE_LENGTH,
    );
    if (exact.length === 1 && exact[0] === target) {
      return { sequence, guide: guideText, target, offTarget };
    }
  }
}

// ── D5 · Probabilidad: ¿predice el índice? (Índice Ω, inventado) ──

export const PEOPLE = 20;
export const THRESHOLD = { min: 0, max: 100, step: 5 } as const;
export const THRESHOLDS_TO_TRY = 3;

export type Person = { readonly index: number; readonly success: boolean };

/**
 * Personas ficticias: con más índice es algo más probable conseguirlo, pero nunca seguro.
 * Siempre hay alguien con índice bajo que lo consigue y alguien con índice alto que no.
 */
export function makePeople(random: Random): Person[] {
  const people = Array.from({ length: PEOPLE - 2 }, () => {
    const index = pickInt(random, 5, 95);
    return { index, success: random() < 0.25 + (0.5 * index) / 100 };
  });
  people.push({ index: pickInt(random, 10, 30), success: true });
  people.push({ index: pickInt(random, 75, 92), success: false });
  return people.sort((a, b) => a.index - b.index);
}

export function classify(people: readonly Person[], threshold: number) {
  const admitted = people.filter((p) => p.index >= threshold);
  const rejected = people.filter((p) => p.index < threshold);
  return {
    admittedSuccess: admitted.filter((p) => p.success).length,
    admittedFail: admitted.filter((p) => !p.success).length,
    rejectedSuccess: rejected.filter((p) => p.success).length,
    rejectedFail: rejected.filter((p) => !p.success).length,
  };
}
