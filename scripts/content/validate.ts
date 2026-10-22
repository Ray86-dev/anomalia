import { basename } from 'node:path';
import { z } from 'zod';
import { canonical, type BlockedTerms } from '../../shared/game/alias.ts';
import { MILESTONE_IDS } from '../../shared/game/milestones.ts';
import { countWords } from '../../shared/game/words.ts';
import {
  alertTermsSchema,
  ambientsSchema,
  blockedTermsSchema,
  classModeSchema,
  conceptSchema,
  counselorSchema,
  dilemmaSchema,
  emblemsSchema,
  endingsSchema,
  fichaSchema,
  fallbacksSchema,
  reflectionSchema,
  rewardsSchema,
  rubricSchema,
  uiSchema,
  type AlertTerms,
  type Ambients,
  type ClassMode,
  type Concept,
  type Counselor,
  type Dilemma,
  type Emblems,
  type Ending,
  type Ficha,
  type Fallbacks,
  type Reflection,
  type Rewards,
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
  readonly alerts: unknown;
  readonly reflection: unknown;
  readonly rewards: unknown;
  readonly fichas: unknown;
  readonly emblems: unknown;
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
  readonly alerts: AlertTerms;
  readonly reflection: Reflection;
  readonly rewards: Rewards;
  readonly fichas: readonly Ficha[];
  readonly emblems: Emblems;
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
export const PROLOGUE_EASY_INK = {
  id: 'prologo-facil',
  path: 'lectura-facil/prologo.ink',
  knots: ['prologo'],
} as const;
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

/** Menos texto (M6): la frase de cada consejero y los respaldos de la IA tienen tope. */
const MAX_WORDS = { frase: 20, objecion: 50, cierre: 40, giro: 45, ari: 35 } as const;

/** Dilemas a los que mira una escena con sus ecos (`eleccion_d1`…). */
const echoesIn = (source: string) =>
  [...source.matchAll(/\beleccion_(d\d+)\b/gu)].map((match) => match[1] ?? '');

/** Versiones (normal y fácil) de un Texto que pasan del tope de palabras. */
function tooLong(text: Readonly<Record<string, string | undefined>>, max: number): string[] {
  return Object.entries(text)
    .filter(([, value]) => value !== undefined && countWords(value) > max)
    .map(([variant]) => variant);
}

/** Una sola frase: ningún punto, cierre de interrogación o exclamación seguido de más texto. */
const severalSentences = (text: string | undefined) =>
  text !== undefined && /[.!?…]\s+\S/u.test(text);

/**
 * Las marcas `TODO(verificar)` son para el docente: se quedan en `content/` (y en los avisos de
 * `npm run content`), pero nunca llegan a la pantalla, al PDF ni a la IA (D-72).
 */
export function withoutReviewMarks(text: string): string {
  return text.replace(/\s*\(TODO\(verificar\)\)/gu, '').replace(/\s*TODO\(verificar\)/gu, '');
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
  const alerts = parse(alertTermsSchema, raw.alerts, 'alertas.json');
  const reflection = parse(reflectionSchema, raw.reflection, 'reflexion.json');
  const rewards = parse(rewardsSchema, raw.rewards, 'logros.json');
  const fichas = parse(z.array(fichaSchema), raw.fichas, 'fichas.json');
  const emblems = parse(emblemsSchema, raw.emblems, 'emblemas.json');
  const dilemmas = raw.dilemmas.map(({ file, data }) => {
    const dilemma = parse(dilemmaSchema, data, file);
    if (dilemma && !basename(file).startsWith(`${dilemma.id}-`)) {
      errors.push(`${file}: el nombre del archivo debe empezar por «${dilemma.id}-»`);
    }
    return dilemma;
  });

  checkInk(PROLOGUE_INK.id, PROLOGUE_INK.path, PROLOGUE_INK.knots, 'prólogo');
  if (options.readText(PROLOGUE_EASY_INK.path) !== null || options.strict) {
    checkInk(PROLOGUE_EASY_INK.id, PROLOGUE_EASY_INK.path, PROLOGUE_EASY_INK.knots, 'prólogo');
  }

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
    ['logros.json › movimientos', rewards?.movimientos ?? null],
    ['logros.json › hitos', rewards?.hitos ?? null],
    ['logros.json › rangos', rewards?.rangos ?? null],
    ['fichas.json', fichas],
    ['emblemas.json › simbolos', emblems?.simbolos ?? null],
    ['emblemas.json › colores', emblems?.colores ?? null],
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
    for (const c of d.consejeros) {
      for (const variant of tooLong(c.frase, MAX_WORDS.frase)) {
        errors.push(`${file} › consejeros.${c.id}.frase.${variant}: más de ${String(MAX_WORDS.frase)} palabras`);
      }
      if (Object.values(c.frase).some(severalSentences)) {
        errors.push(`${file} › consejeros.${c.id}.frase: debe ser una sola frase`);
      }
    }
    if (fallbacks) {
      for (const o of d.opciones) {
        if (fallbacks[d.id]?.[o.id]?.[o.objetor] === undefined) {
          errors.push(`respaldos.json › ${d.id}.${o.id}.${o.objetor}: falta el respaldo de la objeción`);
        }
      }
    }
    for (const o of d.opciones) {
      for (const variant of tooLong(o.ondas.ari, MAX_WORDS.ari)) {
        errors.push(`${file} › opciones.${o.id}.ondas.ari.${variant}: más de ${String(MAX_WORDS.ari)} palabras`);
      }
    }
    if (!d.laboratorio.verificado) {
      notice(`${file} › laboratorio: dato pendiente de verificar por el docente`);
    }
    if (d.giro !== undefined) {
      for (const variant of tooLong(d.giro.texto, MAX_WORDS.giro)) {
        errors.push(`${file} › giro.texto.${variant}: más de ${String(MAX_WORDS.giro)} palabras`);
      }
      if (d.giro.fuente === 'historia' && !d.giro.verificado) {
        notice(`${file} › giro: dato histórico pendiente de verificar por el docente`);
      }
    }
    // Ecos (M6): una escena solo puede recordar decisiones de dilemas anteriores.
    for (const path of [d.escena.ink, d.escena.inkFacil]) {
      const source = path === undefined ? null : options.readText(path);
      for (const echoed of new Set(source === null ? [] : echoesIn(source))) {
        const earlier = validDilemmas.find((other) => other.id === echoed);
        const before =
          earlier !== undefined &&
          (earlier.capitulo < d.capitulo ||
            (earlier.capitulo === d.capitulo && earlier.orden < d.orden));
        if (!before) errors.push(`${path ?? ''}: el eco «eleccion_${echoed}» no es de un dilema anterior`);
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
        for (const [counselor, fallback] of Object.entries(byCounselor)) {
          const where = `respaldos.json › ${dilemma}.${option}.${counselor}`;
          if (counselors && !counselorIds.has(counselor)) {
            errors.push(`${where}: no existe ese consejero`);
          }
          for (const part of ['objecion', 'cierre'] as const) {
            for (const variant of tooLong(fallback[part], MAX_WORDS[part])) {
              errors.push(`${where}.${part}.${variant}: más de ${String(MAX_WORDS[part])} palabras`);
            }
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

  // ── Logros y recompensas (M6) ──
  if (rewards) {
    const conceptIds = new Set(concepts?.map((c) => c.id));
    for (const move of rewards.movimientos) {
      if (conceptIds.has(move.id)) {
        errors.push(`logros.json › movimientos: «${move.id}» coincide con un concepto (la IA los confundiría)`);
      }
    }
    const milestones = new Set(rewards.hitos.map((h) => h.id));
    for (const id of MILESTONE_IDS) {
      if (!milestones.has(id)) errors.push(`logros.json › hitos: falta «${id}»`);
    }
    rewards.rangos.forEach((rank, i) => {
      const previous = rewards.rangos[i - 1];
      if (i === 0 && rank.puntosPorAnomalia !== 0) {
        errors.push('logros.json › rangos: el primer rango debe empezar en 0 puntos');
      }
      if (previous && rank.puntosPorAnomalia <= previous.puntosPorAnomalia) {
        errors.push(`logros.json › rangos: «${rank.id}» debe pedir más puntos que «${previous.id}»`);
      }
    });
  }
  for (const ficha of fichas ?? []) {
    if (!dilemmaIds.has(ficha.dilema)) errors.push(`fichas.json › ${ficha.id}: no existe el dilema «${ficha.dilema}»`);
    if (!ficha.verificado) notice(`fichas.json › ${ficha.id}: pendiente de verificar por el docente`);
  }
  if (emblems) {
    if (!emblems.simbolos.some((s) => s.puntos === 0)) errors.push('emblemas.json: hace falta un símbolo gratis (0 puntos)');
    if (!emblems.colores.some((c) => c.puntos === 0)) errors.push('emblemas.json: hace falta un color gratis (0 puntos)');
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
    ['reflexion.json', raw.reflection],
    ['logros.json', raw.rewards],
    ['fichas.json', raw.fichas],
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
    ui &&
    counselors &&
    concepts &&
    endings &&
    rubric &&
    modes &&
    blocked &&
    fallbacks &&
    ambients &&
    alerts &&
    reflection &&
    rewards &&
    fichas &&
    emblems
      ? {
          ui,
          counselors,
          concepts,
          endings,
          rubric,
          modes,
          blocked,
          fallbacks,
          ambients,
          alerts,
          reflection,
          rewards,
          fichas,
          emblems,
        }
      : null;
  const content =
    errors.length === 0 && complete
      ? { ...complete, dilemmas: [...validDilemmas].sort((a, b) => a.capitulo - b.capitulo || a.orden - b.orden) }
      : null;

  return { errors, warnings, content, inks };
}
