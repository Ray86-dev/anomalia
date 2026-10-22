/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
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

type AppTexts = { titulo: string; descripcion: string; sinJavascript: string };

function appTexts(): AppTexts {
  const raw: unknown = JSON.parse(readFileSync(`${root}content/interfaz.json`, 'utf8'));
  return (raw as { app: AppTexts }).app;
}

/** Los textos de index.html también salen de content/ (regla «contenido como datos»). */
function htmlTexts(): Plugin {
  return {
    name: 'anomalia-html-texts',
    transformIndexHtml(html) {
      const app = appTexts();
      return html.replace('%APP_TITULO%', app.titulo).replace('%APP_SIN_JS%', app.sinJavascript);
    },
  };
}

/**
 * PWA (M7): manifiesto con los textos de content/, iconos y un service worker propio sin
 * librerías (`pwa/service-worker.js`). Solo en build: en desarrollo no hay caché que estorbe.
 */
function progressiveWebApp(): Plugin {
  let base = '/';
  return {
    name: 'anomalia-pwa',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml() {
      const app = appTexts();
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` } },
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', href: `${base}icons/apple-touch-icon.png` },
        },
        { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' } },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
        {
          tag: 'meta',
          attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: app.titulo } },
      ];
    },
    generateBundle(_options, bundle) {
      const app = appTexts();
      const files = Object.keys(bundle)
        .filter((file) => /^assets\/.+\.(js|css)$/.test(file))
        .sort();
      // El PDF (unos 500 kB) solo se descarga al generar el expediente: no se guarda al instalar.
      const precache = [
        `${base}index.html`,
        ...files.filter((file) => !file.includes('vendor-pdf')).map((file) => base + file),
        `${base}favicon.svg`,
        `${base}manifest.webmanifest`,
      ];
      const build = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
      const worker = readFileSync(`${root}pwa/service-worker.js`, 'utf8')
        .replace("const BASE = '__BASE__';", `const BASE = ${JSON.stringify(base)};`)
        .replace("const BUILD = '__BUILD__';", `const BUILD = ${JSON.stringify(build)};`)
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(precache)};`)
        .replace(
          'const FILES = __FILES__;',
          `const FILES = ${JSON.stringify(files.map((file) => base + file))};`,
        );
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker });
      const icon = (file: string, size: number, purpose?: string) => ({
        src: `${base}icons/${file}`,
        sizes: `${String(size)}x${String(size)}`,
        type: 'image/png',
        ...(purpose === undefined ? {} : { purpose }),
      });
      const manifest = {
        name: app.titulo,
        short_name: app.titulo,
        description: app.descripcion,
        lang: 'es-ES',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#05070d',
        theme_color: '#0b0e14',
        icons: [
          icon('icon-192.png', 192),
          icon('icon-512.png', 512),
          icon('icon-maskable-512.png', 512, 'maskable'),
        ],
      };
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  return {
    base: env.VITE_BASE_PATH ?? '/',
    plugins: [
      react(),
      htmlTexts(),
      contentSecurityPolicy(env.VITE_SUPABASE_URL),
      progressiveWebApp(),
    ],
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
