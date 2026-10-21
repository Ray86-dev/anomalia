/**
 * Snapshot agregado del Centro de Control (RPC `class_snapshot`). Solo cifras de grupo:
 * los grupos de menos de k personas llegan como `null` («<5») y las distribuciones solo
 * existen con al menos k respuestas (D-08).
 */
import { z } from 'zod';

const masked = z.number().int().nullable();

export const snapshotSchema = z.object({
  k: z.number().int(),
  generatedAt: z.string(),
  label: z.string(),
  chapter1: z.array(z.string()),
  chapter2: z.array(z.string()),
  chapterUnlocked: z.number(),
  live: z.object({
    players: z.number().int(),
    connected: z.number().int(),
    phases: z.object({ prologue: masked, waiting: masked, final: masked }),
    dilemmas: z.record(z.string(), z.object({ here: masked, done: masked })),
  }),
  results: z.object({
    decisions: z
      .record(
        z.string(),
        z.object({
          n: z.number().int().nullable(),
          A: z.number().int().optional(),
          B: z.number().int().optional(),
          C: z.number().int().optional(),
        }),
      )
      .default({}),
    world: z
      .object({
        n: z.number().int(),
        poder: z.number(),
        responsabilidad: z.number(),
        equidad: z.number(),
        confianza: z.number(),
        desnivel: z.number(),
      })
      .nullable()
      .default(null),
    concepts: z.array(z.object({ id: z.string(), n: z.number().int() })).default([]),
    endings: z.record(z.string(), z.number().int()).nullable().default(null),
  }),
  pendingAnswers: z.number().int(),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
export type DecisionCounts = Snapshot['results']['decisions'][string];

export const OPTION_IDS = ['A', 'B', 'C'] as const;
export type OptionId = (typeof OPTION_IDS)[number];

/** Opción mayoritaria de un dilema, o `null` si hay empate o no hay datos suficientes. */
export function majority(counts: DecisionCounts | undefined): OptionId | null {
  if (counts?.n == null) return null;
  const ranked = OPTION_IDS.map((id) => ({ id, n: counts[id] ?? 0 })).sort((a, b) => b.n - a.n);
  const [first, second] = ranked;
  if (first === undefined || first.n === 0 || second?.n === first.n) return null;
  return first.id;
}
