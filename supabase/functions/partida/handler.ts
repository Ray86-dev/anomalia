/**
 * Lógica de la Edge Function `partida`, separada del runtime para testearla con Vitest.
 * Todas las escrituras del alumnado pasan por aquí (D-05). Nunca se registra en logs
 * texto escrito por el alumnado.
 */
import { aliasProblem, cleanAlias, type BlockedTerms } from '../../../shared/game/alias.ts';
import {
  partidaRequestSchema,
  svcJoinResultSchema,
  type JoinRequest,
  type JoinResponse,
} from '../../../shared/schemas/partida.ts';
import { bearerToken, corsHeaders, isForbiddenOrigin, jsonResponse } from '../_shared/http.ts';

export type SvcFunction = 'svc_join';

export type PartidaDeps = {
  /** Verifica el JWT de la sesión y devuelve el uid, o null si no es válido. */
  readonly verifyUser: (jwt: string) => Promise<string | null>;
  /** Ejecuta una función svc_* con service_role; lanza si la base de datos devuelve error. */
  readonly rpc: (fn: SvcFunction, args: Readonly<Record<string, unknown>>) => Promise<unknown>;
  readonly blockedTerms: BlockedTerms;
  readonly allowedOrigins: readonly string[];
};

const CLASS_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

async function join(uid: string, request: JoinRequest, deps: PartidaDeps): Promise<JoinResponse> {
  const code = request.classCode.replace(/[\s-]/g, '').toUpperCase();
  if (!CLASS_CODE.test(code)) return { ok: false, error: 'invalid_code' };

  const alias = cleanAlias(request.alias);
  const problem = aliasProblem(alias, deps.blockedTerms);
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

    // M0 solo tiene `join`; las demás acciones (M1+) se despacharán aquí por `action`.
    return jsonResponse(200, await join(uid, parsed.data, deps), cors);
  } catch (error) {
    console.error('partida: unexpected error', error instanceof Error ? error.message : error);
    return jsonResponse(500, { ok: false, error: 'server_error' }, cors);
  }
}
