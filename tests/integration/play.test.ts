/**
 * Partida completa de D1 contra el proyecto real: cada acción pasa por `partida`, que valida
 * la fase, aplica los deltas en el servidor y escribe de forma atómica.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fallbacks } from '../../shared/generated/content.ts';
import { gameResponseSchema } from '../../shared/schemas/partida.ts';
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

let student: Db;
let classId: string;

const advance = (phase: string, dilemmaId: string | null) =>
  partida(student, { action: 'advance', from: { phase, dilemmaId } });

describe.skipIf(!configured)('partida · D1 completo (integración)', () => {
  beforeAll(async () => {
    const teacher = await createTeacher('juego');
    const schoolClass = await createClass(teacher, `Juego ${run}`);
    classId = schoolClass.id;
    student = await anonymousStudent();
    expect(
      await partida(student, { action: 'join', classCode: schoolClass.code, alias: 'Cronista1' }),
    ).toMatchObject({
      ok: true,
    });
  });

  afterAll(cleanup);

  it('recorre viaje, escena, laboratorio y consejo hasta la decisión', async () => {
    expect(await advance('prologue', null)).toMatchObject({
      ok: true,
      run: { phase: 'travel', currentDilemma: 'd1' },
    });
    expect(await advance('travel', 'd1')).toMatchObject({ run: { phase: 'scene' } });
    expect(await advance('scene', 'd1')).toMatchObject({ run: { phase: 'lab' } });
    // Salir del laboratorio lo deja registrado en el progreso (logro «Ojo de laboratorio»).
    expect(await advance('lab', 'd1')).toMatchObject({
      run: {
        phase: 'council',
        progress: { labs: ['d1'], classDilemmas: ['d1', 'd2', 'd3', 'd4', 'd5'] },
      },
    });
    expect(await advance('council', 'd1')).toMatchObject({ run: { phase: 'decision' } });
  });

  it('un doble toque no avanza dos veces (stale) y la decisión no se salta', async () => {
    expect(await advance('council', 'd1')).toMatchObject({
      ok: false,
      error: 'stale',
      run: { phase: 'decision' },
    });
    expect(await advance('decision', 'd1')).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('elegir pasa al giro sin tocar el mundo ni crear la respuesta', async () => {
    const result = await partida(student, { action: 'choose', dilemmaId: 'd1', choice: 'A' });
    expect(result).toMatchObject({
      ok: true,
      run: {
        phase: 'twist',
        pendingChoice: 'A',
        world: { poder: 50, responsabilidad: 50, equidad: 50, confianza: 50 },
        branches: [],
      },
      answer: null,
    });
  });

  it('tras el giro aplica los deltas de la decisión definitiva una sola vez', async () => {
    // Cambia de A a D1 · B: CONFIANZA +10, PODER +5, rama alternativa
    const result = await partida(student, { action: 'confirm', dilemmaId: 'd1', choice: 'B' });
    expect(result).toMatchObject({
      ok: true,
      run: {
        phase: 'justification',
        pendingChoice: null,
        world: { poder: 55, responsabilidad: 50, equidad: 50, confianza: 60 },
        branches: ['d1-firme'],
        progress: { choices: { d1: 'B' }, changed: 1, kept: 0 },
      },
      answer: { dilemmaId: 'd1', choice: 'B', firstChoice: 'A', justification: null },
    });
    // Doble toque: no vuelve a aplicar los deltas.
    const again = await partida(student, { action: 'confirm', dilemmaId: 'd1', choice: 'B' });
    expect(again).toMatchObject({
      ok: false,
      error: 'stale',
      run: { world: { poder: 55, confianza: 60 } },
    });
  });

  it('la justificación devuelve la objeción del consejero que más se opone (IA o respaldo)', async () => {
    const started = Date.now();
    const result = gameResponseSchema.parse(
      await partida(student, {
        action: 'justify',
        dilemmaId: 'd1',
        text: 'Creo que la verdad merece defenderse aunque cueste, porque si se niega una vez se puede negar siempre.',
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      run: { phase: 'objection' },
      answer: { objector: 'novak' },
    });
    const answer = result.answer;
    console.info(`objeción: ${answer?.aiSource ?? '?'} en ${Date.now() - started} ms`);
    if (answer?.aiSource === 'respaldo') {
      expect(answer.objection).toBe(fallbacks.d1?.B?.novak?.objecion.normal);
    } else {
      expect(answer?.objection?.length).toBeGreaterThan(20);
    }
    // §7.2: el juego nunca espera a la IA más de 6 s (más el viaje de red)
    expect(Date.now() - started).toBeLessThan(9000);
  });

  it('la réplica guarda la postura y el cierre y pasa a las ondas temporales', async () => {
    const result = await partida(student, {
      action: 'reply',
      dilemmaId: 'd1',
      text: 'Un mártir no hace experimentos, pero sin confianza en la verdad la ciencia tampoco avanza.',
      stance: 'concede',
    });
    expect(result).toMatchObject({
      ok: true,
      run: { phase: 'ripples', progress: { stances: ['concede'], closed: 1 } },
      answer: { replyStance: 'concede' },
    });
    const closing = gameResponseSchema.parse(result).answer?.closing;
    expect(closing?.length).toBeGreaterThan(5);
  });

  it('my_state permite reanudar con la respuesta del dilema en curso', async () => {
    const { data } = await student.rpc('my_state');
    expect(data).toMatchObject({
      run: { phase: 'ripples', currentDilemma: 'd1' },
      answer: { choice: 'B', objector: 'novak' },
    });
  });

  it('tras el Archivo real de D1 viaja a D2', async () => {
    expect(await advance('ripples', 'd1')).toMatchObject({ run: { phase: 'archive' } });
    expect(await advance('archive', 'd1')).toMatchObject({
      run: { phase: 'travel', currentDilemma: 'd2' },
    });
  });

  it('al cerrar el capítulo I espera al II mientras esté bloqueado', async () => {
    // Se salta D2 con la clave secreta (sin gastar IA): la partida queda al final de D3.
    const { data: player } = await admin()
      .from('players')
      .select('id')
      .eq('alias', 'Cronista1')
      .eq('class_id', classId)
      .single();
    if (player === null) throw new Error('Cronista1 no existe');
    await admin()
      .from('runs')
      .update({ phase: 'archive', current_dilemma: 'd3' })
      .eq('player_id', player.id);
    expect(await advance('archive', 'd3')).toMatchObject({
      run: { phase: 'waiting', currentDilemma: null },
    });
    expect(await advance('waiting', null)).toMatchObject({ ok: false, error: 'locked' });
  });

  it('el alumno no puede reescribir su partida directamente', async () => {
    const update = await student
      .from('answers')
      .update({ choice: 'A' })
      .eq('dilemma_id', 'd1')
      .select('choice');
    expect(update.error !== null || update.data.length === 0).toBe(true);
  });
});
