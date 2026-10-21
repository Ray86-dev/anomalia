// GitHub Pages no tiene reescrituras: servimos index.html también como 404.html para que
// los enlaces directos (/anomalia/consola, /anomalia/centro) arranquen la app.
import { copyFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'dist/404.html');
console.log('✔ dist/404.html');
