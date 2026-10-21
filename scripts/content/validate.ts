import { basename } from 'node:path';
import { z } from 'zod';
import { canonical, type BlockedTerms } from '../../shared/game/alias.ts';
import {
  ambientsSchema,
  blockedTermsSchema,
  classModeSchema,
  conceptSchema,
  counselorSchema,
  dilemmaSchema,
  endingsSchema,
  fallbacksSchema,
  rubricSchema,
  uiSchema,
  type Ambients,
  type ClassMode,
  type Concept,
  type Counselor,
  type Dilemma,
  type Ending,
  type Fallbacks,
  type Rubric,
  type UiTree,
} from '../../shared/schemas/content.ts';

export type RawContent = {
  readonly dilemmas: readonly { readonly file: string; readonly data: unknown }[];
  readonly counselors: unknown;
  readonly concepts: unknown;
  readonly endings: unknown;
  readonly rubric: unknown;
  readonly modes: unknown;
  readonly blocked: unknown;
  readonly fallbacks: unknown;
  readonly ui: unknown;
  readonly ambients: unknown;
};

export type Content = {
  readonly ui: UiTree;
  readonly counselors: readonly Counselor[];
  readonly concepts: readonly Concept[];
  readonly endings: readonly Ending[];
  readonly rubric: Rubric;
  readonly modes: readonly ClassMode[];
  readonly blocked: BlockedTerms;
  readonly fallbacks: Fallbacks;
  readonly ambients: Ambients;
  readonly dilemmas: readonly Dilemma[];
};

export type InkResult = {
  /** JSON compilado, o `null` si hay errores. */
  readonly json: string | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
};

export type ValidationOptions = {
  /** Modo estricto (publicación): los avisos pasan a ser errores y la lectura fácil es obligatoria. */
  readonly strict: boolean;
  /** Lee un archivo relativo a `content/`; `null` si no existe. */
  readonly readText: (relativePath: string) => string | null;
  /** ¿Existe el archivo en public/assets/? */
  readonly assetExists: (src: string) => boolean;
  /** Compila una fuente Ink y comprueba que existen los nudos indicados. */
  readonly compileInk: (source: string, requiredKnots: readonly string[]) => InkResult;
};

/** Historias Ink del juego: id → archivo y nudos que debe tener. */
export const PROLOGUE_INK = { id: 'prologo', path: 'prologo.ink', knots: ['prologo'] } as const;
export const SCENE_KNOTS = ['escena'] as const;

export type ValidationResult = {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly content: Content | null;
  /** JSON compilado de cada historia Ink, por id (`prologo`, `d1`, `d1-facil`…). */
  readonly inks: Readonly<Record<string, string>>;
};

function formatPath(path: readonly PropertyKey[]): string {
  return path.length === 0 ? '(raíz)' : path.map(String).join('.');
}

/** Recorre todos los textos de un valor JSON. */
function* strings(value: unknown): Generator<string> {
  if (typeof value === 'string') {
    yield value;
  } else if (Array.isArray(value)) {
    for (const item of value) yield* strings(item);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) yield* strings(item);
  }
}

/** Rutas de los objetos Texto ({ normal, facil? }) sin versión fácil. */
function missingEasyReading(value: unknown, path: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => missingEasyReading(item, [...path, String(i)]));
  }
  if (value === null || typeof value !== 'object') return [];
  if ('normal' in value && typeof value.normal === 'string') {
    return 'facil' in value ? [] : [path.join('.')];
  }
  return Object.entries(value).flatMap(([key, item]) => missingEasyReading(item, [...path, key]));
}

function duplicates(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

export function validateContent(raw: RawContent, options: ValidationOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const inks: Record<string, string> = {};
  const notice = (message: string) => (options.strict ? errors : warnings).push(message);

  function checkInk(id: string, path: string, knots: readonly string[], owner: string): void {
    const source = options.readText(path);
    if (source === null) {
      errors.push(`${owner}: no existe content/${path}`);
      return;
    }
    if (source.includes('TODO(')) notice(`${path}: contiene marcas TODO`);
    const result = options.compileInk(source, knots);
    for (const error of result.errors) errors.push(`${path}: ${error}`);
    for (const warning of result.warnings) notice(`${path}: ${warning}`);
    if (result.json !== null) inks[id] = result.json;
  }

  function parse<T>(schema: z.ZodType<T>, data: unknown, file: string): T | null {
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      errors.push(`${file} › ${formatPath(issue.path)}: ${issue.message}`);
    }
    return null;
  }

  const ui = parse(uiSchema, raw.ui, 'interfaz.json');
  const counselors = parse(z.array(counselorSchema), raw.counselors, 'consejeros.json');
  const concepts = parse(z.array(conceptSchema), raw.concepts, 'conceptos.json');
  const endings = parse(endingsSchema, raw.endings, 'finales.json');
  const rubric = parse(rubricSchema, raw.rubric, 'rubrica.json');
  const modes = parse(z.array(classModeSchema), raw.modes, 'modos.json');
  const blocked = parse(blockedTermsSchema, raw.blocked, 'alias-bloqueados.json');
  const fallbacks = parse(fallbacksSchema, raw.fallbacks, 'respaldos.json');
  const ambients = parse(ambientsSchema, raw.ambients, 'ambientes.json');
  const dilemmas = raw.dilemmas.map(({ file, data }) => {
    const dilemma = parse(dilemmaSchema, data, file);
    if (dilemma && !basename(file).startsWith(`${dilemma.id}-`)) {
      errors.push(`${file}: el nombre del archivo debe empezar por «${dilemma.id}-»`);
    }
    return dilemma;
  });

  checkInk(PROLOGUE_INK.id, PROLOGUE_INK.path, PROLOGUE_INK.knots, 'prólogo');

  /** Imágenes y pistas declaradas deben existir en public/assets/ (si faltan, el juego usa el fondo procedural). */
  function checkAssets(owner: string, assets: { src: string }[]): void {
    for (const { src } of assets) {
      if (!options.assetExists(src)) notice(`${owner}: falta public/assets/${src}`);
    }
  }
  for (const [aesthetic, ambient] of Object.entries(ambients ?? {})) {
    checkAssets(`ambientes.json › ${aesthetic}`, [...ambient.capas, ...(ambient.musica ? [ambient.musica] : [])]);
  }

  // ── Identificadores únicos ──
  const uniqueness: [string, readonly { id: string }[] | null][] = [
    ['consejeros.json', counselors],
    ['conceptos.json', concepts],
    ['finales.json', endings],
    ['modos.json', modes],
    ['dilemas/', dilemmas.filter((d) => d !== null)],
  ];
  for (const [file, list] of uniqueness) {
    for (const id of duplicates(list?.map((item) => item.id) ?? [])) {
      errors.push(`${file}: id repetido «${id}»`);
    }
  }
  const validDilemmas = dilemmas.filter((d) => d !== null);
  for (const slot of duplicates(validDilemmas.map((d) => `${d.capitulo}.${d.orden}`))) {
    errors.push(`dilemas/: dos dilemas comparten capítulo y orden (${slot})`);
  }

  // ── Referencias cruzadas ──
  const counselorIds = new Set(counselors?.map((c) => c.id));
  const dilemmaIds = new Set(validDilemmas.map((d) => d.id));

  for (const d of validDilemmas) {
    const file = `dilemas/${d.id}`;
    if (counselors) {
      for (const c of d.consejeros) {
        if (!counselorIds.has(c.id)) errors.push(`${file} › consejeros: «${c.id}» no existe en consejeros.json`);
      }
    }
    if (fallbacks) {
      for (const o of d.opciones) {
        if (fallbacks[d.id]?.[o.id]?.[o.objetor] === undefined) {
          errors.push(`respaldos.json › ${d.id}.${o.id}.${o.objetor}: falta el respaldo de la objeción`);
        }
      }
    }
    checkInk(d.id, d.escena.ink, SCENE_KNOTS, `${file} › escena`);
    if (d.escena.inkFacil !== undefined) {
      checkInk(`${d.id}-facil`, d.escena.inkFacil, SCENE_KNOTS, `${file} › escena`);
    } else if (options.strict) {
      errors.push(`${file} › escena: falta la escena en lectura fácil («inkFacil»)`);
    }
    if (!d.archivoReal.verificado) notice(`${file} › archivoReal: pendiente de verificar por el docente`);
    const { capas, archivo, musica } = d.assets;
    checkAssets(`${file} › assets`, [...capas, ...(archivo ? [archivo] : []), ...(musica ? [musica] : [])]);
  }

  if (fallbacks) {
    for (const [dilemma, byOption] of Object.entries(fallbacks)) {
      if (!dilemmaIds.has(dilemma)) errors.push(`respaldos.json › ${dilemma}: no existe ese dilema`);
      for (const [option, byCounselor] of Object.entries(byOption)) {
        for (const counselor of Object.keys(byCounselor)) {
          if (counselors && !counselorIds.has(counselor)) {
            errors.push(`respaldos.json › ${dilemma}.${option}.${counselor}: no existe ese consejero`);
          }
        }
      }
    }
  }

  for (const mode of modes ?? []) {
    const ids = [...mode.capitulo1, ...mode.capitulo2];
    for (const id of duplicates(ids)) errors.push(`modos.json › ${mode.id}: «${id}» aparece dos veces`);
    const missing = ids.filter((id) => !dilemmaIds.has(id));
    if (missing.length > 0) notice(`modos.json › ${mode.id}: aún no existen ${missing.join(', ')}`);
  }

  for (const term of blocked?.contiene ?? []) {
    if (canonical(term).length < 3) {
      errors.push(`alias-bloqueados.json › contiene: «${term}» es demasiado corto al normalizarlo y bloquearía alias inocentes`);
    }
  }

  // ── Marcas TODO y lectura fácil ──
  const sources: [string, unknown][] = [
    ['interfaz.json', raw.ui],
    ['consejeros.json', raw.counselors],
    ['finales.json', raw.endings],
    ['respaldos.json', raw.fallbacks],
    ...raw.dilemmas.map(({ file, data }): [string, unknown] => [file, data]),
  ];
  for (const [file, data] of sources) {
    const todos = [...strings(data)].filter((text) => text.includes('TODO(')).length;
    if (todos > 0) notice(`${file}: ${todos} texto(s) con marca TODO`);
    if (options.strict && file !== 'interfaz.json') {
      for (const path of missingEasyReading(data)) {
        errors.push(`${file} › ${path}: falta la versión de lectura fácil («facil»)`);
      }
    }
  }

  const complete =
    ui && counselors && concepts && endings && rubric && modes && blocked && fallbacks && ambients
      ? { ui, counselors, concepts, endings, rubric, modes, blocked, fallbacks, ambients }
      : null;
  const content =
    errors.length === 0 && complete
      ? { ...complete, dilemmas: [...validDilemmas].sort((a, b) => a.capitulo - b.capitulo || a.orden - b.orden) }
      : null;

  return { errors, warnings, content, inks };
}
