/**
 * Matriz de permisos (RLS) y Edge Function `partida` contra el proyecto real de Supabase.
 * Crea sus propios docentes, clases y alumnos con un sufijo aleatorio y los borra al final.
 *   npm run test:integration
 */
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/lib/database.types.ts';

type Db = SupabaseClient<Database>;

const url = process.env.VITE_SUPABASE_URL ?? '';
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
const secretKey = process.env.SUPABASE_SECRET_KEY ?? '';
const configured = url !== '' && publishableKey !== '' && secretKey !== '';

const run = randomBytes(4).toString('hex');
const password = `Rls-${randomBytes(12).toString('hex')}`;
const createdUsers: string[] = [];
const createdClasses: string[] = [];

const newClient = (key = publishableKey): Db =>
  createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let admin: Db;
let anon: Db;
let teacherA: Db;
let teacherB: Db;
let s1: Db; // alumno de la clase A («Kepler»)
let s2: Db; // alumno de la clase A («Hipatia»), con una respuesta y una alerta
let s3: Db; // alumno de la clase B («Orion»)
let s4: Db; // sesión anónima que nunca llega a unirse
let classA: { id: string; code: string };
let classB: { id: string; code: string };

async function createTeacher(name: string): Promise<Db> {
  const email = `rls-${name}-${run}@anomalia.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error !== null) throw error;
  createdUsers.push(data.user.id);
  const insert = await admin
    .from('teachers')
    .insert({ id: data.user.id, display_name: `RLS ${name}` });
  if (insert.error !== null) throw insert.error;
  const client = newClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error !== null) throw signIn.error;
  return client;
}

async function createClass(teacher: Db, label: string) {
  const { data, error } = await teacher.rpc('create_class', {
    p_label: label,
    p_chapter_1: ['d1', 'd2', 'd3'],
    p_chapter_2: ['d4', 'd5'],
    p_retention_days: 1,
  });
  if (error !== null) throw error;
  const created = data as { id: string; code: string };
  createdClasses.push(created.id);
  return created;
}

async function anonymousStudent(): Promise<Db> {
  const client = newClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error !== null) throw error;
  if (data.user !== null) createdUsers.push(data.user.id);
  return client;
}

async function join(client: Db, classCode: string, alias: string): Promise<unknown> {
  const response = await client.functions.invoke<unknown>('partida', {
    body: { action: 'join', classCode, alias },
  });
  if (response.error !== null) throw new Error('partida request failed');
  return response.data;
}

describe.skipIf(!configured)('RLS y partida (integración)', () => {
  beforeAll(async () => {
    admin = newClient(secretKey);
    anon = newClient();
    teacherA = await createTeacher('a');
    teacherB = await createTeacher('b');
    classA = await createClass(teacherA, `RLS A ${run}`);
    classB = await createClass(teacherB, `RLS B ${run}`);

    [s1, s2, s3, s4] = await Promise.all([
      anonymousStudent(),
      anonymousStudent(),
      anonymousStudent(),
      anonymousStudent(),
    ]);
    expect(await join(s1, classA.code, 'Kepler')).toMatchObject({ ok: true, resumed: false });
    expect(await join(s2, classA.code, 'Hipatia')).toMatchObject({ ok: true });
    expect(await join(s3, classB.code, 'Orion')).toMatchObject({ ok: true });

    // Una respuesta y una alerta de s2, escritas como lo haría el servidor.
    const { data: hipatia } = await admin
      .from('players')
      .select('id')
      .eq('class_id', classA.id)
      .eq('alias', 'Hipatia')
      .single();
    if (hipatia === null) throw new Error('Hipatia no existe');
    const { data: answer, error } = await admin
      .from('answers')
      .insert({
        player_id: hipatia.id,
        dilemma_id: 'd1',
        choice: 'B',
        justification: 'Texto de prueba',
      })
      .select('id')
      .single();
    if (error !== null) throw error;
    const alert = await admin.from('alerts').insert({ answer_id: answer.id, class_id: classA.id });
    if (alert.error !== null) throw alert.error;
  });

  afterAll(async () => {
    if (createdClasses.length > 0) await admin.from('classes').delete().in('id', createdClasses);
    await Promise.all(createdUsers.map((id) => admin.auth.admin.deleteUser(id)));
  });

  describe('sin sesión (anon)', () => {
    it('no lee ninguna tabla', async () => {
      for (const table of [
        'teachers',
        'classes',
        'players',
        'runs',
        'answers',
        'alerts',
        'recovery_requests',
      ] as const) {
        const { data } = await anon.from(table).select('*');
        expect(data ?? [], table).toEqual([]);
      }
    });

    it('solo puede llamar a ping()', async () => {
      expect((await anon.rpc('ping')).data).toBe('pong');
      expect((await anon.rpc('my_state')).error).not.toBeNull();
    });

    it('la Edge Function exige sesión', async () => {
      const res = await fetch(`${url}/functions/v1/partida`, {
        method: 'POST',
        headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', classCode: classA.code, alias: 'Intruso' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('alumnado', () => {
    it('ve solo su jugador y su partida', async () => {
      const players = await s1.from('players').select('alias');
      expect(players.data).toEqual([{ alias: 'Kepler' }]);
      const runs = await s1.from('runs').select('phase');
      expect(runs.data).toEqual([{ phase: 'prologue' }]);
    });

    it('no ve las respuestas de otros', async () => {
      expect((await s1.from('answers').select('id')).data).toEqual([]);
      expect((await s2.from('answers').select('choice')).data).toEqual([{ choice: 'B' }]);
    });

    it('no ve clases, docentes, alertas ni solicitudes de recuperación', async () => {
      expect((await s2.from('classes').select('id')).data).toEqual([]);
      expect((await s2.from('teachers').select('id')).data).toEqual([]);
      expect((await s2.from('alerts').select('id')).data).toEqual([]); // ni siquiera la suya
      expect((await s2.from('recovery_requests').select('id')).data ?? []).toEqual([]);
    });

    it('no puede escribir en ninguna tabla directamente', async () => {
      const insert = await s4
        .from('players')
        .insert({ class_id: classA.id, alias: 'Colado', auth_uid: null });
      expect(insert.error).not.toBeNull();
      const update = await s1.from('runs').update({ poder: 100 }).select('poder');
      expect(update.error !== null || update.data.length === 0).toBe(true);
      const del = await s1.from('players').delete().select('id');
      expect(del.error !== null || del.data.length === 0).toBe(true);
      const answer = await s1
        .from('answers')
        .insert({ player_id: classA.id, dilemma_id: 'd1', choice: 'A' });
      expect(answer.error).not.toBeNull();
    });

    it('no puede usar funciones de docente ni svc_*', async () => {
      const create = await s1.rpc('create_class', {
        p_label: 'X',
        p_chapter_1: ['d1'],
        p_chapter_2: [],
      });
      expect(create.error).not.toBeNull();
      expect((await s1.rpc('class_roster', { p_class_id: classA.id })).data).toEqual([]);
      const svc = await s1.rpc('svc_join', {
        p_auth_uid: classA.id,
        p_code: classA.code,
        p_alias: 'Hack',
      });
      expect(svc.error).not.toBeNull();
    });

    it('my_state devuelve su partida y su clase', async () => {
      const { data } = await s1.rpc('my_state');
      expect(data).toMatchObject({
        player: { alias: 'Kepler', status: 'active' },
        class: { label: `RLS A ${run}`, chapterUnlocked: 1 },
        run: {
          phase: 'prologue',
          world: { poder: 50, responsabilidad: 50, equidad: 50, confianza: 50 },
        },
      });
      expect((await s4.rpc('my_state')).data).toBeNull();
    });
  });

  describe('partida · join', () => {
    it('rechaza alias repetidos sin distinguir mayúsculas', async () => {
      expect(await join(s4, classA.code, 'kePLer')).toEqual({ ok: false, error: 'alias_taken' });
    });

    it('rechaza códigos inexistentes y alias bloqueados', async () => {
      expect(await join(s4, 'ZZZZZZ', 'Valido')).toEqual({ ok: false, error: 'invalid_code' });
      expect(await join(s4, classA.code, 'Culo99')).toEqual({ ok: false, error: 'alias_blocked' });
    });

    it('es idempotente y no permite cambiar de clase', async () => {
      expect(await join(s1, classA.code, 'Kepler')).toMatchObject({ ok: true, resumed: true });
      expect(await join(s1, classB.code, 'Kepler')).toEqual({
        ok: false,
        error: 'already_in_other_class',
      });
    });

    it('no permite que una cuenta docente se una como alumno', async () => {
      expect(await join(teacherA, classA.code, 'Profe')).toEqual({
        ok: false,
        error: 'is_teacher',
      });
    });
  });

  describe('docentes', () => {
    it('ven solo sus clases y su alumnado', async () => {
      expect((await teacherA.from('classes').select('id')).data).toEqual([{ id: classA.id }]);
      const players = await teacherA.from('players').select('alias').order('alias');
      expect(players.data).toEqual([{ alias: 'Hipatia' }, { alias: 'Kepler' }]);
      const roster = await teacherA.rpc('class_roster', { p_class_id: classA.id });
      expect(roster.data?.map((r) => r.alias)).toEqual(['Hipatia', 'Kepler']);
      expect((await teacherA.rpc('class_roster', { p_class_id: classB.id })).data).toEqual([]);
    });

    it('no leen partidas ni respuestas directamente', async () => {
      expect((await teacherA.from('runs').select('player_id')).data).toEqual([]);
      expect((await teacherA.from('answers').select('id')).data).toEqual([]);
    });

    it('pueden renombrar a su alumnado, pero no reasignar sesiones ni tocar otras clases', async () => {
      const rename = await teacherA
        .from('players')
        .update({ alias: 'Kepler2' })
        .eq('alias', 'Kepler')
        .select('alias');
      expect(rename.data).toEqual([{ alias: 'Kepler2' }]);
      await teacherA.from('players').update({ alias: 'Kepler' }).eq('alias', 'Kepler2');

      const hijack = await teacherA
        .from('players')
        .update({ auth_uid: null })
        .eq('alias', 'Kepler');
      expect(hijack.error).not.toBeNull();
      const move = await teacherA
        .from('players')
        .update({ class_id: classB.id })
        .eq('alias', 'Kepler');
      expect(move.error).not.toBeNull();
      const other = await teacherA
        .from('players')
        .update({ alias: 'Pirata' })
        .eq('alias', 'Orion')
        .select('id');
      expect(other.data).toEqual([]);
    });

    it('ven y marcan como vistas solo las alertas de sus clases', async () => {
      const alerts = await teacherA.from('alerts').select('id');
      expect(alerts.data).toHaveLength(1);
      expect((await teacherB.from('alerts').select('id')).data).toEqual([]);
      const seen = await teacherA
        .from('alerts')
        .update({ seen_at: new Date().toISOString() })
        .select('seen_at');
      expect(seen.data?.[0]?.seen_at).toBeTruthy();
    });

    it('no pueden modificar clases directamente (solo por RPC)', async () => {
      const update = await teacherA
        .from('classes')
        .update({ ai_calls_used: 0 })
        .eq('id', classA.id)
        .select('id');
      expect(update.error !== null || update.data.length === 0).toBe(true);
    });

    it('create_class valida los capítulos y la retención', async () => {
      const empty = await teacherA.rpc('create_class', {
        p_label: 'Mal',
        p_chapter_1: [],
        p_chapter_2: [],
      });
      expect(empty.error).not.toBeNull();
      const dup = await teacherA.rpc('create_class', {
        p_label: 'Mal',
        p_chapter_1: ['d1'],
        p_chapter_2: ['d1'],
      });
      expect(dup.error).not.toBeNull();
      const days = await teacherA.rpc('create_class', {
        p_label: 'Mal',
        p_chapter_1: ['d1'],
        p_chapter_2: [],
        p_retention_days: 365,
      });
      expect(days.error).not.toBeNull();
    });
  });
});
