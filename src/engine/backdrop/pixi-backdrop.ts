/**
 * Fondo de escena con Pixi (§10.1): capas con parallax según el avance de la narración,
 * deriva lenta y polvo en suspensión. Sin imágenes, solo el degradado de la paleta.
 * Se carga bajo demanda: Pixi nunca entra en el bundle inicial.
 */
import 'pixi.js/unsafe-eval'; // compatible con nuestra CSP (sin 'unsafe-eval')
import {
  Application,
  Assets,
  Container,
  FillGradient,
  Graphics,
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
};

export type BackdropScene = {
  /** Avance de la narración (0, 1, 2…): desplaza las capas con distinta profundidad. */
  setStep: (step: number) => void;
  destroy: () => void;
};

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

  const motes: Mote[] = Array.from({ length: options.reducedMotion ? 0 : 26 }, () => {
    const dot = new Graphics()
      .circle(0, 0, 1 + Math.random() * 1.6)
      .fill({ color: accent, alpha: 0.35 });
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
    for (const mote of motes) {
      mote.y -= mote.speed / 60;
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
    });
  }

  const onVisibility = () => {
    if (options.reducedMotion) return;
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
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
