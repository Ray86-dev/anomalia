# Registro de decisiones

Cada entrada modifica o concreta `docs/DISENO_ANOMALIA.md`. Si el diseño y este registro se contradicen, prevalece lo que diga aquí.

## 2026-10-21 · Arranque (M0)

### Tomadas por el docente
- **D-01 · Hosting: GitHub Pages con repo público.** Sustituye a «Cloudflare Pages o Netlify» (§3, §11.1). Se sigue sin usar Vercel.
  - El plan Free de GitHub solo publica Pages desde repos públicos.
  - Todo lo que llega al navegador es público igualmente, así que en el repo nunca hay secretos ni datos de alumnos.
- **D-02 · Supabase: un proyecto remoto «anomalia» en la UE (Irlanda), sin Docker.**
  - Las migraciones se aplican con `npx supabase db push` y las funciones con `functions deploy --use-api`.
  - Los tests de RLS se ejecutan con Vitest contra ese mismo proyecto, usando datos propios que se borran al terminar.
- **D-03 · Textos libres (justificaciones, réplicas, reflexión): se guardan en el servidor.**
  - El docente solo los lee en dos casos: en las alertas y al verificar un código de PDF.
  - El nombre real nunca sale del móvil.
- **D-04 · Cuentas de docente creadas a mano, sin registro público.** Ser docente equivale a tener fila en `teachers`; se añade con `npm run teacher:add`.
  - *Nota técnica:* el alta por email no se puede desactivar en Supabase.
    - `[auth.email] enable_signup = false` apaga todo el proveedor de email, así que el docente tampoco podría iniciar sesión.
    - Desactivar las altas globales bloquearía el inicio de sesión anónimo del alumnado.
  - Quien se registre por su cuenta no obtiene ningún permiso: lo que da acceso es la lista blanca, y la confirmación por email sigue activa.

### Propuestas técnicas aprobadas con el plan de M0
- **D-05 · Escrituras del alumnado solo a través de la Edge Function `partida`.**
  - `partida` valida con zod, calcula con `shared/game` (la misma lógica que usa el cliente) y escribe con funciones SQL `svc_*` atómicas, ejecutables solo por `service_role`.
  - La RLS solo concede SELECT de las filas propias.
- **D-06 · El contenido se compila a un módulo TS común para la app y las Edge Functions.** No hay contenido en Postgres.
- **D-07 · Cambios en el modelo de datos (§11.5):**
  - `world_state` → 4 columnas con rango 0–100 y `desnivel` generado;
  - `runs.player_id` como PK (una partida por alumno);
  - `ai_usage` → contadores en `answers` y `classes`;
  - `flagged` → tabla `alerts`, que solo ve el docente;
  - `players.auth_uid` separado de `players.id`, para poder reasignarlo al recuperar la partida.
- **D-08 · Anonimato en directo en el Centro de Control** (cambia §8 y `class_aggregates`).
  - El problema: los deltas de cada opción son fijos, así que recalcular las medias con cada respuesta delataría lo que eligió quien acaba de responder.
  - La solución: se publican snapshots solo cuando hay **≥ 5 respuestas nuevas** o cuando el docente pulsa «revelar». Los grupos con menos de 5 alumnos se muestran como «<5».
  - Se concreta en M3.
- **D-09 · Finales:** se evalúan en el orden de la tabla del §5.6 y gana el primero que se cumple. «Equilibrio frágil» es el caso por defecto.
- **D-10 · Lectura fácil:**
  - en los JSON, cada texto es `{ "normal", "facil" }` dentro del mismo archivo;
  - las escenas Ink simplificadas van en `content/lectura-facil/`;
  - `facil` pasa a ser obligatorio en M5 (`npm run content:strict`).
- **D-11 · Sesiones separadas en el mismo navegador:** el cliente del alumno y el del docente guardan la sesión con claves distintas, para que probar ambos roles en un mismo móvil no cierre ninguna sesión.
- **D-12 · Mutaciones de `classes` solo por RPC** (`create_class`, `unlock_chapter`, `delete_class`…). El docente tiene SELECT directo pero no UPDATE, así que no puede tocar contadores como `ai_calls_used`.
- **D-13 · Modos de clase como contenido** (`content/modos.json`):
  - dos sesiones: D1–D3 + D4–D5;
  - una sesión: D1, D3 y D4 en el capítulo I, sin capítulo II.

  Al crear la clase se copian en `classes.chapter_1` y `classes.chapter_2`.
- **D-14 · Versiones de herramientas:**
  - **TypeScript** se fija en 6.0.x porque typescript-eslint todavía no admite la 7.
  - **ESLint 10** se usa con un `overrides` de npm para `eslint-plugin-jsx-a11y`, que es clave para la accesibilidad. El plugin solo declara compatibilidad hasta ESLint 9, pero no usa ninguna API retirada en la 10. La alternativa, ESLint 9, ya no tiene soporte.
- **D-15 · Permisos seguros por defecto en la base de datos:** las tablas y funciones nuevas de `public` no conceden nada a `anon` ni a `authenticated` (`alter default privileges`). Cada migración debe conceder los permisos de forma explícita.
- **D-16 · Bundle:** React, Supabase y zod van en chunks propios. Así cachean entre despliegues y la app propiamente dicha pesa unos 15 KB. El build apunta a iOS 15 o superior.

- **D-17 · Puesta en marcha de Supabase (21/10/2026):**
  - se ha pausado «teselas» para poder crear «anomalia» (`kicpndzbcswxchxiejje`, eu-west-1);
  - la migración `core` se aplicó por MCP y se registró como `20261021191252`, y el archivo local lleva esa misma versión;
  - la CLI está vinculada y `db push` y `migration list` funcionan sin la contraseña de la base de datos.

### Pendientes (no bloquean M0)
- Proveedor y modelo de IA (M2).
- «Clave de rescate» para recuperar la partida sin aprobación manual (M3). Motivo: iOS borra los datos del sitio tras 7 días sin visitarlo.
- Detalle del modelo de snapshots del Centro (M3).
- Mapeo de la rúbrica con el currículo, título definitivo, origen de ilustraciones y música, revisión de los textos históricos (§15).
- Consulta al DPD de la Consejería sobre el uso de una IA externa y sobre las alertas de malestar (datos sensibles de menores, art. 9 RGPD).
