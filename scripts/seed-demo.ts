/**
 * Recrea la clase simulada «PRUEBA» con 30 alumnos en distintas fases (datos ficticios).
 *   npm run seed:demo
 * Necesita en .env.local: VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, SIM_PASSWORD y
 * DEMO_TEACHER_PASSWORD. Es idempotente: borra y vuelve a crear la clase y sus usuarios.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { REPLY_STANCES } from '../shared/game/milestones.ts';
import { applyDeltas, INITIAL_WORLD } from '../shared/game/world.ts';
import { classModes, concepts, dilemmas, fallbacks, rewards } from '../shared/generated/content.ts';
import type { Database } from '../src/lib/database.types.ts';
import { adminClient, check, findUserByEmail, requireEnv } from './lib/admin.ts';

const CLASS_CODE = 'PRUEBA';
const DEMO_TEACHER = 'docente.demo@anomalia.invalid';
const SIM_DOMAIN = 'anomalia.invalid';
const ALIASES = [
  'Kepler7',
  'Hipatia',
  'Nebulosa',
  'Orion',
  'Lince_azul',
  'Marea',
  'Teide3718',
  'Ada_L',
  'Tesla99',
  'Caldera',
  'Perseida',
  'Quark',
  'Alisio',
  'Drago',
  'Halley',
  'Vega',
  'Roque_Nublo',
  'Fermi',
  'Lovelace',
  'Magma',
  'Cometa',
  'Pulsar',
  'Garajonay',
  'Euclides',
  'Noether',
  'Cassini',
  'Timanfaya',
  'Brisa',
  'Neutrino',
  'Faro_Orchilla',
] as const;

type Admin = SupabaseClient<Database>;

/** PRNG determinista (mulberry32): la misma semilla produce siempre la misma clase. */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = prng(2077);
const pick = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick() on an empty list');
  return item;
};

async function ensureUser(admin: Admin, email: string, password: string): Promise<string> {
  const existing = await findUserByEmail(admin, email);
  if (existing !== null) {
    await check('updateUser', admin.auth.admin.updateUserById(existing.id, { password }));
    return existing.id;
  }
  const created = await check(
    'createUser',
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { simulated: true },
    }),
  );
  return created.user.id;
}

async function main() {
  const admin = adminClient();
  const simPassword = requireEnv('SIM_PASSWORD');
  const teacherPassword = requireEnv('DEMO_TEACHER_PASSWORD');
  const mode = classModes[0];
  const d1 = dilemmas.find((d) => d.id === 'd1');
  if (mode === undefined || d1 === undefined) throw new Error('Falta contenido (modos o D1)');

  // 1. Docente de demostración y clase limpia
  const teacherId = await ensureUser(admin, DEMO_TEACHER, teacherPassword);
  await check(
    'teacher',
    admin.from('teachers').upsert({ id: teacherId, display_name: 'Docente de demostración' }),
  );
  await check('delete class', admin.from('classes').delete().eq('code', CLASS_CODE));
  const [schoolClass] = await check(
    'insert class',
    admin
      .from('classes')
      .insert({
        teacher_id: teacherId,
        label: 'Clase simulada',
        code: CLASS_CODE,
        chapter_1: mode.capitulo1,
        chapter_2: mode.capitulo2,
        expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .select('id'),
  );
  if (schoolClass === undefined) throw new Error('No se creó la clase');

  // 2. Treinta alumnos repartidos por las fases de D1
  const stages = [
    'prologue',
    'travel',
    'lab',
    'council',
    'decision',
    'twist',
    'justification',
    'archive',
  ] as const;
  for (const [i, alias] of ALIASES.entries()) {
    const email = `sim-${String(i + 1).padStart(2, '0')}@${SIM_DOMAIN}`;
    const authUid = await ensureUser(admin, email, simPassword);
    const stage = stages[i % stages.length] ?? 'prologue';
    const lastSeen = new Date(Date.now() - Math.floor(random() * 10 * 60_000)).toISOString();

    const [player] = await check(
      `player ${alias}`,
      admin
        .from('players')
        .insert({ auth_uid: authUid, class_id: schoolClass.id, alias, last_seen_at: lastSeen })
        .select('id'),
    );
    if (player === undefined) throw new Error(`No se creó ${alias}`);
    await check(`run ${alias}`, admin.from('runs').insert({ player_id: player.id }));
    if (stage === 'prologue') continue;

    const answered = stage === 'justification' || stage === 'archive';
    const option = pick(d1.opciones);
    // Tras el giro, uno de cada cuatro cambia de opción (la provisional es otra).
    const firstChoice =
      random() < 0.25 ? pick(d1.opciones.filter((o) => o !== option)).id : option.id;
    const world = answered ? applyDeltas(INITIAL_WORLD, option.deltas) : INITIAL_WORLD;
    await check(
      `run state ${alias}`,
      admin
        .from('runs')
        .update({
          phase: stage,
          current_dilemma: 'd1',
          pending_choice: stage === 'twist' ? firstChoice : null,
          labs: stages.indexOf(stage) > stages.indexOf('lab') ? ['d1'] : [],
          ...world,
        })
        .eq('player_id', player.id),
    );
    if (!answered) continue;

    const fallback = fallbacks.d1?.[option.id]?.[option.objetor];
    const complete = stage === 'archive';
    await check(
      `answer ${alias}`,
      admin.from('answers').insert({
        player_id: player.id,
        dilemma_id: 'd1',
        choice: option.id,
        first_choice: firstChoice,
        justification: `[Simulado] Justificación de ${alias} para la opción ${option.id}.`,
        moves: [pick(rewards.movimientos).id],
        ...(complete
          ? {
              objector: option.objetor,
              objection: fallback?.objecion.normal ?? null,
              reply: `[Simulado] Réplica de ${alias}.`,
              reply_stance: pick(REPLY_STANCES),
              closing: fallback?.cierre.normal ?? null,
              concepts: [pick(concepts).id, pick(concepts).id].filter(
                (c, j, all) => all.indexOf(c) === j,
              ),
              quality: pick(['basica', 'solida'] as const),
              ai_source: 'respaldo',
              justified_at: lastSeen,
              replied_at: lastSeen,
              closed_at: lastSeen,
            }
          : {}),
      }),
    );
  }

  console.log(`✔ Clase «${CLASS_CODE}» con ${ALIASES.length} alumnos simulados.`);
  console.log(`  Consola: ${DEMO_TEACHER} (contraseña: DEMO_TEACHER_PASSWORD de .env.local)`);
}

await main();
