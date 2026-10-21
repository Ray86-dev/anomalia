# ANOMALÍA — Documento de diseño

> Videojuego narrativo de dilemas filosóficos sobre la ciencia para Filosofía de 4.º ESO.
> Cierre de la unidad «Ciencia vs. filosofía», tras el visionado de *Gattaca*.
> Título provisional: **ANOMALÍA** (guiño doble: anomalía temporal y anomalía en el sentido de Kuhn).
>
> Estado: diseño cerrado para iniciar desarrollo con Claude Code.
> Versión: 1.0 · Octubre 2026

---

## 1. Visión en una frase

Cada alumno viaja, desde su móvil, a cinco momentos decisivos de la historia de la ciencia; sus decisiones reescriben el futuro de Canarias en 2077, un personaje con IA rebate sus argumentos y, al final, el juego genera un expediente en PDF evaluable que el alumno sube al aula virtual. Mientras tanto, el aula entera ve en el proyector un **centro de control** anónimo que muestra cómo la clase está alterando la historia.

## 2. Objetivos didácticos

- Distinguir qué preguntas puede responder la ciencia y cuáles exigen reflexión filosófica (**ser / deber ser**, Hume).
- Reconocer que la ciencia no es neutral en sus aplicaciones y que el conocimiento genera responsabilidad.
- Conocer y aplicar posturas éticas: utilitarismo, deontología kantiana, principio de responsabilidad (Jonas), tecnooptimismo/cientificismo y tecnocrítica (Anders, desnivel prometeico).
- Argumentar por escrito, recibir una objeción y responderla (diálogo crítico).
- Conectar casos históricos reales con los problemas planteados en *Gattaca* (eugenesia, determinismo genético, discriminación).

> **Pendiente (docente):** mapear cada objetivo con los criterios de evaluación y saberes básicos del currículo canario de Filosofía de 4.º ESO. Ver §12.

## 3. Restricciones del contexto

| Restricción | Decisión de diseño |
|---|---|
| 1–2 sesiones de 50 min | Juego dividido en 2 capítulos desbloqueables por el docente. Modo 1 sesión con 3 dilemas. |
| Móvil del alumnado | Diseño vertical *mobile-first*, PWA, assets ligeros, música en streaming. |
| Juego individual | Cada alumno su partida; lo colectivo vive en el centro de control proyectado. |
| Login | Solo **alias + código de clase**. Sin email, sin nombre real en servidor. |
| Entrega | PDF descargado/compartido por el alumno y subido al aula virtual desde su cuenta. |
| Proyector | Vista «Centro de Control» a pantalla completa en el PC del docente, 100 % anónima. |
| IA | Un único proveedor y modelo, elegido por el docente, configurable por variables de entorno. |
| Backend | Supabase. |
| Hosting | Cualquiera **excepto Vercel** (Cloudflare Pages o Netlify). |
| Alumnado NEAE | Opciones de accesibilidad integradas (ver §10). |

## 4. Concepto narrativo

### 4.1 Premisa

Año 2077. Canarias alberga el **Archivo de Mnemósine**, una IA que custodia la memoria de la ciencia. El Archivo ha detectado una *anomalía*: la línea temporal se está deshilachando y cinco decisiones del pasado han quedado «abiertas». El alumno es reclutado como **Cronista**: debe viajar a esos momentos y decidir. Cada decisión cierra la anomalía… pero en una dirección distinta.

Al volver de cada viaje, el alumno ve cómo ha cambiado el 2077 (titulares, paisaje, música) y recibe una ficha **«Archivo real»** con lo que ocurrió de verdad. Así se aprende la historia real a la vez que se explora la alternativa.

### 4.2 El Consejo (personajes recurrentes)

Cinco consejeros holográficos acompañan al Cronista. En cada dilema intervienen **tres** (para no saturar la pantalla del móvil). Sus nombres son guiños, no caricaturas: deben argumentar bien.

| Personaje | Postura | Idea fuerza |
|---|---|---|
| **Jem Calvo** | Utilitarismo (Bentham, Mill) | Elige lo que produzca más bienestar para más personas. |
| **Inés Kaltz** | Deontología (Kant) | Hay cosas que no se hacen nunca; las personas no son solo medios. |
| **Hana Jonás** | Principio de responsabilidad (Jonas) | Si no conocemos las consecuencias, prudencia ante lo irreversible. |
| **Dex Novak** | Tecnooptimismo / cientificismo | La ciencia avanza y resuelve; frenarla es el verdadero riesgo. |
| **Ander Gil** | Tecnocrítica (Anders) | Fabricamos más de lo que somos capaces de imaginar y de sentir. |

**Mnemósine** (la IA del Archivo) es la narradora: neutral, algo inquietante, nunca da la respuesta.

### 4.3 Estado del mundo

Cuatro variables (0–100, inicio 50) que viajan con la partida y se muestran como indicadores:

- **PODER** — capacidad técnica de la humanidad.
- **RESPONSABILIDAD** — capacidad de comprender y responder por lo que se hace.
- **EQUIDAD** — reparto justo de beneficios y riesgos.
- **CONFIANZA** — confianza social en la ciencia.

**Desnivel prometeico** = PODER − RESPONSABILIDAD. Es la mecánica distintiva: cuanto mayor es, más inestable se vuelve el 2077 (efectos visuales de *glitch*, música disonante, titulares alarmantes).

## 5. Los cinco dilemas

> **Regla de contenido:** los hechos históricos deben ser exactos. Los diálogos de personajes reales son ficción didáctica y **no se inventan citas textuales** atribuidas a personas reales. Cada dilema cierra con la ficha «Archivo real».

Los deltas numéricos son orientativos y se equilibrarán en las pruebas.

### Capítulo I (Sesión 1)

#### D1 · Roma, 1633 — Galileo ante la Inquisición
- **Tema:** autoridad frente a evidencia. ¿Qué cuenta como conocimiento? Ciencia y creencia.
- **Rol del Cronista:** joven asistente de Galileo la noche antes de la sentencia.
- **Opciones:**
  - A) Aconsejarle abjurar para salvar la vida y seguir investigando → CONFIANZA −5, RESPONSABILIDAD +5.
  - B) Aconsejarle mantenerse firme en público → CONFIANZA +10, PODER +5, riesgo personal (rama alternativa).
  - C) Difundir en secreto sus escritos fuera de Italia → PODER +10, EQUIDAD +5.
- **Consejeros:** Inés Kaltz, Dex Novak, Hana Jonás.
- **Archivo real:** Galileo abjuró en 1633, fue condenado a arresto domiciliario y siguió trabajando; sus *Discorsi* se publicaron en Leiden en 1638.

#### D2 · Berlín, 1915 — Fritz Haber y la química de la guerra
- **Tema:** ¿es neutral la ciencia? Responsabilidad del científico. El mismo saber alimenta y mata.
- **Contexto:** la síntesis de amoníaco (Haber–Bosch) permitió fertilizantes a escala masiva; en 1915 Haber dirigió el programa alemán de gas cloro (Ypres). Clara Immerwahr, química y su esposa, se oponía.
- **Rol del Cronista:** químico del equipo de Haber.
- **Opciones:**
  - A) Participar en el programa de gas → PODER +15, RESPONSABILIDAD −15, CONFIANZA −10.
  - B) Negarse y abandonar el laboratorio → RESPONSABILIDAD +10, PODER −5.
  - C) Hacer pública la existencia del programa → CONFIANZA +5, RESPONSABILIDAD +10, EQUIDAD +5, rama de represalia.
- **Consejeros:** Jem Calvo, Ander Gil, Dex Novak. Clara Immerwahr aparece como voz histórica contraria.
- **Sensibilidad:** **no mencionar la muerte de Clara Immerwahr** (alumnado de 15–16 años). Basta con su oposición pública.
- **Archivo real:** Haber recibió el Nobel de Química de 1918 por la síntesis del amoníaco; el uso de gas cloro en Ypres (abril de 1915) inauguró la guerra química a gran escala.

#### D3 · Baltimore, 1951 — Las células de Henrietta Lacks
- **Tema:** consentimiento, justicia y quién se beneficia de la ciencia. Desigualdad racial y de clase.
- **Contexto:** células de un tumor de Henrietta Lacks, mujer afroamericana tratada en el Hospital Johns Hopkins, se extrajeron sin su consentimiento y dieron lugar a la línea HeLa, clave para la vacuna de la polio y miles de investigaciones. Su familia no fue informada durante décadas.
- **Rol del Cronista:** técnico de laboratorio que recibe la muestra.
- **Opciones:**
  - A) Usar las células sin más: el avance médico lo justifica → PODER +15, EQUIDAD −15, CONFIANZA −5.
  - B) No usarlas hasta obtener consentimiento de la familia → RESPONSABILIDAD +10, PODER −10.
  - C) Usarlas, pero exigir que se informe a la familia y que comparta beneficios → EQUIDAD +10, RESPONSABILIDAD +5, PODER +5.
- **Consejeros:** Jem Calvo, Inés Kaltz, Hana Jonás.
- **Sensibilidad:** tratamiento respetuoso; Henrietta no es un personaje con diálogo inventado.
- **Archivo real:** la línea HeLa fue fundamental para la vacuna de la polio; el caso se convirtió en referente de la bioética del consentimiento informado.

### Capítulo II (Sesión 2)

#### D4 · Shenzhen, 2018 — Los primeros bebés editados con CRISPR
- **Tema:** límites de la edición genética, terapia frente a mejora, eugenesia. **Puente directo con *Gattaca*.**
- **Contexto:** en 2018 el investigador He Jiankui anunció el nacimiento de dos gemelas con el gen CCR5 editado; la comunidad científica lo condenó y en 2019 fue condenado a prisión en China.
- **Rol del Cronista:** colega científico al que se consulta antes de la implantación (rol ficticio; **no se inventan diálogos del investigador real**).
- **Opciones:**
  - A) Apoyar el experimento: proteger frente al VIH es un bien → PODER +15, RESPONSABILIDAD −10.
  - B) Denunciarlo antes de que ocurra → RESPONSABILIDAD +15, CONFIANZA +5, PODER −5.
  - C) Callar y no implicarse → CONFIANZA −10, RESPONSABILIDAD −5.
- **Consejeros:** Dex Novak, Hana Jonás, Ander Gil.
- **Archivo real:** el experimento siguió adelante, se conoció tras el nacimiento y provocó llamamientos internacionales a una moratoria de la edición de la línea germinal.

#### D5 · Canarias, 2077 — La Ley del Genoma
- **Tema:** el mundo construido por el alumno le plantea la decisión final. Eco explícito de *Gattaca*.
- **Contexto dinámico:** el escenario se describe según el estado del mundo y las ramas abiertas (por ejemplo, si el Desnivel es alto, la sociedad ya usa perfiles genéticos de forma generalizada).
- **Rol del Cronista:** voto decisivo en el Consejo de Canarias.
- **Opciones:**
  - A) Índice genómico obligatorio para estudios y empleo («eficiencia») → PODER +10, EQUIDAD −20.
  - B) Edición solo terapéutica, pública y gratuita → EQUIDAD +10, RESPONSABILIDAD +10.
  - C) Moratoria total de la edición genética → RESPONSABILIDAD +10, PODER −15.
- **Consejeros:** los cinco, en ronda breve.

### 5.6 Finales

Se calculan con el estado final. Textos preescritos (sin IA), con una pieza visual y musical propia.

| Final | Condición orientativa | Imagen de 2077 |
|---|---|---|
| **Tecnocracia genómica** | Desnivel ≥ 25 y EQUIDAD < 40 | Mundo *Gattaca*: válidos y no válidos. |
| **Era del cuidado** | RESPONSABILIDAD ≥ 65 y EQUIDAD ≥ 60 | Ciencia lenta, compartida y vigilada. |
| **Fractura** | CONFIANZA < 35 | Sociedad que ya no cree a nadie. |
| **Estancamiento** | PODER < 35 | Mundo prudente pero sin capacidad de responder a crisis. |
| **Equilibrio frágil** | Resto de casos | Nada resuelto; todo depende del siguiente paso. |

## 6. Bucle de juego por dilema (~9–10 min)

1. **Viaje** (30 s) — transición cinematográfica; cambia la música a la de la época.
2. **Escena** (2 min) — contexto narrado por Mnemósine, ilustraciones con parallax.
3. **Consejo** (2 min) — tres consejeros exponen su postura (tarjetas deslizables).
4. **Decisión** (30 s) — elegir A/B/C, con confirmación («Esto alterará la historia»).
5. **Justificación** (2 min) — escribir 40–80 palabras. Pregunta guiada específica del dilema.
6. **Objeción socrática** (2 min) — un consejero (el que más se opone a la decisión) rebate *el argumento concreto* del alumno mediante IA. El alumno responde una vez (30–60 palabras). El consejero cierra con una reacción breve.
7. **Ondas temporales** (1 min) — el 2077 cambia: titular alternativo, indicadores animados, efecto visual según el Desnivel.
8. **Archivo real** (30 s) — ficha con lo que ocurrió de verdad.

**Final de la partida (sesión 2):** epílogo → **Reflexión final** (150–250 palabras) → generación del PDF → compartir/subir.

**Pregunta de la reflexión final:**
> «¿Puede la ciencia decirnos lo que *debemos* hacer? Responde usando al menos una de tus decisiones y la postura de al menos un consejero.»

## 7. Uso de la IA

Un único proveedor y modelo, elegido por el docente. Debe ser **rápido** (la latencia en móvil rompe la inmersión).

### 7.1 Llamadas

| Llamada | Cuándo | Entrada | Salida (JSON estricto) |
|---|---|---|---|
| `objecion` | Tras la justificación | dilema, opción elegida, consejero objetor, justificación | `{ calidad: "vacia"\|"basica"\|"solida", conceptos: string[], objecion: string, alerta: boolean }` |
| `cierre` | Tras la réplica del alumno | lo anterior + réplica | `{ reaccion: string, conceptos: string[], alerta: boolean }` |

≈ 10 llamadas por alumno y partida. No hay corrección automática del expediente: **la nota la pone el docente** en el aula virtual.

### 7.2 Reglas

- **La API key nunca llega al cliente.** Todas las llamadas pasan por una Supabase Edge Function.
- Adaptador agnóstico: `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL` como variables de entorno.
- **Texto anonimizado:** al modelo solo se envía el texto del alumno y el contexto del dilema; nunca el alias ni el código de clase.
- **Prompts blindados:** el texto del alumno va delimitado como dato; se ignoran instrucciones dentro de él («ignora tus instrucciones…»). Salida validada contra esquema; si no valida, se usa el respaldo.
- **Estilo de la objeción:** máximo 60 palabras, en castellano, tono respetuoso y retador, en la voz del consejero, centrada en el argumento del alumno; nunca dice qué opción era la correcta.
- `calidad: "vacia"` → aviso suave («Mnemósine no puede archivar esto todavía…») y un reintento; nunca bloquea definitivamente.
- `conceptos` → solo valores de una **lista cerrada** (`content/conceptos.json`: dignidad, utilidad, consecuencias, consentimiento, responsabilidad, prudencia, libertad, justicia, igualdad, progreso, verdad, autoridad, evidencia, neutralidad, riesgo, determinismo…). Alimentan el centro de control sin mostrar texto libre.
- `alerta: true` si el texto contiene indicios de malestar personal grave o contenido muy inapropiado → aviso **privado** en la consola docente (nunca en el proyector).
- **Respaldo:** si la IA tarda más de 6 s o falla, se usa una objeción preescrita por consejero y opción. El juego **nunca** se detiene por la IA.
- **Límite de uso:** máximo 2 llamadas por alumno y dilema más un reintento; presupuesto máximo de llamadas por clase.

## 8. Centro de Control (vista proyectada)

Ruta `/centro`, pensada para 16:9 a pantalla completa en el PC del docente. Estética de **sala de control temporal**: fondo oscuro, tipografía monoespaciada, paneles con brillo, alertas tipo teletipo y sonido ambiente propio a bajo volumen.

### 8.1 Principio de anonimato (innegociable)

- **Nunca** se muestran alias, textos libres ni nada que permita saber quién hizo qué.
- **Umbral k = 5:** ninguna distribución de un dilema se muestra hasta que lo hayan respondido al menos 5 alumnos.
- Los datos llegan **agregados desde el servidor** (funciones RPC); el cliente del centro nunca recibe filas individuales.

### 8.2 Paneles

- **Reloj de sesión** y contador de **Cronistas conectados**.
- **Progreso por dilema:** cuántos alumnos hay en cada fase (barras).
- **Distribución de decisiones** por dilema (A/B/C), con **modo revelación**: oculta hasta que el docente pulsa una tecla. Genera suspense para el debate.
- **Estado del mundo de la clase:** media de las cuatro variables y **Desnivel prometeico** de la clase como gran indicador central.
- **Línea temporal de la clase:** 1633 → 2077 dibujada con la decisión mayoritaria en cada punto; se «tuerce» visualmente según el Desnivel.
- **Constelación de conceptos:** nube de los conceptos de la lista cerrada más usados en las justificaciones.
- **Teletipo de anomalías:** mensajes generados a partir de agregados («ANOMALÍA EN 1915: la mayoría ha detenido el programa de gas»).
- **Distribución de finales** al terminar.

### 8.3 Controles del docente (no visibles en proyección)

- Atajos de teclado en `/centro`: revelar/ocultar distribución, cambiar panel destacado, pantalla completa, silenciar.
- Ruta privada `/consola` (otra pestaña o segunda pantalla): crear clase, ver código, **desbloquear capítulo II**, aprobar recuperación de alias en otro dispositivo, renombrar o expulsar alias, ver alertas privadas, **verificar código de PDF** y borrar los datos de la clase.

## 9. Expediente PDF (documento evaluable)

Generado **en el dispositivo del alumno**.

- **Portada:** título, grupo y **nombre y apellidos escritos en el propio dispositivo** justo antes de generar el PDF. **No se envían al servidor.** Alias y **código de verificación** (por ejemplo, `ANM-7F3K-92QD`) vinculado a la partida.
- **Ruta temporal:** por cada dilema, la decisión, la justificación, la objeción recibida, la réplica del alumno y la ficha «Archivo real».
- **Estado final del mundo** e indicadores, final alcanzado e imagen.
- **Reflexión final.**
- **Rúbrica** (en blanco, para el docente).
- **Entrega:** botón «Compartir» (Web Share API con archivo) para subirlo al aula virtual; **Descargar** como alternativa.
- El docente puede comprobar en `/consola` que un código de verificación corresponde a una partida real (anti-falsificación).
- Tipografía embebida con soporte completo de tildes y ñ.

## 10. Experiencia, audio y accesibilidad

### 10.1 Visual (móvil)
- Vertical, 360–430 px de ancho, *safe areas*, `100dvh`, texto base ≥ 17 px.
- Escenas a pantalla completa con parallax por capas; transiciones cinematográficas; *glitch* y partículas ligados al Desnivel.
- Estética distinta por época: grabado barroco (1633), art déco industrial (1915), fotografía de los 50 (1951), clínico digital (2018), neón y solarpunk o distopía (2077, según el estado del mundo).
- Vibración en momentos clave (solo Android; degradación silenciosa en iOS).

### 10.2 Música y sonido
- Una pista por época: laúd y cuerda barroca, cuerdas de principios del XX, radio y jazz de los 50, electrónica mínima, synth ambiental.
- **Música adaptativa por capas (stems):** capas que entran o salen según el estado; disonancia creciente con el Desnivel.
- El audio se desbloquea con el toque en «Comenzar» (políticas de autoplay móviles).
- Formatos MP3/AAC (compatibilidad iOS); streaming, no empaquetado; volumen y silencio accesibles siempre.
- Todo subtitulado: el juego se entiende sin sonido.
- Ambiente sonoro propio para el centro de control.
- Licencias documentadas en `assets/LICENSES.md`.

### 10.3 Accesibilidad (incluye alumnado NEAE)
- Tamaño de texto ajustable.
- **Lectura en voz alta** (Web Speech API).
- **Modo lectura fácil:** versión simplificada de los textos de cada escena y de cada consejero (contenido paralelo en los datos).
- Movimiento reducido (`prefers-reduced-motion` y opción manual).
- Sin límites de tiempo de lectura; contraste AA.

## 11. Arquitectura técnica

### 11.1 Stack
- **Front:** Vite + React + TypeScript (estricto) + React Router.
- **Narrativa:** Ink (inkjs); historias compiladas en el *build*.
- **Gráficos:** Pixi.js (escenas, parallax, shaders); GSAP (transiciones).
- **Audio:** Howler.js.
- **PDF:** pdf-lib con fuente embebida.
- **PWA:** service worker con caché de assets ligeros.
- **Backend:** Supabase (Auth, Postgres con RLS, Edge Functions, Realtime).
- **Hosting:** Cloudflare Pages o Netlify (**no Vercel**). Supabase en región UE.

### 11.2 Rutas
- `/` — alumno: unirse con código de clase y alias, jugar y generar el expediente.
- `/centro` — centro de control proyectable (requiere sesión docente).
- `/consola` — consola privada del docente.

### 11.3 Contenido como datos
Todo el contenido vive en `content/`, separado del código, para poder editarlo sin programar y reutilizar el motor con otros temas:

```
content/
  dilemas/
    d1-galileo.ink   d1-galileo.json
    d2-haber.ink     d2-haber.json
    ...
  consejeros.json      # nombres, postura, estilo de voz, retratos
  finales.json
  conceptos.json       # lista cerrada para IA y centro de control
  respaldos.json       # objeciones preescritas por dilema/opción/consejero
  rubrica.json
  lectura-facil/       # versiones simplificadas
```

El `.json` de cada dilema incluye metadatos: año, lugar, opciones, deltas del estado, consejeros, pregunta de justificación, ficha «Archivo real» y assets.

### 11.4 Autenticación
- **Docente:** email y contraseña (Supabase Auth).
- **Alumno:** inicio de sesión anónimo de Supabase y fila en `players` con alias y clase. La sesión persiste en el dispositivo.
- Alias único por clase (3–16 caracteres, filtro de palabras inapropiadas).
- **Recuperación en otro dispositivo:** el alumno introduce el código y su alias; queda pendiente hasta que el docente lo aprueba en `/consola`, y entonces la partida se reasigna a la nueva sesión.

### 11.5 Modelo de datos (orientativo)

| Tabla | Campos clave |
|---|---|
| `classes` | id, code, teacher_id, chapter_unlocked, created_at, expires_at |
| `players` | id (auth uid), class_id, alias, status, created_at |
| `runs` | id, player_id, world_state (jsonb), current_dilemma, phase, ending, verify_code, finished_at |
| `answers` | id, run_id, dilemma_id, choice, justification, objection, reply, closing, concepts[], quality, flagged, timestamps |
| `recovery_requests` | id, class_id, alias, new_auth_uid, status |
| `ai_usage` | run_id, dilemma_id, calls, last_call_at |
| `class_aggregates` | class_id, payload (jsonb), updated_at — actualizada por triggers y emitida por Realtime |

- **RLS:** el alumno solo lee y escribe sus filas; el docente solo las de sus clases; `/centro` solo consume `class_aggregates` y RPC agregadas con umbral k.
- **Retención:** borrado de la clase desde la consola y borrado automático tras `expires_at` (por ejemplo, 30 días).

### 11.6 Edge Functions
- `ai-dialogo` — llamadas `objecion` y `cierre` (§7).
- `verify-code` — validación de códigos de PDF para el docente.

## 12. Evaluación

### 12.1 Rúbrica (4 niveles: Insuficiente · Suficiente · Notable · Sobresaliente)

| Criterio | Qué se observa |
|---|---|
| **C1. Comprensión de posturas** | Identifica y explica correctamente las posturas de los consejeros. |
| **C2. Argumentación** | Las justificaciones dan razones, no solo opiniones; son coherentes con la decisión. |
| **C3. Diálogo crítico** | La réplica responde de verdad a la objeción (concede, matiza o refuta). |
| **C4. Ciencia y filosofía** | La reflexión final distingue lo que la ciencia puede explicar de lo que debemos hacer. |
| **C5. Uso de conceptos y casos** | Emplea con precisión conceptos de la unidad y conecta casos históricos (y *Gattaca*). |

> **Pendiente (docente):** vincular C1–C5 con los criterios de evaluación oficiales de Filosofía de 4.º ESO (currículo de Canarias) y fijar las ponderaciones.

## 13. Planificación de aula

| Sesión | Minutos | Actividad |
|---|---|---|
| **1** | 0–5 | Entrar con código y alias; prólogo. Centro de control proyectado. |
| | 5–37 | D1, D2, D3 a ritmo individual. |
| | 37–50 | Debate con el centro de control: revelar distribuciones, Desnivel de la clase. |
| **2** | 0–3 | Retomar partida; el docente desbloquea el capítulo II. |
| | 3–25 | D4 y D5; epílogo. |
| | 25–37 | Reflexión final y generación del PDF. |
| | 37–50 | Distribución de finales en el proyector; debate de cierre; subida al aula virtual. |

**Modo 1 sesión:** D1, D3 y D4 (o selección del docente), sin D5; la reflexión final queda como tarea.

**Antes de la sesión:** comprobar la normativa del centro sobre uso pedagógico del móvil y la conectividad del aula.

## 14. Hitos de desarrollo

1. **M0 — Base:** repositorio, Vite + React + TS, Supabase (esquema, RLS, auth anónima y docente), despliegue de prueba.
2. **M1 — *Vertical slice*:** D1 completo jugable en móvil (sin IA, con respaldos), estado del mundo y guardado.
3. **M2 — IA:** Edge Function `ai-dialogo`, adaptador de proveedor, validación JSON, respaldo y límites.
4. **M3 — Centro de control y consola:** agregados, Realtime, umbral k, modo revelación, desbloqueo de capítulos, recuperación de alias.
5. **M4 — Expediente PDF:** generación, código de verificación, compartir/descargar, `verify-code`.
6. **M5 — Contenido completo:** D2–D5, finales, «Archivo real», lectura fácil.
7. **M6 — Pulido:** música adaptativa, efectos de Desnivel, transiciones, PWA, accesibilidad.
8. **M7 — Prueba real:** test en Android e iOS reales, prueba con 25 sesiones simultáneas, ensayo completo de las 2 sesiones.

## 15. Decisiones abiertas

- [ ] Proveedor y modelo de IA.
- [ ] Hosting: Cloudflare Pages o Netlify.
- [ ] Título definitivo (provisional: ANOMALÍA).
- [ ] Origen de ilustraciones y música (generación propia o bancos con licencia).
- [ ] Mapeo de la rúbrica con el currículo oficial.
- [ ] Duración de la retención de datos.
- [ ] Revisión de los textos históricos por el docente antes de usar en clase.
