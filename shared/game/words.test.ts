import { describe, expect, it } from 'vitest';
import { checkWords, cleanText, countWords } from './words.ts';

describe('countWords', () => {
  it('cuenta palabras con tildes, ñ y cifras, ignorando signos sueltos', () => {
    expect(countWords('Galileo debería abjurar — porque su vida importa, ¿no?')).toBe(8);
    expect(countWords('En 1633 la ñ ya existía')).toBe(6);
    expect(countWords('   \n\t ')).toBe(0);
    expect(countWords('… ¡! ?')).toBe(0);
  });
});

describe('cleanText', () => {
  it('normaliza, quita caracteres de control y espacios sobrantes', () => {
    expect(cleanText('  Hola\u0000   mundo\n\n\n\nfin  ')).toBe('Hola mundo\n\nfin');
    expect(cleanText('Peña')).toBe('Peña');
  });
});

describe('checkWords', () => {
  const range = [3, 5] as const;
  it('clasifica por rangos sin bloquear', () => {
    expect(checkWords('', range)).toBe('empty');
    expect(checkWords('una dos', range)).toBe('short');
    expect(checkWords('una dos tres', range)).toBe('ok');
    expect(checkWords('una dos tres cuatro cinco seis', range)).toBe('long');
  });
});
