/**
 * Llamadas `objecion` y `cierre` con todas las salvaguardas (§7.2):
 * datos personales fuera, salida JSON validada con zod, conceptos solo de la lista cerrada,
 * longitud y lenguaje controlados. Ante cualquier problema devuelve `null` y el llamador usa
 * el respaldo preescrito: el juego nunca se detiene por la IA.
 */
import { canonical, type BlockedTerms } from '../../../../shared/game/alias.ts';
import { scrubPersonalData } from '../../../../shared/game/privacy.ts';
import { countWords } from '../../../../shared/game/words.ts';
import {
  closingOutputSchema,
  MAX_CLOSING_WORDS,
  MAX_OBJECTION_WORDS,
  objectionOutputSchema,
  type ClosingOutput,
  type ObjectionOutput,
} from '../../../../shared/schemas/ia.ts';
import type { AiConfig } from './config.ts';
import { closingPrompt, objectionPrompt, type DialogueContext } from './prompts.ts';
import { complete, type FetchLike } from './provider.ts';

export type CallLog = {
  readonly call: 'objecion' | 'cierre';
  readonly ok: boolean;
  readonly ms: number;
  /** Motivo del fallo, sin ningún texto del alumno. */
  readonly reason?: string;
};

export type DialogueDeps = {
  readonly config: AiConfig;
  readonly blockedTerms: BlockedTerms;
  readonly fetchImpl?: FetchLike;
  readonly log?: (entry: CallLog) => void;
};

/** Extrae el objeto JSON de la respuesta (tolera ```json … ``` y texto alrededor). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function offensive(text: string, blocked: BlockedTerms): boolean {
  const normalized = canonical(text);
  return blocked.contiene.some((term) => normalized.includes(canonical(term)));
}

function knownConcepts(ids: readonly string[], context: DialogueContext): string[] {
  const allowed = new Set(context.concepts.map((c) => c.id));
  return [...new Set(ids.map((id) => id.trim().toLowerCase()).filter((id) => allowed.has(id)))];
}

async function run<T>(
  deps: DialogueDeps,
  call: CallLog['call'],
  attempt: () => Promise<{ value: T } | { reason: string }>,
): Promise<T | null> {
  const started = Date.now();
  let result: { value: T } | { reason: string };
  try {
    result = await attempt();
  } catch (error) {
    const reason =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? 'timeout'
        : 'error';
    result = { reason };
  }
  const ms = Date.now() - started;
  if ('value' in result) {
    deps.log?.({ call, ok: true, ms });
    return result.value;
  }
  deps.log?.({ call, ok: false, ms, reason: result.reason });
  return null;
}

export function generateObjection(
  deps: DialogueDeps,
  context: DialogueContext,
  justification: string,
): Promise<ObjectionOutput | null> {
  return run(deps, 'objecion', async () => {
    const raw = await complete(
      deps.config,
      objectionPrompt(context, scrubPersonalData(justification)),
      deps.fetchImpl,
    );
    const parsed = objectionOutputSchema.safeParse(extractJson(raw));
    if (!parsed.success) return { reason: 'invalid_json' };
    const output = parsed.data;
    if (countWords(output.objecion) > MAX_OBJECTION_WORDS) return { reason: 'too_long' };
    if (offensive(output.objecion, deps.blockedTerms)) return { reason: 'unsafe' };
    return { value: { ...output, conceptos: knownConcepts(output.conceptos, context) } };
  });
}

export function generateClosing(
  deps: DialogueDeps,
  context: DialogueContext,
  objection: string,
  reply: string,
): Promise<ClosingOutput | null> {
  return run(deps, 'cierre', async () => {
    const raw = await complete(
      deps.config,
      closingPrompt(context, objection, scrubPersonalData(reply)),
      deps.fetchImpl,
    );
    const parsed = closingOutputSchema.safeParse(extractJson(raw));
    if (!parsed.success) return { reason: 'invalid_json' };
    const output = parsed.data;
    if (countWords(output.reaccion) > MAX_CLOSING_WORDS) return { reason: 'too_long' };
    if (offensive(output.reaccion, deps.blockedTerms)) return { reason: 'unsafe' };
    return { value: { ...output, conceptos: knownConcepts(output.conceptos, context) } };
  });
}
