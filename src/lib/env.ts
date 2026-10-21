import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type ClientEnv = { readonly supabaseUrl: string; readonly publishableKey: string };

function readEnv(): ClientEnv | null {
  const parsed = envSchema.safeParse(import.meta.env);
  return parsed.success
    ? {
        supabaseUrl: parsed.data.VITE_SUPABASE_URL,
        publishableKey: parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY,
      }
    : null;
}

/** `null` si faltan las variables públicas de Supabase (la app muestra un aviso). */
export const clientEnv = readEnv();
