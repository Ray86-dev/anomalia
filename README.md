# ANOMALÍA

Videojuego narrativo de dilemas filosóficos sobre la ciencia para Filosofía de 4.º ESO. El diseño completo está en [`docs/DISENO_ANOMALIA.md`](docs/DISENO_ANOMALIA.md) y las decisiones posteriores en [`docs/decisiones.md`](docs/decisiones.md).

- **Alumnado** (`/`): juega desde el móvil con un alias y el código de clase.
- **Centro de Control** (`/centro`): vista proyectable, anónima, con datos agregados (k ≥ 5).
- **Consola docente** (`/consola`): crear clases, desbloquear capítulos, ver alertas privadas y verificar PDF.

## Puesta en marcha

Requisitos: Node 22 o posterior y npm. No hace falta Docker.

```bash
npm install
cp .env.example .env.local   # y rellénalo (ver comentarios)
npm run dev                  # http://localhost:5173
npm run dev -- --host        # para abrirlo desde el móvil en la misma wifi
```

### Supabase (una vez)

1. Inicia sesión en la CLI: `npx supabase login`, o pon `SUPABASE_ACCESS_TOKEN` en `.env.local`.
2. Vincula el proyecto: `npx supabase link --project-ref <ref>`.
3. Aplica las migraciones con `npm run db:push` y despliega la función con `npm run functions:deploy`.
4. Configura CORS: `npx supabase secrets set ALLOWED_ORIGINS=https://ray86-dev.github.io,http://localhost:5173`.
5. Ajusta Auth en el panel de Supabase:
   - activa **Anonymous sign-ins**;
   - en **Rate limits**, sube los inicios de sesión anónimos a 150/h (el aula comparte una sola IP).
6. Crea tu usuario docente en Auth → Add user y añádelo a la lista blanca con `npm run teacher:add -- tu@correo`.

## Calidad

```bash
npm run check              # contenido + tipos + lint + formato + tests unitarios
npm run test:integration   # RLS y Edge Functions contra Supabase (necesita .env.local)
```

## Despliegue

Cada push a `main` publica en GitHub Pages mediante `.github/workflows/deploy.yml`. Las variables públicas `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` se configuran como *Variables* de Actions en el repositorio.

**No despliegues durante una clase**: los móviles perderían los archivos que ya tienen cargados.
