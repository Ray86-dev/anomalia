/**
 * Valida `content/` con zod y genera `shared/generated/content.ts`, el módulo que
 * importan la app y las Edge Functions.
 *
 *   npm run content            avisos para lo pendiente (TODO, sin verificar)
 *   npm run content:strict     los avisos son errores y la lectura fácil es obligatoria
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent, type Content, type RawContent } from './content/validate.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(root, 'content');
const outFile = join(root, 'shared', 'generated', 'content.ts');
const strict = process.argv.includes('--strict');

const parseErrors: string[] = [];

function readJson(relativePath: string): unknown {
  try {
    return JSON.parse(readFileSync(join(contentDir, relativePath), 'utf8'));
  } catch (error) {
    parseErrors.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function readText(relativePath: string): string | null {
  const file = join(contentDir, relativePath);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

const dilemmaFiles = readdirSync(join(contentDir, 'dilemas'))
  .filter((f) => f.endsWith('.json'))
  .sort();

const raw: RawContent = {
  dilemmas: dilemmaFiles.map((f) => ({ file: `dilemas/${f}`, data: readJson(`dilemas/${f}`) })),
  counselors: readJson('consejeros.json'),
  concepts: readJson('conceptos.json'),
  endings: readJson('finales.json'),
  rubric: readJson('rubrica.json'),
  modes: readJson('modos.json'),
  blocked: readJson('alias-bloqueados.json'),
  fallbacks: readJson('respaldos.json'),
  ui: readJson('interfaz.json'),
};

const { errors, warnings, content } = validateContent(raw, { strict, readText });
const allErrors = [...parseErrors, ...errors];

for (const warning of warnings) console.warn(`  aviso  ${warning}`);
for (const error of allErrors) console.error(`  ERROR  ${error}`);

if (allErrors.length > 0 || content === null) {
  console.error(`\n✖ Contenido no válido (${allErrors.length} errores). No se ha generado nada.`);
  process.exit(1);
}

function emit(c: Content): string {
  const json = (value: unknown) => JSON.stringify(value, null, 2);
  return `// Generado por scripts/build-content.ts a partir de content/. NO EDITAR A MANO.
import type { BlockedTerms } from '../game/alias.ts';
import type {
  ClassMode,
  Concept,
  Counselor,
  Dilemma,
  Ending,
  Fallbacks,
  Rubric,
  UiTree,
} from '../schemas/content.ts';

export const ui = ${json(c.ui)} as const satisfies UiTree;

export const counselors: readonly Counselor[] = ${json(c.counselors)};

export const concepts: readonly Concept[] = ${json(c.concepts)};

export const endings: readonly Ending[] = ${json(c.endings)};

export const rubric: Rubric = ${json(c.rubric)};

export const classModes: readonly ClassMode[] = ${json(c.modes)};

export const blockedTerms: BlockedTerms = ${json(c.blocked)};

export const fallbacks: Fallbacks = ${json(c.fallbacks)};

export const dilemmas: readonly Dilemma[] = ${json(c.dilemmas)};
`;
}

const output = emit(content);
const previous = existsSync(outFile) ? readFileSync(outFile, 'utf8') : null;
if (output !== previous) {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, output, 'utf8');
}

console.log(
  `✔ Contenido válido: ${content.dilemmas.length} dilema(s), ${content.counselors.length} consejeros, ` +
    `${content.concepts.length} conceptos, ${content.endings.length} finales` +
    (warnings.length > 0 ? ` · ${warnings.length} aviso(s) pendientes` : ''),
);
