import type { ContentImage } from '@shared/schemas/content.ts';
import { useEffect, useRef, type CSSProperties } from 'react';
import { prefersReducedMotion } from '../motion.ts';
import type { BackdropScene } from './pixi-backdrop.ts';

type BackdropProps = {
  readonly palette: readonly [string, string, string];
  readonly layers: readonly ContentImage[];
  /** Avance de la narración: mueve las capas (parallax). */
  readonly step?: number;
  /** Inestabilidad de 0 a 1 según el Desnivel: glitch en la escena y un velo rojizo. */
  readonly instability?: number;
};

export const assetUrl = (src: string) => `${import.meta.env.BASE_URL}assets/${src}`;

/** «55% 40%» → [0.55, 0.4]; por defecto, el centro. */
function parseFocus(focus: string | undefined): readonly [number, number] {
  const [x, y] = (focus ?? '50% 50%').split(' ').map((part) => Number.parseFloat(part) / 100);
  return [x ?? 0.5, y ?? 0.5];
}

/**
 * Fondo a pantalla completa. El degradado CSS es el respaldo inmediato (y el definitivo si
 * WebGL no está disponible); encima se monta la escena de Pixi cuando termina de cargar.
 */
export function Backdrop({ palette, layers, step = 0, instability = 0 }: BackdropProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BackdropScene | null>(null);
  const [deep, mid] = palette;
  const key = `${palette.join()}|${layers.map((l) => l.src).join()}`;

  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    let disposed = false;
    let created: BackdropScene | null = null;
    import('./pixi-backdrop.ts')
      .then(({ createBackdrop }) =>
        createBackdrop(element, {
          palette,
          images: layers.map((layer) => ({
            url: assetUrl(layer.src),
            focus: parseFocus(layer.foco),
            tint: layer.tinte === true,
          })),
          reducedMotion: prefersReducedMotion(),
          instability,
        }),
      )
      .then((result) => {
        created = result;
        if (disposed) result.destroy();
        else scene.current = result;
      })
      .catch(() => {
        // Sin WebGL o sin red: se queda el degradado CSS.
      });
    return () => {
      disposed = true;
      created?.destroy();
      scene.current = null;
    };
    // `key` resume palette y layers: solo se recrea la escena si cambian de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    scene.current?.setStep(step);
  }, [step]);

  useEffect(() => {
    scene.current?.setInstability(instability);
  }, [instability]);

  return (
    <div
      ref={host}
      className="backdrop"
      aria-hidden="true"
      style={
        {
          background: `linear-gradient(180deg, ${mid} 0%, ${deep} 65%)`,
          '--instability': String(instability),
        } as CSSProperties
      }
    />
  );
}
