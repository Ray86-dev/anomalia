/** Logros, recompensas y emblema en el móvil (M6): textos y piezas a partir del progreso. */
import { summarize, type Catalog, type Novelty, type Summary } from '@shared/game/achievements.ts';
import { concepts, dilemmas, emblems, fichas, rewards, ui } from '@shared/generated/content.ts';
import type { Progress } from '@shared/schemas/partida.ts';
import { fmt } from '../../../lib/text.ts';
import { texto } from './helpers.ts';

const t = ui.juego.logros;

export const CATALOG: Catalog = { rewards, concepts, fichas, emblems };

export const summaryOf = (progress: Progress): Summary => summarize(progress, CATALOG);

/** Movimientos (los detecta la IA) e hitos (reglas fijas), con su nombre y descripción. */
export const ACHIEVEMENTS = [
  ...rewards.movimientos.map((m) => ({ ...m, kind: 'movimiento' as const })),
  ...rewards.hitos.map((h) => ({ ...h, kind: 'hito' as const })),
];

const labelOf = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.etiqueta ?? id;
const conceptOf = (id: string) => concepts.find((c) => c.id === id)?.etiqueta ?? id;

/** Texto del aviso de cada novedad. */
export function noveltyText(novelty: Novelty, before: Summary): string {
  switch (novelty.kind) {
    case 'logro':
      return fmt(before.earned.has(novelty.id) ? t.aviso.repetido : t.aviso.nuevo, {
        etiqueta: labelOf(novelty.id),
        puntos: novelty.points,
      });
    case 'estrella':
      return fmt(t.aviso.estrella, { concepto: conceptOf(novelty.id), puntos: novelty.points });
    case 'rango':
      return fmt(t.aviso.rango, { rango: novelty.label });
    case 'ficha': {
      const ficha = fichas.find((f) => f.id === novelty.id);
      return fmt(t.aviso.ficha, { titulo: ficha === undefined ? '' : texto(ficha.titulo) });
    }
  }
}

export type EmblemPieces = {
  readonly symbol: (typeof emblems.simbolos)[number];
  readonly color: (typeof emblems.colores)[number];
};

/** Piezas del emblema guardado; sin emblema, el primer símbolo y el primer color gratis. */
export function emblemPieces(emblem: string | null): EmblemPieces {
  const [symbolId, colorId] = (emblem ?? '').split(':');
  const fallbackSymbol = emblems.simbolos.find((s) => s.puntos === 0) ?? emblems.simbolos[0];
  const fallbackColor = emblems.colores.find((c) => c.puntos === 0) ?? emblems.colores[0];
  if (fallbackSymbol === undefined || fallbackColor === undefined) {
    throw new Error('emblemas.json sin piezas');
  }
  return {
    symbol: emblems.simbolos.find((s) => s.id === symbolId) ?? fallbackSymbol,
    color: emblems.colores.find((c) => c.id === colorId) ?? fallbackColor,
  };
}

/** Lugar del dilema de una ficha («Roma, 1633»). */
export function placeOf(dilemmaId: string): string {
  const dilemma = dilemmas.find((d) => d.id === dilemmaId);
  return dilemma === undefined ? '' : `${dilemma.lugar}, ${String(dilemma.anio)}`;
}
