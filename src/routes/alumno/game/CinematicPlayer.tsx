/**
 * Paneles de una cinemática (D-87): el texto del panel actual sobre la animación de partículas,
 * al ritmo del alumno (sin temporizadores de lectura, §10.3), con «Atrás», «Siguiente» y
 * «Saltar». El plano lo pinta <Cinematic>, que monta la pantalla para que dure entre pasos.
 */
import { ui } from '@shared/generated/content.ts';
import type { Panel } from '@shared/schemas/content.ts';
import type { ReactNode } from 'react';
import { fmt } from '../../../lib/text.ts';
import { useGameContext } from './GameContext.ts';
import { texto } from './helpers.ts';
import { ActionBar, AriMessage, Listen } from './parts.tsx';

const t = ui.juego;

type CinematicPlayerProps = {
  readonly panels: readonly Panel[];
  readonly index: number;
  readonly onIndex: (index: number) => void;
  /** Título para lectores de pantalla (no se ve). */
  readonly title: string;
  /** Acción del último panel en lugar de «Siguiente» (p. ej. «Viajar a la primera anomalía»). */
  readonly finalAction: ReactNode;
  /** Texto del enlace para saltar la cinemática. */
  readonly skipLabel: string;
  /** Qué hace «Saltar»; por defecto, ir al último panel. */
  readonly onSkip?: () => void;
};

/** Texto del panel en la versión que toca, con {grupo} sustituido por el nombre de la clase. */
function panelText(panel: Panel, classLabel: string): string {
  return fmt(texto(panel.texto), { grupo: classLabel });
}

function PanelText({ panel, text }: { readonly panel: Panel; readonly text: string }) {
  if (panel.voz === 'ari') return <AriMessage text={text} />;
  if (panel.voz === 'mnemosine') {
    return (
      <figure className="cine-mnemo">
        <figcaption>{t.cinematica.mnemosine}</figcaption>
        <p>{text}</p>
      </figure>
    );
  }
  return <p className="cine-title">{text}</p>;
}

/** Lo que oye quien usa la lectura en voz alta: quién habla y qué dice. */
function spoken(panel: Panel, text: string): string {
  if (panel.voz === 'ari') return `${t.ari.remitente}: ${text}`;
  if (panel.voz === 'mnemosine') return `${t.cinematica.mnemosine}: ${text}`;
  return text;
}

export function CinematicPlayer({
  panels,
  index,
  onIndex,
  title,
  finalAction,
  skipLabel,
  onSkip,
}: CinematicPlayerProps) {
  const { classLabel } = useGameContext();
  const panel = panels[index];
  if (panel === undefined) return null;
  const text = panelText(panel, classLabel);
  const last = index === panels.length - 1;
  return (
    <div className="cine">
      <h1 className="visually-hidden" tabIndex={-1} data-focus>
        {title}
      </h1>
      <div className="cine-text" aria-live="polite">
        <div key={index} className="cine-panel" data-voz={panel.voz}>
          <PanelText panel={panel} text={text} />
        </div>
      </div>
      <Listen auto text={spoken(panel, text)} />
      <ActionBar>
        <div className="cine-controls">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={index === 0}
            onClick={() => {
              onIndex(index - 1);
            }}
          >
            {t.cinematica.anterior}
          </button>
          {last ? (
            finalAction
          ) : (
            <button
              className="btn"
              type="button"
              onClick={() => {
                onIndex(index + 1);
              }}
            >
              {t.siguiente}
            </button>
          )}
        </div>
        <div className="cine-meta">
          <span className="cine-progress">
            {fmt(t.cinematica.progreso, { n: index + 1, total: panels.length })}
          </span>
          {!last && (
            <button
              className="link-button"
              type="button"
              onClick={() => {
                if (onSkip === undefined) onIndex(panels.length - 1);
                else onSkip();
              }}
            >
              {skipLabel}
            </button>
          )}
        </div>
      </ActionBar>
    </div>
  );
}
