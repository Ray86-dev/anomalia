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

## 2026-10-22 · Alineación con los materiales de clase

Revisión del contenido frente a los materiales que el docente trabajó antes de la actividad: una sesión sobre ciencia y filosofía (datos que se comprueban frente a razones que se discuten) y una ficha de *Gattaca*. Los materiales no se versionan (`no_git_materiales/`).

### Tomadas por el docente
- **D-48 · Cuatro conceptos nuevos en la lista cerrada:** discriminación, naturaleza y cultura, bioética, y datos y razones. Son 20 en total.
- **D-49 · Rúbrica vinculada al currículo** (Filosofía 4.º ESO, Decreto 30/2023 de Canarias). Cierra el pendiente del §15.
  - C1 → 1.1; C2 → 3.1; C3 → 2.1; C4 → 1.1; C5 → 2.1 y 3.1.
  - Sin ponderaciones: las fija el docente en el aula virtual.
  - Se imprime en la rúbrica del PDF (`rubrica.json › referencia` y `criterios[].curriculo`).
- **D-50 · Archivo real de D1:** añade que en los *Discorsi* Galileo explicaba cómo había medido la caída de los cuerpos con bolas en planos inclinados. Enlaza con lo trabajado en clase. Va marcado `TODO(verificar)` hasta que lo revise el docente.
- **D-51 · La IA puede apoyarse en la distinción entre datos y razones** cuando encaje con la objeción, con esas mismas palabras y sin repetirla en todas las respuestas. Comprobado con `npm run ai:probe`.

### Propuestas de contenido
- **D-52 · Vocabulario de la unidad dentro del juego**, en lenguaje literal:
  - **Prólogo:** el Archivo guarda los datos, pero los datos no dicen qué debemos hacer; por eso hace falta alguien que decida con razones.
  - **Escena de D1:** lo que muestran los dibujos se puede comprobar con el telescopio; lo que debe hacer Galileo se decide con razones.
  - **Reflexión final:** una pista bajo la pregunta (`reflexion.json › pista`).

### Para el M5 (ideas de los materiales; los datos se verifican antes de escribirlos)
- **D4:** enlazar con «predecir no es decidir»: una probabilidad genética no es un destino.
- **D5:**
  - Eco del mito de los metales de Platón (*La República*): en la Ley del Genoma, el «metal» sería el índice genómico.
  - Posible voz documental: la Declaración Universal sobre el Genoma Humano y los Derechos Humanos (UNESCO, 1997) y su artículo sobre la no discriminación por características genéticas. La cita literal debe verificarse.
- **Coherencia con la ficha de *Gattaca*:** CRISPR desde 2012 y el caso de 2018, condenado por la comunidad científica y con pena de prisión.
- **Lectura fácil y textos de los finales:** frases literales y sin metáforas en todo lo que indique qué hay que hacer.

## 2026-10-22 · M5 (contenido completo)

### Tomadas por el docente
- **D-53 · D3: el permiso se le pide a Henrietta Lacks** (cambio sobre §5). En 1951 estaba viva y en tratamiento cuando se tomó la muestra. La escena ocurre cuando la muestra llega al laboratorio:
  - B) no usarlas hasta pedirle permiso a ella y explicarle para qué;
  - C) usarlas, pero informarla a ella y a su familia y compartir los beneficios.
- **D-54 · Imágenes y música de D2–D5 en el M6.** Hasta entonces, cada época usa su fondo generado y la música del 2077.

### Propuestas de contenido
- **D-55 · Personas reales:**
  - **Clara Immerwahr (D2):** aparece como «Voz de la historia», en una tarjeta aparte en el Consejo. Solo se describe su postura, sin frases inventadas y sin mencionar su muerte.
  - **He Jiankui (D4):** solo se le nombra en el Archivo real; en la escena es «un investigador», sin frases suyas.
  - **Henrietta Lacks (D3):** no habla y siempre se la nombra por su nombre.
- **D-56 · D5 es dinámica.** El juego pasa a Ink `poder`, `responsabilidad`, `equidad`, `confianza`, `desnivel` y `rama_<id>`.
  - La escena cambia con Desnivel ≥ 25 o ≥ 10, equidad < 40, confianza < 35 y las ramas `d1-firme` y `d2-denuncia`. Esta última es nueva: la abre la opción C de D2.
  - Cierra con el eco del mito de los metales de Platón trabajado en clase.
- **D-57 · Consejero que objeta en cada opción** (el que más se opone a ella):
  - D2: A Gil, B Calvo, C Novak.
  - D3: A Kaltz, B Calvo, C Jonás.
  - D4: A Jonás, B Novak, C Gil.
  - D5: A Kaltz, B Novak, C Calvo.
- **D-58 · Lectura fácil activable por el alumno:**
  - Botón con icono de libro en la barra del juego. Se recuerda en el móvil y cambia al momento todos los textos.
  - Las escenas pasan a su versión `<id>-facil`, y también el prólogo (`lectura-facil/prologo.ink`).
  - El expediente PDF usa la versión activa.
  - Todo el contenido tiene ya su versión `facil`: `npm run content:strict` solo falla por las marcas pendientes de verificar.
- **D-59 · Archivo real de D5:** el 2077 es ficción, así que se cuenta el marco real del debate: la Declaración Universal sobre el Genoma Humano y los Derechos Humanos (UNESCO, 1997) y el Convenio de Oviedo (1997, ratificado por España). Está marcado `TODO(verificar)`.
- **D-60 · Textos de los cinco finales**, en versión normal y fácil. «Equilibrio frágil» cierra con la idea de la unidad: los datos dicen cómo son las cosas, pero qué hacer con ellos se decide con razones.
- **`npm run ai:probe -- --dilema dN`** prueba la IA real en cualquier dilema. Se probó D2–D5.

### Pendiente de verificación por el docente
Datos que no están en el documento de diseño (marcados `TODO(verificar)`). Además, los cinco Archivos reales siguen con `verificado: false`.
- **D1:** motivo del proceso; dibujos de la Luna y de las manchas solares; los *Discorsi* y los planos inclinados.
- **D2:** la Primera Guerra Mundial en 1915; el amoníaco obtenido a partir del nitrógeno del aire.
- **D3:** antes de HeLa, las células humanas no sobrevivían mucho tiempo en el laboratorio; la segregación racial en los hospitales de Estados Unidos en 1951.
- **D4:** CRISPR existe desde 2012.
- **D5:** el mito de los metales (Platón, *La República*); la Declaración de la UNESCO de 1997 y el Convenio de Oviedo.

## 2026-10-22 · M6 (jugabilidad)

Tras jugar D1–D3, el docente concluye que el juego hace pensar pero se lee como «una novela de texto»: mucho que leer y escribir, y nada inesperado. Plan aprobado: menos texto y más juego, con la misma privacidad.

### Tomadas por el docente
- **D-61 · Nueva numeración de hitos:** M6 Jugabilidad; M7 Recursos y pulido (imágenes y música, también las del Archivo de D3–D5, efectos del Desnivel, PWA y voz); M8 Prueba real. Sustituye a D-54: las imágenes y la música de D2–D5 pasan al M7.
- **D-62 · Menos texto** (cambio sobre §6 y D-43):
  - justificación de 25–50 palabras, réplica de 15–35 y reflexión final de 100–180 (antes 40–80, 30–60 y 150–250);
  - escenas de D1–D4 con título, tres líneas y la pregunta;
  - cada consejero tiene una `frase` (una sola frase, como mucho 20 palabras) y su argumento completo queda tras «Leer más»;
  - la IA pide 45 palabras para la objeción y 35 para el cierre; los respaldos no pasan de 50 y 40 (lo comprueba el validador).
- **D-63 · Réplica guiada:** el alumno elige postura (le doy parte de razón, matizo, la rebato) y completa un comienzo de frase editable. Enviar el comienzo sin añadir nada cuenta como vacío. La postura llega a la IA como valor enumerado (nunca como texto libre) y se guarda en `answers.reply_stance`.
- **D-64 · Decisión en dos pasos con un giro:**
  - `choose` guarda una elección provisional (fase `twist`, `runs.pending_choice`) sin tocar el mundo; `confirm` aplica los deltas una sola vez y crea la respuesta con `first_choice`.
  - Se quita el diálogo «Alterar la historia»: el giro hace de reconsideración.
  - Los cinco giros son ficción (`fuente: ficcion`) y neutrales: mantener o cambiar valen lo mismo, también en puntos.
  - El Centro solo cuenta decisiones confirmadas (test de integración).
- **D-65 · Laboratorio antes del Consejo** (fase `lab`): un experimento corto por dilema para comprobar un dato antes de decidir con razones.
  - D1 telescopio (lunas de Júpiter), D2 reactor de amoníaco, D3 microscopio (dos cultivos), D4 guía de CRISPR sobre un ADN de ejemplo, D5 umbral de un Índice Ω inventado.
  - Sin temporizador ni forma de fallar; «Ir al ágora» aparece al terminar, con el «Dato del laboratorio».
  - Cuidados: D3 nombra a Henrietta Lacks con respeto; D4 nunca edita un embrión ni plantea «ganar»; D5 usa un índice ficticio, no una enfermedad.
- **D-66 · Ari:** 15 años, vive en el 2077 que construye el alumno y le escribe en el prólogo (`# ari`), tras cada decisión (`ondas.ari`) y en el epílogo (`finales[].ari`). Habla en primera persona sin marcas de género.
- **D-67 · Ecos y D5 más breve:**
  - las escenas de D2–D4 empiezan con una línea `# eco` que recuerda la decisión del último dilema jugado (variables Ink `eleccion_dN`); el validador solo admite ecos de dilemas anteriores;
  - D5 muestra el mundo y una sola consecuencia, por prioridad: desigualdad, desconfianza, denuncia de 1915 y Galileo firme;
  - ninguna escena pasa de 6 líneas con ninguna combinación de mundo y decisiones (test en `src/engine/ink.test.ts`).
- **D-68 · Logros y recompensas** (al estilo de «Diálogo Socrático»):
  - 10 movimientos que reconoce la IA (lista cerrada, como mucho 3 por texto y solo si el alumno los hace de verdad) y 9 hitos con reglas fijas (`content/logros.json`). Si la IA falla, no hay movimientos.
  - +10 la primera vez, +3 cada repetición y +5 por cada concepto nuevo (estrella de la constelación).
  - Rangos por anomalía de la clase: Aprendiz del Archivo 0, Cronista 15, Voz del Ágora 30, Memoria del Archivo 45 y Leyenda del Tiempo 60. Calibrados con `npm run simular` (25 alumnos: mediana de 47 puntos por anomalía) y `npm run ai:probe` (unos 2 movimientos por texto).
  - Fichas secretas del Archivo (2 por dilema) y emblema personalizable (8 símbolos y 6 colores que se abren con puntos).
- **D-69 · Los puntos no evalúan:** no premian ninguna opción, no hay clasificación y nada de esto llega al Centro ni a la consola. El PDF lo recoge en una última página, «Logros del cronista», que dice que no forma parte de la nota. Cambiar el emblema no avisa al Centro (`runs_notify` solo salta con fase, dilema, mundo, final y cierre).
- **D-70 · Barra del juego:** emblema y puntos a la izquierda (abren el panel de logros: Logros, Constelación, Fichas y Emblema); los avisos de logros salen como una fila dentro de la barra, nunca encima del texto; el rótulo del lugar baja a la pantalla.
- **Descartado por el docente:** el momento ágora colectivo y los logros de clase en el proyector.

### Propuestas técnicas
- **D-71 · Progreso en cada estado** (`private.run_progress`, `run.progress`): el móvil calcula logros, avisos, rango y recompensas con `shared/game/achievements.ts`. `partida` usa la misma función para validar que el emblema elegido está desbloqueado.

### Pendiente de verificación por el docente (M6)
Los giros, los ecos, Ari y el Índice Ω son ficción. Llevan `TODO(verificar)`:
- **Datos del laboratorio** (`laboratorio.dato`, con `verificado: false` en D1–D4):
  - D1: Galileo observó las lunas de Júpiter con su telescopio;
  - D2: la química del nitrógeno sirve también para fabricar explosivos;
  - D3: las células normales mueren en pocos días y las de la muestra siguen dividiéndose;
  - D4: CRISPR puede cortar también en sitios parecidos, y en un embrión el cambio pasaría a todas sus células y a sus hijos.
- **Las 10 fichas secretas** (`content/fichas.json`, todas con `verificado: false`).
