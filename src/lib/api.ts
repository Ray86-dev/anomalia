import { joinResponseSchema, type JoinResponse } from '@shared/schemas/partida.ts';
import { myStateSchema, type MyState } from '@shared/schemas/state.ts';
import { getClient } from './supabase.ts';

/** Fallo de red o de protocolo: la interfaz muestra un aviso genérico y permite reintentar. */
export class NetworkError extends Error {
  override name = 'NetworkError';
}

const REQUEST_TIMEOUT_MS = 10_000;

/** Une la sesión anónima actual a una clase (Edge Function `partida`). */
export async function joinClass(classCode: string, alias: string): Promise<JoinResponse> {
  const response = await getClient('student').functions.invoke<unknown>('partida', {
    body: { action: 'join', classCode, alias },
    timeout: REQUEST_TIMEOUT_MS,
  });
  if (response.error !== null) throw new NetworkError('partida request failed');
  const parsed = joinResponseSchema.safeParse(response.data);
  if (!parsed.success) throw new NetworkError('Unexpected response from partida');
  return parsed.data;
}

/** Partida y clase del alumno; `null` si la sesión aún no se ha unido a ninguna clase. */
export async function loadMyState(): Promise<MyState | null> {
  const { data, error } = await getClient('student').rpc('my_state');
  if (error !== null) throw new NetworkError(error.message);
  const parsed = myStateSchema.safeParse(data);
  if (!parsed.success) throw new NetworkError('Unexpected response from my_state');
  return parsed.data;
}
