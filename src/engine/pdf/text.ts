/** Corte de líneas para el PDF (pdf-lib no reparte el texto en líneas por sí mismo). */

/** Ancho de un texto con la fuente y el tamaño en uso, en puntos. */
export type Measure = (text: string) => number;

/** Corta una palabra que no cabe en una línea en trozos que sí caben. */
function splitLongWord(word: string, maxWidth: number, measure: Measure): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const char of word) {
    if (piece !== '' && measure(piece + char) > maxWidth) {
      pieces.push(piece);
      piece = char;
    } else {
      piece += char;
    }
  }
  if (piece !== '') pieces.push(piece);
  return pieces;
}

/** Líneas de un párrafo que caben en `maxWidth`, sin cortar palabras salvo que no quepan solas. */
export function wrapParagraph(paragraph: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of paragraph.split(/\s+/).filter(Boolean)) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line !== '') lines.push(line);
    if (measure(word) <= maxWidth) {
      line = word;
    } else {
      const pieces = splitLongWord(word, maxWidth, measure);
      line = pieces.pop() ?? '';
      lines.push(...pieces);
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** Párrafos (separados por saltos de línea) ya cortados en líneas; omite los vacíos. */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[][] {
  return text
    .split(/\n+/)
    .map((paragraph) => wrapParagraph(paragraph, maxWidth, measure))
    .filter((lines) => lines.length > 0);
}
