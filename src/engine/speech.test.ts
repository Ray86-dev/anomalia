import { describe, expect, it } from 'vitest';
import { chooseVoice, sentences } from './speech.ts';

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

describe('chooseVoice (español de Canarias, D-91)', () => {
  const v = (lang: string, localService = true) => ({ lang, localService });

  it('prefiere una voz que sesea a la de España', () => {
    expect(chooseVoice([v('es-ES'), v('en-GB'), v('es-US')])?.lang).toBe('es-US');
    expect(chooseVoice([v('es-ES'), v('es-MX')])?.lang).toBe('es-MX');
  });

  it('entiende el guion bajo de algunos Android', () => {
    expect(chooseVoice([v('es_ES'), v('es_US')])?.lang).toBe('es_US');
  });

  it('dentro del mismo idioma, mejor la voz del propio móvil', () => {
    const remote = v('es-US', false);
    const local = v('es-US', true);
    expect(chooseVoice([remote, local])).toBe(local);
  });

  it('sin voces que sesean usa la de España; sin español, ninguna', () => {
    expect(chooseVoice([v('fr-FR'), v('es-ES')])?.lang).toBe('es-ES');
    expect(chooseVoice([v('es-AR')])?.lang).toBe('es-AR');
    expect(chooseVoice([v('en-US'), v('fr-FR')])).toBeNull();
  });
});
