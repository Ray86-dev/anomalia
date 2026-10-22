import { describe, expect, it } from 'vitest';
import {
  AMMONIA_GOAL,
  ammoniaProduction,
  ammoniaYield,
  blurFor,
  classify,
  DAYS,
  dishPoints,
  focusTarget,
  GUIDE_LENGTH,
  isFocused,
  makeGenome,
  makePeople,
  matchesAt,
  moonPhases,
  moonPositions,
  NIGHTS,
  normalCells,
  PRESSURE,
  REACTOR_START,
  reactionSpeed,
  sampleCells,
  seeded,
  sides,
  TEMPERATURE,
} from './models.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

describe('telescopio', () => {
  it('el enfoque inicial está borroso y existe un punto nítido', () => {
    for (const seed of SEEDS) {
      const target = focusTarget(seeded(seed));
      expect(isFocused(0, target)).toBe(false);
      expect(blurFor(0, target)).toBeGreaterThan(0);
      expect(isFocused(target, target)).toBe(true);
      expect(blurFor(target, target)).toBe(0);
    }
  });

  it('en cuatro noches las lunas cambian de lado y nunca tapan a Júpiter', () => {
    for (const seed of SEEDS) {
      const phases = moonPhases(seeded(seed));
      const nights = Array.from({ length: NIGHTS }, (_, n) => moonPositions(n, phases));
      for (const night of nights) {
        expect(night.every((x) => Math.abs(x) >= 0.12 && Math.abs(x) <= 1)).toBe(true);
        expect(sides(night).left + sides(night).right).toBe(4);
      }
      // La luna más rápida cambia de lado al menos una vez: se ve que gira.
      const fastest = nights.map((night) => Math.sign(night[0] ?? 0));
      expect(new Set(fastest).size).toBe(2);
    }
  });
});

describe('amoníaco', () => {
  it('más presión da más amoníaco; más temperatura, menos amoníaco pero más velocidad', () => {
    const base = { pressure: 150, temperature: 450, catalyst: true };
    expect(ammoniaYield({ ...base, pressure: 300 })).toBeGreaterThan(ammoniaYield(base));
    expect(ammoniaYield({ ...base, temperature: 600 })).toBeLessThan(ammoniaYield(base));
    expect(reactionSpeed({ ...base, temperature: 600 })).toBeGreaterThan(reactionSpeed(base));
    expect(reactionSpeed(base)).toBeGreaterThan(reactionSpeed({ ...base, catalyst: false }));
  });

  it('se empieza lejos de la meta y la meta siempre se puede alcanzar', () => {
    expect(ammoniaProduction(REACTOR_START)).toBeLessThan(AMMONIA_GOAL);
    let reachable = 0;
    for (let p: number = PRESSURE.min; p <= PRESSURE.max; p += PRESSURE.step) {
      for (let t: number = TEMPERATURE.min; t <= TEMPERATURE.max; t += TEMPERATURE.step) {
        if (ammoniaProduction({ pressure: p, temperature: t, catalyst: true }) >= AMMONIA_GOAL) {
          reachable += 1;
        }
      }
    }
    expect(reachable).toBeGreaterThan(5);
  });
});

describe('microscopio', () => {
  it('las células normales mueren en pocos días y las de la muestra se multiplican', () => {
    expect(normalCells(0)).toBe(8);
    expect(normalCells(DAYS)).toBe(0);
    expect(sampleCells(DAYS)).toBeGreaterThan(sampleCells(0) * 10);
  });

  it('los puntos del cultivo caen dentro de la placa', () => {
    const points = dishPoints(200, seeded(7));
    expect(points.every(([x, y]) => x * x + y * y <= 1)).toBe(true);
  });
});

describe('CRISPR', () => {
  it('la guía coincide entera en un solo sitio y hay un trozo casi igual en otro', () => {
    for (const seed of SEEDS) {
      const genome = makeGenome(seeded(seed));
      const { sequence, guide, target, offTarget } = genome;
      expect(guide).toHaveLength(GUIDE_LENGTH);
      expect(matchesAt(sequence, guide, target)).toBe(GUIDE_LENGTH);
      expect(matchesAt(sequence, guide, offTarget)).toBe(GUIDE_LENGTH - 1);
      expect(Math.abs(offTarget - target)).toBeGreaterThanOrEqual(GUIDE_LENGTH);
      const exact = Array.from({ length: sequence.length - GUIDE_LENGTH + 1 }, (_, k) => k).filter(
        (k) => matchesAt(sequence, guide, k) === GUIDE_LENGTH,
      );
      expect(exact).toHaveLength(1);
    }
  });
});

describe('probabilidad', () => {
  it('con cualquier umbral intermedio, el índice deja fuera a alguien que lo habría conseguido', () => {
    for (const seed of SEEDS) {
      const people = makePeople(seeded(seed));
      expect(people).toHaveLength(20);
      for (const threshold of [35, 50, 65]) {
        const result = classify(people, threshold);
        expect(result.rejectedSuccess + result.admittedFail).toBeGreaterThan(0);
        expect(
          result.admittedSuccess +
            result.admittedFail +
            result.rejectedSuccess +
            result.rejectedFail,
        ).toBe(20);
      }
      expect(classify(people, 35).rejectedSuccess).toBeGreaterThan(0);
    }
  });
});
