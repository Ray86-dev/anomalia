import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateContent, type InkResult, type RawContent } from './validate.ts';

const contentDir = fileURLToPath(new URL('../../content/', import.meta.url));
const json = (file: string): unknown => JSON.parse(readFileSync(join(contentDir, file), 'utf8'));

/** Contenido real del repo como punto de partida; cada test lo altera. */
function realContent(): RawContent {
  return {
    dilemmas: readdirSync(join(contentDir, 'dilemas'))
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => ({ file: `dilemas/${file}`, data: json(`dilemas/${file}`) })),
    counselors: json('consejeros.json'),
    concepts: json('conceptos.json'),
    endings: json('finales.json'),
    rubric: json('rubrica.json'),
    modes: json('modos.json'),
    blocked: json('alias-bloqueados.json'),
    fallbacks: json('respaldos.json'),
    ui: json('interfaz.json'),
    ambients: json('ambientes.json'),
    alerts: json('alertas.json'),
    reflection: json('reflexion.json'),
    rewards: json('logros.json'),
    fichas: json('fichas.json'),
    emblems: json('emblemas.json'),
  };
}

const VALID_PROLOGUE = '=== prologo ===\nAño 2077.\n-> END';
const inkFiles: Record<string, string> = {
  'prologo.ink': VALID_PROLOGUE,
  'dilemas/d1-galileo.ink': '=== escena ===\nRoma.\n-> END',
};
/** Escenas de prueba para el prólogo y D1; el resto, las reales del repo. */
const readText = (path: string) => {
  const file = join(contentDir, path);
  return inkFiles[path] ?? (existsSync(file) ? readFileSync(file, 'utf8') : null);
};

/** Compilador falso: «falla» si la fuente contiene ROTO (el real se prueba al generar el contenido). */
const compileInk = (source: string): InkResult =>
  source.includes('ROTO')
    ? { json: null, errors: ['error de sintaxis'], warnings: [] }
    : { json: '{"inkVersion":21}', errors: [], warnings: [] };

const validate = (raw: RawContent, strict = false) =>
  validateContent(raw, { strict, readText, compileInk, assetExists: () => true });

type Mutable = Record<string, unknown> & { opciones: Record<string, unknown>[] };
const d1 = (raw: RawContent) => raw.dilemmas[0]?.data as Mutable;

describe('validateContent', () => {
  it('acepta el contenido actual del repositorio', () => {
    const result = validate(realContent());
    expect(result.errors).toEqual([]);
    expect(result.content?.dilemmas.map((d) => d.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
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
    expect(validate({ ...raw, endings: reordered }).errors.join('\n')).toMatch(
      /caso por defecto|condicion: null/,
    );
  });

  it('rechaza un archivo Ink inexistente', () => {
    const raw = realContent();
    d1(raw).escena = { ink: 'dilemas/no-existe.ink' };
    expect(validate(raw).errors.join('\n')).toMatch(/no existe content\/dilemas\/no-existe\.ink/);
  });

  it('compila el prólogo y las escenas, e informa de los errores de Ink', () => {
    expect(Object.keys(validate(realContent()).inks).sort()).toEqual([
      'd1',
      'd1-facil',
      'd2',
      'd2-facil',
      'd3',
      'd3-facil',
      'd4',
      'd4-facil',
      'd5',
      'd5-facil',
      'prologo',
      'prologo-facil',
    ]);
    inkFiles['prologo.ink'] = 'ROTO';
    try {
      expect(validate(realContent()).errors.join('\n')).toMatch(/prologo\.ink: error de sintaxis/);
    } finally {
      inkFiles['prologo.ink'] = VALID_PROLOGUE;
    }
  });

  it('rechaza términos bloqueados que al normalizarse quedarían demasiado cortos', () => {
    const raw = { ...realContent(), blocked: { contiene: ['xxx'], exactas: [] } };
    expect(validate(raw).errors.join('\n')).toMatch(/demasiado corto/);
  });

  it('en modo estricto, los TODO y la falta de lectura fácil son errores', () => {
    const raw = realContent();
    d1(raw).titulo = { normal: 'Galileo ante la Inquisición' };
    const strict = validate(raw, true);
    expect(strict.content).toBeNull();
    expect(strict.errors.join('\n')).toMatch(/marca TODO/);
    expect(strict.errors.join('\n')).toMatch(/lectura fácil/);
  });
});
