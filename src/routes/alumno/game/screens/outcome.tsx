/** Ondas temporales y Archivo real (fases 7–8 del bucle §6). */
import { ui } from '@shared/generated/content.ts';
import {
  desnivel,
  WORLD_MAX,
  WORLD_MIN,
  WORLD_VARS,
  type Deltas,
  type WorldState,
} from '@shared/game/world.ts';
import type { Dilemma } from '@shared/schemas/content.ts';
import { useEffect, useState } from 'react';
import { assetUrl } from '../../../../engine/backdrop/Backdrop.tsx';
import { fmt } from '../../../../lib/text.ts';
import { useGameContext } from '../GameContext.ts';
import { findCounselor, texto } from '../helpers.ts';
import { ActionBar, AdvanceButton, AriMessage, Avatar } from '../parts.tsx';

const t = ui.juego;

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** Estado del mundo. Con `deltas`, las barras crecen desde el valor anterior a la decisión. */
export function WorldMeters({
  world,
  deltas,
}: {
  readonly world: WorldState;
  readonly deltas?: Deltas;
}) {
  // Las barras parten del valor anterior a la decisión y crecen hasta el actual.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setGrown(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  const gap = desnivel(world);
  return (
    <section className="panel stack" aria-labelledby="estado-mundo">
      <h2 id="estado-mundo">{t.ondas.estado}</h2>
      <ul className="meters">
        {WORLD_VARS.map((variable) => {
          const delta = deltas?.[variable] ?? 0;
          const now = world[variable];
          const before = Math.min(WORLD_MAX, Math.max(WORLD_MIN, now - delta));
          return (
            <li key={variable} className="meter-row">
              <span className="meter-label">{t.mundo[variable]}</span>
              <span
                className="meter"
                role="meter"
                aria-label={t.mundo[variable]}
                aria-valuemin={WORLD_MIN}
                aria-valuemax={WORLD_MAX}
                aria-valuenow={now}
              >
                <span className="meter-fill" style={{ width: `${grown ? now : before}%` }} />
              </span>
              <span className="meter-value">{now}</span>
              {deltas !== undefined && (
                <span className={`meter-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                  {delta === 0 ? t.ondas.sinCambio : signed(delta)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="gap-indicator" data-level={gap >= 25 ? 'high' : gap >= 10 ? 'mid' : 'low'}>
        <p className="gap-value">{signed(gap)}</p>
        <div>
          <p className="gap-label">{t.ondas.desnivel}</p>
          <p className="help">{t.ondas.desnivelAyuda}</p>
        </div>
      </div>
    </section>
  );
}

export function Ripples({ dilemma }: { readonly dilemma: Dilemma }) {
  const { run, answer } = useGameContext();
  const [revealed, setRevealed] = useState(false);
  const option = dilemma.opciones.find((o) => o.id === answer?.choice);
  const objector = findCounselor(answer?.objector);

  if (!revealed && objector !== undefined && answer?.closing != null) {
    return (
      <>
        <h1 tabIndex={-1} data-focus>
          {fmt(t.objecion.cierreTitulo, { nombre: objector.nombre })}
        </h1>
        <blockquote className="speech">
          <Avatar counselor={objector} />
          <p>{answer.closing}</p>
        </blockquote>
        <ActionBar>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setRevealed(true);
            }}
          >
            {t.objecion.volver}
          </button>
        </ActionBar>
      </>
    );
  }

  return (
    <>
      <p className="kicker">{t.ondas.titulo}</p>
      {option !== undefined && (
        <>
          <h1 className="headline" tabIndex={-1} data-focus>
            {texto(option.ondas.titular)}
          </h1>
          <p className="lead">{texto(option.ondas.texto)}</p>
          <AriMessage text={texto(option.ondas.ari)} />
        </>
      )}
      <WorldMeters world={run.world} deltas={option?.deltas ?? {}} />
      <ActionBar>
        <AdvanceButton label={t.ondas.verArchivo} />
      </ActionBar>
    </>
  );
}

export function Archive({ dilemma }: { readonly dilemma: Dilemma }) {
  const image = dilemma.assets.archivo;
  return (
    <>
      <p className="kicker">{t.archivo.subtitulo}</p>
      <h1 tabIndex={-1} data-focus>
        {t.archivo.titulo}
      </h1>
      <article className="archive-card">
        <p className="archive-text">{texto(dilemma.archivoReal.texto)}</p>
        {image !== undefined && (
          <figure>
            <img src={assetUrl(image.src)} alt={image.pie ? texto(image.pie) : ''} loading="lazy" />
            <figcaption>
              {image.pie !== undefined && <span>{texto(image.pie)}</span>}
              <span className="credit">{image.credito}</span>
            </figcaption>
          </figure>
        )}
        {dilemma.assets.capas.length > 0 && (
          <p className="credit">{dilemma.assets.capas.map((capa) => capa.credito).join(' · ')}</p>
        )}
      </article>
      <ActionBar>
        <AdvanceButton label={t.archivo.cerrar} />
      </ActionBar>
    </>
  );
}
