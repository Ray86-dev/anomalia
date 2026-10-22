/**
 * Avance de la partida entre fases (§6). Lo usan el cliente (para saber qué pantalla
 * toca) y la Edge Function `partida` (autoridad: valida cada transición).
 */
import type { Phase } from './phases.ts';

export type Position = {
  readonly phase: Phase;
  readonly dilemma: string | null;
};

export type FlowContext = {
  readonly chapter1: readonly string[];
  readonly chapter2: readonly string[];
  readonly chapterUnlocked: 1 | 2;
  /** Dilemas con contenido disponible (en desarrollo puede faltar alguno). */
  readonly isAvailable: (dilemmaId: string) => boolean;
};

/**
 * Fases que se superan con «Continuar». El resto exige una acción propia:
 * decision → elegir, twist → confirmar, justification → justificar, objection → replicar.
 */
const ADVANCE_WITHIN_DILEMMA: Partial<Record<Phase, Phase>> = {
  travel: 'scene',
  scene: 'lab',
  lab: 'council',
  council: 'decision',
  ripples: 'archive',
};

/** Fases de un dilema que se recorren con «Continuar» antes de la decisión (tests y scripts). */
export const INTRO_PATH = ['travel', 'scene', 'lab', 'council'] as const;

function available(ids: readonly string[], ctx: FlowContext): string[] {
  return ids.filter((id) => ctx.isAvailable(id));
}

/** Primer dilema del capítulo indicado, o el epílogo si no queda ninguno. */
function startOf(ids: readonly string[], ctx: FlowContext): Position {
  const first = available(ids, ctx)[0];
  return first === undefined
    ? { phase: 'epilogue', dilemma: null }
    : { phase: 'travel', dilemma: first };
}

/** Lo que viene después de cerrar el «Archivo real» de un dilema. */
function afterDilemma(dilemma: string, ctx: FlowContext): Position {
  const chapter1 = available(ctx.chapter1, ctx);
  const index1 = chapter1.indexOf(dilemma);
  if (index1 !== -1) {
    const next = chapter1[index1 + 1];
    if (next !== undefined) return { phase: 'travel', dilemma: next };
    // La espera depende de cómo configuró la clase el docente, no de qué contenido exista ya.
    if (ctx.chapter2.length === 0) return { phase: 'epilogue', dilemma: null };
    return ctx.chapterUnlocked === 2
      ? startOf(ctx.chapter2, ctx)
      : { phase: 'waiting', dilemma: null };
  }
  const chapter2 = available(ctx.chapter2, ctx);
  const next = chapter2[chapter2.indexOf(dilemma) + 1];
  return next === undefined
    ? { phase: 'epilogue', dilemma: null }
    : { phase: 'travel', dilemma: next };
}

/**
 * Siguiente posición al pulsar «Continuar», o `null` si desde aquí no se puede avanzar así
 * (falta una acción del alumno o el capítulo II sigue bloqueado).
 */
export function nextPosition(position: Position, ctx: FlowContext): Position | null {
  const { phase, dilemma } = position;
  switch (phase) {
    case 'prologue':
      return startOf(ctx.chapter1, ctx);
    case 'waiting':
      return ctx.chapterUnlocked === 2 ? startOf(ctx.chapter2, ctx) : null;
    case 'archive':
      return dilemma === null ? null : afterDilemma(dilemma, ctx);
    case 'epilogue':
      return { phase: 'reflection', dilemma: null };
    default: {
      const next = ADVANCE_WITHIN_DILEMMA[phase];
      return next === undefined || dilemma === null ? null : { phase: next, dilemma };
    }
  }
}

export function samePosition(a: Position, b: Position): boolean {
  return a.phase === b.phase && a.dilemma === b.dilemma;
}
