/** Resultado de la RPC `my_state()`: la partida del alumno y los ajustes de su clase. */
import { z } from 'zod';
import { DILEMMA_PHASES, GLOBAL_PHASES } from '../game/phases.ts';

export const myStateSchema = z
  .object({
    player: z.object({ alias: z.string(), status: z.enum(['active', 'expelled']) }),
    class: z.object({
      label: z.string(),
      chapter1: z.array(z.string()),
      chapter2: z.array(z.string()),
      chapterUnlocked: z.union([z.literal(1), z.literal(2)]),
    }),
    run: z.object({
      world: z.object({
        poder: z.number(),
        responsabilidad: z.number(),
        equidad: z.number(),
        confianza: z.number(),
      }),
      branches: z.array(z.string()),
      currentDilemma: z.string().nullable(),
      phase: z.enum([...GLOBAL_PHASES, ...DILEMMA_PHASES]),
      ending: z.string().nullable(),
      finishedAt: z.string().nullable(),
    }),
  })
  .nullable();

export type MyState = NonNullable<z.infer<typeof myStateSchema>>;
