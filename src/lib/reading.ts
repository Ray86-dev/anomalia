/**
 * Modo lectura fácil (§10.3, D-10): cada texto del contenido tiene una versión `facil`.
 * Se recuerda en este dispositivo y se puede cambiar en cualquier momento de la partida.
 */
const STORAGE_KEY = 'anomalia:lectura-facil';

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let easy = readStored();
const listeners = new Set<() => void>();

export const reading = {
  isEasy(): boolean {
    return easy;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setEasy(value: boolean): void {
    easy = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // Sin almacenamiento: el ajuste dura hasta recargar.
    }
    for (const listener of listeners) listener();
  },
};
