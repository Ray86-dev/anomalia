/**
 * Música por época con Howler (§10.2): streaming (html5), bucle y fundidos.
 * - El audio se desbloquea con el toque en «Comenzar»: por eso conviene llamar a `preload()`
 *   antes, para que Howler ya esté cargado cuando llegue el gesto.
 * - El silencio se recuerda en este dispositivo y el juego se entiende sin sonido.
 * - Mientras se lee en voz alta, la música baja (`setDucked`).
 * - Disonancia (§10.2, M7): un zumbido generado con Web Audio (segunda menor y tritono) que
 *   crece con el Desnivel prometeico (`setTension`). Pasa por el volumen general de Howler,
 *   así que el silencio también lo calla.
 */
import type { Howl } from 'howler';

type HowlerModule = typeof import('howler');

const STORAGE_KEY = 'anomalia:silencio';
const VOLUME = 0.45;
const FADE_MS = 1200;
/** Volumen relativo de la música mientras se lee en voz alta. */
const DUCKED = 0.3;

let howler: HowlerModule | null = null;
let loading: Promise<HowlerModule> | null = null;
let current: { readonly src: string; readonly howl: Howl; readonly volume: number } | null = null;
let ducked = false;
let wanted: string | null = null;
let tension = 0;

type Drone = {
  readonly context: AudioContext;
  readonly gain: GainNode;
  readonly filter: BiquadFilterNode;
};
let drone: Drone | null = null;

/** Volumen máximo de la disonancia: se mezcla por debajo de la música. */
const TENSION_GAIN = 0.05;
/** El zumbido se puede quitar sin quitar la música (ajuste del alumno o tecla Z del Centro). */
let droneMuted = false;

/** Tensión de 0 a 1 según el Desnivel: nada hasta +5 y el máximo a partir de +40. */
export function tensionFor(desnivel: number): number {
  return Math.min(1, Math.max(0, (desnivel - 5) / 35));
}

/** Tres osciladores graves con intervalos tensos, un filtro que «respira» y su volumen. */
function buildDrone(module: HowlerModule): Drone | null {
  const context = module.Howler.ctx as AudioContext | null;
  const output = module.Howler.masterGain as GainNode | null;
  if (context === null || output === null) return null;
  const gain = context.createGain();
  gain.gain.value = 0;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  filter.Q.value = 3;
  // La, la sostenido (segunda menor) y re sostenido (tritono): los batidos dan inquietud.
  const tones: [OscillatorType, number, number][] = [
    ['triangle', 110, 0],
    ['triangle', 116.54, 0],
    ['sine', 155.56, 9],
  ];
  for (const [type, frequency, detune] of tones) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    oscillator.connect(filter);
    oscillator.start();
  }
  const lfo = context.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = context.createGain();
  depth.gain.value = 120;
  lfo.connect(depth).connect(filter.frequency);
  lfo.start();
  filter.connect(gain).connect(output);
  return { context, gain, filter };
}

function applyTension(module: HowlerModule): void {
  if (tension === 0 && drone === null) return;
  drone ??= buildDrone(module);
  if (drone === null) return;
  const now = drone.context.currentTime;
  const level = droneMuted ? 0 : TENSION_GAIN * tension ** 1.5;
  drone.gain.gain.setTargetAtTime(level, now, droneMuted ? 0.2 : 1.5);
  drone.filter.frequency.setTargetAtTime(300 + 900 * tension, now, 1.5);
}
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
    howl.fade(0, ducked ? volume * DUCKED : volume, FADE_MS);
  });
  howl.play();
  current = { src, howl, volume };
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

  /** Disonancia de 0 (nada) a 1 (máxima); ver `tensionFor`. */
  setTension(value: number): void {
    tension = Math.min(1, Math.max(0, value));
    if (howler !== null) applyTension(howler);
    else if (tension > 0) void load().then(applyTension);
  },

  /** Quita (o devuelve) solo el zumbido de inestabilidad. */
  setDroneMuted(value: boolean): void {
    droneMuted = value;
    if (howler !== null) applyTension(howler);
  },

  /** Baja la música mientras se lee en voz alta y la recupera al terminar. */
  setDucked(value: boolean): void {
    ducked = value;
    if (current === null) return;
    const { howl, volume } = current;
    howl.fade(howl.volume(), value ? volume * DUCKED : volume, 400);
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
