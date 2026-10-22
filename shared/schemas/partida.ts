/** Contrato entre la app y la Edge Function `partida` (todas las escrituras del alumnado). */
import { z } from 'zod';
import { DILEMMA_PHASES, GLOBAL_PHASES } from '../game/phases.ts';

const phaseSchema = z.enum([...GLOBAL_PHASES, ...DILEMMA_PHASES]);
const dilemmaIdSchema = z.string().regex(/^d\d+$/);
const choiceSchema = z.enum(['A', 'B', 'C']);

export const MAX_JUSTIFICATION_CHARS = 1200;
export const MAX_REPLY_CHARS = 900;
/** Igual que el CHECK de `runs.final_reflection`. */
export const MAX_REFLECTION_CHARS = 3000;

// ── Peticiones ──

export const joinRequestSchema = z.strictObject({
  action: z.literal('join'),
  classCode: z.string().max(32),
  alias: z.string().max(64),
});

/** Recuperar un alias desde otro móvil: con la clave de rescate, al instante (D-33). */
export const recoverRequestSchema = z.strictObject({
  action: z.literal('recover'),
  classCode: z.string().max(32),
  alias: z.string().max(64),
  rescueKey: z.string().max(16).optional(),
});

/** «Continuar»: desde la posición que el cliente cree tener (si no coincide → `stale`). */
export const advanceRequestSchema = z.strictObject({
  action: z.literal('advance'),
  from: z.strictObject({ phase: phaseSchema, dilemmaId: dilemmaIdSchema.nullable() }),
});

export const chooseRequestSchema = z.strictObject({
  action: z.literal('choose'),
  dilemmaId: dilemmaIdSchema,
  choice: choiceSchema,
});

export const justifyRequestSchema = z.strictObject({
  action: z.literal('justify'),
  dilemmaId: dilemmaIdSchema,
  text: z.string().max(MAX_JUSTIFICATION_CHARS),
});

export const replyRequestSchema = z.strictObject({
  action: z.literal('reply'),
  dilemmaId: dilemmaIdSchema,
  text: z.string().max(MAX_REPLY_CHARS),
});

/** Reflexión final (§6): cierra la partida y genera el código de verificación del PDF. */
export const reflectRequestSchema = z.strictObject({
  action: z.literal('reflect'),
  text: z.string().max(MAX_REFLECTION_CHARS),
});

export const partidaRequestSchema = z.discriminatedUnion('action', [
  joinRequestSchema,
  recoverRequestSchema,
  advanceRequestSchema,
  chooseRequestSchema,
  justifyRequestSchema,
  replyRequestSchema,
  reflectRequestSchema,
]);
export type PartidaRequest = z.infer<typeof partidaRequestSchema>;
export type JoinRequest = z.infer<typeof joinRequestSchema>;
export type RecoverRequest = z.infer<typeof recoverRequestSchema>;
export type GameRequest = Exclude<PartidaRequest, JoinRequest | RecoverRequest>;

// ── Estado de la partida que devuelven las acciones de juego ──

export const worldSchema = z.object({
  poder: z.number(),
  responsabilidad: z.number(),
  equidad: z.number(),
  confianza: z.number(),
});

export const runSnapshotSchema = z.object({
  phase: phaseSchema,
  currentDilemma: z.string().nullable(),
  world: worldSchema,
  branches: z.array(z.string()),
  /** Final alcanzado: se fija al entrar en el epílogo (`null` antes). */
  ending: z.string().nullable().default(null),
});
export type RunSnapshot = z.infer<typeof runSnapshotSchema>;

/** Respuesta del alumno al dilema en curso (sus propios textos). */
export const answerSnapshotSchema = z.object({
  dilemmaId: z.string(),
  choice: choiceSchema,
  justification: z.string().nullable(),
  objector: z.string().nullable(),
  objection: z.string().nullable(),
  reply: z.string().nullable(),
  closing: z.string().nullable(),
  /** De dónde salió la objeción: IA o respaldo preescrito. */
  aiSource: z.enum(['ia', 'respaldo']).nullable().default(null),
});
export type AnswerSnapshot = z.infer<typeof answerSnapshotSchema>;

// ── Respuestas (HTTP 200) ──

export const JOIN_ERRORS = [
  'invalid_code',
  'alias_taken',
  'alias_format',
  'alias_blocked',
  'already_in_other_class',
  'expelled',
  'is_teacher',
] as const;
export type JoinError = (typeof JOIN_ERRORS)[number];

export const joinResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    alias: z.string(),
    classLabel: z.string(),
    resumed: z.boolean(),
    rescueKey: z.string(),
  }),
  z.strictObject({ ok: z.literal(false), error: z.enum(JOIN_ERRORS) }),
]);
export type JoinResponse = z.infer<typeof joinResponseSchema>;

/**
 * - `pending`: sin clave, queda una solicitud que debe aprobar el docente.
 * - `wrong_key`: clave incorrecta; también queda la solicitud para el docente.
 */
export const RECOVER_ERRORS = [
  'invalid_code',
  'unknown_alias',
  'expelled',
  'already_in_other_class',
  'is_teacher',
  'pending',
  'wrong_key',
] as const;
export type RecoverError = (typeof RECOVER_ERRORS)[number];

export const recoverResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), alias: z.string(), classLabel: z.string() }),
  z.strictObject({ ok: z.literal(false), error: z.enum(RECOVER_ERRORS) }),
]);
export type RecoverResponse = z.infer<typeof recoverResponseSchema>;

/**
 * - `stale`: la partida no está donde el cliente creía (doble toque, otra pestaña…):
 *   el cliente adopta el estado devuelto.
 * - `locked`: el capítulo II sigue bloqueado.
 * - `invalid`: texto vacío, dilema u opción inexistentes.
 * - `needs_more`: la IA no encuentra ninguna razón en la justificación; el alumno puede
 *   reescribirla una vez (el segundo envío se archiva siempre, §7.2).
 */
export const GAME_ERRORS = [
  'stale',
  'locked',
  'invalid',
  'needs_more',
  'not_joined',
  'expelled',
] as const;
export type GameError = (typeof GAME_ERRORS)[number];

export const gameResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    run: runSnapshotSchema,
    answer: answerSnapshotSchema.nullable(),
  }),
  z.strictObject({
    ok: z.literal(false),
    error: z.enum(GAME_ERRORS),
    run: runSnapshotSchema.nullable(),
    answer: answerSnapshotSchema.nullable(),
  }),
]);
export type GameResponse = z.infer<typeof gameResponseSchema>;

// ── Errores de protocolo (HTTP 4xx/5xx): el cliente los trata como fallo de red ──

export const PROTOCOL_ERRORS = [
  'forbidden_origin',
  'method_not_allowed',
  'unauthenticated',
  'bad_request',
  'server_error',
] as const;
export type ProtocolError = (typeof PROTOCOL_ERRORS)[number];

// ── Resultados de las funciones SQL svc_* ──

export const svcJoinResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    alias: z.string(),
    classLabel: z.string(),
    resumed: z.boolean(),
    rescueKey: z.string(),
  }),
  z.object({ status: z.enum(JOIN_ERRORS) }),
]);

export const svcRecoverResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), alias: z.string(), classLabel: z.string() }),
  z.object({ status: z.enum(RECOVER_ERRORS) }),
]);

export const svcStateSchema = z.object({
  playerId: z.string(),
  status: z.enum(['active', 'expelled']),
  chapter1: z.array(z.string()),
  chapter2: z.array(z.string()),
  chapterUnlocked: z.union([z.literal(1), z.literal(2)]),
  run: runSnapshotSchema,
  answer: answerSnapshotSchema.nullable(),
});
export type SvcState = z.infer<typeof svcStateSchema>;

export const svcWriteResultSchema = z.object({
  status: z.enum(['ok', 'stale']),
  state: svcStateSchema,
});
