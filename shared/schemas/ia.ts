/**
 * Contrato de las salidas de la IA (§7.1). Las claves van en castellano como en el diseño.
 * Se usa `z.object` (no estricto) para tolerar campos de más que añada el modelo.
 */
import { z } from 'zod';

export const QUALITIES = ['vacia', 'basica', 'solida'] as const;
export type Quality = (typeof QUALITIES)[number];

/** Llamada `objecion`: tras la justificación del alumno. */
export const objectionOutputSchema = z.object({
  calidad: z.enum(QUALITIES),
  conceptos: z.array(z.string()).max(10),
  objecion: z.string().trim().min(10).max(700),
  alerta: z.boolean(),
});
export type ObjectionOutput = z.infer<typeof objectionOutputSchema>;

/** Llamada `cierre`: tras la réplica del alumno. */
export const closingOutputSchema = z.object({
  reaccion: z.string().trim().min(5).max(600),
  conceptos: z.array(z.string()).max(10),
  alerta: z.boolean(),
});
export type ClosingOutput = z.infer<typeof closingOutputSchema>;

/** Máximo de llamadas por alumno y dilema: objeción + cierre + un reintento (§7.2). */
export const AI_MAX_CALLS_PER_DILEMMA = 3;
/** Límites de longitud de lo que dice un consejero (el prompt pide 60 y 45; se tolera algo más). */
export const MAX_OBJECTION_WORDS = 90;
export const MAX_CLOSING_WORDS = 70;
