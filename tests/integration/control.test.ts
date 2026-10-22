/**
 * M3 contra el proyecto real: snapshots del Centro con k = 5 y publicación por lotes,
 * aviso por Realtime solo al docente, recuperación de partidas y funciones de la consola.
 */
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INTRO_PATH } from '../../shared/game/flow.ts';
import {
  admin,
  anonymousStudent,
  cleanup,
  configured,
  createClass,
  createTeacher,
  partida,
  run,
  type Db,
} from './helpers.ts';

type Snapshot = {
  live: { players: number; connected: number; dilemmas: Record<string, { here: number | null }> };
  results: {
    decisions: Record<string, { n: number | null; A?: number; B?: number; C?: number }>;
    world: { n: number; desnivel: number } | null;
  };
  pendingAnswers: number;
};

let teacher: Db;
let otherTeacher: Db;
let schoolClass: { id: string; code: string };
const students: Db[] = [];

async function snapshot(force = false, as: Db = teacher) {
  return as.rpc('class_snapshot', { p_class_id: schoolClass.id, p_force: force });
}

async function toDecision(student: Db) {
  await partida(student, { action: 'advance', from: { phase: 'prologue', dilemmaId: null } });
  for (const phase of INTRO_PATH) {
    await partida(student, { action: 'advance', from: { phase, dilemmaId: 'd1' } });
  }
}

/** Decisión completa: elección provisional y confirmación tras el giro (M6). */
async function choose(student: Db, choice: 'A' | 'B' | 'C') {
  await partida(student, { action: 'choose', dilemmaId: 'd1', choice });
  return partida(student, { action: 'confirm', dilemmaId: 'd1', choice });
}

describe.skipIf(!configured)('Centro de Control y consola (integración)', () => {
  beforeAll(async () => {
    teacher = await createTeacher('centro');
    otherTeacher = await createTeacher('ajeno');
    schoolClass = await createClass(teacher, `Centro ${run}`, {
      chapter1: ['d1'],
      chapter2: ['d4'],
    });
    for (let i = 0; i < 6; i++) {
      const student = await anonymousStudent();
      expect(
        await partida(student, {
          action: 'join',
          classCode: schoolClass.code,
          alias: `Cron${String(i)}`,
        }),
      ).toMatchObject({ ok: true });
      students.push(student);
    }
    await Promise.all(students.map(toDecision));
  });

  afterAll(cleanup);

  describe('snapshots con k = 5', () => {
    it('solo el docente de la clase puede pedir el snapshot', async () => {
      expect((await snapshot(false, students[0])).error).not.toBeNull();
      expect((await snapshot(false, otherTeacher)).error).not.toBeNull();
      const { data, error } = await snapshot();
      expect(error).toBeNull();
      expect((data as Snapshot).live.players).toBe(6);
    });

    it('con menos de 5 decisiones no se publica ninguna distribución', async () => {
      const choices = ['A', 'B', 'A', 'C'] as const;
      for (const [i, choice] of choices.entries()) {
        const student = students[i];
        if (student) await choose(student, choice);
      }
      const data = (await snapshot()).data as Snapshot;
      expect(data.results.decisions.d1).toBeUndefined();
      expect(data.results.world).toBeNull();
      expect(data.pendingAnswers).toBe(4);
    });

    it('una elección provisional (aún en el giro) no cuenta como decisión', async () => {
      const fifth = students[4];
      if (fifth) await partida(fifth, { action: 'choose', dilemmaId: 'd1', choice: 'B' });
      const data = (await snapshot()).data as Snapshot;
      expect(data.results.decisions.d1).toBeUndefined();
      expect(data.pendingAnswers).toBe(4);
      expect(data.live.dilemmas.d1?.here).toBe(6);
    });

    it('al llegar a 5 decisiones nuevas se publica el lote', async () => {
      const fifth = students[4];
      if (fifth) await choose(fifth, 'B');
      const data = (await snapshot()).data as Snapshot;
      expect(data.results.decisions.d1).toEqual({ n: 5, A: 2, B: 2, C: 1 });
      expect(data.results.world?.n).toBe(5);
      expect(data.pendingAnswers).toBe(0);
    });

    it('una sola decisión nueva no cambia lo publicado (no delata a nadie) salvo al revelar', async () => {
      const sixth = students[5];
      if (sixth) await choose(sixth, 'C');
      const quiet = (await snapshot()).data as Snapshot;
      expect(quiet.results.decisions.d1?.n).toBe(5);
      expect(quiet.pendingAnswers).toBe(1);
      const revealed = (await snapshot(true)).data as Snapshot;
      expect(revealed.results.decisions.d1).toEqual({ n: 6, A: 2, B: 2, C: 2 });
    });

    it('el progreso en directo enmascara los grupos de menos de 5', async () => {
      const data = (await snapshot()).data as Snapshot;
      expect(data.live.dilemmas.d1?.here).toBe(6);
      const smallClass = await createClass(teacher, `Pequeña ${run}`, {
        chapter1: ['d1'],
        chapter2: [],
      });
      const lonely = await anonymousStudent();
      await partida(lonely, { action: 'join', classCode: smallClass.code, alias: 'Solo1' });
      await toDecision(lonely);
      const small = (
        await teacher.rpc('class_snapshot', { p_class_id: smallClass.id, p_force: true })
      ).data as Snapshot;
      expect(small.live.dilemmas.d1?.here).toBeNull(); // «<5»
    });
  });

  describe('Realtime', () => {
    it('avisa al docente de la clase por su canal privado, sin datos de nadie', async () => {
      await teacher.realtime.setAuth();
      const received: unknown[] = [];
      const channel = teacher.channel(`class:${schoolClass.id}`, { config: { private: true } });
      await new Promise<void>((resolve, reject) => {
        channel
          .on('broadcast', { event: 'changed' }, (message) => received.push(message.payload))
          .subscribe((status) => {
            if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) resolve();
            if (
              status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
              status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
            ) {
              reject(new Error(status));
            }
          });
      });
      // Un cambio seguro: alguien nuevo se une a la clase.
      const newcomer = await anonymousStudent();
      await partida(newcomer, { action: 'join', classCode: schoolClass.code, alias: 'Recien' });
      for (let i = 0; i < 20 && received.length === 0; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      await teacher.removeChannel(channel);
      expect(received.length).toBeGreaterThan(0);
      expect(JSON.stringify(received)).not.toMatch(/Recien|Cron|alias/i);
    });
  });

  describe('recuperación de partidas', () => {
    let rescueKey = '';

    it('al unirse, el alumno recibe su clave de rescate (y el docente no puede leerla)', async () => {
      const student = await anonymousStudent();
      const joined = (await partida(student, {
        action: 'join',
        classCode: schoolClass.code,
        alias: 'Marea',
      })) as { rescueKey: string };
      rescueKey = joined.rescueKey;
      expect(rescueKey).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      const { data } = await student.rpc('my_state');
      expect(data).toMatchObject({ player: { alias: 'Marea', rescueKey } });
      const peek = await teacher.from('players').select('rescue_key');
      expect(peek.error).not.toBeNull();
    });

    it('con la clave correcta, otro móvil recupera la partida al instante', async () => {
      const newPhone = await anonymousStudent();
      const result = await partida(newPhone, {
        action: 'recover',
        classCode: schoolClass.code,
        alias: 'marea',
        rescueKey: `${rescueKey.slice(0, 3)}-${rescueKey.slice(3).toLowerCase()}`,
      });
      expect(result).toEqual({ ok: true, alias: 'Marea', classLabel: `Centro ${run}` });
      expect((await newPhone.rpc('my_state')).data).toMatchObject({ player: { alias: 'Marea' } });
    });

    it('sin clave (o con una incorrecta), la solicitud llega a la consola y el docente la aprueba', async () => {
      const thirdPhone = await anonymousStudent();
      expect(
        await partida(thirdPhone, {
          action: 'recover',
          classCode: schoolClass.code,
          alias: 'Marea',
          rescueKey: 'ZZZZZZ',
        }),
      ).toEqual({ ok: false, error: 'wrong_key' });
      expect((await thirdPhone.rpc('my_recovery')).data).toMatchObject({
        alias: 'Marea',
        status: 'pending',
      });

      const consoleData = (await teacher.rpc('class_console', { p_class_id: schoolClass.id }))
        .data as {
        requests: { id: string; alias: string }[];
      };
      const request = consoleData.requests.find((r) => r.alias === 'Marea');
      expect(request).toBeDefined();
      expect(
        (
          await students[1]?.rpc('resolve_recovery', {
            p_request_id: request?.id ?? '',
            p_approve: true,
          })
        )?.data,
      ).toMatchObject({ status: 'not_found' });

      const resolved = await teacher.rpc('resolve_recovery', {
        p_request_id: request?.id ?? '',
        p_approve: true,
      });
      expect(resolved.data).toEqual({ status: 'approved' });
      expect((await thirdPhone.rpc('my_state')).data).toMatchObject({ player: { alias: 'Marea' } });
    });
  });

  describe('consola', () => {
    it('desbloquea el capítulo II (solo el docente de la clase)', async () => {
      const student = students[2];
      if (student === undefined) throw new Error('falta alumno');
      expect(
        (await student.rpc('unlock_chapter', { p_class_id: schoolClass.id, p_chapter: 2 })).error,
      ).not.toBeNull();
      expect(
        (await teacher.rpc('unlock_chapter', { p_class_id: schoolClass.id, p_chapter: 2 })).error,
      ).toBeNull();
      expect((await student.rpc('my_state')).data).toMatchObject({ class: { chapterUnlocked: 2 } });
    });

    it('las alertas llegan con el texto solo al docente de la clase', async () => {
      const student = students[3];
      if (student === undefined) throw new Error('falta alumno');
      await partida(student, {
        action: 'justify',
        dilemmaId: 'd1',
        text: 'Da igual lo que elija, a veces me quiero morir y no se lo cuento a nadie.',
      });
      const own = (await teacher.rpc('class_console', { p_class_id: schoolClass.id })).data as {
        alerts: { alias: string; text: string | null; justification: string | null }[];
      };
      // Aunque la IA pida reescribir (justificación sin razones), la alerta llega con su texto.
      expect(
        own.alerts.some(
          (a) => a.alias === 'Cron3' && (a.text ?? a.justification ?? '').includes('morir'),
        ),
      ).toBe(true);
      expect(
        (await otherTeacher.rpc('class_console', { p_class_id: schoolClass.id })).data,
      ).toBeNull();
      expect((await student.rpc('class_console', { p_class_id: schoolClass.id })).data).toBeNull();
    });

    it('borrar la clase elimina sus datos y las sesiones anónimas del alumnado', async () => {
      const doomed = await createClass(teacher, `Borrar ${run}`, {
        chapter1: ['d1'],
        chapter2: [],
      });
      const student = await anonymousStudent();
      await partida(student, { action: 'join', classCode: doomed.code, alias: 'Efimero' });
      const { data: session } = await student.auth.getUser();
      expect(
        (await otherTeacher.rpc('delete_class', { p_class_id: doomed.id })).error,
      ).not.toBeNull();
      expect((await teacher.rpc('delete_class', { p_class_id: doomed.id })).error).toBeNull();
      const left = await admin().from('classes').select('id').eq('id', doomed.id);
      expect(left.data).toEqual([]);
      const user = await admin().auth.admin.getUserById(session.user?.id ?? '');
      expect(user.data.user).toBeNull();
    });
  });
});
