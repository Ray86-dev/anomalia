// Edge Function `partida`: punto único de escritura del alumnado (ver handler.ts).
import { createClient } from '@supabase/supabase-js';
import { blockedTerms, dilemmas, fallbacks } from '../../../shared/generated/content.ts';
import { requireEnv, secretKey } from '../_shared/env.ts';
import { parseAllowedOrigins } from '../_shared/http.ts';
import { handlePartida } from './handler.ts';

const admin = createClient(requireEnv('SUPABASE_URL'), secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));

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
    content: { blockedTerms, dilemmas, fallbacks },
    allowedOrigins,
  }),
);
