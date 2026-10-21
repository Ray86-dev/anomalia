/** Reglas de alias (§11.4): 3–16 caracteres, único por clase, sin palabras inapropiadas. */

/** Debe coincidir con el CHECK de `players.alias` en la migración core. */
export const ALIAS_PATTERN = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ_-]{3,16}$/;

export type BlockedTerms = {
  /** Se bloquean si aparecen en cualquier parte del alias. */
  readonly contiene: readonly string[];
  /** Se bloquean solo si son el alias entero o uno de sus trozos (separados por _ o -). */
  readonly exactas: readonly string[];
};

export type AliasProblem = 'format' | 'blocked';

const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
};

/** Limpia espacios y unifica la forma Unicode (NFC) para que «á» sea un solo carácter. */
export function cleanAlias(alias: string): string {
  return alias.trim().normalize('NFC');
}

/** Forma canónica para comparar con la lista: minúsculas, sin tildes, sin leet y sin letras repetidas. */
export function canonical(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[0-8]/g, (d) => LEET[d] ?? d)
    .replace(/(.)\1+/g, '$1');
}

export function aliasProblem(alias: string, blocked: BlockedTerms): AliasProblem | null {
  if (!ALIAS_PATTERN.test(alias)) return 'format';

  const parts = alias.split(/[_-]+/).filter((p) => p.length > 0);
  const whole = canonical(parts.join(''));
  if (blocked.contiene.some((term) => whole.includes(canonical(term)))) return 'blocked';

  // Cada trozo y el alias entero, con y sin números finales («Culo99» no se salva).
  const exact = new Set(blocked.exactas.map(canonical));
  const candidates = [parts.join(''), ...parts].flatMap((raw) => [
    canonical(raw),
    canonical(raw.replace(/\d+$/, '')),
  ]);
  return candidates.some((c) => exact.has(c)) ? 'blocked' : null;
}
