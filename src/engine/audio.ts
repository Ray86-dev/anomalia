/**
 * Música por época con Howler (§10.2): streaming (html5), bucle y fundidos.
 * - El audio se desbloquea con el toque en «Comenzar»: por eso conviene llamar a `preload()`
 *   antes, para que Howler ya esté cargado cuando llegue el gesto.
 * - El silencio se recuerda en este dispositivo y el juego se entiende sin sonido.
 */
import type { Howl } from 'howler';

type HowlerModule = typeof import('howler');

const STORAGE_KEY = 'anomalia:silencio';
const VOLUME = 0.45;
const FADE_MS = 1200;

let howler: HowlerModule | null = null;
let loading: Promise<HowlerModule> | null = null;
let current: { readonly src: string; readonly howl: Howl } | null = null;
let wanted: string | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function load(): Promise<HowlerModule> {
  loading ??= import('howler').then((module) => {
    howler = module;
    module.Howler.mute(muted);
    return module;
  });
  return loading;
}

function start(module: HowlerModule, src: string, volume: number): void {
  const previous = current;
  if (previous !== null) {
    previous.howl.fade(previous.howl.volume(), 0, FADE_MS);
    window.setTimeout(() => previous.howl.unload(), FADE_MS + 100);
  }
  const howl = new module.Howl({ src: [src], loop: true, html5: true, volume: 0 });
  howl.once('play', () => {
    howl.fade(0, volume, FADE_MS);
  });
  howl.play();
  current = { src, howl };
}

export const audio = {
  preload(): void {
    void load();
  },

  isMuted(): boolean {
    return muted;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setMuted(value: boolean): void {
    muted = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // Sin almacenamiento: el ajuste dura hasta recargar.
    }
    howler?.Howler.mute(value);
    for (const listener of listeners) listener();
  },

  /**
   * Cambia la pista en bucle (`null` = silencio). Si Howler ya está cargado, empieza en el
   * mismo instante (necesario dentro del gesto que desbloquea el audio en móviles).
   * `volume` permite un ambiente más bajo, como el del Centro de Control.
   */
  play(src: string | null, volume: number = VOLUME): void {
    wanted = src;
    if (current?.src === src) return;
    if (src === null) {
      const previous = current;
      current = null;
      previous?.howl.fade(previous.howl.volume(), 0, FADE_MS);
      if (previous) window.setTimeout(() => previous.howl.unload(), FADE_MS + 100);
      return;
    }
    if (howler !== null) {
      start(howler, src, volume);
      return;
    }
    void load().then((module) => {
      if (wanted === src && current?.src !== src) start(module, src, volume);
    });
  },
};
