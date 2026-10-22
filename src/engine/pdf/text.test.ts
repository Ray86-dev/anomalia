import { describe, expect, it } from 'vitest';
import { wrapParagraph, wrapText } from './text.ts';

/** Fuente monoespaciada imaginaria: cada carácter mide 1. */
const measure = (text: string) => Array.from(text).length;

describe('wrapParagraph', () => {
  it('reparte las palabras sin pasarse del ancho', () => {
    expect(wrapParagraph('La ciencia explica pero no decide', 12, measure)).toEqual([
      'La ciencia',
      'explica pero',
      'no decide',
    ]);
  });

  it('corta por letras solo la palabra que no cabe sola', () => {
    expect(wrapParagraph('Un supercalifragilístico día', 8, measure)).toEqual([
      'Un',
      'supercal',
      'ifragilí',
      'stico',
      'día',
    ]);
  });

  it('cuenta tildes, eñes y emojis como un carácter', () => {
    expect(wrapParagraph('Niño 🙂 año', 6, measure)).toEqual(['Niño 🙂', 'año']);
  });
});

describe('wrapText', () => {
  it('separa párrafos y descarta los vacíos', () => {
    expect(wrapText('Primero.\n\n\nSegundo párrafo.\n', 10, measure)).toEqual([
      ['Primero.'],
      ['Segundo', 'párrafo.'],
    ]);
  });

  it('un texto vacío no produce líneas', () => {
    expect(wrapText('   ', 10, measure)).toEqual([]);
  });
});
