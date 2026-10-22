import { describe, expect, it } from 'vitest';
import { sentences } from './speech.ts';

describe('sentences', () => {
  it('parte el texto en frases sin perder las preguntas ni las comillas', () => {
    expect(sentences('Roma, 1633. ¿Qué cuenta como conocimiento? Dijo: «basta». Fin…')).toEqual([
      'Roma, 1633.',
      '¿Qué cuenta como conocimiento?',
      'Dijo: «basta».',
      'Fin…',
    ]);
  });

  it('ignora los trozos sin letras ni cifras', () => {
    expect(sentences('Hola. … ¡ ')).toEqual(['Hola.']);
    expect(sentences('')).toEqual([]);
  });
});
