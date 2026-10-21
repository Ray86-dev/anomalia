/** Cliente con la clave secreta para scripts locales (lee .env.local). Nunca en el front. */
import { existsSync } from 'node:fs';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types.ts';

export function loadLocalEnv(): void {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Falta ${name} en .env.local (ver .env.example)`);
  }
  return value;
}

export function adminClient(): SupabaseClient<Database> {
  loadLocalEnv();
  return createClient<Database>(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('SUPABASE_SECRET_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Busca un usuario de Auth por correo recorriendo las páginas de la API de administración. */
export async function findUserByEmail(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<User | null> {
  const target = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error !== null) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found !== undefined) return found;
    if (data.users.length < 200) return null;
  }
}
