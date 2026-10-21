/** Mensajes del teletipo de anomalías (§8.2), generados solo a partir de agregados. */
import type { Concept, Dilemma } from '@shared/schemas/content.ts';
import { fmt } from '../../lib/text.ts';
import { majority, type Snapshot } from './snapshot.ts';

export type TickerTexts = {
  readonly mayoria: string;
  readonly empate: string;
  readonly desnivel: string;
  readonly inestable: string;
  readonly concepto: string;
  readonly conectados: string;
  readonly espera: string;
};

/** Desnivel a partir del cual el 2077 de la clase se considera inestable (§4.3). */
export const UNSTABLE_GAP = 25;

export function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : value < 0 ? `−${String(Math.abs(value))}` : '0';
}

export function buildTicker(
  snapshot: Snapshot,
  revealed: boolean,
  texts: TickerTexts,
  dilemmas: readonly Dilemma[],
  concepts: readonly Concept[],
): string[] {
  const messages: string[] = [];
  const { live, results } = snapshot;

  if (live.connected > 0) messages.push(fmt(texts.conectados, { n: live.connected }));

  // Las mayorías forman parte de las distribuciones: solo con la revelación activada.
  if (revealed) {
    for (const id of [...snapshot.chapter1, ...snapshot.chapter2]) {
      const counts = results.decisions[id];
      const dilemma = dilemmas.find((d) => d.id === id);
      if (counts?.n == null || dilemma === undefined) continue;
      const winner = majority(counts);
      const option = dilemma.opciones.find((o) => o.id === winner);
      messages.push(
        option === undefined
          ? fmt(texts.empate, { anio: dilemma.anio })
          : fmt(texts.mayoria, { anio: dilemma.anio, opcion: option.corto }),
      );
    }
  }

  if (results.world !== null) {
    messages.push(fmt(texts.desnivel, { valor: signed(results.world.desnivel) }));
    if (results.world.desnivel >= UNSTABLE_GAP) messages.push(texts.inestable);
  }

  const top = results.concepts[0];
  const label = concepts.find((c) => c.id === top?.id)?.etiqueta;
  if (label !== undefined) messages.push(fmt(texts.concepto, { concepto: label.toUpperCase() }));

  return messages.length > 0 ? messages : [texts.espera];
}
