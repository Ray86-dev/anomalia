/**
 * Fondo de escena con Pixi (§10.1): capas con parallax según el avance de la narración,
 * deriva lenta y polvo en suspensión. Sin imágenes, solo el degradado de la paleta.
 * Con el Desnivel (M7) la línea temporal se deshilacha: ruido, partículas más rápidas y
 * rojizas y fallos de imagen (glitch) cada vez más frecuentes. Con movimiento reducido no
 * hay nada de eso: el aviso queda en el velo estático de la hoja de estilos.
 * Se carga bajo demanda: Pixi nunca entra en el bundle inicial.
 */
import 'pixi.js/unsafe-eval'; // compatible con nuestra CSP (sin 'unsafe-eval')
import {
  Application,
  Assets,
  Container,
  Color,
  FillGradient,
  Graphics,
  NoiseFilter,
  Sprite,
  type Texture,
} from 'pixi.js';

export type BackdropImage = {
  readonly url: string;
  /** Punto de interés (0–1) que se mantiene a la vista al recortar en vertical. */
  readonly focus: readonly [number, number];
  /** Teñir con el tono medio de la paleta (grabados claros). */
  readonly tint: boolean;
};

export type BackdropOptions = {
  readonly palette: readonly [string, string, string];
  readonly images: readonly BackdropImage[];
  readonly reducedMotion: boolean;
  /** Inestabilidad de 0 a 1 según el Desnivel (ver `tensionFor`). */
  readonly instability: number;
};

export type BackdropScene = {
  /** Avance de la narración (0, 1, 2…): desplaza las capas con distinta profundidad. */
  setStep: (step: number) => void;
  setInstability: (level: number) => void;
  destroy: () => void;
};

/** Partículas con el mundo estable y con la máxima inestabilidad. */
const BASE_MOTES = 26;
const MAX_MOTES = 60;

type Layer = {
  readonly sprite: Sprite;
  readonly depth: number;
  readonly focus: readonly [number, number];
};
type Mote = {
  readonly dot: Graphics;
  x: number;
  y: number;
  readonly speed: number;
  readonly drift: number;
};

export async function createBackdrop(
  host: HTMLElement,
  options: BackdropOptions,
): Promise<BackdropScene> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    powerPreference: 'low-power',
    preference: 'webgl',
  });
  app.canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(app.canvas);

  const [deep, mid, accent] = options.palette;
  const root = new Container();
  app.stage.addChild(root);

  const background = new Graphics();
  root.addChild(background);

  const textures = await Promise.all(
    options.images.map((image) => Assets.load<Texture>(image.url).catch(() => null)),
  );
  const layers: Layer[] = [];
  textures.forEach((texture, index) => {
    const image = options.images[index];
    if (texture === null || image === undefined) return;
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.alpha = index === 0 ? 0.6 : 0.85;
    if (image.tint) sprite.tint = mid;
    layers.push({ sprite, depth: 10 + index * 14, focus: image.focus });
    root.addChild(sprite);
  });

  // Las partículas se dibujan en blanco y se tiñen: así cambian de color sin redibujarlas.
  const motes: Mote[] = Array.from({ length: options.reducedMotion ? 0 : MAX_MOTES }, () => {
    const dot = new Graphics()
      .circle(0, 0, 1 + Math.random() * 1.6)
      .fill({ color: 0xffffff, alpha: 0.35 });
    root.addChild(dot);
    return {
      dot,
      x: Math.random(),
      y: Math.random(),
      speed: 0.004 + Math.random() * 0.01,
      drift: Math.random() * 6,
    };
  });

  let step = 0;
  let shown = 0;
  let time = 0;
  let instability = 0;
  let nextGlitch = 0;
  let glitchUntil = 0;

  // Fallos de imagen: franjas desplazadas del color de la época y ruido sobre toda la escena.
  const bars = new Graphics();
  bars.visible = false;
  root.addChild(bars);
  const noise = new NoiseFilter({ noise: 0, seed: Math.random() });
  noise.resolution = 0.5;

  function setInstability(level: number): void {
    instability = Math.min(1, Math.max(0, level));
    const tint = Color.shared.setValue(accent).toArray();
    const warning = [1, 0.42, 0.35];
    const mixed = tint
      .slice(0, 3)
      .map((value, i) => value + ((warning[i] ?? 0) - value) * instability);
    const color = new Color(mixed).toNumber();
    const visible = Math.round(BASE_MOTES + (MAX_MOTES - BASE_MOTES) * instability);
    motes.forEach((mote, i) => {
      mote.dot.tint = color;
      mote.dot.visible = i < visible;
    });
    root.filters = options.reducedMotion || instability < 0.15 ? [] : [noise];
    noise.noise = 0.04 + instability * 0.1;
    nextGlitch = time + glitchDelay();
  }

  /** Cada vez más seguidos: unos 8 s con poca inestabilidad y unos 2 s con la máxima. */
  function glitchDelay(): number {
    return (8 - 6 * instability) * (0.6 + Math.random() * 0.8);
  }

  function glitch(): void {
    const { width, height } = app.screen;
    bars.clear();
    const count = 2 + Math.round(4 * instability);
    for (let i = 0; i < count; i++) {
      const y = Math.random() * height;
      const h = 2 + Math.random() * 10 * (0.5 + instability);
      bars
        .rect(-20 + (Math.random() - 0.5) * 30, y, width + 40, h)
        .fill({ color: i % 2 === 0 ? accent : 0xff5a4a, alpha: 0.12 + 0.2 * instability });
    }
    glitchUntil = time + 0.1 + Math.random() * 0.18;
    nextGlitch = time + glitchDelay();
  }

  function layout(): void {
    const { width, height } = app.screen;
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: mid },
        { offset: 0.65, color: deep },
        { offset: 1, color: deep },
      ],
      textureSpace: 'local',
    });
    background.clear().rect(0, 0, width, height).fill(gradient);
    for (const { sprite, depth } of layers) {
      // «cover» con margen para que el parallax nunca deje bordes vacíos
      const scale = Math.max(
        (width + depth * 4) / sprite.texture.width,
        (height + depth * 4) / sprite.texture.height,
      );
      sprite.scale.set(scale);
    }
  }

  /** Centra el punto de interés sin dejar nunca un borde de la imagen a la vista. */
  function centre(screen: number, size: number, focus: number, offset: number): number {
    const start = Math.min(0, Math.max(screen - size, screen / 2 - focus * size + offset));
    return start + size / 2;
  }

  function place(): void {
    const { width, height } = app.screen;
    for (const { sprite, depth, focus } of layers) {
      const dx = Math.sin(time * 0.07) * depth * 0.4;
      const dy = -shown * depth * 0.35 + Math.cos(time * 0.05) * depth * 0.2;
      sprite.x = centre(width, sprite.width, focus[0], dx);
      sprite.y = centre(height, sprite.height, focus[1], dy);
    }
    const speed = 1 + 2 * instability;
    for (const mote of motes) {
      mote.y -= (mote.speed * speed) / 60;
      if (mote.y < -0.02) mote.y = 1.02;
      mote.dot.x = (mote.x + Math.sin(time * 0.3 + mote.drift) * 0.01) * width;
      mote.dot.y = mote.y * height;
    }
  }

  layout();
  place();
  app.renderer.on('resize', () => {
    layout();
    place();
    if (options.reducedMotion) app.render();
  });

  if (options.reducedMotion) {
    app.ticker.stop();
    app.render();
  } else {
    app.ticker.add((ticker) => {
      time += ticker.deltaMS / 1000;
      shown += (step - shown) * Math.min(1, ticker.deltaMS / 600);
      place();
      if (instability > 0 && time >= nextGlitch) glitch();
      const glitching = time < glitchUntil;
      bars.visible = glitching;
      root.x = glitching ? (Math.random() - 0.5) * 24 * instability : 0;
      if (glitching) noise.seed = Math.random();
    });
  }

  const onVisibility = () => {
    if (options.reducedMotion) return;
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  setInstability(options.instability);

  return {
    setInstability,
    setStep(next) {
      step = Math.min(next, 5);
      if (options.reducedMotion) {
        shown = step;
        place();
        app.render();
      }
    },
    destroy() {
      document.removeEventListener('visibilitychange', onVisibility);
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
