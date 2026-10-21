/**
 * Añade un usuario de Auth existente a la lista blanca de docentes (D-04).
 *   npm run teacher:add -- correo@centro.es ["Nombre visible"]
 * Crea antes el usuario en el panel de Supabase (Authentication → Add user).
 */
import { adminClient, findUserByEmail } from './lib/admin.ts';

const [email, displayName] = process.argv.slice(2);
if (email === undefined) {
  console.error('Uso: npm run teacher:add -- correo@centro.es ["Nombre visible"]');
  process.exit(1);
}

const admin = adminClient();
const user = await findUserByEmail(admin, email);
if (user === null) {
  console.error(
    `No existe ningún usuario con el correo ${email}. Créalo antes en Authentication → Add user.`,
  );
  process.exit(1);
}

const { error } = await admin
  .from('teachers')
  .upsert({ id: user.id, display_name: displayName ?? email.split('@')[0] ?? email });
if (error !== null) {
  console.error(`No se pudo añadir: ${error.message}`);
  process.exit(1);
}
console.log(`✔ ${email} ya es docente.`);
