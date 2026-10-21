/** Prólogo, viaje temporal y escena (fases 1–2 del bucle §6). */
import { ui } from '@shared/generated/content.ts';
import type { Dilemma } from '@shared/schemas/content.ts';
import { useEffect, useState } from 'react';
import { audio } from '../../../../engine/audio.ts';
import { countTo } from '../../../../engine/motion.ts';
import { fmt } from '../../../../lib/text.ts';
import { useGameContext } from '../GameContext.ts';
import { formatRescueKey, texto } from '../helpers.ts';
import { ActionBar, AdvanceButton, InkReader } from '../parts.tsx';

const t = ui.juego;

export function Prologue() {
  const { setStep, rescueKey } = useGameContext();
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    audio.preload(); // Howler listo antes del toque en «Comenzar» (desbloqueo en iOS/Android)
  }, []);

  if (!started) {
    return (
      <>
        <h1 className="title-hero" tabIndex={-1} data-focus>
          {ui.app.titulo}
        </h1>
        <p className="lead">{t.comenzarAyuda}</p>
        <div className="rescue-key">
          <p className="rescue-key-label">{t.clave.titulo}</p>
          <p className="rescue-key-value">{formatRescueKey(rescueKey)}</p>
          <p className="help">{t.clave.texto}</p>
        </div>
        <ActionBar>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setStarted(true);
            }}
          >
            {t.comenzar}
          </button>
        </ActionBar>
      </>
    );
  }

  return (
    <>
      <h1 className="visually-hidden" tabIndex={-1} data-focus>
        {ui.app.titulo}
      </h1>
      <InkReader
        storyId="prologo"
        knot="prologo"
        onStep={setStep}
        onDone={() => {
          setDone(true);
        }}
      />
      {done && (
        <ActionBar>
          <AdvanceButton label={t.prologo.viajar} />
        </ActionBar>
      )}
    </>
  );
}

export function Travel({ dilemma }: { readonly dilemma: Dilemma }) {
  const [year, setYear] = useState(2077);

  useEffect(() => {
    let cancel: (() => void) | undefined;
    let active = true;
    void countTo(2077, dilemma.anio, setYear).then((stop) => {
      if (active) cancel = stop;
      else stop();
    });
    return () => {
      active = false;
      cancel?.();
    };
  }, [dilemma.anio]);

  return (
    <>
      <p className="kicker">{t.viaje.titulo}</p>
      <p className="year-counter" aria-hidden="true">
        {year}
      </p>
      <h1 tabIndex={-1} data-focus>
        {fmt(t.viaje.destino, { lugar: dilemma.lugar, anio: dilemma.anio })}
      </h1>
      <p className="lead">{texto(dilemma.titulo)}</p>
      <p>{texto(dilemma.rolCronista)}</p>
      <ActionBar>
        <AdvanceButton label={t.viaje.llegar} />
      </ActionBar>
    </>
  );
}

export function Scene({ dilemma }: { readonly dilemma: Dilemma }) {
  const { setStep } = useGameContext();
  const [done, setDone] = useState(false);
  return (
    <>
      <h1 className="visually-hidden" tabIndex={-1} data-focus>
        {texto(dilemma.titulo)}
      </h1>
      <InkReader
        storyId={dilemma.id}
        knot="escena"
        onStep={setStep}
        onDone={() => {
          setDone(true);
        }}
      />
      {done && (
        <ActionBar>
          <AdvanceButton label={t.escena.irAlConsejo} />
        </ActionBar>
      )}
    </>
  );
}
