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

## 2026-10-21 · M2 (IA)

### Tomadas por el docente
- **D-26 · Proveedor de IA (§15): DeepSeek, modelo DeepSeek-V4.1-Flash-1017** (en la API, `deepseek-flash`).
  - Se configura con `AI_PROVIDER=deepseek` y `AI_MODEL=deepseek-flash`; la clave va solo en los secretos de Supabase.
  - **Aviso de privacidad, comunicado al docente:** la API de DeepSeek trata los datos en China, y varias autoridades europeas han actuado contra DeepSeek (Italia, Berlín, Irlanda).
  - Antes de usarlo con alumnado real conviene contar con el visto bueno del DPD. Alternativa sin tocar código: el mismo modelo de pesos abiertos servido desde la UE, con `AI_PROVIDER=openai-compatible` y `AI_BASE_URL`.

### Propuestas técnicas
- **D-27 · La IA va dentro de `partida`, no en una función `ai-dialogo` aparte** (cambio sobre §11.6).
  - `justify` y `reply` llaman a la IA y escriben el resultado en la misma petición.
  - Ventajas: un solo viaje por la wifi del aula, la fase se valida en un único sitio y la escritura es atómica.
  - El módulo de IA vive en `supabase/functions/_shared/ai/` por si hiciera falta separarlo.
- **D-28 · Adaptador de dos formatos.** Uno compatible con OpenAI (DeepSeek, Mistral, OpenAI, Gemini, OpenRouter…) y otro para Anthropic.
  - Presets por proveedor, más `AI_BASE_URL`, `AI_EXTRA_BODY` y `AI_TIMEOUT_MS` (máximo 6000).
  - En DeepSeek se desactiva el modo «thinking», que viene activado por defecto, para no superar los 6 s.
- **D-29 · Salvaguardas de cada llamada.**
  - **Entrada:** se quitan emails, teléfonos, URL y usuarios de redes. El texto va delimitado como dato y se neutralizan los signos `<` y `>`.
  - **Salida:** JSON validado con zod, conceptos filtrados por la lista cerrada, longitud máxima y sin términos de la lista de bloqueo.
  - **Fallo:** ante cualquier problema (error, tiempo agotado, JSON inválido, respuesta vacía) se usa el respaldo preescrito.
  - **Registros:** solo métricas (tipo de llamada, éxito, milisegundos, motivo), nunca texto.
- **D-30 · Presupuesto atómico** (`svc_ai_take`): como mucho 3 llamadas por alumno y dilema (objeción, cierre y un reintento) y nunca por encima de `classes.ai_budget` (400 por defecto).
- **D-31 · Calidad «vacía».** Si en el primer intento la IA no encuentra ninguna razón, el alumno recibe un aviso suave y puede reescribir; no se guarda nada. El segundo envío se archiva siempre (§7.2).
- **D-32 · Alertas privadas.** La IA (`alerta`) y una lista local de indicios (`content/alertas.json`) crean una fila en `alerts`, que solo ve el docente.
  - La lista local funciona aunque la IA falle.
  - La vista de alertas en `/consola` llega en el M3.

### Pendientes (no bloquean M2)
- «Clave de rescate» para recuperar la partida sin aprobación manual (M3). Motivo: iOS borra los datos del sitio tras 7 días sin visitarlo.
- Detalle del modelo de snapshots del Centro (M3).
- Mapeo de la rúbrica con el currículo, título definitivo y revisión de los textos históricos (§15). Las marcas `TODO(verificar)` de D1 están en `content/dilemas/d1-galileo.ink` y en el contexto para la IA.
- Consulta al DPD de la Consejería sobre el uso de una IA externa y sobre las alertas de malestar (datos sensibles de menores, art. 9 RGPD).

## 2026-10-21 · M3 (Centro de Control y consola)

### Tomadas por el docente
- **D-33 · Recuperación con clave de rescate y aprobación.** Cada alias recibe una clave de 6 caracteres (`K7P-2MX`, sin 0/O/1/I).
  - El alumno la ve en el botón ⓘ del juego («Información: clave de rescate y créditos») y debe apuntarla en el cuaderno.
  - Con la clave, la partida se recupera al instante desde otro móvil (sin distinguir mayúsculas y con o sin guion).
  - Sin clave, o con una clave incorrecta, queda una solicitud pendiente que el docente aprueba o rechaza en `/consola`.
  - Motivo: iOS borra los datos del sitio tras 7 días sin visitarlo y no conviene aprobar 10 solicitudes a mano en mitad de una clase.
- **D-34 · Alertas de malestar: nada visible para el alumno.** Solo el docente las ve en la consola, con el texto que las motivó, y puede marcarlas como vistas.

### Propuestas técnicas
- **D-35 · Snapshots del Centro** (`class_snapshot(class_id, force)`), con k = 5:
  - **En directo** (conectados, progreso por anomalía, fases): se recalcula en cada petición y no revela decisiones. Los grupos de 1 a 4 personas llegan como `null` y se muestran como «<5».
  - **Resultados** (decisiones, mundo medio, conceptos, finales): solo se recalculan con un lote de ≥ 5 decisiones nuevas, cuando bajan (alumno retirado) o al pulsar R. Las distribuciones solo existen con ≥ 5 respuestas.
  - **Riesgo residual aceptado:** pulsar R publica al momento, así que quien lo pulse justo después de una única respuesta nueva podría aislarla. Lo controla solo el docente y el Centro nunca muestra quién respondió.
- **D-36 · Aviso en directo por Realtime Broadcast privado** (`class:<id>`).
  - Un trigger en `runs` y `answers` envía solo «changed», sin datos. Únicamente el docente de la clase puede suscribirse (política en `realtime.messages`).
  - El Centro agrupa los avisos (1,5 s) y pide el snapshot; si la red del centro corta los WebSocket, sondea cada 20 s.
- **D-37 · Vista proyectable** (`/centro?clase=<id>`, 16:9): reloj, conectados, seis paneles y teletipo.
  - Las decisiones están ocultas hasta pulsar R. Atajos: R, ← →, Esc, F, M y H.
  - La línea temporal se retuerce según el Desnivel medio y a partir de +25 se vuelve inestable (discontinua, en rojo).
  - Ambiente sonoro a volumen bajo; de momento reutiliza la pista del 2077.
  - Con movimiento reducido, el teletipo queda fijo.
- **D-38 · Etiqueta breve por opción** (`corto`, como mucho 40 caracteres) para la línea temporal, el teletipo y las leyendas.
- **D-39 · Simulador de clase** (`npm run simular`): hasta 30 alumnos `sim-vivo-NN@anomalia.invalid` que juegan a la vez.
  - Por defecto escribe con las mismas `svc_*` que `partida`, sin IA (textos de relleno y respaldos).
  - Con `--api` pasa por la Edge Function y gasta llamadas reales.

### Pendientes (no bloquean M3)
- El panel de finales se llenará en el M4, cuando el epílogo calcule y guarde el final de cada partida.
- Contenido de D2–D5 (M5): hasta entonces el Centro las muestra como «D2»… y sin datos.
- Ambiente sonoro propio del Centro de Control.
- Consulta al DPD sobre la IA externa y las alertas (sigue abierta).

## 2026-10-22 · M4 (expediente PDF)

### Tomadas por el docente
- **D-40 · Tipografía incrustada en el PDF:** Atkinson Hyperlegible (SIL OFL), pensada para baja visión, con el complemento oficial `@pdf-lib/fontkit`.
  - pdf-lib y fontkit pesan unos 500 kB gzip. Van en un chunk propio (`vendor-pdf`) que solo se descarga al pulsar «Generar», y su hash no cambia entre despliegues.
  - Los caracteres que la fuente no tiene (emojis) se omiten en el PDF para que no salgan como cuadros.

### Propuestas técnicas
- **D-41 · Verificación con una RPC (`verify_run`) en lugar de la Edge Function `verify-code`** (cambio sobre §11.6).
  - El docente ya tiene sesión, así que basta con comprobar en SQL que el código es de una de sus clases. Otro docente, o el propio alumno, recibe `null`.
  - Acepta el código en minúsculas, con o sin «ANM» y con guiones o espacios.
  - Devuelve las decisiones, los textos y la reflexión para compararlos con el PDF (D-03).
- **D-42 · El final se fija al entrar en el epílogo.** Lo calcula `partida` con `shared/game` (§5.6) y queda en `runs.ending`. Con eso se llena el panel de finales del Centro de Control.
- **D-43 · Reflexión final** (`content/reflexion.json`: pregunta y 150–250 palabras orientativas).
  - No pasa por la IA.
  - Es definitiva: el código de verificación certifica el texto, así que no se puede reescribir.
  - Si muestra indicios de malestar, crea una alerta privada. Las alertas ya no exigen una respuesta (`answer_id` puede ser nulo y llevan `player_id`).
- **D-44 · Código de verificación `ANM-XXXX-XXXX`.** Lo genera el servidor al archivar la reflexión, sin caracteres ambiguos (32⁸ combinaciones), y se imprime en la portada y en el pie de cada página.
- **D-45 · Nombre real (§9).**
  - Solo existe en la memoria de la pantalla del expediente y en la portada del PDF.
  - No se guarda en borradores, no se envía y no va en los metadatos del PDF.
  - El campo tiene `autocomplete="off"`. Si se cambia el nombre, hay que volver a generar el PDF.
- **D-46 · Imagen del final.** Mientras no haya imágenes propias de cada final (M5/M6), el PDF usa la del 2077 con su crédito CC BY. El WebP se convierte a JPEG en el móvil, porque pdf-lib no lee WebP. Si falla, el PDF sale sin imagen.
- **D-47 · Entrega.** Botón «Compartir o subir» (Web Share API con archivo) cuando el navegador lo permite y «Descargar el PDF» siempre.
- **`my_dossier()`:** el alumno lee sus decisiones y textos desde el epílogo, para recordarlas al escribir la reflexión y para generar el PDF.

### Pendientes (no bloquean M4)
- Textos de los finales (M5): hasta entonces el epílogo y el PDF muestran la marca `TODO(contenido)`.
- Imagen propia de cada final, con su crédito en `finales.json` (M5/M6).
- Mapeo de la rúbrica con el currículo oficial (§15). El PDF imprime C1–C5 tal como están en `content/rubrica.json`.

