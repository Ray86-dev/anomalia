import { ambients, dilemmas, ui } from '@shared/generated/content.ts';
import { useRef } from 'react';
import { useGameContext } from './GameContext.ts';
import { formatRescueKey } from './helpers.ts';

const t = ui.juego.creditos;
const clave = ui.juego.clave;

type Credit = { readonly key: string; readonly text: string; readonly url: string | undefined };

/** Todos los recursos con su atribución (CC BY exige mostrarla de forma clara y legible). */
function allCredits(): Credit[] {
  const assets = [
    ...Object.values(ambients).flatMap((a) => [...a.capas, ...(a.musica ? [a.musica] : [])]),
    ...dilemmas.flatMap((d) => [
      ...d.assets.capas,
      ...(d.assets.archivo ? [d.assets.archivo] : []),
      ...(d.assets.musica ? [d.assets.musica] : []),
    ]),
  ];
  return assets.map((asset) => ({ key: asset.src, text: asset.credito, url: asset.licenciaUrl }));
}

/** Botón «i» de la barra del juego con la lista de créditos. */
export function Credits() {
  const dialog = useRef<HTMLDialogElement>(null);
  const credits = allCredits();
  const { rescueKey } = useGameContext();
  return (
    <>
      <button
        className="icon-button"
        type="button"
        aria-label={t.abrir}
        onClick={() => {
          dialog.current?.showModal();
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 11v6M12 7.5v.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <dialog
        ref={dialog}
        className="confirm-dialog credits-dialog"
        aria-labelledby="creditos-titulo"
      >
        <div className="rescue-key">
          <p className="rescue-key-label">{clave.titulo}</p>
          <p className="rescue-key-value">{formatRescueKey(rescueKey)}</p>
          <p className="help">{clave.texto}</p>
        </div>
        <h2 id="creditos-titulo">{t.titulo}</h2>
        <p className="help">{t.texto}</p>
        <ul className="credits-list">
          {credits.map((credit) => (
            <li key={credit.key}>
              {credit.text}{' '}
              {credit.url !== undefined && (
                <a href={credit.url} target="_blank" rel="noopener noreferrer">
                  {t.licencia}
                </a>
              )}
            </li>
          ))}
        </ul>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            dialog.current?.close();
          }}
        >
          {t.cerrar}
        </button>
      </dialog>
    </>
  );
}
