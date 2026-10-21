import { ui } from '@shared/generated/content.ts';
import type {
  AnswerSnapshot,
  GameRequest,
  GameResponse,
  RunSnapshot,
} from '@shared/schemas/partida.ts';
import type { MyState } from '@shared/schemas/state.ts';
import { createContext, useContext, useState } from 'react';
import { playAction } from '../../../lib/api.ts';

export type Game = {
  readonly alias: string;
  readonly run: RunSnapshot;
  readonly answer: AnswerSnapshot | null;
  readonly pending: boolean;
  readonly error: string | null;
  /** Envía una acción a `partida`; devuelve la respuesta o `null` si falló la red. */
  readonly act: (request: GameRequest) => Promise<GameResponse | null>;
  readonly retry: () => void;
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

/** Estado de la partida en el cliente: siempre adopta el estado que devuelve el servidor. */
export function useGameState(initial: MyState, onLost: () => void): Omit<Game, 'setStep'> {
  const [run, setRun] = useState<RunSnapshot>(initial.run);
  const [answer, setAnswer] = useState<AnswerSnapshot | null>(initial.answer);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<GameRequest | null>(null);

  async function act(request: GameRequest): Promise<GameResponse | null> {
    setPending(true);
    setError(null);
    setFailed(null);
    try {
      const response = await playAction(request);
      if (response.run !== null) {
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
    run,
    answer,
    pending,
    error,
    act,
    retry: () => {
      if (failed !== null) void act(failed);
    },
  };
}
