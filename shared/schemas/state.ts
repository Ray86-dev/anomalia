/** Resultado de la RPC `my_state()`: la partida del alumno y los ajustes de su clase. */
import { z } from 'zod';
import { REPLY_STANCES } from '../game/milestones.ts';
import { answerSnapshotSchema, progressSchema, runSnapshotSchema, worldSchema } from './partida.ts';

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
    run: runSnapshotSchema.extend({ finishedAt: z.string().nullable() }),
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

/** Una decisión con sus textos, tal como va al expediente PDF y a la verificación docente. */
export const dossierAnswerSchema = z.object({
  dilemmaId: z.string(),
  choice: z.enum(['A', 'B', 'C']),
  firstChoice: z.enum(['A', 'B', 'C']).nullable().default(null),
  justification: z.string().nullable(),
  objector: z.string().nullable(),
  objection: z.string().nullable(),
  reply: z.string().nullable(),
  replyStance: z.enum(REPLY_STANCES).nullable().default(null),
});
export type DossierAnswer = z.infer<typeof dossierAnswerSchema>;

/**
 * Datos del expediente del alumno (`my_dossier()`): disponibles desde el epílogo.
 * `verifyCode` y `finishedAt` llegan al enviar la reflexión final. El nombre real
 * nunca pasa por aquí: se escribe en el móvil al generar el PDF.
 */
export const myDossierSchema = z
  .object({
    alias: z.string(),
    classLabel: z.string(),
    verifyCode: z.string().nullable(),
    ending: z.string().nullable(),
    finishedAt: z.string().nullable(),
    world: worldSchema,
    reflection: z.string().nullable(),
    emblem: z.string().nullable().default(null),
    progress: progressSchema.prefault({}),
    answers: z.array(dossierAnswerSchema),
  })
  .nullable();
export type MyDossier = NonNullable<z.infer<typeof myDossierSchema>>;
