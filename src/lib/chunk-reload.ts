const KEY = 'anomalia:chunk-reload-at';
const MIN_INTERVAL_MS = 60_000;

/**
 * Si se publica una versión nueva mientras alguien juega, los archivos antiguos dejan de
 * existir y la siguiente carga diferida falla. Recargamos una vez (como mucho cada minuto);
 * si vuelve a fallar, el error llega a la pantalla de error de la ruta.
 */
export function installChunkReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) ?? 0);
    } catch {
      // sessionStorage bloqueado: recargamos igualmente
    }
    if (Date.now() - last < MIN_INTERVAL_MS) return;
    event.preventDefault();
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      // sin almacenamiento disponible
    }
    window.location.reload();
  });
}
