import { ambients, ui } from '@shared/generated/content.ts';
import type { Phase } from '@shared/game/phases.ts';
import type { MyState } from '@shared/schemas/state.ts';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { desnivel } from '@shared/game/world.ts';
import { audio, tensionFor } from '../../../engine/audio.ts';
import { speech } from '../../../engine/speech.ts';
import { assetUrl, Backdrop } from '../../../engine/backdrop/Backdrop.tsx';
import { animateIn } from '../../../engine/motion.ts';
import { reading } from '../../../lib/reading.ts';
import { fmt } from '../../../lib/text.ts';
import { Notice } from '../../../ui/Notice.tsx';
import { Achievements } from './Achievements.tsx';
import { Credits } from './Credits.tsx';
import { GameContext, useGameState } from './GameContext.ts';
import { findDilemma } from './helpers.ts';
import { AudioToggle, ReadingToggle, VoiceToggle } from './parts.tsx';
import { Council, Decision } from './screens/council.tsx';
import { Lab } from './screens/lab.tsx';
import { Twist } from './screens/twist.tsx';
import { Prologue, Scene, Travel } from './screens/intro.tsx';
import { Archive, Ripples } from './screens/outcome.tsx';
import { Dossier, Epilogue, Reflection } from './screens/finale.tsx';
import { Waiting } from './screens/pause.tsx';
import { Justification, Objection } from './screens/writing.tsx';
import { Toasts } from './Toasts.tsx';
import '../../../styles/game.css';

const t = ui.juego;

/** Fases que transcurren en la época del dilema; el resto, en el 2077 del Archivo. */
const IN_THE_PAST: ReadonlySet<Phase> = new Set([
  'travel',
  'scene',
  'lab',
  'council',
  'decision',
  'twist',
  'justification',
  'objection',
]);

type GameProps = {
  readonly initial: MyState;
  /** La sesión ya no tiene partida (retirada por el docente, clase borrada…). */
  readonly onLost: () => void;
};

/** Partida del alumno: elige la pantalla según la fase y ambienta fondo y música. */
export function Game({ initial, onLost }: GameProps) {
  const state = useGameState(initial, onLost);
  // Al cambiar la lectura fácil se vuelve a pintar toda la partida con la otra versión.
  useSyncExternalStore(
    (listener) => reading.subscribe(listener),
    () => reading.isEasy(),
  );
  const { run } = state;
  // El parallax vuelve a 0 en cada pantalla: el paso se guarda junto a la pantalla que lo fijó.
  const screenKey = `${run.phase}:${run.currentDilemma ?? ''}`;
  const [progress, setProgress] = useState({ screen: screenKey, step: 0 });
  const step = progress.screen === screenKey ? progress.step : 0;
  const dilemma = findDilemma(run.currentDilemma);

  const past = dilemma !== undefined && IN_THE_PAST.has(run.phase);
  const era = past ? dilemma.estetica : '2077';
  const ambient = ambients[era];
  const layers = past && dilemma.assets.capas.length > 0 ? dilemma.assets.capas : ambient.capas;
  const track = (past ? dilemma.assets.musica : undefined) ?? ambient.musica;
  const trackUrl = track === undefined ? null : assetUrl(track.src);

  useEffect(() => {
    audio.play(trackUrl);
  }, [trackUrl]);

  // La disonancia crece con el Desnivel del mundo del alumno (§10.2).
  const tension = tensionFor(desnivel(run.world));
  useEffect(() => {
    audio.setTension(tension);
  }, [tension]);
  useEffect(
    () => () => {
      audio.setTension(0);
    },
    [],
  );

  // La música baja mientras se lee en voz alta.
  useEffect(() => {
    speech.onSpeakingChange((speaking) => {
      audio.setDucked(speaking);
    });
    return () => {
      speech.onSpeakingChange(null);
      speech.stop();
    };
  }, []);

  // Cada fase nueva: entrada suave y foco en el título (lectores de pantalla).
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = main.current;
    if (element === null) return;
    speech.stop();
    element.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    void animateIn(element);
  }, [screenKey]);

  let screen: ReactNode;
  if (run.phase === 'prologue') screen = <Prologue />;
  else if (run.phase === 'waiting') screen = <Waiting />;
  else if (run.phase === 'epilogue') screen = <Epilogue />;
  else if (run.phase === 'reflection') screen = <Reflection />;
  else if (run.phase === 'dossier' || run.phase === 'done') screen = <Dossier />;
  else if (dilemma === undefined) screen = <Notice tone="error">{ui.app.errorInesperado}</Notice>;
  else {
    const screens: Partial<Record<Phase, ReactNode>> = {
      travel: <Travel dilemma={dilemma} />,
      scene: <Scene dilemma={dilemma} />,
      lab: <Lab dilemma={dilemma} />,
      council: <Council dilemma={dilemma} />,
      decision: <Decision dilemma={dilemma} />,
      twist: <Twist dilemma={dilemma} />,
      justification: <Justification dilemma={dilemma} />,
      objection: <Objection dilemma={dilemma} />,
      ripples: <Ripples dilemma={dilemma} />,
      archive: <Archive dilemma={dilemma} />,
    };
    screen = screens[run.phase] ?? <Notice tone="error">{ui.app.errorInesperado}</Notice>;
  }

  const kicker = past
    ? fmt(t.viaje.destino, { lugar: dilemma.lugar, anio: dilemma.anio })
    : fmt(t.cronista, { alias: state.alias });

  return (
    <GameContext.Provider
      value={{
        ...state,
        setStep: (next: number) => {
          setProgress({ screen: screenKey, step: next });
        },
      }}
    >
      <Backdrop palette={ambient.paleta} layers={layers} step={step} instability={tension} />
      <div
        className="game"
        data-era={era}
        style={{ '--accent': ambient.paleta[2] } as CSSProperties}
      >
        <header className="game-bar">
          <div className="game-bar-row">
            <Achievements />
            <span className="game-bar-actions">
              <ReadingToggle />
              <VoiceToggle />
              <Credits />
              <AudioToggle />
            </span>
          </div>
          <Toasts />
        </header>
        <main key={screenKey} ref={main} className="screen game-screen">
          {/* El rótulo del lugar o del cronista baja a la pantalla: la barra es del emblema (M6). */}
          <p className="kicker game-place">{kicker}</p>
          {initial.player.status === 'expelled' ? (
            <Notice tone="error">{t.errores.expulsado}</Notice>
          ) : (
            screen
          )}
        </main>
      </div>
    </GameContext.Provider>
  );
}
