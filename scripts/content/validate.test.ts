import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateContent, type RawContent } from './validate.ts';

const contentDir = fileURLToPath(new URL('../../content/', import.meta.url));
const json = (file: string): unknown => JSON.parse(readFileSync(join(contentDir, file), 'utf8'));

/** Contenido real del repo como punto de partida; cada test lo altera. */
function realContent(): RawContent {
  return {
    dilemmas: [{ file: 'dilemas/d1-galileo.json', data: json('dilemas/d1-galileo.json') }],
    counselors: json('consejeros.json'),
    concepts: json('conceptos.json'),
    endings: json('finales.json'),
    rubric: json('rubrica.json'),
    modes: json('modos.json'),
    blocked: json('alias-bloqueados.json'),
    fallbacks: json('respaldos.json'),
    ui: json('interfaz.json'),
  };
}

const readText = (path: string) => (path === 'dilemas/d1-galileo.ink' ? 'Roma.\n-> END' : null);
const validate = (raw: RawContent, strict = false) => validateContent(raw, { strict, readText });

type Mutable = Record<string, unknown> & { opciones: Record<string, unknown>[] };
const d1 = (raw: RawContent) => raw.dilemmas[0]?.data as Mutable;

describe('validateContent', () => {
  it('acepta el contenido actual del repositorio', () => {
    const result = validate(realContent());
    expect(result.errors).toEqual([]);
    expect(result.content?.dilemmas.map((d) => d.id)).toEqual(['d1']);
  });

  it('detecta un objetor que no es consejero del dilema', () => {
    const raw = realContent();
    const option = d1(raw).opciones[0];
    if (option) option.objetor = 'calvo';
    expect(validate(raw).errors.join('\n')).toMatch(/«calvo» no es uno de los consejeros/);
  });

  it('detecta un respaldo que falta para el objetor de una opción', () => {
    const raw = { ...realContent(), fallbacks: { d1: { A: {}, B: {}, C: {} } } };
    expect(validate(raw).errors.join('\n')).toMatch(/respaldos\.json › d1\.A\.kaltz/);
  });

  it('detecta deltas fuera de las cuatro variables', () => {
    const raw = realContent();
    const option = d1(raw).opciones[0];
    if (option) option.deltas = { felicidad: 5 };
    expect(validate(raw).errors.length).toBeGreaterThan(0);
  });

  it('exige que solo el último final sea el caso por defecto', () => {
    const raw = realContent();
    const endings = raw.endings as Record<string, unknown>[];
    const reordered = [...endings.slice(-1), ...endings.slice(0, -1)];
    expect(validate({ ...raw, endings: reordered }).errors.join('\n')).toMatch(/caso por defecto|condicion: null/);
  });

  it('rechaza un archivo Ink inexistente', () => {
    const raw = realContent();
    d1(raw).escena = { ink: 'dilemas/no-existe.ink' };
    expect(validate(raw).errors.join('\n')).toMatch(/no existe content\/dilemas\/no-existe\.ink/);
  });

  it('rechaza términos bloqueados que al normalizarse quedarían demasiado cortos', () => {
    const raw = { ...realContent(), blocked: { contiene: ['xxx'], exactas: [] } };
    expect(validate(raw).errors.join('\n')).toMatch(/demasiado corto/);
  });

  it('en modo estricto, los TODO y la falta de lectura fácil son errores', () => {
    const strict = validate(realContent(), true);
    expect(strict.content).toBeNull();
    expect(strict.errors.join('\n')).toMatch(/marca TODO/);
    expect(strict.errors.join('\n')).toMatch(/lectura fácil/);
  });
});
