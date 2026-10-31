import { describe, expect, it } from 'vitest';
import { buildShape, seeded, SHAPE_IDS } from './shapes.ts';

const COUNT = 3000;

describe('formas de las cinemáticas', () => {
  it.each(SHAPE_IDS)('«%s» coloca todas las partículas dentro del encuadre', (id) => {
    const { positions, tones, sizes } = buildShape(id, COUNT);
    expect(positions).toHaveLength(COUNT * 3);
    expect(tones).toHaveLength(COUNT);
    expect(sizes).toHaveLength(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const [x, y, z] = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
      expect(Math.abs(x ?? 0)).toBeLessThanOrEqual(2);
      expect(y).toBeGreaterThanOrEqual(-1.2);
      expect(y).toBeLessThanOrEqual(1.6);
      expect(z).toBeGreaterThanOrEqual(-7);
      expect(z).toBeLessThanOrEqual(1.5);
      expect(tones[i]).toBeGreaterThanOrEqual(0);
      expect(tones[i]).toBeLessThanOrEqual(1);
      expect(sizes[i]).toBeGreaterThan(0);
    }
  });

  it('es determinista: la misma forma en todos los móviles', () => {
    expect(buildShape('ari', 500).positions).toEqual(buildShape('ari', 500).positions);
    expect(seeded(1)()).toBe(seeded(1)());
  });

  it('mezcla el orden: la primera mitad (móviles lentos) cubre toda la forma', () => {
    const { positions } = buildShape('hilo', COUNT);
    const half = COUNT / 2;
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = 0; i < half; i++) {
      const y = positions[i * 3 + 1] ?? 0;
      top = Math.max(top, y);
      bottom = Math.min(bottom, y);
    }
    expect(top).toBeGreaterThan(1);
    expect(bottom).toBeLessThan(-0.8);
  });

  it('el parpadeo es la ciudad con solo una parte de las partículas movidas', () => {
    const city = buildShape('ciudad', COUNT).positions;
    const flicker = buildShape('parpadeo', COUNT).positions;
    let moved = 0;
    for (let i = 0; i < COUNT * 3; i++) if (city[i] !== flicker[i]) moved++;
    expect(moved / (COUNT * 3)).toBeGreaterThan(0.05);
    expect(moved / (COUNT * 3)).toBeLessThan(0.4);
  });
});
