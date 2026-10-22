/**
 * Lógica de la Edge Function `partida`, separada del runtime para testearla con Vitest.
 * Todas las escrituras del alumnado pasan por aquí (D-05): se valida cada transición con
 * shared/game y se escribe con funciones SQL atómicas. Nunca se registra en logs texto
 * escrito por el alumnado.
 */
import { z } from 'zod';
import { aliasProblem, cleanAlias, type BlockedTerms } from '../../../shared/game/alias.ts';
import { computeEnding } from '../../../shared/game/endings.ts';
import { nextPosition, samePosition, type FlowContext } from '../../../shared/game/flow.ts';
import { mentionsDistress } from '../../../shared/game/privacy.ts';
import { applyDeltas } from '../../../shared/game/world.ts';
import { cleanText, countWords } from '../../../shared/game/words.ts';
import type {
  AlertTerms,
  Concept,
  Counselor,
  Dilemma,
  Ending,
  Fallbacks,
} from '../../../shared/schemas/content.ts';
import {
  AI_MAX_CALLS_PER_DILEMMA,
  type ClosingOutput,
  type ObjectionOutput,
} from '../../../shared/schemas/ia.ts';
import {
  partidaRequestSchema,
  svcJoinResultSchema,
  svcRecoverResultSchema,
  svcStateSchema,
  svcWriteResultSchema,
  type GameError,
  type GameRequest,
  type GameResponse,
  type JoinRequest,
  type JoinResponse,
  type RecoverRequest,
  type RecoverResponse,
  type SvcState,
} from '../../../shared/schemas/partida.ts';
import type { DialogueContext } from '../_shared/ai/prompts.ts';
import { bearerToken, corsHeaders, isForbiddenOrigin, jsonResponse } from '../_shared/http.ts';

export type SvcFunction =
  | 'svc_join'
  | 'svc_recover'
  | 'svc_load'
  | 'svc_advance'
  | 'svc_choose'
  | 'svc_justify'
  | 'svc_reply'
  | 'svc_ai_take'
  | 'svc_alert'
  | 'svc_reflect';

/** Diálogo con la IA; cada llamada devuelve `null` si falla y entonces se usa el respaldo. */
export type AiDialogue = {
  readonly objection: (
    context: DialogueContext,
    justification: string,
  ) => Promise<ObjectionOutput | null>;
  readonly closing: (
    context: DialogueContext,
    objection: string,
    reply: string,
  ) => Promise<ClosingOutput | null>;
};

export type PartidaDeps = {
  /** Verifica el JWT de la sesión y devuelve el uid, o null si no es válido. */
  readonly verifyUser: (jwt: string) => Promise<string | null>;
  /** Ejecuta una función svc_* con service_role; lanza si la base de datos devuelve error. */
  readonly rpc: (fn: SvcFunction, args: Readonly<Record<string, unknown>>) => Promise<unknown>;
  readonly content: {
    readonly blockedTerms: BlockedTerms;
    readonly dilemmas: readonly Dilemma[];
    readonly fallbacks: Fallbacks;
    readonly counselors: readonly Counselor[];
    readonly concepts: readonly Concept[];
    readonly alertTerms: AlertTerms;
    readonly endings: readonly Ending[];
  };
  /** `null` si no hay proveedor de IA configurado: entonces todo sale de los respaldos. */
  readonly ai: AiDialogue | null;
  readonly allowedOrigins: readonly string[];
};

const CLASS_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

// ── join ──

async function join(uid: string, request: JoinRequest, deps: PartidaDeps): Promise<JoinResponse> {
  const code = request.classCode.replace(/[\s-]/g, '').toUpperCase();
  if (!CLASS_CODE.test(code)) return { ok: false, error: 'invalid_code' };

  const alias = cleanAlias(request.alias);
  const problem = aliasProblem(alias, deps.content.blockedTerms);
  if (problem !== null) {
    return { ok: false, error: problem === 'format' ? 'alias_format' : 'alias_blocked' };
  }

  const result = svcJoinResultSchema.parse(
    await deps.rpc('svc_join', { p_auth_uid: uid, p_code: code, p_alias: alias }),
  );
  return result.status === 'ok'
    ? {
        ok: true,
        alias: result.alias,
        classLabel: result.classLabel,
        resumed: result.resumed,
        rescueKey: result.rescueKey,
      }
    : { ok: false, error: result.status };
}

// ── recover ──

async function recover(
  uid: string,
  request: RecoverRequest,
  deps: PartidaDeps,
): Promise<RecoverResponse> {
  const code = request.classCode.replace(/[\s-]/g, '').toUpperCase();
  if (!CLASS_CODE.test(code)) return { ok: false, error: 'invalid_code' };
  const key = request.rescueKey?.trim();
  const result = svcRecoverResultSchema.parse(
    await deps.rpc('svc_recover', {
      p_auth_uid: uid,
      p_code: code,
      p_alias: cleanAlias(request.alias),
      p_key: key === undefined || key === '' ? null : key,
    }),
  );
  return result.status === 'ok'
    ? { ok: true, alias: result.alias, classLabel: result.classLabel }
    : { ok: false, error: result.status };
}

// ── acciones de juego ──

const success = (state: SvcState): GameResponse => ({
  ok: true,
  run: state.run,
  answer: state.answer,
});

const failure = (error: GameError, state: SvcState | null): GameResponse => ({
  ok: false,
  error,
  run: state?.run ?? null,
  answer: state?.answer ?? null,
});

async function write(deps: PartidaDeps, fn: SvcFunction, args: Record<string, unknown>) {
  const result = svcWriteResultSchema.parse(await deps.rpc(fn, args));
  return result.status === 'ok' ? success(result.state) : failure('stale', result.state);
}

/** Reserva una llamada a la IA: cuántas lleva el alumno en este dilema, o `null` si no quedan. */
async function takeAiCall(
  deps: PartidaDeps,
  playerId: string,
  dilemmaId: string,
): Promise<number | null> {
  const result = await deps.rpc('svc_ai_take', {
    p_player_id: playerId,
    p_dilemma: dilemmaId,
    p_max_calls: AI_MAX_CALLS_PER_DILEMMA,
  });
  return z.number().int().nullable().parse(result);
}

function flowContext(state: SvcState, deps: PartidaDeps): FlowContext {
  const ids = new Set(deps.content.dilemmas.map((d) => d.id));
  return {
    chapter1: state.chapter1,
    chapter2: state.chapter2,
    chapterUnlocked: state.chapterUnlocked,
    isAvailable: (id) => ids.has(id),
  };
}

async function play(uid: string, request: GameRequest, deps: PartidaDeps): Promise<GameResponse> {
  const loaded: unknown = await deps.rpc('svc_load', { p_auth_uid: uid });
  if (loaded === null) return failure('not_joined', null);
  const state = svcStateSchema.parse(loaded);
  if (state.status === 'expelled') return failure('expelled', null);

  const { run, answer, playerId } = state;
  const here = { phase: run.phase, dilemma: run.currentDilemma };

  if (request.action === 'advance') {
    const from = { phase: request.from.phase, dilemma: request.from.dilemmaId };
    if (!samePosition(here, from)) return failure('stale', state);
    const to = nextPosition(from, flowContext(state, deps));
    if (to === null) return failure(from.phase === 'waiting' ? 'locked' : 'invalid', state);
    return write(deps, 'svc_advance', {
      p_player_id: playerId,
      p_from_phase: from.phase,
      p_from_dilemma: from.dilemma,
      p_to_phase: to.phase,
      p_to_dilemma: to.dilemma,
      // El mundo ya no cambia después del último dilema: el final queda fijado aquí (§5.6).
      p_ending: to.phase === 'epilogue' ? computeEnding(run.world, deps.content.endings).id : null,
    });
  }

  // Reflexión final: sin IA; cierra la partida y genera el código de verificación del PDF.
  if (request.action === 'reflect') {
    if (run.phase !== 'reflection') return failure('stale', state);
    const text = cleanText(request.text);
    if (countWords(text) === 0) return failure('invalid', state);
    return write(deps, 'svc_reflect', {
      p_player_id: playerId,
      p_text: text,
      p_ending: computeEnding(run.world, deps.content.endings).id,
      p_alert: mentionsDistress(text, deps.content.alertTerms.contiene),
    });
  }

  // El resto de acciones actúa sobre el dilema en curso y en una fase concreta.
  const expectedPhase = {
    choose: 'decision',
    justify: 'justification',
    reply: 'objection',
  } as const;
  if (run.currentDilemma !== request.dilemmaId || run.phase !== expectedPhase[request.action]) {
    return failure('stale', state);
  }
  const dilemma = deps.content.dilemmas.find((d) => d.id === request.dilemmaId);
  if (dilemma === undefined) return failure('invalid', state);

  if (request.action === 'choose') {
    const option = dilemma.opciones.find((o) => o.id === request.choice);
    if (option === undefined) return failure('invalid', state);
    const world = applyDeltas(run.world, option.deltas);
    return write(deps, 'svc_choose', {
      p_player_id: playerId,
      p_dilemma: dilemma.id,
      p_choice: option.id,
      p_poder: world.poder,
      p_responsabilidad: world.responsabilidad,
      p_equidad: world.equidad,
      p_confianza: world.confianza,
      p_branch: option.rama,
    });
  }

  const text = cleanText(request.text);
  if (countWords(text) === 0) return failure('invalid', state);
  const option = dilemma.opciones.find((o) => o.id === answer?.choice);
  if (option === undefined) return failure('invalid', state);
  const fallback = deps.content.fallbacks[dilemma.id]?.[option.id]?.[option.objetor];
  if (fallback === undefined) return failure('invalid', state);

  // Indicios de malestar: aviso privado al docente aunque la IA falle (respaldo local).
  let alert = mentionsDistress(text, deps.content.alertTerms.contiene);
  const counselor = deps.content.counselors.find((c) => c.id === option.objetor);
  const context: DialogueContext | null =
    counselor === undefined
      ? null
      : { counselor, dilemma, option, concepts: deps.content.concepts };

  if (request.action === 'justify') {
    let objection = fallback.objecion.normal;
    let source: 'ia' | 'respaldo' = 'respaldo';
    let quality: ObjectionOutput['calidad'] | null = null;
    let concepts: string[] = [];
    if (deps.ai !== null && context !== null) {
      const calls = await takeAiCall(deps, playerId, dilemma.id);
      const output = calls === null ? null : await deps.ai.objection(context, text);
      if (output !== null) {
        // «Vacía»: un único reintento para que el alumno añada razones; el segundo envío se archiva.
        if (output.calidad === 'vacia' && calls === 1) {
          // La alerta no se pierde aunque el alumno reescriba el texto después.
          if (alert || output.alerta) {
            await deps.rpc('svc_alert', {
              p_player_id: playerId,
              p_dilemma: dilemma.id,
              p_text: text,
            });
          }
          return failure('needs_more', state);
        }
        objection = output.objecion;
        source = 'ia';
        quality = output.calidad;
        concepts = output.conceptos;
        alert ||= output.alerta;
      }
    }
    return write(deps, 'svc_justify', {
      p_player_id: playerId,
      p_dilemma: dilemma.id,
      p_text: text,
      p_objector: option.objetor,
      p_objection: objection,
      p_ai_source: source,
      p_quality: quality,
      p_concepts: concepts,
      p_alert: alert,
    });
  }

  let closing = fallback.cierre.normal;
  let concepts: string[] = [];
  if (deps.ai !== null && context !== null && answer?.objection != null) {
    const calls = await takeAiCall(deps, playerId, dilemma.id);
    const output = calls === null ? null : await deps.ai.closing(context, answer.objection, text);
    if (output !== null) {
      closing = output.reaccion;
      concepts = output.conceptos;
      alert ||= output.alerta;
    }
  }
  return write(deps, 'svc_reply', {
    p_player_id: playerId,
    p_dilemma: dilemma.id,
    p_text: text,
    p_closing: closing,
    p_concepts: concepts,
    p_alert: alert,
  });
}

// ── entrada HTTP ──

export async function handlePartida(request: Request, deps: PartidaDeps): Promise<Response> {
  const cors = corsHeaders(request, deps.allowedOrigins);

  if (isForbiddenOrigin(request, deps.allowedOrigins)) {
    return jsonResponse(403, { ok: false, error: 'forbidden_origin' }, cors);
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' }, cors);
  }

  try {
    const token = bearerToken(request);
    const uid = token === null ? null : await deps.verifyUser(token);
    if (uid === null) return jsonResponse(401, { ok: false, error: 'unauthenticated' }, cors);

    const body: unknown = await request.json().catch(() => null);
    const parsed = partidaRequestSchema.safeParse(body);
    if (!parsed.success) return jsonResponse(400, { ok: false, error: 'bad_request' }, cors);

    const data = parsed.data;
    const result =
      data.action === 'join'
        ? await join(uid, data, deps)
        : data.action === 'recover'
          ? await recover(uid, data, deps)
          : await play(uid, data, deps);
    return jsonResponse(200, result, cors);
  } catch (error) {
    console.error('partida: unexpected error', error instanceof Error ? error.message : error);
    return jsonResponse(500, { ok: false, error: 'server_error' }, cors);
  }
}
