import { fileURLToPath, URL } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Tests contra el proyecto real de Supabase: leen .env.local y crean/borran sus propios datos.
export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    env: loadEnv('test', fileURLToPath(new URL('.', import.meta.url)), ''),
    testTimeout: 30_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
