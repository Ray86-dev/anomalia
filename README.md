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

### Supabase

El proyecto «anomalia» (ref `kicpndzbcswxchxiejje`, región eu-west-1) ya está creado y configurado. En un equipo nuevo:

1. Inicia sesión en la CLI con `npx supabase login` y vincula el proyecto con `npx supabase link --project-ref kicpndzbcswxchxiejje`. No necesitas la contraseña de la base de datos.
2. Aplica las migraciones con `npm run db:push`, despliega la función con `npm run functions:deploy` y regenera los tipos con `npm run db:types`.
3. La configuración de Auth vive en `supabase/config.toml`: inicio de sesión anónimo activado y limitado a 150/h, porque el aula comparte una sola IP.
   - Para aplicarla, lanza `npx supabase config push`.
   - **Revisa el diff antes de confirmar**: los valores locales sustituyen a los remotos.
4. CORS de las Edge Functions: `npx supabase secrets set ALLOWED_ORIGINS=https://ray86-dev.github.io,http://localhost:5173`.
5. Docentes: crea el usuario en Authentication → Users → Add user, marcando *Auto Confirm User*. Después añádelo a la lista blanca con `npm run teacher:add -- tu@correo "Tu nombre"`.
6. Datos de prueba: `npm run seed:demo` recrea la clase **PRUEBA** con 30 alumnos simulados. Su docente de demostración es `docente.demo@anomalia.invalid`, con la contraseña `DEMO_TEACHER_PASSWORD` de `.env.local`.

## Calidad

```bash
npm run check              # contenido + tipos + lint + formato + tests unitarios
npm run test:integration   # RLS y Edge Functions contra Supabase (necesita .env.local)
```

## Despliegue

Cada push a `main` publica en GitHub Pages mediante `.github/workflows/deploy.yml`. Las variables públicas `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` se configuran como *Variables* de Actions en el repositorio.

**No despliegues durante una clase**: los móviles perderían los archivos que ya tienen cargados.
