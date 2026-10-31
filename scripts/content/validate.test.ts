import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  validateContent,
  vosotrosForms,
  withoutReviewMarks,
  type InkResult,
  type RawContent,
} from './validate.ts';

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
    world: json('mundo.json'),
    intro: json('intro.json'),
  };
}

const VALID_SCENE = '=== escena ===\nRoma.\n-> END';
const inkFiles: Record<string, string> = {
  'dilemas/d1-galileo.ink': VALID_SCENE,
};
/** Escena de prueba para D1; el resto, las reales del repo. */
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

describe('withoutReviewMarks', () => {
  it('quita las marcas de revisión sin dejar huecos ni paréntesis vacíos', () => {
    expect(withoutReviewMarks('Siguió trabajando. TODO(verificar)')).toBe('Siguió trabajando.');
    expect(withoutReviewMarks('alrededor del Sol (TODO(verificar)). Tema')).toBe(
      'alrededor del Sol. Tema',
    );
    expect(withoutReviewMarks('Sin marcas.')).toBe('Sin marcas.');
  });
});

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

  it('exige una frase «porque» por cada variable que mueve una opción, y ninguna más', () => {
    const raw = realContent();
    const option = d1(raw).opciones[0] as { porque: Record<string, unknown> } | undefined;
    if (option) {
      delete option.porque.confianza;
      option.porque.equidad = { normal: 'No cambia.', facil: 'No cambia.' };
    }
    const errors = validate(raw).errors.join('\n');
    expect(errors).toMatch(/porque\.confianza: falta la frase/);
    expect(errors).toMatch(/porque\.equidad: «equidad» no cambia/);
  });

  it('limita la frase «porque» y la definición de cada barra', () => {
    const raw = realContent();
    const option = d1(raw).opciones[0] as { porque: Record<string, unknown> } | undefined;
    if (option) option.porque.confianza = { normal: 'palabra '.repeat(19), facil: 'Corta.' };
    const world = raw.world as { variables: Record<string, { definicion: unknown }> };
    const poder = world.variables.poder;
    if (poder) poder.definicion = { normal: 'palabra '.repeat(17), facil: 'Corta.' };
    const errors = validate(raw).errors.join('\n');
    expect(errors).toMatch(/opciones\.A\.porque\.confianza\.normal: más de 18 palabras/);
    expect(errors).toMatch(/mundo\.json › variables\.poder\.definicion\.normal: más de 16/);
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

  it('compila las escenas e informa de los errores de Ink', () => {
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
    ]);
    inkFiles['dilemas/d1-galileo.ink'] = 'ROTO';
    try {
      expect(validate(realContent()).errors.join('\n')).toMatch(
        /d1-galileo\.ink: error de sintaxis/,
      );
    } finally {
      inkFiles['dilemas/d1-galileo.ink'] = VALID_SCENE;
    }
  });

  it('detecta las formas de «vosotros» (en Canarias, «ustedes») sin falsos positivos', () => {
    expect(vosotrosForms('Os he elegido a vosotros: este curso tenéis Filosofía.')).toEqual([
      'Os',
      'vosotros',
      'tenéis',
    ]);
    expect(vosotrosForms('Sí, en vuestro instituto. ¿Estáis listos? Sois Cronistas.')).toEqual([
      'vuestro',
      'Estáis',
      'Sois',
    ]);
    expect(
      vosotrosForms('Los he elegido a ustedes: tengo dieciséis años, veintiséis osos y un país.'),
    ).toEqual([]);
  });

  it('rechaza «vosotros» en el contenido y en las escenas Ink', () => {
    const raw = realContent();
    const [first] = (raw.intro as { paneles: { texto: Record<string, string> }[] }).paneles;
    if (first) first.texto = { normal: 'Os he elegido.', facil: 'Ustedes tienen Filosofía.' };
    inkFiles['dilemas/d1-galileo.ink'] = '=== escena ===\nEste curso tenéis Filosofía.\n-> END';
    try {
      const errors = validate(raw).errors.join('\n');
      expect(errors).toMatch(/intro\.json: «Os» es de «vosotros»/);
      expect(errors).toMatch(/d1-galileo\.ink: «tenéis» es de «vosotros»/);
    } finally {
      inkFiles['dilemas/d1-galileo.ink'] = VALID_SCENE;
    }
  });

  it('solo acepta el hueco {grupo}, y solo en los paneles de las cinemáticas', () => {
    const raw = realContent();
    const [first] = (raw.intro as { paneles: { texto: Record<string, string> }[] }).paneles;
    if (first) first.texto = { normal: 'Hola, {grupo} y {grup}.', facil: 'Hola, {grupo}.' };
    const [ending] = raw.endings as { ari: Record<string, string> }[];
    if (ending) ending.ari = { normal: 'Saludos al {grupo}.', facil: 'Hola.' };
    const errors = validate(raw).errors.join('\n');
    expect(errors).toMatch(/intro\.json › paneles\.0\.texto: «\{grup\}» no existe/);
    expect(errors).not.toMatch(/paneles\.0\.texto: «\{grupo\}»/);
    expect(errors).toMatch(/finales\.json › tecnocracia\.ari: «\{grupo\}» no se sustituye/);
  });

  it('valida la intro: planos conocidos y paneles cortos', () => {
    const panels = (raw: RawContent) => (raw.intro as { paneles: Record<string, unknown>[] }).paneles;

    const unknownShot = realContent();
    const [first] = panels(unknownShot);
    if (first) first.plano = 'luna';
    expect(validate(unknownShot).errors.join('\n')).toMatch(/intro\.json › paneles\.0\.plano/);

    const tooLongPanel = realContent();
    const [, second] = panels(tooLongPanel);
    if (second) second.texto = { normal: 'palabra '.repeat(36), facil: 'Corta.' };
    expect(validate(tooLongPanel).errors.join('\n')).toMatch(
      /intro\.json › paneles\.1\.texto\.normal: más de 35 palabras/,
    );
  });

  it('la frase de un consejero es una sola frase de como mucho 20 palabras', () => {
    const raw = realContent();
    const [first] = d1(raw).consejeros as { frase: { normal: string } }[];
    if (first) first.frase = { normal: `${'palabra '.repeat(21)}final. Y otra frase` };
    const errors = validate(raw).errors.join('\n');
    expect(errors).toMatch(/consejeros\.kaltz\.frase\.normal: más de 20 palabras/);
    expect(errors).toMatch(/consejeros\.kaltz\.frase: debe ser una sola frase/);
  });

  it('los respaldos de la IA no pasan de 50 palabras (objeción) ni de 40 (cierre)', () => {
    const raw = realContent();
    const fallbacks = raw.fallbacks as Record<string, Record<string, Record<string, unknown>>>;
    const long = 'palabra '.repeat(51);
    const d1A = fallbacks.d1?.A;
    if (d1A) d1A.kaltz = { objecion: { normal: long }, cierre: { normal: long, facil: 'Bien.' } };
    const errors = validate(raw).errors.join('\n');
    expect(errors).toMatch(/d1\.A\.kaltz\.objecion\.normal: más de 50 palabras/);
    expect(errors).toMatch(/d1\.A\.kaltz\.cierre\.normal: más de 40 palabras/);
    expect(errors).not.toMatch(/cierre\.facil/);
  });

  it('un eco solo puede recordar decisiones de dilemas anteriores', () => {
    const files: Record<string, string> = {
      ...inkFiles,
      'dilemas/d2-haber.ink':
        'VAR eleccion_d3 = ""\n=== escena ===\n{ eleccion_d3 == "A": Eco. }\n-> END',
    };
    const result = validateContent(realContent(), {
      strict: false,
      readText: (path) => files[path] ?? readText(path),
      compileInk,
      assetExists: () => true,
    });
    expect(result.errors.join('\n')).toMatch(/«eleccion_d3» no es de un dilema anterior/);
    expect(result.errors.join('\n')).not.toMatch(/eleccion_d1/);
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
