/** Recuento de palabras para las justificaciones y réplicas (40–80 / 30–60 palabras, §6). */

/** Cuenta palabras: secuencias con al menos una letra o cifra (ignora signos sueltos). */
export function countWords(text: string): number {
  return text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Limpia un texto libre del alumno: NFC, sin caracteres de control y sin espacios sobrantes. */
export function cleanText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\p{Cc}/gu, (char) => (char === '\n' || char === '\t' ? char : ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type WordCheck = 'empty' | 'short' | 'ok' | 'long';

/** Comprueba la longitud sin bloquear: el aviso de «corto» se puede saltar tras un reintento. */
export function checkWords(text: string, [min, max]: readonly [number, number]): WordCheck {
  const words = countWords(text);
  if (words === 0) return 'empty';
  if (words < min) return 'short';
  if (words > max) return 'long';
  return 'ok';
}
