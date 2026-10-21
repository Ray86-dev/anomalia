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

## 2026-10-21 · M1 (vertical slice de D1)

### Tomadas por el docente
- **D-18 · Ilustraciones y música (§15): dominio público y bancos con licencia libre.**
  - Se aceptan CC0, CC BY y dominio público; nada NC ni ND.
  - Cada recurso queda documentado en `public/assets/LICENSES.md`.
  - El juego tiene un panel de créditos (botón «i») con enlace a cada licencia, porque CC BY exige una atribución clara.
- **D-19 · Objetores de D1:** A → Inés Kaltz, B → Dex Novak, C → Hana Jonás. El docente dio «todo OK».

### Propuestas técnicas
- **D-20 · Fases y acciones.** La partida avanza por las fases de `shared/game/phases.ts`. `partida` acepta cuatro acciones:
  - `advance` («Continuar»);
  - `choose` (decisión), que aplica los deltas **en el servidor**;
  - `justify`, que guarda la justificación y la objeción de respaldo hasta el M2;
  - `reply`, que guarda la réplica y el cierre.

  Si la partida no está donde el cliente cree (doble toque, otra pestaña…), el servidor responde `stale` con el estado real y el cliente lo adopta.
- **D-21 · Longitud de los textos sin bloqueo.** El contador de palabras avisa si el texto es corto o largo, pero un segundo envío lo archiva igualmente, en coherencia con «nunca bloquea definitivamente» (§7.2). El servidor solo rechaza los textos vacíos y los que superan 1200 o 900 caracteres.
- **D-22 · Capítulos.** Al acabar el capítulo I, el alumno espera si el docente ha configurado un capítulo II y aún no lo ha abierto. En modo de una sesión pasa directamente al epílogo. La pantalla de espera consulta cada 30 s.
- **D-23 · Ambientes por época** (`content/ambientes.json`): paleta, capas de fondo y música de cada estética. Un dilema puede sustituir capas y música con sus propios `assets`.
  - Las fases del bucle anteriores a las ondas usan la época del dilema.
  - El prólogo, las ondas, el Archivo real y la espera usan el 2077.
- **D-24 · Carga diferida.** Pixi, Ink, GSAP y Howler se cargan bajo demanda.
  - **Ink:** se compila en el build y cada historia es un JSON aparte.
  - **Pixi:** usa `pixi.js/unsafe-eval` para respetar nuestra CSP, y si no hay WebGL se queda el degradado CSS.
  - **Música:** se reproduce en streaming (`html5`), con fundidos, y el silencio se recuerda en el móvil.
- **D-25 · Grabados claros.** Se tiñen con el tono medio de la paleta para que el texto blanco tenga contraste suficiente (`tinte: true`).

### Pendientes (no bloquean M1)
- Proveedor y modelo de IA (M2).
- «Clave de rescate» para recuperar la partida sin aprobación manual (M3). Motivo: iOS borra los datos del sitio tras 7 días sin visitarlo.
- Detalle del modelo de snapshots del Centro (M3).
- Mapeo de la rúbrica con el currículo, título definitivo y revisión de los textos históricos (§15). Las marcas `TODO(verificar)` de D1 están en `content/dilemas/d1-galileo.ink` y en el contexto para la IA.
- Consulta al DPD de la Consejería sobre el uso de una IA externa y sobre las alertas de malestar (datos sensibles de menores, art. 9 RGPD).
