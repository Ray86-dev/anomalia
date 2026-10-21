import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import { clientEnv } from './env.ts';

export type Db = SupabaseClient<Database>;

/**
 * Dos clientes con sesiones independientes (D-11): probar el juego como alumno y la
 * consola como docente en el mismo navegador no cierra ninguna de las dos sesiones.
 */
export type Role = 'student' | 'teacher';

const STORAGE_KEYS: Readonly<Record<Role, string>> = {
  student: 'anomalia-alumno',
  teacher: 'anomalia-docente',
};

const clients = new Map<Role, Db>();

export function getClient(role: Role): Db {
  const existing = clients.get(role);
  if (existing) return existing;
  if (clientEnv === null) throw new Error('Supabase is not configured (see .env.example)');
  const client = createClient<Database>(clientEnv.supabaseUrl, clientEnv.publishableKey, {
    auth: {
      storageKey: STORAGE_KEYS[role],
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  clients.set(role, client);
  return client;
}
