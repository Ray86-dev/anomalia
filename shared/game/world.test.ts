import { describe, expect, it } from 'vitest';
import { applyDeltas, desnivel, INITIAL_WORLD, type WorldState } from './world.ts';

describe('applyDeltas', () => {
  it('suma los deltas y deja igual lo que no aparece', () => {
    // D1 · opción A del diseño: CONFIANZA −5, RESPONSABILIDAD +5
    expect(applyDeltas(INITIAL_WORLD, { confianza: -5, responsabilidad: 5 })).toEqual({
      poder: 50,
      responsabilidad: 55,
      equidad: 50,
      confianza: 45,
    });
  });

  it('recorta al rango 0–100', () => {
    const high: WorldState = { poder: 95, responsabilidad: 3, equidad: 100, confianza: 0 };
    expect(
      applyDeltas(high, { poder: 15, responsabilidad: -15, equidad: 10, confianza: -10 }),
    ).toEqual({ poder: 100, responsabilidad: 0, equidad: 100, confianza: 0 });
  });

  it('no muta el estado de entrada', () => {
    const before = { ...INITIAL_WORLD };
    applyDeltas(INITIAL_WORLD, { poder: 10 });
    expect(INITIAL_WORLD).toEqual(before);
  });

  it('encadena decisiones: recortar en cada paso no equivale a sumar y recortar al final', () => {
    const start: WorldState = { ...INITIAL_WORLD, poder: 90 };
    const after = applyDeltas(applyDeltas(start, { poder: 15 }), { poder: -10 });
    expect(after.poder).toBe(90); // 90 → 100 (recortado) → 90; no 95
  });
});

describe('desnivel', () => {
  it('es PODER − RESPONSABILIDAD y puede ser negativo', () => {
    expect(desnivel({ ...INITIAL_WORLD, poder: 80, responsabilidad: 40 })).toBe(40);
    expect(desnivel({ ...INITIAL_WORLD, poder: 30, responsabilidad: 70 })).toBe(-40);
    expect(desnivel(INITIAL_WORLD)).toBe(0);
  });
});
