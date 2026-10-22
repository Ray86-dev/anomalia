import { ambients, dilemmas, ui } from '@shared/generated/content.ts';
import { useId, useRef, useSyncExternalStore } from 'react';
import { drone, motion, textSize, TEXT_SIZES } from '../../../lib/settings.ts';
import { useGameContext } from './GameContext.ts';
import { formatRescueKey } from './helpers.ts';

const t = ui.juego.creditos;
const clave = ui.juego.clave;
const a = ui.juego.ajustes;

/** Tamaño del texto y movimiento reducido (§10.3), guardados en este móvil. */
function Settings() {
  const name = useId();
  const size = useSyncExternalStore(
    (listener) => textSize.subscribe(listener),
    () => textSize.get(),
  );
  const droneOn = useSyncExternalStore(
    (listener) => drone.subscribe(listener),
    () => drone.get() === 'si',
  );
  const reduced = useSyncExternalStore(
    (listener) => motion.subscribe(listener),
    () => motion.get() === 'reducido',
  );
  return (
    <section className="settings stack" aria-labelledby={`${name}-t`}>
      <h2 id={`${name}-t`}>{a.titulo}</h2>
      <fieldset className="settings-sizes">
        <legend>{a.tamano}</legend>
        {TEXT_SIZES.map((value) => (
          <label key={value} className={`size-choice size-${value}`}>
            <input
              type="radio"
              name={name}
              checked={size === value}
              onChange={() => {
                textSize.set(value);
              }}
            />
            <span>{a.tamanos[value]}</span>
          </label>
        ))}
      </fieldset>
      <label className="lab-check">
        <input
          type="checkbox"
          checked={droneOn}
          onChange={(event) => {
            drone.set(event.target.checked ? 'si' : 'no');
          }}
        />
        <span>{a.zumbido}</span>
      </label>
      <p className="help">{a.zumbidoAyuda}</p>
      <label className="lab-check">
        <input
          type="checkbox"
          checked={reduced}
          onChange={(event) => {
            motion.set(event.target.checked ? 'reducido' : 'sistema');
          }}
        />
        <span>{a.movimiento}</span>
      </label>
      <p className="help">{a.movimientoAyuda}</p>
    </section>
  );
}

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
        <Settings />
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
