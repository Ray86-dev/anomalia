import type { ShotId } from '@shared/game/shots.ts';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../motion.ts';
import type { CinematicScene } from './particles.ts';

type CinematicProps = {
  readonly shot: ShotId;
  /** Inestabilidad del mundo (0–1, según el Desnivel). */
  readonly instability?: number;
};

/**
 * Cinemática de partículas a pantalla completa, detrás del texto (D-87). Va en un portal al
 * `body` para que la entrada animada de cada pantalla (un `transform`) no la arrastre. Si no
 * hay WebGL o falla la carga, no se pinta nada y queda el fondo CSS del juego.
 */
export function Cinematic({ shot, instability = 0 }: CinematicProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CinematicScene | null>(null);
  const latest = useRef({ shot, instability });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    latest.current = { shot, instability };
    scene.current?.show(shot);
  }, [shot, instability]);

  useEffect(() => {
    scene.current?.setInstability(instability);
  }, [instability]);

  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    let disposed = false;
    let created: CinematicScene | null = null;
    import('./particles.ts')
      .then(({ createCinematic }) => {
        if (disposed) return;
        created = createCinematic(element, {
          shot: latest.current.shot,
          instability: latest.current.instability,
          reducedMotion: prefersReducedMotion(),
          onLost: () => {
            setFailed(true);
          },
        });
        scene.current = created;
        // Por si el plano cambió mientras cargaba.
        created.show(latest.current.shot);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      created?.destroy();
      scene.current = null;
    };
  }, []);

  if (failed) return null;
  return createPortal(<div ref={host} className="cinematic" aria-hidden="true" />, document.body);
}
