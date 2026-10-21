import { describe, expect, it } from 'vitest';
import { nextPosition, type FlowContext, type Position } from './flow.ts';

const twoSessions = (overrides: Partial<FlowContext> = {}): FlowContext => ({
  chapter1: ['d1', 'd2', 'd3'],
  chapter2: ['d4', 'd5'],
  chapterUnlocked: 1,
  isAvailable: () => true,
  ...overrides,
});

const at = (phase: Position['phase'], dilemma: string | null = null): Position => ({
  phase,
  dilemma,
});

describe('nextPosition', () => {
  it('del prólogo viaja al primer dilema del capítulo I', () => {
    expect(nextPosition(at('prologue'), twoSessions())).toEqual(at('travel', 'd1'));
  });

  it('recorre las fases «de continuar» de un dilema', () => {
    const ctx = twoSessions();
    expect(nextPosition(at('travel', 'd1'), ctx)).toEqual(at('scene', 'd1'));
    expect(nextPosition(at('scene', 'd1'), ctx)).toEqual(at('council', 'd1'));
    expect(nextPosition(at('council', 'd1'), ctx)).toEqual(at('decision', 'd1'));
    expect(nextPosition(at('ripples', 'd1'), ctx)).toEqual(at('archive', 'd1'));
  });

  it('no deja saltarse la decisión, la justificación ni la réplica', () => {
    const ctx = twoSessions();
    for (const phase of ['decision', 'justification', 'objection'] as const) {
      expect(nextPosition(at(phase, 'd1'), ctx)).toBeNull();
    }
  });

  it('tras el Archivo real pasa al siguiente dilema del capítulo', () => {
    expect(nextPosition(at('archive', 'd1'), twoSessions())).toEqual(at('travel', 'd2'));
  });

  it('al acabar el capítulo I espera al docente si el II está bloqueado', () => {
    expect(nextPosition(at('archive', 'd3'), twoSessions())).toEqual(at('waiting'));
    expect(nextPosition(at('waiting'), twoSessions())).toBeNull();
  });

  it('con el capítulo II desbloqueado, continúa en él (también desde la espera)', () => {
    const ctx = twoSessions({ chapterUnlocked: 2 });
    expect(nextPosition(at('archive', 'd3'), ctx)).toEqual(at('travel', 'd4'));
    expect(nextPosition(at('waiting'), ctx)).toEqual(at('travel', 'd4'));
  });

  it('tras el último dilema llega el epílogo', () => {
    expect(nextPosition(at('archive', 'd5'), twoSessions({ chapterUnlocked: 2 }))).toEqual(
      at('epilogue'),
    );
  });

  it('modo una sesión: sin capítulo II, del último dilema al epílogo', () => {
    const ctx = twoSessions({ chapter1: ['d1', 'd3', 'd4'], chapter2: [] });
    expect(nextPosition(at('archive', 'd3'), ctx)).toEqual(at('travel', 'd4'));
    expect(nextPosition(at('archive', 'd4'), ctx)).toEqual(at('epilogue'));
  });

  it('salta los dilemas que aún no tienen contenido', () => {
    const ctx = twoSessions({ isAvailable: (id) => id === 'd1' });
    expect(nextPosition(at('archive', 'd1'), ctx)).toEqual(at('waiting'));
    expect(nextPosition(at('waiting'), { ...ctx, chapterUnlocked: 2 })).toEqual(at('epilogue'));
  });

  it('no avanza desde las fases finales', () => {
    for (const phase of ['epilogue', 'reflection', 'dossier', 'done'] as const) {
      expect(nextPosition(at(phase), twoSessions())).toBeNull();
    }
  });
});
