import { describe, expect, it } from 'vitest';
import { tensionFor } from './audio.ts';

describe('tensionFor', () => {
  it('no hay disonancia con un mundo estable y crece hasta el máximo con el Desnivel', () => {
    expect(tensionFor(-20)).toBe(0);
    expect(tensionFor(5)).toBe(0);
    expect(tensionFor(22.5)).toBeCloseTo(0.5);
    expect(tensionFor(40)).toBe(1);
    expect(tensionFor(90)).toBe(1);
  });
});
