/**
 * Simula una clase jugando a la vez para probar el Centro de Control en directo (§13, M3).
 *   npm run simular                      25 alumnos en la clase PRUEBA
 *   npm run simular -- --clase ABC234 --alumnos 30 --ritmo 3
 *   npm run simular -- --reiniciar        borra a los simulados y empiezan desde el prólogo
 *   npm run simular -- --borrar           solo borra a los alumnos simulados y sale
 *   npm run simular -- --api              pasa por la Edge Function `partida` (gasta IA)
 *
 * Por defecto escribe con las mismas funciones SQL que usa `partida` (svc_*), con la clave
 * secreta y sin coste de IA: los textos son de relleno y la objeción, el respaldo
 * preescrito. Los alumnos son usuarios `sim-vivo-NN@anomalia.invalid` (contraseña
 * SIM_PASSWORD). Si llegan a «Esperando el capítulo II», desbloquéalo en la consola y
 * seguirán solos.
 */
import { parseArgs } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { aliasProblem } from '../shared/game/alias.ts';
import { nextPosition, type Position } from '../shared/game/flow.ts';
import type { Phase } from '../shared/game/phases.ts';
import { applyDeltas } from '../shared/game/world.ts';
import { blockedTerms, concepts, dilemmas, fallbacks } from '../shared/generated/content.ts';
import {
  gameResponseSchema,
  svcJoinResultSchema,
  svcStateSchema,
  svcWriteResultSchema,
  type SvcState,
} from '../shared/schemas/partida.ts';
import { myStateSchema } from '../shared/schemas/state.ts';
import type { Database } from '../src/lib/database.types.ts';
import { adminClient, check, requireEnv } from './lib/admin.ts';

type Db = SupabaseClient<Database>;
type Choice = 'A' | 'B' | 'C';

const SIM_DOMAIN = 'anomalia.invalid';
const MAX_STUDENTS = 30;
const ALIASES = [
  'Anaga',
  'Tamadaba',
  'Jandia',
  'Famara',
  'Tindaya',
  'Betancuria',
  'Tejeda',
  'Agaete',
  'Teror',
  'Firgas',
  'Tazacorte',
  'Garafia',
  'Tijarafe',
  'Fuencaliente',
  'Hermigua',
  'Valverde',
  'Sabinosa',
  'Haria',
  'Yaiza',
  'Tinajo',
  'Teguise',
  'Mancha_Blanca',
  'Puntallana',
  'Agulo',
  'Vallehermoso',
  'Chipude',
  'Masca',
  'Taganana',
  'Bandama',
  'Isora',
] as const;

const JUSTIFICATIONS = [
  'Elijo esta opción porque pienso que las consecuencias para otras personas importan más que el beneficio inmediato. Si nadie asume la responsabilidad de lo que puede pasar después, el conocimiento termina usándose contra quienes no pudieron opinar. Prefiero un camino más lento pero más justo.',
  'Creo que es lo más prudente. La verdad es importante, pero también lo es seguir vivo para poder defenderla y compartirla con los demás. Una decisión valiente que lo destruye todo no siempre ayuda a nadie, y por eso busco un equilibrio entre principios y consecuencias.',
  'Mi razón principal es la dignidad de las personas afectadas. No se puede tratar a nadie solo como un medio para avanzar, aunque el avance sea grande. Si la ciencia pierde la confianza de la gente, también pierde su sentido, así que hay que poner límites claros.',
  'Lo decido así porque el poder de una idea no debería depender de quién tiene autoridad, sino de las pruebas. Callar ahora haría que otros tengan miedo más adelante. Asumo el riesgo porque creo que la libertad de investigar beneficia a toda la sociedad.',
] as const;

const REPLIES = [
  'Entiendo la objeción, pero sigo pensando lo mismo: el riesgo existe en cualquier opción y al menos esta respeta a las personas implicadas. Cambiaría de idea si me demostraran que el daño sería mayor.',
  'Es verdad que mi postura tiene un coste, y no lo niego. Aun así, creo que es más fácil reparar un retraso que reparar la pérdida de confianza. Por eso mantengo mi decisión.',
  'Tienes parte de razón y quizá debería matizar mi respuesta. Seguiría con mi elección, pero pidiendo que más personas puedan opinar antes de aplicarla.',
] as const;

/** Tiempo medio de cada paso; escribir lleva más que pulsar «Continuar». */
const WRITING_FACTOR = 3;
const STATUS_EVERY_MS = 5_000;
/** El alumno ya no está en la clase (p. ej., se lanzó `--borrar` durante la simulación). */
const GONE = 'ya no está en la clase';

const PHASE_LABEL: Partial<Record<Phase, string>> = {
  prologue: 'prólogo',
  waiting: 'esperando cap. II',
  epilogue: 'epílogo',
};
const ENDED: readonly Phase[] = ['epilogue', 'reflection', 'dossier', 'done'];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('pick() on an empty list');
  return item;
};

/** Conceptos de la lista cerrada, sesgados hacia los primeros para que haya un «más invocado». */
function someConcepts(): string[] {
  const count = 1 + Math.floor(Math.random() * 3);
  const ids = Array.from({ length: count }, () => {
    const index = Math.floor(Math.random() ** 2 * concepts.length);
    return concepts[index]?.id;
  });
  return [...new Set(ids.filter((id) => id !== undefined))];
}

/** Preferencias de la clase por dilema: una opción favorita para que haya mayoría visible. */
const preferences = new Map<string, readonly number[]>();
function chooseFor(dilemmaId: string): Choice {
  let weights = preferences.get(dilemmaId);
  if (weights === undefined) {
    const favourite = Math.floor(Math.random() * 3);
    weights = [0, 1, 2].map((i) => (0.4 + Math.random()) * (i === favourite ? 2.2 : 1));
    preferences.set(dilemmaId, weights);
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [i, id] of (['A', 'B', 'C'] as const).entries()) {
    r -= weights[i] ?? 0;
    if (r <= 0) return id;
  }
  return 'C';
}

// ── Dos formas de jugar: directa (svc_* con la clave secreta) o por la Edge Function ──

type Driver = {
  join(): Promise<void>;
  position(): Promise<Position>;
  /** `false` si el capítulo II sigue bloqueado. */
  advance(from: Position): Promise<boolean>;
  choose(dilemmaId: string, choice: Choice): Promise<void>;
  justify(dilemmaId: string, text: string): Promise<void>;
  reply(dilemmaId: string, text: string): Promise<void>;
};

function directDriver(admin: Db, uid: string, code: string, alias: string): Driver {
  let state: SvcState | null = null;
  // Como en `partida`: los tipos generados no admiten los `null` que reciben las svc_*.
  const loose = admin.rpc.bind(admin) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    const { data, error } = await loose(fn, args);
    if (error !== null) throw new Error(`${fn}: ${error.message}`);
    return data;
  };
  const write = async (fn: string, args: Record<string, unknown>) => {
    const result = await rpc(fn, args);
    // Un jugador borrado no tiene estado: las svc_* devuelven `state: null`.
    if (z.object({ state: z.null() }).safeParse(result).success) throw new Error(GONE);
    state = svcWriteResultSchema.parse(result).state;
  };
  const current = (): SvcState => {
    if (state === null) throw new Error('Estado sin cargar');
    return state;
  };
  const optionOf = (dilemmaId: string) => {
    const dilemma = dilemmas.find((d) => d.id === dilemmaId);
    const option = dilemma?.opciones.find((o) => o.id === current().answer?.choice);
    if (option === undefined) throw new Error(`Sin opción elegida en ${dilemmaId}`);
    return option;
  };

  return {
    async join() {
      const result = svcJoinResultSchema.parse(
        await rpc('svc_join', { p_auth_uid: uid, p_code: code, p_alias: alias }),
      );
      if (result.status !== 'ok') throw new Error(result.status);
    },
    async position() {
      const loaded = await rpc('svc_load', { p_auth_uid: uid });
      if (loaded === null) throw new Error(GONE);
      state = svcStateSchema.parse(loaded);
      return { phase: state.run.phase, dilemma: state.run.currentDilemma };
    },
    async advance(from) {
      const s = current();
      const ids = new Set(dilemmas.map((d) => d.id));
      const to = nextPosition(from, {
        chapter1: s.chapter1,
        chapter2: s.chapter2,
        chapterUnlocked: s.chapterUnlocked,
        isAvailable: (id) => ids.has(id),
      });
      if (to === null) return false;
      await write('svc_advance', {
        p_player_id: s.playerId,
        p_from_phase: from.phase,
        p_from_dilemma: from.dilemma,
        p_to_phase: to.phase,
        p_to_dilemma: to.dilemma,
      });
      return true;
    },
    async choose(dilemmaId, choice) {
      const s = current();
      const option = dilemmas
        .find((d) => d.id === dilemmaId)
        ?.opciones.find((o) => o.id === choice);
      if (option === undefined) throw new Error(`Opción ${choice} inexistente en ${dilemmaId}`);
      const world = applyDeltas(s.run.world, option.deltas);
      await write('svc_choose', {
        p_player_id: s.playerId,
        p_dilemma: dilemmaId,
        p_choice: choice,
        p_poder: world.poder,
        p_responsabilidad: world.responsabilidad,
        p_equidad: world.equidad,
        p_confianza: world.confianza,
        p_branch: option.rama,
      });
    },
    async justify(dilemmaId, text) {
      const option = optionOf(dilemmaId);
      const fallback = fallbacks[dilemmaId]?.[option.id]?.[option.objetor];
      await write('svc_justify', {
        p_player_id: current().playerId,
        p_dilemma: dilemmaId,
        p_text: text,
        p_objector: option.objetor,
        p_objection: fallback?.objecion.normal ?? '',
        p_ai_source: 'respaldo',
        p_quality: Math.random() < 0.7 ? 'basica' : 'solida',
        p_concepts: someConcepts(),
        p_alert: false,
      });
    },
    async reply(dilemmaId, text) {
      const option = optionOf(dilemmaId);
      const fallback = fallbacks[dilemmaId]?.[option.id]?.[option.objetor];
      await write('svc_reply', {
        p_player_id: current().playerId,
        p_dilemma: dilemmaId,
        p_text: text,
        p_closing: fallback?.cierre.normal ?? '',
        p_concepts: someConcepts(),
        p_alert: false,
      });
    },
  };
}

function apiDriver(client: Db, code: string, alias: string): Driver {
  const call = async (body: Record<string, unknown>) => {
    const response = await client.functions.invoke<unknown>('partida', { body });
    if (response.error !== null) throw new Error(`partida/${String(body.action)}: error HTTP`);
    return response.data;
  };
  const game = async (body: Record<string, unknown>) => gameResponseSchema.parse(await call(body));

  return {
    async join() {
      const result = (await call({ action: 'join', classCode: code, alias })) as {
        ok: boolean;
        error?: string;
      };
      if (!result.ok) throw new Error(result.error ?? 'join');
    },
    async position() {
      const { data, error } = await client.rpc('my_state');
      if (error !== null) throw new Error(`my_state: ${error.message}`);
      const state = myStateSchema.parse(data);
      if (state === null) throw new Error(GONE);
      return { phase: state.run.phase, dilemma: state.run.currentDilemma };
    },
    async advance(from) {
      const result = await game({
        action: 'advance',
        from: { phase: from.phase, dilemmaId: from.dilemma },
      });
      return result.ok || result.error !== 'locked';
    },
    async choose(dilemmaId, choice) {
      await game({ action: 'choose', dilemmaId, choice });
    },
    async justify(dilemmaId, text) {
      const result = await game({ action: 'justify', dilemmaId, text });
      // «Necesita más»: se reenvía una vez con otro texto, como haría un alumno.
      if (!result.ok && result.error === 'needs_more') {
        await game({ action: 'justify', dilemmaId, text: `${text} ${pick(JUSTIFICATIONS)}` });
      }
    },
    async reply(dilemmaId, text) {
      await game({ action: 'reply', dilemmaId, text });
    },
  };
}

// ── Un alumno simulado ──

type Student = { readonly alias: string; position: Position | null; failed: string | null };

async function play(student: Student, driver: Driver, pace: number, startDelay: number) {
  const wait = (factor = 1) => pause(pace * factor * (0.4 + Math.random() * 1.2));
  await pause(startDelay);
  await driver.join();
  for (;;) {
    const here = await driver.position();
    student.position = here;
    if (ENDED.includes(here.phase)) return;
    const dilemma = here.dilemma;

    if (here.phase === 'decision' && dilemma !== null) {
      await wait(WRITING_FACTOR / 2);
      await driver.choose(dilemma, chooseFor(dilemma));
    } else if (here.phase === 'justification' && dilemma !== null) {
      await wait(WRITING_FACTOR);
      await driver.justify(dilemma, `[Simulación] ${pick(JUSTIFICATIONS)}`);
    } else if (here.phase === 'objection' && dilemma !== null) {
      await wait(WRITING_FACTOR);
      await driver.reply(dilemma, `[Simulación] ${pick(REPLIES)}`);
    } else {
      await wait();
      // Capítulo II bloqueado: se vuelve a intentar hasta que el docente lo abra.
      if (!(await driver.advance(here))) await wait(2);
    }
  }
}

// ── Preparación ──

async function simulatedUsers(admin: Db, count: number, password: string) {
  const emails = Array.from(
    { length: count },
    (_, i) => `sim-vivo-${String(i + 1).padStart(2, '0')}@${SIM_DOMAIN}`,
  );
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { users } = await check('listUsers', admin.auth.admin.listUsers({ page, perPage: 200 }));
    for (const user of users) {
      if (user.email !== undefined) existing.set(user.email.toLowerCase(), user.id);
    }
    if (users.length < 200) break;
  }
  const users: { email: string; uid: string }[] = [];
  for (const email of emails) {
    let uid = existing.get(email);
    if (uid === undefined) {
      const created = await check(
        'createUser',
        admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { simulated: true },
        }),
      );
      uid = created.user.id;
    } else {
      await check('updateUser', admin.auth.admin.updateUserById(uid, { password }));
    }
    users.push({ email, uid });
  }
  return users;
}

async function removePlayers(admin: Db, uids: readonly string[]): Promise<number> {
  const deleted = await check(
    'delete players',
    admin.from('players').delete().in('auth_uid', uids).select('id'),
  );
  return deleted.length;
}

function printStatus(students: readonly Student[]) {
  const counts = new Map<string, number>();
  for (const s of students) {
    const p = s.position;
    const key =
      s.failed !== null
        ? 'error'
        : p === null
          ? 'sin entrar'
          : (PHASE_LABEL[p.phase] ?? `${p.dilemma ?? '?'}·${p.phase}`);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const time = new Date().toLocaleTimeString('es-ES');
  const parts = [...counts.entries()].sort().map(([k, n]) => `${k} ${String(n)}`);
  console.log(`${time}  ${parts.join(' · ')}`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      clase: { type: 'string', default: 'PRUEBA' },
      alumnos: { type: 'string', default: '25' },
      ritmo: { type: 'string', default: '5' },
      espera: { type: 'string', default: '300' },
      api: { type: 'boolean', default: false },
      reiniciar: { type: 'boolean', default: false },
      borrar: { type: 'boolean', default: false },
    },
  });
  const code = values.clase.toUpperCase();
  const count = Math.min(MAX_STUDENTS, Math.max(1, Number.parseInt(values.alumnos, 10) || 25));
  const pace = Math.max(0.5, Number.parseFloat(values.ritmo) || 5) * 1000;
  const idleLimit = Math.max(0, Number.parseFloat(values.espera) || 0) * 1000;

  const admin = adminClient();
  const password = requireEnv('SIM_PASSWORD');
  const users = await simulatedUsers(admin, MAX_STUDENTS, password);
  const uids = users.map((u) => u.uid);

  if (values.borrar || values.reiniciar) {
    const removed = await removePlayers(admin, uids);
    console.log(`Borrados ${String(removed)} alumnos simulados.`);
    if (values.borrar) return;
  }

  const classes = await check(
    'class',
    admin.from('classes').select('id, label').eq('code', code).limit(1),
  );
  const schoolClass = classes[0];
  if (schoolClass === undefined) throw new Error(`No existe la clase ${code}`);

  const students: Student[] = [];
  const runs: Promise<void>[] = [];
  const publishableKey = values.api ? requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY') : '';
  for (const [i, user] of users.slice(0, count).entries()) {
    const alias = ALIASES[i] ?? `Sim${String(i)}`;
    if (aliasProblem(alias, blockedTerms) !== null) throw new Error(`Alias no válido: ${alias}`);
    const student: Student = { alias, position: null, failed: null };
    students.push(student);

    let driver: Driver;
    if (values.api) {
      const client = createClient<Database>(requireEnv('VITE_SUPABASE_URL'), publishableKey, {
        auth: { persistSession: false, autoRefreshToken: true },
      });
      await check('signIn', client.auth.signInWithPassword({ email: user.email, password }));
      driver = apiDriver(client, code, alias);
    } else {
      driver = directDriver(admin, user.uid, code, alias);
    }
    // Las entradas se escalonan durante los primeros segundos, como en un aula real.
    runs.push(
      play(student, driver, pace, Math.random() * pace * 3).catch((error: unknown) => {
        student.failed =
          error instanceof z.ZodError
            ? 'respuesta inesperada del servidor'
            : error instanceof Error
              ? error.message
              : String(error);
        // Si borran a toda la clase simulada, basta con el resumen final.
        if (student.failed !== GONE) console.error(`✖ ${alias}: ${student.failed}`);
      }),
    );
  }

  console.log(
    `▶ ${String(count)} alumnos simulados en «${schoolClass.label}» (${code}) · ritmo ${String(pace / 1000)} s` +
      (values.api ? ' · vía Edge Function (gasta IA)' : ' · sin IA'),
  );
  console.log(`  Centro: /centro?clase=${schoolClass.id}`);

  let idleSince: number | null = null;
  let warned = false;
  const finished = Promise.all(runs);
  const progress = { done: false };
  void finished.then(() => {
    progress.done = true;
  });
  while (!progress.done) {
    await Promise.race([pause(STATUS_EVERY_MS), finished]);
    printStatus(students);
    const busy = students.some(
      (s) =>
        s.failed === null &&
        s.position?.phase !== 'waiting' &&
        !ENDED.includes(s.position?.phase ?? 'prologue'),
    );
    if (busy) {
      idleSince = null;
      continue;
    }
    const waiting = students.filter(
      (s) => s.failed === null && s.position?.phase === 'waiting',
    ).length;
    if (waiting === 0) break;
    idleSince ??= Date.now();
    if (!warned) {
      console.log(
        `  ${String(waiting)} esperan el capítulo II: desbloquéalo en la consola para que sigan.`,
      );
      warned = true;
    }
    if (Date.now() - idleSince >= idleLimit) {
      console.log(`  Fin de la espera (${String(idleLimit / 1000)} s).`);
      break;
    }
  }
  printStatus(students);
  const gone = students.filter((s) => s.failed === GONE).length;
  if (gone > 0) {
    console.log(
      `✖ Alumnos simulados que desaparecieron durante la simulación (¿--borrar?): ${String(gone)}.`,
    );
  }
  const failed = students.every((s) => s.failed !== null);
  if (!failed) {
    console.log('✔ Simulación terminada. Para borrar a los alumnos: npm run simular -- --borrar');
  }
  process.exit(failed ? 1 : 0);
}

await main();
