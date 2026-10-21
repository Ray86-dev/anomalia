import { counselors, dilemmas } from '@shared/generated/content.ts';
import type { Counselor, Dilemma, Texto } from '@shared/schemas/content.ts';

/** Versión del texto que toca mostrar. La lectura fácil (D-10) se activará con su ajuste en M5. */
export function texto(value: Texto): string {
  return value.normal;
}

export function findDilemma(id: string | null): Dilemma | undefined {
  return id === null ? undefined : dilemmas.find((d) => d.id === id);
}

export function findCounselor(id: string | null | undefined): Counselor | undefined {
  return counselors.find((c) => c.id === id);
}

/** «K7P2MX» → «K7P-2MX» (más fácil de copiar a mano). */
export function formatRescueKey(key: string): string {
  return `${key.slice(0, 3)}-${key.slice(3)}`;
}

/** Iniciales para el avatar del consejero («Inés Kaltz» → «IK»). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const DRAFT_PREFIX = 'anomalia:borrador:';

/** Borradores de texto en el propio móvil (nunca en el servidor hasta que se envían). */
export const drafts = {
  read(key: string): string {
    try {
      return localStorage.getItem(DRAFT_PREFIX + key) ?? '';
    } catch {
      return '';
    }
  },
  write(key: string, value: string): void {
    try {
      if (value === '') localStorage.removeItem(DRAFT_PREFIX + key);
      else localStorage.setItem(DRAFT_PREFIX + key, value);
    } catch {
      // Sin almacenamiento: el borrador se pierde al recargar, pero se puede seguir escribiendo.
    }
  },
};
