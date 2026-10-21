/**
 * Adaptador de proveedor: dos formatos de API cubren casi todo el mercado.
 * - `openai`: /chat/completions (OpenAI, DeepSeek, Mistral, Groq, OpenRouter, Gemini…).
 * - `anthropic`: /v1/messages.
 * Devuelve el texto de la respuesta; lanza si hay error, tiempo agotado o formato inesperado.
 */
import { z } from 'zod';
import type { AiConfig } from './config.ts';

export type Completion = {
  readonly system: string;
  readonly user: string;
  readonly maxTokens: number;
};

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const openAiResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

const anthropicResponse = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

export async function complete(
  config: AiConfig,
  request: Completion,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const signal = AbortSignal.timeout(config.timeoutMs);

  if (config.kind === 'anthropic') {
    const response = await fetchImpl(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: request.maxTokens,
        temperature: 0.6,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
        ...config.extraBody,
      }),
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const body = anthropicResponse.parse(await response.json());
    return body.content.map((block) => (block.type === 'text' ? (block.text ?? '') : '')).join('');
  }

  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      max_tokens: request.maxTokens,
      temperature: 0.6,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      ...(config.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...config.extraBody,
    }),
  });
  if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
  const body = openAiResponse.parse(await response.json());
  return body.choices[0]?.message.content ?? '';
}
