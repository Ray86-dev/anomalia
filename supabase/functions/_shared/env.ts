/** Lectura de variables de entorno de las Edge Functions (runtime Deno). */

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') throw new Error(`Missing environment variable ${name}`);
  return value;
}

/**
 * Clave secreta del proyecto. Supabase inyecta `SUPABASE_SECRET_KEYS` (JSON con la clave
 * `default`); en proyectos antiguos solo existe `SUPABASE_SERVICE_ROLE_KEY`.
 */
export function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys !== undefined && keys !== '') {
    const parsed: unknown = JSON.parse(keys);
    if (parsed !== null && typeof parsed === 'object' && 'default' in parsed) {
      const key = parsed.default;
      if (typeof key === 'string' && key !== '') return key;
    }
  }
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}
