/**
 * Avisos de logros (M6): una fila dentro de la barra superior, nunca encima del texto.
 * Se muestran de uno en uno y se van solos; el lector de pantalla los anuncia (role=status).
 */
import { ui } from '@shared/generated/content.ts';
import { useEffect } from 'react';
import { useGameContext } from './GameContext.ts';

const SHOW_MS = 3200;

export function Toasts() {
  const { toasts, dismissToast } = useGameContext();
  const current = toasts[0];

  useEffect(() => {
    if (current === undefined) return;
    const timer = setTimeout(() => {
      dismissToast(current.id);
    }, SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [current, dismissToast]);

  return (
    <div className="toasts" role="status" aria-label={ui.juego.logros.aviso.region}>
      {current !== undefined && (
        <p key={current.id} className="toast">
          {current.text}
        </p>
      )}
    </div>
  );
}
