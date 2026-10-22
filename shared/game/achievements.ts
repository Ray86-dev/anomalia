/**
 * Logros, puntos y recompensas (M6), calculados siempre a partir del progreso de la partida
 * que guarda el servidor. Lo usan el móvil (avisos, panel, PDF) y `partida` (emblema).
 * Los puntos no evalúan: nunca premian una opción concreta, solo cómo se razona y se juega.
 */
import type { Concept, Emblems, Ficha, Rewards } from '../schemas/content.ts';
import type { Progress } from '../schemas/partida.ts';
import { REPLY_STANCES, type MilestoneId } from './milestones.ts';

export type Catalog = {
  readonly rewards: Rewards;
  readonly concepts: readonly Concept[];
  readonly fichas: readonly Ficha[];
  readonly emblems: Emblems;
};

export type Rank = { readonly id: string; readonly label: string; readonly points: number };

export type Summary = {
  /** Logro (movimiento o hito) → veces conseguido. */
  readonly earned: ReadonlyMap<string, number>;
  readonly points: number;
  readonly rank: Rank;
  readonly nextRank: Rank | null;
  /** Conceptos de la lista cerrada que ha usado el alumno (estrellas de su constelación). */
  readonly stars: readonly string[];
  readonly fichas: readonly string[];
  readonly symbols: readonly string[];
  readonly colors: readonly string[];
};

/** Número de anomalías de la clase (nunca 0, para no dividir umbrales por cero). */
function anomalies(progress: Progress): number {
  return Math.max(1, progress.classDilemmas.length);
}

function milestoneCounts(
  progress: Progress,
  stars: number,
  totalConcepts: number,
): Record<MilestoneId, number> {
  const n = anomalies(progress);
  return {
    laboratorio: progress.labs.length,
    // Mantener y cambiar valen lo mismo: nunca se juzga la decisión.
    mantiene: progress.kept,
    cambia: progress.changed,
    'tres-posturas': REPLY_STANCES.every((stance) => progress.stances.includes(stance)) ? 1 : 0,
    'estrellas-a': stars >= Math.ceil(1.2 * n) ? 1 : 0,
    'estrellas-b': stars >= Math.ceil(2.4 * n) ? 1 : 0,
    constelacion: totalConcepts > 0 && stars >= totalConcepts ? 1 : 0,
    anomalias: progress.classDilemmas.length > 0 && progress.closed >= n ? 1 : 0,
    expediente: progress.finished ? 1 : 0,
  };
}

export function summarize(progress: Progress, catalog: Catalog): Summary {
  const { rewards } = catalog;
  const conceptIds = new Set(catalog.concepts.map((c) => c.id));
  const stars = [...new Set(progress.concepts)].filter((id) => conceptIds.has(id));

  const earned = new Map<string, number>();
  const moveIds = new Set(rewards.movimientos.map((m) => m.id));
  for (const move of progress.moves) {
    if (moveIds.has(move)) earned.set(move, (earned.get(move) ?? 0) + 1);
  }
  for (const [id, count] of Object.entries(
    milestoneCounts(progress, stars.length, conceptIds.size),
  )) {
    if (count > 0) earned.set(id, count);
  }

  let points = stars.length * rewards.puntos.estrella;
  for (const count of earned.values()) {
    points += rewards.puntos.nuevo + rewards.puntos.repetido * (count - 1);
  }

  const n = anomalies(progress);
  const ranks: Rank[] = rewards.rangos.map((r) => ({
    id: r.id,
    label: r.etiqueta,
    points: r.puntosPorAnomalia * n,
  }));
  const reached = ranks.filter((r) => points >= r.points);
  const rank = reached.at(-1) ?? ranks[0] ?? { id: '', label: '', points: 0 };
  const nextRank = ranks[reached.length] ?? null;

  const played = new Set(Object.keys(progress.choices));
  return {
    earned,
    points,
    rank,
    nextRank,
    stars,
    fichas: catalog.fichas
      .filter((f) => played.has(f.dilema) && points >= f.puntos)
      .map((f) => f.id),
    symbols: catalog.emblems.simbolos.filter((s) => points >= s.puntos).map((s) => s.id),
    colors: catalog.emblems.colores.filter((c) => points >= c.puntos).map((c) => c.id),
  };
}

export type Novelty =
  | { readonly kind: 'logro'; readonly id: string; readonly points: number }
  | { readonly kind: 'estrella'; readonly id: string; readonly points: number }
  | { readonly kind: 'rango'; readonly id: string; readonly label: string }
  | { readonly kind: 'ficha'; readonly id: string };

/** Lo conseguido entre dos momentos de la partida, para los avisos del móvil. */
export function newlyEarned(before: Summary, after: Summary, rewards: Rewards): Novelty[] {
  const news: Novelty[] = [];
  for (const [id, count] of after.earned) {
    const previous = before.earned.get(id) ?? 0;
    if (count > previous) {
      news.push({
        kind: 'logro',
        id,
        points: previous === 0 ? rewards.puntos.nuevo : rewards.puntos.repetido,
      });
    }
  }
  for (const id of after.stars) {
    if (!before.stars.includes(id))
      news.push({ kind: 'estrella', id, points: rewards.puntos.estrella });
  }
  if (after.rank.id !== before.rank.id && after.points > before.points) {
    news.push({ kind: 'rango', id: after.rank.id, label: after.rank.label });
  }
  for (const id of after.fichas) {
    if (!before.fichas.includes(id)) news.push({ kind: 'ficha', id });
  }
  return news;
}
