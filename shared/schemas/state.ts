/** Resultado de la RPC `my_state()`: la partida del alumno y los ajustes de su clase. */
import { z } from 'zod';
import { answerSnapshotSchema, runSnapshotSchema } from './partida.ts';

export const myStateSchema = z
  .object({
    player: z.object({
      alias: z.string(),
      status: z.enum(['active', 'expelled']),
      rescueKey: z.string(),
    }),
    class: z.object({
      label: z.string(),
      chapter1: z.array(z.string()),
      chapter2: z.array(z.string()),
      chapterUnlocked: z.union([z.literal(1), z.literal(2)]),
    }),
    run: runSnapshotSchema.extend({
      ending: z.string().nullable(),
      finishedAt: z.string().nullable(),
    }),
    answer: answerSnapshotSchema.nullable(),
  })
  .nullable();

export type MyState = NonNullable<z.infer<typeof myStateSchema>>;

/** Última solicitud de recuperación de esta sesión (`my_recovery()`). */
export const myRecoverySchema = z
  .object({
    alias: z.string(),
    status: z.enum(['pending', 'approved', 'rejected']),
    createdAt: z.string(),
  })
  .nullable();
export type MyRecovery = z.infer<typeof myRecoverySchema>;
