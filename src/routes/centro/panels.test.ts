import { describe, expect, it } from 'vitest';
import { wrapWords } from './panels.tsx';

describe('wrapWords', () => {
  it('parte en líneas sin cortar palabras', () => {
    expect(wrapWords('Abjurar y seguir investigando', 16)).toEqual([
      'Abjurar y seguir',
      'investigando',
    ]);
    expect(wrapWords('Mantenerse firme', 16)).toEqual(['Mantenerse firme']);
  });

  it('deja sola una palabra más larga que el máximo', () => {
    expect(wrapWords('Superconductividad aplicada', 10)).toEqual([
      'Superconductividad',
      'aplicada',
    ]);
  });
});
