/**
 * Final de la partida contra el proyecto real: epílogo con su final, reflexión final con
 * código de verificación, datos del expediente y verificación del docente (M4).
 * La partida se coloca al final de D1 con la clave secreta para no gastar llamadas de IA.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { myDossierSchema } from '../../shared/schemas/state.ts';
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

const REFLECTION =
  'La ciencia puede explicar qué pasará si elegimos una opción, pero no decide por nosotros qué debemos hacer. Cuando aconsejé a Galileo abjurar pensé en las consecuencias, como Kaltz.';
const DISTRESS = 'No sé qué escribir, últimamente me quiero morir.';

let teacher: Db;
let otherTeacher: Db;
let student: Db;
let classId: string;
let code: string;

/** Une un alumno a la clase y deja su partida en la fase indicada, con D1 ya contestado. */
async function studentAt(classCode: string, alias: string, phase: 'archive' | 'reflection') {
  const client = await anonymousStudent();
  expect(await partida(client, { action: 'join', classCode, alias })).toMatchObject({ ok: true });
  const { data: player, error } = await admin()
    .from('players')
    .select('id')
    .eq('class_id', classId)
    .eq('alias', alias)
    .single();
  if (error !== null) throw error;
  const now = new Date().toISOString();
  const answer = await admin()
    .from('answers')
    .insert({
      player_id: player.id,
      dilemma_id: 'd1',
      choice: 'A',
      first_choice: 'B',
      reply_stance: 'matiza',
      moves: ['da-razones', 'mira-consecuencias'],
      justification: 'Prefiero que siga vivo para que pueda seguir investigando.',
      objector: 'kaltz',
      objection: 'Objeción de prueba.',
      reply: 'Réplica de prueba.',
      closing: 'Cierre de prueba.',
      justified_at: now,
      replied_at: now,
      closed_at: now,
    });
  if (answer.error !== null) throw answer.error;
  // Desnivel 30 y equidad 30: «Tecnocracia genómica».
  const update = await admin()
    .from('runs')
    .update({
      phase,
      current_dilemma: phase === 'archive' ? 'd1' : null,
      poder: 80,
      responsabilidad: 50,
      equidad: 30,
      confianza: 50,
    })
    .eq('player_id', player.id);
  if (update.error !== null) throw update.error;
  return client;
}

describe.skipIf(!configured)('expediente · reflexión final y verificación (integración)', () => {
  beforeAll(async () => {
    teacher = await createTeacher('expediente');
    otherTeacher = await createTeacher('ajeno');
    const schoolClass = await createClass(teacher, `Expediente ${run}`, {
      chapter1: ['d1'],
      chapter2: [],
    });
    classId = schoolClass.id;
    student = await studentAt(schoolClass.code, 'Cronista2', 'archive');
  });

  afterAll(cleanup);

  const advance = (phase: string, dilemmaId: string | null) =>
    partida(student, { action: 'advance', from: { phase, dilemmaId } });

  it('al entrar en el epílogo queda fijado el final', async () => {
    expect(await advance('archive', 'd1')).toMatchObject({
      ok: true,
      run: { phase: 'epilogue', ending: 'tecnocracia' },
    });
  });

  it('el expediente está disponible desde el epílogo, aún sin código', async () => {
    const { data } = await student.rpc('my_dossier');
    expect(myDossierSchema.parse(data)).toMatchObject({
      alias: 'Cronista2',
      verifyCode: null,
      ending: 'tecnocracia',
      reflection: null,
      emblem: null,
      answers: [
        {
          dilemmaId: 'd1',
          choice: 'A',
          firstChoice: 'B',
          replyStance: 'matiza',
          objector: 'kaltz',
        },
      ],
      progress: {
        classDilemmas: ['d1'],
        choices: { d1: 'A' },
        moves: ['da-razones', 'mira-consecuencias'],
        stances: ['matiza'],
        changed: 1,
        kept: 0,
        closed: 1,
        finished: false,
      },
    });
  });

  it('el emblema solo admite piezas desbloqueadas y no avisa al Centro', async () => {
    expect(
      await partida(student, { action: 'emblem', symbol: 'corona', color: 'turquesa' }),
    ).toMatchObject({ ok: false, error: 'invalid' });
    expect(
      await partida(student, { action: 'emblem', symbol: 'reloj', color: 'ambar' }),
    ).toMatchObject({ ok: true, run: { emblem: 'reloj:ambar', phase: 'epilogue' } });
  });

  it('la reflexión final cierra la partida con un código de verificación', async () => {
    expect(await advance('epilogue', null)).toMatchObject({ run: { phase: 'reflection' } });
    expect(await partida(student, { action: 'reflect', text: REFLECTION })).toMatchObject({
      ok: true,
      run: { phase: 'dossier' },
    });
    const dossier = myDossierSchema.parse((await student.rpc('my_dossier')).data);
    expect(dossier?.reflection).toBe(REFLECTION);
    expect(dossier?.finishedAt).not.toBeNull();
    expect(dossier?.emblem).toBe('reloj:ambar');
    expect(dossier?.progress.finished).toBe(true);
    expect(dossier?.verifyCode).toMatch(/^ANM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    code = dossier?.verifyCode ?? '';
  });

  it('la reflexión no se puede reescribir', async () => {
    expect(await partida(student, { action: 'reflect', text: 'Otra versión' })).toMatchObject({
      ok: false,
      error: 'stale',
    });
  });

  it('el docente verifica el código, escrito de cualquier forma, y lee los textos', async () => {
    for (const typed of [code, code.toLowerCase(), code.replaceAll('-', ' '), code.slice(4)]) {
      const { data } = await teacher.rpc('verify_run', { p_code: typed });
      expect(data).toMatchObject({
        alias: 'Cronista2',
        verifyCode: code,
        ending: 'tecnocracia',
        reflection: REFLECTION,
        answers: [{ dilemmaId: 'd1', choice: 'A' }],
      });
    }
    expect((await teacher.rpc('verify_run', { p_code: 'ANM-AAAA-AAAA' })).data).toBeNull();
  });

  it('ni otro docente ni el propio alumno pueden usar la verificación', async () => {
    expect((await otherTeacher.rpc('verify_run', { p_code: code })).data).toBeNull();
    expect((await student.rpc('verify_run', { p_code: code })).data).toBeNull();
  });

  it('una reflexión con indicios de malestar llega al docente como alerta privada', async () => {
    const { data: schoolClass } = await teacher
      .from('classes')
      .select('code')
      .eq('id', classId)
      .single();
    const worried = await studentAt(schoolClass?.code ?? '', 'Cronista3', 'reflection');
    expect(await partida(worried, { action: 'reflect', text: DISTRESS })).toMatchObject({
      ok: true,
    });
    const { data } = await teacher.rpc('class_console', { p_class_id: classId });
    expect(data).toMatchObject({
      alerts: [{ alias: 'Cronista3', dilemmaId: null, text: DISTRESS }],
    });
  });
});
