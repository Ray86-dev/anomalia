/** Contrato entre la app y la Edge Function `partida` (todas las escrituras del alumnado). */
import { z } from 'zod';

// ── Peticiones ──

export const joinRequestSchema = z.strictObject({
  action: z.literal('join'),
  classCode: z.string().max(32),
  alias: z.string().max(64),
});

export const partidaRequestSchema = z.discriminatedUnion('action', [joinRequestSchema]);
export type PartidaRequest = z.infer<typeof partidaRequestSchema>;
export type JoinRequest = z.infer<typeof joinRequestSchema>;

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

// ── Errores de protocolo (HTTP 4xx/5xx): el cliente los trata como fallo genérico ──

export const PROTOCOL_ERRORS = [
  'forbidden_origin',
  'method_not_allowed',
  'unauthenticated',
  'bad_request',
  'server_error',
] as const;
export type ProtocolError = (typeof PROTOCOL_ERRORS)[number];

// ── Resultado de la función SQL svc_join ──

export const svcJoinResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    alias: z.string(),
    classLabel: z.string(),
    resumed: z.boolean(),
  }),
  z.object({ status: z.enum(JOIN_ERRORS) }),
]);
