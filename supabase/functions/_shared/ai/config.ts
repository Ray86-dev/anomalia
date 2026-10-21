/**
 * Configuración del proveedor de IA (§7.2): un único proveedor elegido por el docente con
 * AI_PROVIDER, AI_MODEL, AI_API_KEY y AI_BASE_URL. La clave solo existe aquí (secreto de
 * la Edge Function). Sin configuración válida, el juego usa siempre los respaldos.
 */
import { z } from 'zod';

export type ApiKind = 'openai' | 'anthropic';

export type AiConfig = {
  readonly kind: ApiKind;
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl: string;
  /** Campos extra del cuerpo de la petición, propios del proveedor. */
  readonly extraBody: Readonly<Record<string, unknown>>;
  /** Pedir salida JSON nativa (`response_format`) en APIs compatibles con OpenAI. */
  readonly jsonMode: boolean;
  /** Tiempo máximo de la llamada: pasado este tiempo se usa el respaldo (§7.2: 6 s). */
  readonly timeoutMs: number;
};

type Preset = Omit<AiConfig, 'model' | 'apiKey' | 'timeoutMs'>;

/** Valores por defecto de cada proveedor. `openai-compatible` exige AI_BASE_URL. */
const PRESETS: Readonly<Record<string, Preset>> = {
  // DeepSeek: el modo «thinking» viene activado por defecto y dispara la latencia.
  deepseek: {
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com',
    extraBody: { thinking: { type: 'disabled' } },
    jsonMode: true,
  },
  mistral: { kind: 'openai', baseUrl: 'https://api.mistral.ai/v1', extraBody: {}, jsonMode: true },
  openai: { kind: 'openai', baseUrl: 'https://api.openai.com/v1', extraBody: {}, jsonMode: true },
  'openai-compatible': { kind: 'openai', baseUrl: '', extraBody: {}, jsonMode: true },
  anthropic: {
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    extraBody: {},
    jsonMode: false,
  },
};

const DEFAULT_TIMEOUT_MS = 6000;

const extraBodySchema = z.record(z.string(), z.unknown());

/** Lee la configuración; `null` si falta algo (el juego seguirá con respaldos). */
export function readAiConfig(env: (name: string) => string | undefined): AiConfig | null {
  const provider = env('AI_PROVIDER')?.trim().toLowerCase();
  const model = env('AI_MODEL')?.trim();
  const apiKey = env('AI_API_KEY')?.trim();
  if (!provider || !model || !apiKey) return null;
  const preset = PRESETS[provider];
  if (preset === undefined) return null;

  const baseUrl = (env('AI_BASE_URL')?.trim() || preset.baseUrl).replace(/\/+$/, '');
  if (baseUrl === '') return null;

  let extraBody: Record<string, unknown> = { ...preset.extraBody };
  const rawExtra = env('AI_EXTRA_BODY')?.trim();
  if (rawExtra) {
    try {
      const parsed = extraBodySchema.safeParse(JSON.parse(rawExtra));
      if (parsed.success) extraBody = { ...extraBody, ...parsed.data };
    } catch {
      // AI_EXTRA_BODY mal formado: se ignora y se usan los valores del proveedor.
    }
  }

  const timeout = Number.parseInt(env('AI_TIMEOUT_MS') ?? '', 10);
  return {
    kind: preset.kind,
    model,
    apiKey,
    baseUrl,
    extraBody,
    jsonMode: preset.jsonMode,
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0
        ? Math.min(timeout, DEFAULT_TIMEOUT_MS)
        : DEFAULT_TIMEOUT_MS,
  };
}
