/** Giro (M6): llega información nueva y el alumno mantiene o cambia su decisión. */
import { ui } from '@shared/generated/content.ts';
import type { Dilemma } from '@shared/schemas/content.ts';
import { useId, useState } from 'react';
import { vibrate } from '../../../../engine/motion.ts';
import { fmt } from '../../../../lib/text.ts';
import { useGameContext } from '../GameContext.ts';
import { texto } from '../helpers.ts';
import { ActionBar, Listen } from '../parts.tsx';

const t = ui.juego;

export function Twist({ dilemma }: { readonly dilemma: Dilemma }) {
  const { act, pending, run } = useGameContext();
  const groupId = useId();
  const provisional = run.pendingChoice;
  const [selected, setSelected] = useState(provisional ?? 'A');
  const twist = dilemma.giro;

  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {twist === undefined ? t.giro.titulo : texto(twist.titulo)}
      </h1>
      {twist !== undefined && (
        <article className="panel stack twist-card">
          {/* Solo se señala un dato histórico real; la ficción no se anuncia (rompería la inmersión). */}
          {twist.fuente === 'historia' && <p className="kicker">{t.giro.historia}</p>}
          <p className="lead">{texto(twist.texto)}</p>
        </article>
      )}
      <p className="muted">{t.giro.texto}</p>
      <Listen
        auto
        text={`${twist === undefined ? '' : `${texto(twist.titulo)}. ${texto(twist.texto)} `}${t.giro.texto}`}
      />
      <fieldset className="option-list option-fieldset">
        <legend id={groupId} className="visually-hidden">
          {t.giro.tuEleccion}
        </legend>
        {dilemma.opciones.map((option) => (
          <label
            key={option.id}
            className={`option option-radio${selected === option.id ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name={groupId}
              value={option.id}
              checked={selected === option.id}
              onChange={() => {
                setSelected(option.id);
              }}
            />
            <span className="option-letter" aria-hidden="true">
              {option.id}
            </span>
            <span>
              <span className="visually-hidden">{fmt(t.opcion, { id: option.id })}: </span>
              {texto(option.texto)}
              {option.id === provisional && (
                <span className="option-tag"> · {t.giro.provisional}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <ActionBar>
        <button
          className="btn"
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            vibrate();
            void act({ action: 'confirm', dilemmaId: dilemma.id, choice: selected });
          }}
        >
          {pending ? t.guardando : t.giro.confirmar}
        </button>
      </ActionBar>
    </>
  );
}
