/**
 * Esquemas del contenido (`content/`). Las claves van en castellano porque
 * los archivos los edita el docente (ver CLAUDE.md · Convenciones).
 */
import { z } from 'zod';
import { WORLD_VARS } from '../game/world.ts';

const id = z.string().regex(/^[a-z0-9-]+$/, 'solo minúsculas, números y guiones');
const dilemmaId = z.string().regex(/^d\d+$/, 'formato d1, d2…');

/** Texto con versión en lectura fácil (obligatoria en modo estricto, ver D-10). */
export const textoSchema = z.strictObject({
  normal: z.string().min(1),
  facil: z.string().min(1).optional(),
});

const worldVar = z.enum(WORLD_VARS);
const wordRange = z
  .tuple([z.number().int().positive(), z.number().int().positive()])
  .refine(([min, max]) => min <= max, 'el mínimo no puede superar al máximo');

// ── Dilemas ────────────────────────────────────────────────────────────────

const optionSchema = z.strictObject({
  id: z.enum(['A', 'B', 'C']),
  texto: textoSchema,
  deltas: z.partialRecord(worldVar, z.number().int().min(-30).max(30)),
  rama: id.nullable(),
  objetor: id,
  ondas: z.strictObject({ titular: textoSchema, texto: textoSchema }),
});

export const dilemmaSchema = z
  .strictObject({
    id: dilemmaId,
    capitulo: z.union([z.literal(1), z.literal(2)]),
    orden: z.number().int().positive(),
    anio: z.number().int(),
    lugar: z.string().min(1),
    titulo: textoSchema,
    tema: textoSchema,
    rolCronista: textoSchema,
    estetica: z.enum(['barroco', 'artdeco', 'foto50', 'clinico', '2077']),
    escena: z.strictObject({ ink: z.string().min(1), inkFacil: z.string().min(1).optional() }),
    consejeros: z
      .array(z.strictObject({ id, argumento: textoSchema }))
      .refine(
        (list) => list.length === 3 || list.length === 5,
        '3 consejeros (5 en el dilema final)',
      ),
    /** Voces históricas: se describe su postura, sin citas textuales inventadas. */
    voces: z.array(z.strictObject({ nombre: z.string().min(1), postura: textoSchema })),
    opciones: z.tuple([optionSchema, optionSchema, optionSchema]),
    justificacion: z.strictObject({ pregunta: textoSchema, palabras: wordRange }),
    replica: z.strictObject({ palabras: wordRange }),
    archivoReal: z.strictObject({ texto: textoSchema, verificado: z.boolean() }),
    ia: z.strictObject({ contexto: z.string().min(1) }),
    sensibilidad: z.array(z.string()),
    assets: z.strictObject({
      capas: z.array(z.string()),
      musica: z.string().optional(),
      stems: z.array(z.string()),
    }),
  })
  .superRefine((d, ctx) => {
    const order = d.opciones.map((o) => o.id).join('');
    if (order !== 'ABC') {
      ctx.addIssue({
        code: 'custom',
        path: ['opciones'],
        message: 'las opciones deben ser A, B y C, en ese orden',
      });
    }
    const counselors = d.consejeros.map((c) => c.id);
    if (new Set(counselors).size !== counselors.length) {
      ctx.addIssue({ code: 'custom', path: ['consejeros'], message: 'consejero repetido' });
    }
    d.opciones.forEach((o, i) => {
      if (!counselors.includes(o.objetor)) {
        ctx.addIssue({
          code: 'custom',
          path: ['opciones', i, 'objetor'],
          message: `«${o.objetor}» no es uno de los consejeros de este dilema`,
        });
      }
    });
  });

// ── Consejeros, conceptos, finales, rúbrica, modos ───────────────────────────

export const counselorSchema = z.strictObject({
  id,
  nombre: z.string().min(1),
  postura: z.string().min(1),
  referentes: z.array(z.string().min(1)),
  ideaFuerza: textoSchema,
  /** Estilo de voz para el prompt de la IA (M2). */
  vozIA: z.string().min(1),
  retrato: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const conceptSchema = z.strictObject({ id, etiqueta: z.string().min(1) });

const comparisonSchema = z.strictObject({
  var: z.enum([...WORLD_VARS, 'desnivel']),
  op: z.enum(['<', '<=', '>', '>=']),
  valor: z.number(),
});

export const endingSchema = z.strictObject({
  id,
  titulo: textoSchema,
  /** `null` = «resto de casos». Solo puede tenerlo el último final (D-09). */
  condicion: z.strictObject({ todas: z.array(comparisonSchema).min(1) }).nullable(),
  /** «Imagen de 2077» de la tabla §5.6. */
  resumen: textoSchema,
  texto: textoSchema,
  assets: z.strictObject({ imagen: z.string().optional(), musica: z.string().optional() }),
});

export const endingsSchema = z.array(endingSchema).superRefine((list, ctx) => {
  list.forEach((e, i) => {
    const isLast = i === list.length - 1;
    if (isLast && e.condicion !== null) {
      ctx.addIssue({
        code: 'custom',
        path: [i, 'condicion'],
        message: 'el último final debe ser el caso por defecto (condicion: null)',
      });
    }
    if (!isLast && e.condicion === null) {
      ctx.addIssue({
        code: 'custom',
        path: [i, 'condicion'],
        message: 'solo el último final puede tener condicion: null',
      });
    }
  });
});

export const rubricSchema = z.strictObject({
  niveles: z.array(z.string().min(1)).min(2),
  criterios: z.array(
    z.strictObject({
      id: z.string().min(1),
      nombre: z.string().min(1),
      descripcion: z.string().min(1),
    }),
  ),
});

export const classModeSchema = z.strictObject({
  id,
  etiqueta: z.string().min(1),
  descripcion: z.string().min(1),
  capitulo1: z.array(dilemmaId).min(1),
  capitulo2: z.array(dilemmaId),
});

export const blockedTermsSchema = z.strictObject({
  contiene: z.array(z.string().min(3)),
  exactas: z.array(z.string().min(2)),
});

/** Respaldos: dilema → opción → consejero objetor → { objecion, cierre }. */
export const fallbacksSchema = z.record(
  dilemmaId,
  z.partialRecord(
    z.enum(['A', 'B', 'C']),
    z.record(id, z.strictObject({ objecion: textoSchema, cierre: textoSchema })),
  ),
);

/** Textos de interfaz: árbol libre de cadenas (las claves las fija el código). */
export type UiTree = { readonly [key: string]: string | UiTree };
export const uiSchema: z.ZodType<UiTree> = z.lazy(() =>
  z.record(z.string(), z.union([z.string(), uiSchema])),
);

export type Texto = z.infer<typeof textoSchema>;
export type Dilemma = z.infer<typeof dilemmaSchema>;
export type DilemmaOption = Dilemma['opciones'][number];
export type Counselor = z.infer<typeof counselorSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type Ending = z.infer<typeof endingSchema>;
export type Rubric = z.infer<typeof rubricSchema>;
export type ClassMode = z.infer<typeof classModeSchema>;
export type Fallbacks = z.infer<typeof fallbacksSchema>;
