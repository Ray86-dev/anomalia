/**
 * Lógica de la Edge Function `partida`, separada del runtime para testearla con Vitest.
 * Todas las escrituras del alumnado pasan por aquí (D-05): se valida cada transición con
 * shared/game y se escribe con funciones SQL atómicas. Nunca se registra en logs texto
 * escrito por el alumnado.
 */
import { aliasProblem, cleanAlias, type BlockedTerms } from '../../../shared/game/alias.ts';
import { nextPosition, samePosition, type FlowContext } from '../../../shared/game/flow.ts';
import { applyDeltas } from '../../../shared/game/world.ts';
import { cleanText, countWords } from '../../../shared/game/words.ts';
import type { Dilemma, Fallbacks } from '../../../shared/schemas/content.ts';
import {
  partidaRequestSchema,
  svcJoinResultSchema,
  svcStateSchema,
  svcWriteResultSchema,
  type GameError,
  type GameRequest,
  type GameResponse,
  type JoinRequest,
  type JoinResponse,
  type SvcState,
} from '../../../shared/schemas/partida.ts';
import { bearerToken, corsHeaders, isForbiddenOrigin, jsonResponse } from '../_shared/http.ts';

export type SvcFunction =
  'svc_join' | 'svc_load' | 'svc_advance' | 'svc_choose' | 'svc_justify' | 'svc_reply';

export type PartidaDeps = {
  /** Verifica el JWT de la sesión y devuelve el uid, o null si no es válido. */
  readonly verifyUser: (jwt: string) => Promise<string | null>;
  /** Ejecuta una función svc_* con service_role; lanza si la base de datos devuelve error. */
  readonly rpc: (fn: SvcFunction, args: Readonly<Record<string, unknown>>) => Promise<unknown>;
  readonly content: {
    readonly blockedTerms: BlockedTerms;
    readonly dilemmas: readonly Dilemma[];
    readonly fallbacks: Fallbacks;
  };
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
    ? { ok: true, alias: result.alias, classLabel: result.classLabel, resumed: result.resumed }
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

  if (request.action === 'justify') {
    // M1: objeción preescrita. En M2 la genera la IA (con este mismo respaldo si falla).
    return write(deps, 'svc_justify', {
      p_player_id: playerId,
      p_dilemma: dilemma.id,
      p_text: text,
      p_objector: option.objetor,
      p_objection: fallback.objecion.normal,
      p_ai_source: 'respaldo',
    });
  }
  return write(deps, 'svc_reply', {
    p_player_id: playerId,
    p_dilemma: dilemma.id,
    p_text: text,
    p_closing: fallback.cierre.normal,
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
      data.action === 'join' ? await join(uid, data, deps) : await play(uid, data, deps);
    return jsonResponse(200, result, cors);
  } catch (error) {
    console.error('partida: unexpected error', error instanceof Error ? error.message : error);
    return jsonResponse(500, { ok: false, error: 'server_error' }, cors);
  }
}
