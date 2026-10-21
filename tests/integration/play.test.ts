/**
 * Partida completa de D1 contra el proyecto real: cada acción pasa por `partida`, que valida
 * la fase, aplica los deltas en el servidor y escribe de forma atómica.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fallbacks } from '../../shared/generated/content.ts';
import {
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

const advance = (phase: string, dilemmaId: string | null) =>
  partida(student, { action: 'advance', from: { phase, dilemmaId } });

describe.skipIf(!configured)('partida · D1 completo (integración)', () => {
  beforeAll(async () => {
    const teacher = await createTeacher('juego');
    const schoolClass = await createClass(teacher, `Juego ${run}`);
    student = await anonymousStudent();
    expect(
      await partida(student, { action: 'join', classCode: schoolClass.code, alias: 'Cronista1' }),
    ).toMatchObject({
      ok: true,
    });
  });

  afterAll(cleanup);

  it('recorre viaje, escena y consejo hasta la decisión', async () => {
    expect(await advance('prologue', null)).toMatchObject({
      ok: true,
      run: { phase: 'travel', currentDilemma: 'd1' },
    });
    expect(await advance('travel', 'd1')).toMatchObject({ run: { phase: 'scene' } });
    expect(await advance('scene', 'd1')).toMatchObject({ run: { phase: 'council' } });
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

  it('la decisión aplica los deltas en el servidor y registra la rama', async () => {
    // D1 · B: CONFIANZA +10, PODER +5, rama alternativa
    const result = await partida(student, { action: 'choose', dilemmaId: 'd1', choice: 'B' });
    expect(result).toMatchObject({
      ok: true,
      run: {
        phase: 'justification',
        world: { poder: 55, responsabilidad: 50, equidad: 50, confianza: 60 },
        branches: ['d1-firme'],
      },
      answer: { dilemmaId: 'd1', choice: 'B', justification: null },
    });
    const again = await partida(student, { action: 'choose', dilemmaId: 'd1', choice: 'A' });
    expect(again).toMatchObject({ ok: false, error: 'stale', answer: { choice: 'B' } });
  });

  it('la justificación devuelve la objeción del consejero que más se opone (respaldo)', async () => {
    const result = await partida(student, {
      action: 'justify',
      dilemmaId: 'd1',
      text: 'Creo que la verdad merece defenderse aunque cueste, porque si se niega una vez se puede negar siempre.',
    });
    expect(result).toMatchObject({
      ok: true,
      run: { phase: 'objection' },
      answer: { objector: 'novak', objection: fallbacks.d1?.B?.novak?.objecion.normal },
    });
  });

  it('la réplica guarda el cierre y pasa a las ondas temporales', async () => {
    const result = await partida(student, {
      action: 'reply',
      dilemmaId: 'd1',
      text: 'Un mártir no hace experimentos, pero sin confianza en la verdad la ciencia tampoco avanza.',
    });
    expect(result).toMatchObject({
      ok: true,
      run: { phase: 'ripples' },
      answer: { closing: fallbacks.d1?.B?.novak?.cierre.normal },
    });
  });

  it('my_state permite reanudar con la respuesta del dilema en curso', async () => {
    const { data } = await student.rpc('my_state');
    expect(data).toMatchObject({
      run: { phase: 'ripples', currentDilemma: 'd1' },
      answer: { choice: 'B', objector: 'novak' },
    });
  });

  it('tras el Archivo real espera al capítulo II mientras esté bloqueado', async () => {
    expect(await advance('ripples', 'd1')).toMatchObject({ run: { phase: 'archive' } });
    // En el contenido actual solo existe D1: el capítulo I termina aquí.
    expect(await advance('archive', 'd1')).toMatchObject({
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
