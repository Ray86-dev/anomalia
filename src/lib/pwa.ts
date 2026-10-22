/**
 * Registra el service worker de la PWA (M7) solo en la versión publicada. Si el navegador no
 * lo admite o falla, la app funciona igual: solo pierde la caché.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined);
  });
}
