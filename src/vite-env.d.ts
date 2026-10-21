/// <reference types="vite/client" />

// Variables públicas de Vite (ver .env.example). La declaración debe ser `interface`
// para fusionarse con la de vite/client.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_BASE_PATH?: string;
}
