/** Emblema del cronista (M6): símbolo de 24×24 sobre un círculo del color elegido. */
import type { EmblemPieces } from './rewards.ts';

const INK = '#0b0e14';

export function Emblem({
  pieces,
  size = 28,
}: {
  readonly pieces: EmblemPieces;
  readonly size?: number;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="emblem">
      <circle cx="12" cy="12" r="12" fill={pieces.color.hex} />
      <path d={pieces.symbol.path} fill={INK} transform="translate(4.8 4.8) scale(0.6)" />
    </svg>
  );
}
