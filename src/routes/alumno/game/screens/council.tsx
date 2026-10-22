/** Consejo y decisión (fases 3–4 del bucle §6). */
import { ui } from '@shared/generated/content.ts';
import type { Dilemma, DilemmaOption } from '@shared/schemas/content.ts';
import { useId, useState, type ReactNode } from 'react';
import { fmt } from '../../../../lib/text.ts';
import { useGameContext } from '../GameContext.ts';
import { findCounselor, texto } from '../helpers.ts';
import { ActionBar, AdvanceButton, Avatar, Listen } from '../parts.tsx';

const t = ui.juego;

/** «Leer más» (M6): el argumento completo queda a un toque, sin alargar la tarjeta. */
function MoreText({ children }: { readonly children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div id={id} className="stack-tight" hidden={!open}>
        {children}
      </div>
      <button
        className="link-button more-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? t.consejo.leerMenos : t.consejo.leerMas}
      </button>
    </>
  );
}

export function Council({ dilemma }: { readonly dilemma: Dilemma }) {
  const total = dilemma.consejeros.length + dilemma.voces.length;
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
              <p className="counselor-phrase">{texto(entry.frase)}</p>
              <Listen
                text={`${counselor.nombre}. ${texto(entry.frase)} ${texto(entry.argumento)}`}
              />
              <MoreText>
                <p className="counselor-idea">{texto(counselor.ideaFuerza)}</p>
                <p>{texto(entry.argumento)}</p>
              </MoreText>
            </li>
          );
        })}
        {/* Voces de la historia: se describe su postura, nunca con frases inventadas (§5). */}
        {dilemma.voces.map((voice, index) => (
          <li
            key={voice.nombre}
            className="counselor-card voice-card"
            aria-label={fmt(t.consejo.tarjeta, {
              n: dilemma.consejeros.length + index + 1,
              total,
            })}
          >
            <p className="kicker">{t.consejo.voz}</p>
            <h2>{voice.nombre}</h2>
            <p>{texto(voice.postura)}</p>
          </li>
        ))}
      </ul>
      <ActionBar>
        <AdvanceButton label={t.consejo.decidir} />
      </ActionBar>
    </>
  );
}

/** Elección provisional: el giro (fase siguiente) hace de «pensarlo otra vez» (M6). */
export function Decision({ dilemma }: { readonly dilemma: Dilemma }) {
  const { act, pending } = useGameContext();

  function choose(option: DilemmaOption) {
    void act({ action: 'choose', dilemmaId: dilemma.id, choice: option.id });
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
    </>
  );
}
