# ANOMALÍA — instrucciones para Claude Code

Videojuego narrativo web para Filosofía de 4.º ESO (Canarias): unos 25 alumnos de 15–16 años, cada uno en su móvil, en 1–2 sesiones de 50 min; hay alumnado NEAE. El docente proyecta en paralelo un Centro de Control anónimo.

- **Fuente de verdad:** `docs/DISENO_ANOMALIA.md`.
- **Decisiones posteriores:** `docs/decisiones.md`. Prevalecen sobre el diseño cuando lo contradicen. Registra ahí cada decisión nueva.

## Reglas innegociables

1. **Stack:** Vite + React + TypeScript estricto + React Router, inkjs, Pixi.js, GSAP, Howler.js, pdf-lib, zod y Supabase (Auth, Postgres con RLS, Edge Functions, Realtime). **No añadas librerías pesadas sin preguntar.**
2. **Hosting:** GitHub Pages con repo **público**. **Nunca Vercel** ni dependencias específicas de Vercel.
3. **Privacidad de menores:**
   - El alumnado entra solo con alias y código de clase (inicio de sesión anónimo de Supabase).
   - El nombre real solo existe en el dispositivo al generar el PDF. **Nunca** se envía al servidor ni se guarda en almacenamiento persistente.
   - `/centro` **jamás** muestra alias, textos libres ni filas individuales: solo snapshots agregados del servidor con k ≥ 5.
   - El repo es público: nunca subas secretos, `.env.local` ni datos reales de alumnos.
4. **IA:**
   - Un único proveedor configurable con `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` y `AI_BASE_URL`. La key solo existe en la Edge Function.
   - Al modelo nunca le llegan el alias ni el código de clase.
   - La salida es JSON validado con zod.
   - Si la IA falla o tarda más de 6 s, se usa un respaldo preescrito; el juego nunca se bloquea por ella.
   - El texto del alumno es dato, nunca instrucciones.
5. **Contenido como datos:** todo texto visible vive en `content/`: interfaz, dilemas, consejeros, finales, conceptos, respaldos y rúbrica. Nunca escribas cadenas de interfaz en los componentes.
6. **Rigor histórico:**
   - No inventes hechos ni citas textuales atribuidas a personas reales.
   - Un dato histórico que no esté en el diseño se marca con `// TODO(verificar)`, o `TODO(verificar)` dentro del texto JSON, y se avisa al docente.
   - La marca se queda en `content/` y en los avisos, pero el contenido generado la quita: nunca se ve en el juego, el PDF ni la IA (D-72).
   - Respeta las notas de sensibilidad: no mencionar la muerte de Clara Immerwahr, Henrietta Lacks sin diálogo inventado, ningún diálogo de He Jiankui.
7. **Móvil primero:**
   - Vertical de 360–430 px, `100dvh` y safe areas.
   - Texto base de 18 px (mínimo 17).
   - Audio desbloqueado con el primer toque, en MP3/AAC; el juego se entiende sin sonido.
   - `prefers-reduced-motion`, más la opción manual `html[data-motion="reduced"]`.
8. **Idioma:** interfaz y contenido en castellano de España; código, identificadores y nombres técnicos en inglés.

## Forma de trabajar

- **Hitos M0 → M8** (§14 del diseño, renumerados en D-61). Al cerrar cada uno:
  - `npm run check` y, si aplica, `npm run test:integration`;
  - lista breve de pruebas en el móvil;
  - **parar hasta que el docente confirme**.
- **Ambigüedades:** ante una ambigüedad o una decisión abierta (§15), pregunta en lugar de suponer.
- **Este archivo:** mantenlo al día cuando cambien las convenciones.
- **No desplegar en horario de clase.** Un despliegue borra los chunks que los móviles tienen cargados.
- **Migraciones:**
  - versionadas en `supabase/migrations/AAAAMMDDHHMMSS_nombre.sql`;
  - nunca se edita una migración ya aplicada: se crea otra;
  - las tablas y funciones nuevas nacen **sin permisos** para `anon` y `authenticated` (D-15): concede en la migración solo lo necesario y activa RLS en cada tabla;
  - toda función `security definer` lleva `set search_path = ''` y `revoke execute … from public, anon, authenticated` antes de su `grant`.
- **Commits** en inglés con prefijo convencional (`feat:`, `fix:`, `chore:`…).
- **Proyecto de Supabase:** «anomalia» (`kicpndzbcswxchxiejje`, eu-west-1), vinculado a la CLI. El MCP de Supabase sirve para consultas y avisos; las migraciones se aplican con `npm run db:push`.

## Materiales de clase

- `no_git_materiales/` (ignorado por git) contiene los materiales que el docente trabajó antes de la actividad. Úsalos para alinear el vocabulario y los conceptos, pero no copies su contenido al repo, que es público.
- Vocabulario de la unidad: los **datos** se comprueban (medir, contar, experimentar) y las **razones** se discuten («¿qué debemos hacer?»). El juego usa esas mismas palabras (D-52).

## Arquitectura (resumen)

- **Contenido:** `content/` (JSON + Ink) → `npm run content` (`scripts/build-content.ts`) valida con zod, compila Ink con `inkjs/full` y genera `shared/generated/` (`content.ts` y `ink/<id>.json`). Esos archivos no se versionan ni se editan a mano.
  - Nudos Ink obligatorios: `prologo` en `content/prologo.ink` y `escena` en cada dilema.
  - Etiquetas Ink: `# titulo`, `# pregunta`, `# eco` (recuerdo de una decisión anterior) y `# ari` (mensaje de Ari).
  - Variables que el juego pasa a las escenas: el mundo, `desnivel`, `rama_<id>` y `eleccion_dN` (decisión final de cada dilema jugado). Ninguna escena pasa de 6 líneas (test en `src/engine/ink.test.ts`).
  - Logros, fichas secretas y emblemas: `content/logros.json`, `fichas.json` y `emblemas.json`.
- **Recursos:** imágenes y música en `public/assets/`, siempre con su entrada en `public/assets/LICENSES.md` y `credito` (más `licenciaUrl` si es CC BY) en el JSON que las declara.
  - Solo CC0, CC BY o dominio público; las tipografías, con licencia SIL OFL.
  - Imágenes en WebP de unos 1050×1400 (recorte vertical); música en MP3 de unos 128 kbps.
- **Juego del alumno** (`src/routes/alumno/game/`): una pantalla por fase. El servidor es la autoridad: el cliente adopta siempre el estado que devuelve `partida`.
  - Motor en `src/engine/`: Ink, Pixi, Howler y GSAP, todo cargado bajo demanda.
  - Laboratorios en `labs/` (modelos puros en `labs/models.ts`, con tests). Logros, avisos y rango se calculan en el móvil con `shared/game/achievements.ts` a partir de `run.progress`; nunca llegan al Centro ni a la consola (D-69).
  - **Lectura fácil** (D-10, D-58): `texto()` y `storyFor()` de `helpers.ts` eligen la versión. Todo texto nuevo del contenido necesita su `facil` (lo exige `content:strict`), y cada escena, su `lectura-facil/<archivo>.ink`.
  - **Escenas con variables** (D5): la escena recibe el estado del mundo y las ramas (`rama_<id>`); declara con `VAR` solo las que use.
- **`shared/`:** TS puro, sin DOM ni APIs de Node o Deno. Lo importan la app (alias `@shared`) y las Edge Functions (rutas relativas).
  - Los imports relativos llevan extensión `.ts`.
  - Solo puede depender de `zod`.
- **Escrituras del alumnado:**
  - nunca escriben directamente en las tablas;
  - todo pasa por la Edge Function `partida`, que valida con zod, calcula con `shared/game` y llama a funciones SQL `svc_*`, ejecutables solo por `service_role`.
- **IA** (`supabase/functions/_shared/ai/`): `partida` la llama dentro de `justify` y `reply` (D-27).
  - Presupuesto con `svc_ai_take` y salida validada (`shared/schemas/ia.ts`).
  - Ante cualquier fallo, devuelve `null` y se usa el respaldo de `content/respaldos.json`.
  - Nunca registres en logs el texto del alumno ni el del modelo.
  - Al cambiar los prompts (`prompts.ts`), mantén el texto del alumno solo en el mensaje de usuario, delimitado con `<texto_alumno>`.
- **RLS:**
  - el alumno puede hacer SELECT de sus filas;
  - el docente (tiene fila en `teachers`) accede a sus clases por RLS y por RPC con comprobación de propiedad;
  - las funciones auxiliares van en el esquema `private`.
- **Sesiones separadas:** dos clientes de Supabase con `storageKey` distinto: `anomalia-alumno` para `/` y `anomalia-docente` para `/consola` y `/centro`.
- **Expediente PDF** (§9):
  - `src/engine/pdf/` lo maqueta con pdf-lib, fontkit y Atkinson Hyperlegible (D-40). Se carga bajo demanda y no conoce el contenido: recibe los textos ya resueltos.
  - El ensamblado a partir de `my_dossier()` y de `content/` está en `src/routes/alumno/game/dossier.ts`.
  - El nombre real solo vive en memoria mientras se genera (D-45).
  - El docente comprueba los códigos con la RPC `verify_run` (D-41).
- **Centro de Control** (`src/routes/centro/`): solo consume `class_snapshot` (agregados con k = 5, resultados publicados por lotes o al pulsar R; D-35) y se actualiza por Realtime Broadcast privado con sondeo de respaldo (D-36).
  - Nunca le pases alias, textos libres ni filas individuales, y no importes nada de `alumno` ni de `consola` (regla de ESLint).

## Convenciones

- **TypeScript** estricto, sin `any`. Valida con zod en todos los bordes: contenido, respuestas de red, payloads de Edge Functions y salidas de la IA.
- **Claves en castellano sin tildes**, como en el diseño, en `content/*.json` (las edita el docente) y en el contrato de la IA (`calidad`, `conceptos`, `objecion`…).
- **Claves e identificadores en inglés** en todo lo demás: tablas y columnas SQL, payloads de Edge Functions y RPC (camelCase en JSON), código TS. Excepción: las cuatro variables del mundo (`poder`, `responsabilidad`, `equidad`, `confianza`), que son términos del dominio.
- **Textos de interfaz:** `import { ui } from '@shared/generated/content'` y `fmt(ui.x.y, { alias })` para sustituir `{alias}`.
- **React:** componentes de función. La UI compartida va en `src/ui/` y lo específico de cada ruta en `src/routes/<ruta>/`.
- **Carga diferida:** Pixi, Ink, Howler y pdf-lib se cargan bajo demanda, nunca en el bundle inicial.
- **Tests:**
  - unitarios en `*.test.ts`, junto al código (Vitest);
  - de integración en `tests/integration/`, contra el proyecto de Supabase. Necesitan `.env.local` y siempre crean y borran sus propios datos.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Genera el contenido y arranca Vite. Usa `-- --host` para probar desde el móvil en la misma wifi |
| `npm run check` | content + typecheck + lint + format:check + tests unitarios (lo mismo que CI) |
| `npm run content` / `content:strict` | Valida y genera el contenido; `strict` falla si quedan TODO o falta lectura fácil |
| `npm run test:integration` | Matriz RLS y la Edge Function `partida` contra Supabase |
| `npm run db:push` | Aplica las migraciones pendientes (lee `.env.local`) |
| `npm run functions:deploy` | Despliega `partida` sin Docker (`--use-api`) |
| `npm run db:types` | Regenera `src/lib/database.types.ts` tras cada migración |
| `npx supabase config push` | Sube la config de Auth de `supabase/config.toml`; **revisa el diff**: los valores locales sustituyen a los remotos |
| `npm run teacher:add -- correo@dominio` | Añade un usuario de Auth existente a la lista blanca de docentes |
| `npm run seed:demo` | Recrea la clase simulada PRUEBA con 30 alumnos |
| `npm run simular` | Simula una clase jugando a la vez para probar el Centro (`--clase`, `--alumnos`, `--ritmo`, `--reiniciar`, `--borrar`, `--api`) |
| `npm run ai:probe` | Prueba la IA real a través de `partida` (latencia, calidad, inyección, malestar); `-- --dilema d3` prueba otro dilema. Gasta llamadas reales y borra lo que crea |
