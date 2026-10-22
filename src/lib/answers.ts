/**
 * Notas sobre una respuesta archivada (M6) que comparten el expediente PDF del alumno y la
 * verificación del docente: si mantuvo o cambió su decisión tras el giro y con qué postura replicó.
 */
import { REPLY_STANCES } from '@shared/game/milestones.ts';
import { ui } from '@shared/generated/content.ts';
import { fmt } from './text.ts';

const p = ui.pdf;

/** `null` en partidas anteriores al giro (sin primera elección guardada). */
export function twistNote(choice: string, firstChoice: string | null): string | null {
  if (firstChoice === null) return null;
  return firstChoice === choice
    ? p.decisionMantenida
    : fmt(p.decisionCambiada, { opcion: firstChoice });
}

/** «Réplica · Matizo mi postura», o solo «Réplica» si no hay postura guardada. */
export function replyLabel(stance: string | null): string {
  const known = REPLY_STANCES.find((s) => s === stance);
  return known === undefined
    ? p.replica
    : fmt(p.replicaPostura, { postura: ui.juego.objecion.posturas[known].etiqueta });
}
