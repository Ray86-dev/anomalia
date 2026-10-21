/**
 * Privacidad de menores (§7.2): antes de enviar un texto del alumno a la IA se quitan datos
 * de contacto que pudiera haber escrito. Al modelo nunca llegan ni el alias ni el código de clase.
 */
import { canonical } from './alias.ts';

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const URL = /\b(?:https?:\/\/|www\.)\S+/giu;
/** Teléfonos españoles: 9 cifras empezando por 6–9, con prefijo y separadores opcionales. */
const PHONE = /(?<!\d)(?:\+?34[\s.-]?)?[6-9](?:[\s.-]?\d){8}(?!\d)/g;
const HANDLE = /(^|\s)@[\p{L}\p{N}_.]{2,}/gu;

export function scrubPersonalData(text: string): string {
  return text
    .replace(EMAIL, '[correo]')
    .replace(URL, '[enlace]')
    .replace(PHONE, '[teléfono]')
    .replace(HANDLE, '$1[usuario]');
}

/**
 * Indicios de malestar personal grave en un texto (respaldo local de la `alerta` de la IA:
 * funciona aunque la IA falle). Genera un aviso privado para el docente, nunca un bloqueo.
 */
export function mentionsDistress(text: string, terms: readonly string[]): boolean {
  const normalized = canonical(text);
  return terms.some((term) => normalized.includes(canonical(term)));
}
