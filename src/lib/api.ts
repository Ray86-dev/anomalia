import {
  gameResponseSchema,
  joinResponseSchema,
  type GameRequest,
  type GameResponse,
  type JoinResponse,
} from '@shared/schemas/partida.ts';
import { myStateSchema, type MyState } from '@shared/schemas/state.ts';
import { getClient } from './supabase.ts';

/** Fallo de red o de protocolo: la interfaz muestra un aviso y permite reintentar. */
export class NetworkError extends Error {
  override name = 'NetworkError';
}

const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [700, 2000];

async function invokePartida(body: Record<string, unknown>): Promise<unknown> {
  const response = await getClient('student').functions.invoke<unknown>('partida', {
    body,
    timeout: REQUEST_TIMEOUT_MS,
  });
  if (response.error !== null) throw new NetworkError('partida request failed');
  return response.data;
}

/** Une la sesión anónima actual a una clase (Edge Function `partida`). */
export async function joinClass(classCode: string, alias: string): Promise<JoinResponse> {
  const parsed = joinResponseSchema.safeParse(
    await invokePartida({ action: 'join', classCode, alias }),
  );
  if (!parsed.success) throw new NetworkError('Unexpected response from partida');
  return parsed.data;
}

/**
 * Acción de juego con reintentos ante fallos de red (wifi del aula). Es seguro reintentar:
 * el servidor rechaza con `stale` lo que ya se aplicó y devuelve el estado real.
 */
export async function playAction(request: GameRequest): Promise<GameResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      const parsed = gameResponseSchema.safeParse(await invokePartida(request));
      if (!parsed.success) throw new NetworkError('Unexpected response from partida');
      return parsed.data;
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** Partida y clase del alumno; `null` si la sesión aún no se ha unido a ninguna clase. */
export async function loadMyState(): Promise<MyState | null> {
  const { data, error } = await getClient('student').rpc('my_state');
  if (error !== null) throw new NetworkError(error.message);
  const parsed = myStateSchema.safeParse(data);
  if (!parsed.success) throw new NetworkError('Unexpected response from my_state');
  return parsed.data;
}
