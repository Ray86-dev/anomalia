// Edge Function `partida`: punto único de escritura del alumnado (ver handler.ts).
import { createClient } from '@supabase/supabase-js';
import {
  alertTerms,
  blockedTerms,
  concepts,
  counselors,
  dilemmas,
  emblems,
  endings,
  fallbacks,
  fichas,
  rewards,
} from '../../../shared/generated/content.ts';
import { readAiConfig } from '../_shared/ai/config.ts';
import { generateClosing, generateObjection, type DialogueDeps } from '../_shared/ai/dialogue.ts';
import { requireEnv, secretKey } from '../_shared/env.ts';
import { parseAllowedOrigins } from '../_shared/http.ts';
import { handlePartida, type AiDialogue } from './handler.ts';

const admin = createClient(requireEnv('SUPABASE_URL'), secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));

// IA (§7): sin AI_PROVIDER, AI_MODEL y AI_API_KEY válidos, todo sale de los respaldos.
const aiConfig = readAiConfig((name) => Deno.env.get(name));
function dialogue(config: NonNullable<typeof aiConfig>): AiDialogue {
  const deps: DialogueDeps = {
    config,
    blockedTerms,
    // Solo métricas: nunca se registra texto del alumno ni del modelo.
    log: (entry) => {
      console.log(JSON.stringify({ ai: entry }));
    },
  };
  return {
    objection: (context, justification) => generateObjection(deps, context, justification),
    closing: (context, objection, reply, stance) =>
      generateClosing(deps, context, objection, reply, stance),
  };
}
const ai = aiConfig === null ? null : dialogue(aiConfig);

Deno.serve((request) =>
  handlePartida(request, {
    verifyUser: async (jwt) => {
      const { data, error } = await admin.auth.getClaims(jwt);
      if (error !== null || data === null) return null;
      const sub: unknown = data.claims.sub;
      return typeof sub === 'string' && sub !== '' ? sub : null;
    },
    rpc: async (fn, args) => {
      const result: { data: unknown; error: { message: string } | null } = await admin.rpc(
        fn,
        args,
      );
      if (result.error !== null) throw new Error(`${fn}: ${result.error.message}`);
      return result.data;
    },
    content: {
      blockedTerms,
      dilemmas,
      fallbacks,
      counselors,
      concepts,
      alertTerms,
      endings,
      catalog: { rewards, concepts, fichas, emblems },
    },
    ai,
    allowedOrigins,
  }),
);
