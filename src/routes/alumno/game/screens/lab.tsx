/** Laboratorio (M6): comprobar los datos antes de decidir con razones en el ágora. */
import { ui } from '@shared/generated/content.ts';
import type { Dilemma } from '@shared/schemas/content.ts';
import { texto } from '../helpers.ts';
import { ActionBar, AdvanceButton } from '../parts.tsx';

const t = ui.juego;

export function Lab({ dilemma }: { readonly dilemma: Dilemma }) {
  return (
    <>
      <p className="kicker">{texto(dilemma.titulo)}</p>
      <h1 tabIndex={-1} data-focus>
        {t.laboratorio.titulo}
      </h1>
      <p className="lead">{t.laboratorio.texto}</p>
      <ActionBar>
        <AdvanceButton label={t.laboratorio.irAlAgora} />
      </ActionBar>
    </>
  );
}
