// Ejecuta la CLI de Supabase con las variables de .env.local (contraseña de la base de
// datos, token de acceso…) sin exponerlas en la línea de órdenes.
//   node scripts/sb.mjs db push
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

// La CLI del paquete npm `supabase` es un script de Node: se ejecuta sin shell.
const cli = 'node_modules/supabase/dist/supabase.js';
const args = process.argv.slice(2);
const { status } = spawnSync(process.execPath, [cli, ...args], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(status ?? 1);
