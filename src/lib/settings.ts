/**
 * Ajustes de accesibilidad del alumnado (§10.3, M7), recordados en este dispositivo:
 * lectura en voz alta, tamaño del texto y movimiento reducido manual.
 * El tamaño y el movimiento se aplican como atributos de <html> que leen los estilos.
 */
type Setting<T extends string> = {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
};

function storedSetting<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
  apply?: (value: T) => void,
): Setting<T> {
  let value = fallback;
  try {
    const stored = localStorage.getItem(key);
    value = values.find((v) => v === stored) ?? fallback;
  } catch {
    // Sin almacenamiento: valor por defecto.
  }
  const listeners = new Set<() => void>();
  apply?.(value);
  return {
    get: () => value,
    set(next) {
      value = next;
      try {
        localStorage.setItem(key, next);
      } catch {
        // Sin almacenamiento: el ajuste dura hasta recargar.
      }
      apply?.(next);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const TEXT_SIZES = ['normal', 'grande', 'muy-grande'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

const root = () => document.documentElement;

export const voice = storedSetting('anomalia:voz', ['si', 'no'] as const, 'no');

export const textSize = storedSetting<TextSize>(
  'anomalia:tamano-texto',
  TEXT_SIZES,
  'normal',
  (value) => {
    if (value === 'normal') delete root().dataset.text;
    else root().dataset.text = value;
  },
);

/** «reducido» activa `html[data-motion="reduced"]`; «sistema» sigue a `prefers-reduced-motion`. */
export const motion = storedSetting(
  'anomalia:movimiento',
  ['sistema', 'reducido'] as const,
  'sistema',
  (value) => {
    if (value === 'reducido') root().dataset.motion = 'reduced';
    else delete root().dataset.motion;
  },
);
