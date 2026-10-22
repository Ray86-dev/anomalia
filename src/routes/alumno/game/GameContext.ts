import { newlyEarned } from '@shared/game/achievements.ts';
import { rewards, ui } from '@shared/generated/content.ts';
import type {
  AnswerSnapshot,
  GameRequest,
  GameResponse,
  RunSnapshot,
} from '@shared/schemas/partida.ts';
import type { MyState } from '@shared/schemas/state.ts';
import { createContext, useCallback, useContext, useState } from 'react';
import { vibrate } from '../../../engine/motion.ts';
import { playAction } from '../../../lib/api.ts';
import { noveltyText, summaryOf } from './rewards.ts';

/** Aviso de logro (M6): se calcula comparando el progreso antes y después de cada acción. */
export type Toast = { readonly id: number; readonly text: string };

export type Game = {
  readonly alias: string;
  /** Clave de rescate para recuperar la partida en otro móvil (solo la ve su dueño). */
  readonly rescueKey: string;
  readonly run: RunSnapshot;
  readonly answer: AnswerSnapshot | null;
  readonly pending: boolean;
  readonly error: string | null;
  /** Envía una acción a `partida`; devuelve la respuesta o `null` si falló la red. */
  readonly act: (request: GameRequest) => Promise<GameResponse | null>;
  readonly retry: () => void;
  readonly toasts: readonly Toast[];
  readonly dismissToast: (id: number) => void;
  /** Avance de la narración, para el parallax del fondo. */
  readonly setStep: (step: number) => void;
};

export const GameContext = createContext<Game | null>(null);

export function useGameContext(): Game {
  const game = useContext(GameContext);
  if (game === null) throw new Error('useGameContext outside <GameContext>');
  return game;
}

const t = ui.juego;
let nextToast = 1;

/** Estado de la partida en el cliente: siempre adopta el estado que devuelve el servidor. */
export function useGameState(initial: MyState, onLost: () => void): Omit<Game, 'setStep'> {
  const [run, setRun] = useState<RunSnapshot>(initial.run);
  const [answer, setAnswer] = useState<AnswerSnapshot | null>(initial.answer);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<GameRequest | null>(null);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  // Estable entre renderizados: el temporizador de cada aviso no se reinicia al repintar.
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  async function act(request: GameRequest): Promise<GameResponse | null> {
    setPending(true);
    setError(null);
    setFailed(null);
    try {
      const response = await playAction(request);
      if (response.run !== null) {
        const before = summaryOf(run.progress);
        const news = newlyEarned(before, summaryOf(response.run.progress), rewards);
        if (news.length > 0) {
          vibrate(40);
          setToasts((current) => [
            ...current,
            ...news.map((novelty) => ({ id: nextToast++, text: noveltyText(novelty, before) })),
          ]);
        }
        setRun(response.run);
        setAnswer(response.answer);
      }
      if (!response.ok) {
        if (response.error === 'invalid') setError(t.errores.invalido);
        if (response.error === 'expelled' || response.error === 'not_joined') onLost();
      }
      return response;
    } catch {
      setError(t.errores.red);
      setFailed(request);
      return null;
    } finally {
      setPending(false);
    }
  }

  return {
    alias: initial.player.alias,
    rescueKey: initial.player.rescueKey,
    run,
    answer,
    pending,
    error,
    act,
    retry: () => {
      if (failed !== null) void act(failed);
    },
    toasts,
    dismissToast,
  };
}
