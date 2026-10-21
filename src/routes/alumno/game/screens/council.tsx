/** Consejo y decisión (fases 3–4 del bucle §6). */
import { ui } from '@shared/generated/content.ts';
import type { Dilemma, DilemmaOption } from '@shared/schemas/content.ts';
import { useRef, useState } from 'react';
import { vibrate } from '../../../../engine/motion.ts';
import { fmt } from '../../../../lib/text.ts';
import { useGameContext } from '../GameContext.ts';
import { findCounselor, texto } from '../helpers.ts';
import { ActionBar, AdvanceButton, Avatar } from '../parts.tsx';

const t = ui.juego;

export function Council({ dilemma }: { readonly dilemma: Dilemma }) {
  const total = dilemma.consejeros.length;
  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.consejo.titulo}
      </h1>
      <p className="muted">{t.consejo.ayuda}</p>
      {/* Tarjetas deslizables con scroll-snap: gesto nativo, accesibles con teclado y lector de pantalla */}
      <ul className="council-track" aria-label={t.consejo.titulo}>
        {dilemma.consejeros.map((entry, index) => {
          const counselor = findCounselor(entry.id);
          if (counselor === undefined) return null;
          return (
            <li
              key={entry.id}
              className="counselor-card"
              aria-label={fmt(t.consejo.tarjeta, { n: index + 1, total })}
            >
              <div className="counselor-head">
                <Avatar counselor={counselor} />
                <div>
                  <h2>{counselor.nombre}</h2>
                  <p className="muted">{counselor.postura}</p>
                </div>
              </div>
              <p className="counselor-idea">{texto(counselor.ideaFuerza)}</p>
              <p>{texto(entry.argumento)}</p>
            </li>
          );
        })}
      </ul>
      <ActionBar>
        <AdvanceButton label={t.consejo.decidir} />
      </ActionBar>
    </>
  );
}

export function Decision({ dilemma }: { readonly dilemma: Dilemma }) {
  const { act, pending } = useGameContext();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<DilemmaOption | null>(null);

  function choose(option: DilemmaOption) {
    setSelected(option);
    dialog.current?.showModal();
  }

  function confirm() {
    if (selected === null) return;
    vibrate();
    dialog.current?.close();
    void act({ action: 'choose', dilemmaId: dilemma.id, choice: selected.id });
  }

  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.decision.titulo}
      </h1>
      <p className="muted">{t.decision.ayuda}</p>
      <ul className="option-list">
        {dilemma.opciones.map((option) => (
          <li key={option.id}>
            <button
              className="option"
              type="button"
              disabled={pending}
              onClick={() => {
                choose(option);
              }}
            >
              <span className="option-letter" aria-hidden="true">
                {option.id}
              </span>
              <span>
                <span className="visually-hidden">{fmt(t.opcion, { id: option.id })}: </span>
                {texto(option.texto)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog ref={dialog} className="confirm-dialog" aria-labelledby="confirmar-titulo">
        <h2 id="confirmar-titulo">{t.decision.confirmarTitulo}</h2>
        {selected !== null && (
          <p>
            {fmt(t.decision.confirmarTexto, { opcion: `${selected.id}. ${texto(selected.texto)}` })}
          </p>
        )}
        <div className="stack">
          <button className="btn" type="button" onClick={confirm}>
            {t.decision.confirmar}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              dialog.current?.close();
            }}
          >
            {t.decision.cambiar}
          </button>
        </div>
      </dialog>
    </>
  );
}
