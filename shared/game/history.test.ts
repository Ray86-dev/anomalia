import { describe, expect, it } from 'vitest';
import { sameWorld, worldHistory, type HistoryDilemma } from './history.ts';
import { INITIAL_WORLD } from './world.ts';

const dilemmas: HistoryDilemma[] = [
  {
    id: 'd1',
    opciones: [
      { id: 'A', deltas: { poder: 30 } },
      { id: 'B', deltas: { responsabilidad: 10 } },
    ],
  },
  { id: 'd2', opciones: [{ id: 'A', deltas: { poder: 30, confianza: -10 } }] },
  { id: 'd3', opciones: [{ id: 'A', deltas: { poder: -20 } }] },
];

describe('worldHistory', () => {
  it('encadena las decisiones en el orden de la clase', () => {
    const steps = worldHistory(['d1', 'd2'], { d1: 'B', d2: 'A' }, dilemmas);
    expect(steps.map((s) => s.dilemmaId)).toEqual(['d1', 'd2']);
    expect(steps[0]?.before).toEqual(INITIAL_WORLD);
    expect(steps[0]?.after).toEqual({ ...INITIAL_WORLD, responsabilidad: 60 });
    expect(steps[1]?.before).toEqual(steps[0]?.after);
    expect(steps[1]?.after).toEqual({
      poder: 80,
      responsabilidad: 60,
      equidad: 50,
      confianza: 40,
    });
  });

  it('refleja el recorte real a 100, no el delta nominal', () => {
    const steps = worldHistory(['d1', 'd2', 'd3'], { d1: 'A', d2: 'A', d3: 'A' }, dilemmas);
    // 50 + 30 + 30 = 110 → 100; después −20 → 80 (no 90).
    expect(steps[1]?.after.poder).toBe(100);
    expect(steps[2]?.before.poder).toBe(100);
    expect(steps[2]?.after.poder).toBe(80);
  });

  it('salta los dilemas sin decisión y las opciones desconocidas', () => {
    expect(worldHistory(['d1', 'd2', 'd9'], { d2: 'A', d9: 'A' }, dilemmas)).toHaveLength(1);
    expect(worldHistory(['d1'], { d1: 'C' }, dilemmas)).toEqual([]);
  });
});

describe('sameWorld', () => {
  it('compara las cuatro variables', () => {
    expect(sameWorld(INITIAL_WORLD, { ...INITIAL_WORLD })).toBe(true);
    expect(sameWorld(INITIAL_WORLD, { ...INITIAL_WORLD, equidad: 51 })).toBe(false);
  });
});
