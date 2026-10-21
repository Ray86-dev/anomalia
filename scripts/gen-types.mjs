// Regenera src/lib/database.types.ts desde el proyecto remoto (sin Docker). Tras cada migración.
//   npm run db:types
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error('Falta SUPABASE_PROJECT_REF en .env.local');

// La CLI del paquete npm `supabase` es un script de Node: se ejecuta sin shell.
const cli = 'node_modules/supabase/dist/supabase.js';
const types = execFileSync(
  process.execPath,
  [cli, 'gen', 'types', 'typescript', '--project-id', ref, '--schema', 'public'],
  { encoding: 'utf8' },
);
const header =
  '// Generado con `npm run db:types` desde el proyecto de Supabase. NO EDITAR A MANO.\n' +
  '// Las columnas de funciones RETURNS TABLE se validan con zod en el cliente: aquí salen como no nulas.\n';
writeFileSync('src/lib/database.types.ts', header + types);
console.log('✔ src/lib/database.types.ts');
