/** Prólogo, viaje temporal y escena (fases 1–2 del bucle §6). */
import { intro, ui } from '@shared/generated/content.ts';
import { desnivel } from '@shared/game/world.ts';
import type { Dilemma } from '@shared/schemas/content.ts';
import type { RunSnapshot } from '@shared/schemas/partida.ts';
import { useEffect, useState } from 'react';
import { audio } from '../../../../engine/audio.ts';
import { Cinematic } from '../../../../engine/cinematic/Cinematic.tsx';
import { countTo } from '../../../../engine/motion.ts';
import { fmt } from '../../../../lib/text.ts';
import { useGameContext } from '../GameContext.ts';
import { CinematicPlayer } from '../CinematicPlayer.tsx';
import { formatRescueKey, storyFor, texto } from '../helpers.ts';
import { ActionBar, AdvanceButton, InkReader, Listen, useSubScreen } from '../parts.tsx';

const t = ui.juego;

export function Prologue() {
  const { rescueKey } = useGameContext();
  // `null`: pantalla de inicio; después, el panel de la intro que se está viendo (D-87).
  const [panel, setPanel] = useState<number | null>(null);
  const panels = intro.paneles;
  useSubScreen(panel === null ? 'inicio' : 'intro');

  useEffect(() => {
    audio.preload(); // Howler listo antes del toque en «Comenzar» (desbloqueo en iOS/Android)
  }, []);

  const shot = panels[panel ?? 0]?.plano ?? 'canarias';

  return (
    <>
      <Cinematic shot={shot} />
      {panel === null ? (
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
                setPanel(0);
              }}
            >
              {t.comenzar}
            </button>
          </ActionBar>
        </>
      ) : (
        <CinematicPlayer
          panels={panels}
          index={panel}
          onIndex={setPanel}
          title={ui.app.titulo}
          skipLabel={t.cinematica.saltar}
          finalAction={<AdvanceButton label={t.prologo.viajar} />}
        />
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
      <Listen
        auto
        text={`${fmt(t.viaje.destino, { lugar: dilemma.lugar, anio: dilemma.anio })}. ${texto(dilemma.titulo)}. ${texto(dilemma.rolCronista)}`}
      />
      <ActionBar>
        <AdvanceButton label={t.viaje.llegar} />
      </ActionBar>
    </>
  );
}

/**
 * Lo que una escena puede consultar (D5 cambia según el mundo construido): las cuatro
 * variables, el Desnivel, las ramas abiertas como `rama_d1_firme` y, para los ecos (M6), la
 * decisión final de cada dilema ya jugado como `eleccion_d1` («A», «B» o «C»).
 */
function sceneVariables({
  world,
  branches,
  progress,
}: Pick<RunSnapshot, 'world' | 'branches' | 'progress'>) {
  return {
    ...world,
    desnivel: desnivel(world),
    ...Object.fromEntries(branches.map((b) => [`rama_${b.replaceAll('-', '_')}`, true])),
    ...Object.fromEntries(
      Object.entries(progress.choices).map(([dilemma, choice]) => [`eleccion_${dilemma}`, choice]),
    ),
  };
}

export function Scene({ dilemma }: { readonly dilemma: Dilemma }) {
  const { setStep, run } = useGameContext();
  const [done, setDone] = useState(false);
  return (
    <>
      <h1 className="visually-hidden" tabIndex={-1} data-focus>
        {texto(dilemma.titulo)}
      </h1>
      <InkReader
        storyId={storyFor(dilemma.id)}
        knot="escena"
        variables={sceneVariables(run)}
        onStep={setStep}
        onDone={() => {
          setDone(true);
        }}
      />
      {done && (
        <ActionBar>
          <AdvanceButton label={t.escena.irAlLaboratorio} />
        </ActionBar>
      )}
    </>
  );
}
