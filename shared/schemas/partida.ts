/** Contrato entre la app y la Edge Function `partida` (todas las escrituras del alumnado). */
import { z } from 'zod';
import { DILEMMA_PHASES, GLOBAL_PHASES } from '../game/phases.ts';

const phaseSchema = z.enum([...GLOBAL_PHASES, ...DILEMMA_PHASES]);
const dilemmaIdSchema = z.string().regex(/^d\d+$/);
const choiceSchema = z.enum(['A', 'B', 'C']);

export const MAX_JUSTIFICATION_CHARS = 1200;
export const MAX_REPLY_CHARS = 900;

// ── Peticiones ──

export const joinRequestSchema = z.strictObject({
  action: z.literal('join'),
  classCode: z.string().max(32),
  alias: z.string().max(64),
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

export const partidaRequestSchema = z.discriminatedUnion('action', [
  joinRequestSchema,
  advanceRequestSchema,
  chooseRequestSchema,
  justifyRequestSchema,
  replyRequestSchema,
]);
export type PartidaRequest = z.infer<typeof partidaRequestSchema>;
export type JoinRequest = z.infer<typeof joinRequestSchema>;
export type GameRequest = Exclude<PartidaRequest, JoinRequest>;

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
  }),
  z.strictObject({ ok: z.literal(false), error: z.enum(JOIN_ERRORS) }),
]);
export type JoinResponse = z.infer<typeof joinResponseSchema>;

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
  }),
  z.object({ status: z.enum(JOIN_ERRORS) }),
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
