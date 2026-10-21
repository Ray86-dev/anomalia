/**
 * Utilidades de los tests de integración: crean docentes, clases y alumnos con un sufijo
 * aleatorio y los registran para borrarlos al final (`cleanup`).
 */
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types.ts';

export type Db = SupabaseClient<Database>;

export const url = process.env.VITE_SUPABASE_URL ?? '';
export const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
const secretKey = process.env.SUPABASE_SECRET_KEY ?? '';
export const configured = url !== '' && publishableKey !== '' && secretKey !== '';

export const run = randomBytes(4).toString('hex');
const password = `Int-${randomBytes(12).toString('hex')}`;
const createdUsers: string[] = [];
const createdClasses: string[] = [];

export const newClient = (key = publishableKey): Db =>
  createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let adminClient: Db | null = null;
export function admin(): Db {
  adminClient ??= newClient(secretKey);
  return adminClient;
}

export async function createTeacher(name: string): Promise<Db> {
  const email = `it-${name}-${run}@anomalia.invalid`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error !== null) throw error;
  createdUsers.push(data.user.id);
  const insert = await admin()
    .from('teachers')
    .insert({ id: data.user.id, display_name: `Test ${name}` });
  if (insert.error !== null) throw insert.error;
  const client = newClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error !== null) throw signIn.error;
  return client;
}

export async function createClass(
  teacher: Db,
  label: string,
  chapters: { chapter1: string[]; chapter2: string[] } = {
    chapter1: ['d1', 'd2', 'd3'],
    chapter2: ['d4', 'd5'],
  },
): Promise<{ id: string; code: string }> {
  const { data, error } = await teacher.rpc('create_class', {
    p_label: label,
    p_chapter_1: chapters.chapter1,
    p_chapter_2: chapters.chapter2,
    p_retention_days: 1,
  });
  if (error !== null) throw error;
  const created = data as { id: string; code: string };
  createdClasses.push(created.id);
  return created;
}

export async function anonymousStudent(): Promise<Db> {
  const client = newClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error !== null) throw error;
  if (data.user !== null) createdUsers.push(data.user.id);
  return client;
}

/** Llama a la Edge Function `partida` y devuelve el cuerpo JSON. */
export async function partida(client: Db, body: Record<string, unknown>): Promise<unknown> {
  const response = await client.functions.invoke<unknown>('partida', { body });
  if (response.error !== null) throw new Error('partida request failed');
  return response.data;
}

export async function cleanup(): Promise<void> {
  if (createdClasses.length > 0) await admin().from('classes').delete().in('id', createdClasses);
  await Promise.all(createdUsers.map((id) => admin().auth.admin.deleteUser(id)));
}
