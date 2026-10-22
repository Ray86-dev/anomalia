/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

/** CSP por <meta>: GitHub Pages no permite cabeceras propias. Solo en build (el dev server usa scripts inline). */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  const supabase = supabaseUrl ? new URL(supabaseUrl) : null;
  const connect = supabase ? `${supabase.origin} wss://${supabase.host}` : '';
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: data:", // Howler desbloquea el audio móvil con un clip data: silencioso
    "font-src 'self'",
    `connect-src 'self' ${connect}`.trim(),
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return {
    name: 'anomalia-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
        injectTo: 'head-prepend',
      },
    ],
  };
}

/** Los textos de index.html también salen de content/ (regla «contenido como datos»). */
function htmlTexts(): Plugin {
  return {
    name: 'anomalia-html-texts',
    transformIndexHtml(html) {
      const raw: unknown = JSON.parse(readFileSync(`${root}content/interfaz.json`, 'utf8'));
      const app = (raw as { app: { titulo: string; sinJavascript: string } }).app;
      return html.replace('%APP_TITULO%', app.titulo).replace('%APP_SIN_JS%', app.sinJavascript);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  return {
    base: env.VITE_BASE_PATH ?? '/',
    plugins: [react(), htmlTexts(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
    resolve: {
      alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
    },
    build: {
      // Móviles del alumnado: incluye iPhone antiguos (iOS 15).
      target: ['es2020', 'safari15', 'chrome100', 'firefox100', 'edge100'],
      rolldownOptions: {
        output: {
          // Librerías en chunks propios: su hash no cambia entre despliegues de la app, así que
          // los móviles las reutilizan de caché y un despliegue no las invalida.
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              },
              { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
              { name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/ },
              // Solo se descarga al generar el expediente PDF (unos 500 kB gzip).
              { name: 'vendor-pdf', test: /node_modules[\\/](pdf-lib|@pdf-lib)[\\/]/ },
            ],
          },
        },
      },
    },
    test: {
      include: [
        'shared/**/*.test.ts',
        'src/**/*.test.{ts,tsx}',
        'scripts/**/*.test.ts',
        'supabase/functions/**/*.test.ts',
      ],
    },
  };
});
