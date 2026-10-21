/** Justificación y objeción socrática (fases 5–6 del bucle §6). */
import { ui } from '@shared/generated/content.ts';
import type { Dilemma } from '@shared/schemas/content.ts';
import { MAX_JUSTIFICATION_CHARS, MAX_REPLY_CHARS } from '@shared/schemas/partida.ts';
import { fmt } from '../../../../lib/text.ts';
import { Notice } from '../../../../ui/Notice.tsx';
import { useGameContext } from '../GameContext.ts';
import { findCounselor, texto } from '../helpers.ts';
import { Avatar, TextAnswer } from '../parts.tsx';

const t = ui.juego;

export function Justification({ dilemma }: { readonly dilemma: Dilemma }) {
  const { act, answer } = useGameContext();
  const option = dilemma.opciones.find((o) => o.id === answer?.choice);
  const objector = findCounselor(option?.objetor);
  const [min, max] = dilemma.justificacion.palabras;
  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {t.justificacion.titulo}
      </h1>
      {option !== undefined && (
        <p className="chosen">
          {fmt(t.justificacion.eleccion, { opcion: `${option.id}. ${texto(option.texto)}` })}
        </p>
      )}
      <p className="prompt">{texto(dilemma.justificacion.pregunta)}</p>
      <TextAnswer
        label={t.justificacion.etiqueta}
        help={fmt(t.justificacion.ayuda, { min, max })}
        draftKey={`${dilemma.id}:justificacion`}
        range={dilemma.justificacion.palabras}
        maxChars={MAX_JUSTIFICATION_CHARS}
        submitLabel={t.justificacion.enviar}
        pendingLabel={fmt(t.ia.leyendoArgumento, { nombre: objector?.nombre ?? '' })}
        onSubmit={async (text) => {
          const response = await act({ action: 'justify', dilemmaId: dilemma.id, text });
          if (response?.ok === false && response.error === 'needs_more') {
            return t.justificacion.necesitaMas;
          }
          return response?.ok === true;
        }}
      />
    </>
  );
}

export function Objection({ dilemma }: { readonly dilemma: Dilemma }) {
  const { act, answer } = useGameContext();
  const objector = findCounselor(answer?.objector);
  const [min, max] = dilemma.replica.palabras;
  return (
    <>
      <h1 tabIndex={-1} data-focus>
        {fmt(t.objecion.titulo, { nombre: objector?.nombre ?? '' })}
      </h1>
      {objector !== undefined && answer?.objection != null && (
        <blockquote className="speech">
          <Avatar counselor={objector} />
          <p>{answer.objection}</p>
        </blockquote>
      )}
      {answer?.objection == null && <Notice tone="error">{ui.app.errorInesperado}</Notice>}
      <TextAnswer
        label={t.objecion.replicaEtiqueta}
        help={fmt(t.objecion.ayuda, { min, max })}
        draftKey={`${dilemma.id}:replica`}
        range={dilemma.replica.palabras}
        maxChars={MAX_REPLY_CHARS}
        submitLabel={t.objecion.enviar}
        pendingLabel={fmt(t.ia.leyendoReplica, { nombre: objector?.nombre ?? '' })}
        onSubmit={async (text) => {
          const response = await act({ action: 'reply', dilemmaId: dilemma.id, text });
          return response?.ok === true;
        }}
      />
    </>
  );
}
