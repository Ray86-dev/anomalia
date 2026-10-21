/**
 * Historias Ink compiladas en build (scripts/build-content.ts → shared/generated/ink/*.json).
 * Cada historia, y el propio runtime de inkjs, se descargan solo cuando hacen falta.
 */
const sources = import.meta.glob<string>('/shared/generated/ink/*.json', {
  query: '?raw',
  import: 'default',
});

export type InkLine = {
  readonly text: string;
  readonly tags: readonly string[];
};

/** Recorre un nudo y devuelve sus líneas con sus etiquetas (# titulo, # pregunta…). */
export async function loadInkLines(storyId: string, knot: string): Promise<InkLine[]> {
  const load = sources[`/shared/generated/ink/${storyId}.json`];
  if (load === undefined) throw new Error(`Ink story not found: ${storyId}`);
  // El runtime de Ink (~30 KB gzip) solo se descarga al llegar a la primera narración.
  const [{ Story }, json] = await Promise.all([import('inkjs'), load()]);
  const story = new Story(json);
  story.ChoosePathString(knot);
  const lines: InkLine[] = [];
  while (story.canContinue) {
    const text = (story.Continue() ?? '').trim();
    if (text !== '') lines.push({ text, tags: story.currentTags ?? [] });
  }
  return lines;
}
