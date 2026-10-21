/** Compila fuentes Ink (solo en build: el navegador recibe el JSON y usa el runtime de inkjs). */
import { Compiler, Story } from 'inkjs/full';
import type { InkResult } from './validate.ts';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function compileInk(source: string, requiredKnots: readonly string[]): InkResult {
  const compiler = new Compiler(source);
  let json: string;
  try {
    const story = compiler.Compile();
    json = String(story.ToJson());
  } catch (error) {
    const errors = compiler.errors.length > 0 ? compiler.errors : [message(error)];
    return { json: null, errors, warnings: compiler.warnings };
  }
  if (compiler.errors.length > 0) return { json: null, errors: compiler.errors, warnings: compiler.warnings };

  // Cada nudo que usa el juego debe existir y producir texto.
  const errors: string[] = [];
  for (const knot of requiredKnots) {
    try {
      const story = new Story(json);
      story.ChoosePathString(knot);
      if (story.ContinueMaximally().trim() === '') errors.push(`el nudo «${knot}» no produce texto`);
    } catch {
      errors.push(`falta el nudo «${knot}»`);
    }
  }
  return { json: errors.length > 0 ? null : json, errors, warnings: compiler.warnings };
}
