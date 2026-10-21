// Ejecuta la CLI de Supabase con las variables de .env.local (contraseña de la base de
// datos, token de acceso…) sin exponerlas en la línea de órdenes.
//   node scripts/sb.mjs db push
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const args = process.argv.slice(2);
const { status } = spawnSync('npx', ['supabase', ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});
process.exit(status ?? 1);
