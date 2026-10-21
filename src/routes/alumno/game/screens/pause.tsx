/** Espera entre capítulos y final provisional de la versión jugable. */
import { ui } from '@shared/generated/content.ts';
import { useEffect, useState } from 'react';
import { Notice } from '../../../../ui/Notice.tsx';
import { useGameContext } from '../GameContext.ts';
import { ActionBar } from '../parts.tsx';

const t = ui.juego;
const POLL_MS = 30_000;

export function Waiting() {
  const { act, pending } = useGameContext();
  const [locked, setLocked] = useState(false);

  async function check() {
    const response = await act({ action: 'advance', from: { phase: 'waiting', dilemmaId: null } });
    setLocked(response?.ok === false && response.error === 'locked');
  }

  // Comprueba solo de vez en cuando: 25 móviles esperando no deben saturar el servidor.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
    // check usa el contexto actual; basta con programar el intervalo una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.espera.titulo}
      </h1>
      <p className="lead">{t.espera.texto}</p>
      {locked && <Notice>{t.espera.bloqueado}</Notice>}
      <ActionBar>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            void check();
          }}
        >
          {t.espera.comprobar}
        </button>
      </ActionBar>
    </>
  );
}

export function Epilogue() {
  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.epilogo.titulo}
      </h1>
      <p className="lead">{t.epilogo.texto}</p>
    </>
  );
}
