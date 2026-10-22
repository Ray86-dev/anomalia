import { describe, expect, it } from 'vitest';
import { hasStory, loadInkLines, type InkVariables } from './ink.ts';

const text = async (story: string, variables = {}) =>
  (await loadInkLines(story, 'escena', variables)).map((line) => line.text).join('\n');

const DILEMMAS = ['d1', 'd2', 'd3', 'd4', 'd5'] as const;
const CHOICES = ['', 'A', 'B', 'C'] as const;

/** Todas las combinaciones de decisiones anteriores («» = dilema no jugado). */
function* previousChoices(): Generator<Record<string, string>> {
  const ids = DILEMMAS.slice(0, 4);
  for (let n = 0; n < CHOICES.length ** ids.length; n++) {
    yield Object.fromEntries(
      ids.map((id, i) => [
        `eleccion_${id}`,
        CHOICES[Math.floor(n / CHOICES.length ** i) % 4] ?? '',
      ]),
    );
  }
}

/** Mundos extremos: tranquilo e inestable, con todas las ramas cerradas o abiertas. */
const WORLDS: readonly InkVariables[] = [
  { desnivel: 0, equidad: 100, confianza: 100, rama_d1_firme: false, rama_d2_denuncia: false },
  { desnivel: 40, equidad: 0, confianza: 0, rama_d1_firme: true, rama_d2_denuncia: true },
  { desnivel: 15, equidad: 60, confianza: 60, rama_d1_firme: true, rama_d2_denuncia: false },
];

describe('historias Ink', () => {
  it('cada dilema tiene su escena y su versión de lectura fácil', () => {
    for (const id of DILEMMAS) {
      expect(hasStory(id)).toBe(true);
      expect(hasStory(`${id}-facil`)).toBe(true);
    }
    expect(hasStory('prologo-facil')).toBe(true);
    expect(hasStory('d9')).toBe(false);
  });

  it('ninguna escena pasa de seis líneas, sea cual sea la partida (M6)', async () => {
    for (const id of DILEMMAS) {
      for (const story of [id, `${id}-facil`]) {
        let longest = 0;
        for (const world of WORLDS) {
          for (const choices of previousChoices()) {
            const lines = await loadInkLines(story, 'escena', { ...world, ...choices });
            longest = Math.max(longest, lines.length);
          }
        }
        expect(longest, story).toBeLessThanOrEqual(6);
      }
    }
  });

  it('los ecos recuerdan la decisión del último dilema jugado', async () => {
    const d2 = await text('d2', { eleccion_d1: 'B' });
    expect(d2).toMatch(/Galileo mantenerse firme/);
    expect(await text('d2')).not.toMatch(/Todavía recuerdas/);

    const d3 = await text('d3', { eleccion_d1: 'A', eleccion_d2: 'C' });
    expect(d3).toMatch(/Todavía recuerdas Berlín: contaste/);
    expect(d3).not.toMatch(/Roma/);
    // Si la clase no jugó D2, recuerda D1.
    expect(await text('d3-facil', { eleccion_d1: 'C' })).toMatch(/Te acuerdas de Roma/);
  });

  it('D5 describe el 2077 que ha construido el alumno, con una sola consecuencia', async () => {
    const calm = await text('d5', { desnivel: 0, equidad: 55, confianza: 60 });
    expect(calm).toMatch(/casi nadie los usa fuera de los hospitales/);
    expect(calm).not.toMatch(/Galileo/);

    const unstable = await text('d5', {
      desnivel: 30,
      equidad: 30,
      confianza: 30,
      rama_d1_firme: true,
      rama_d2_denuncia: true,
    });
    expect(unstable).toMatch(/casi todo el mundo tiene su perfil genético/);
    // La desigualdad tiene prioridad sobre la desconfianza y las ramas.
    expect(unstable).toMatch(/Solo quien puede pagarlas/);
    expect(unstable).not.toMatch(/no se fía|denuncia|Galileo/);

    const firm = await text('d5', { desnivel: 0, equidad: 60, confianza: 60, rama_d1_firme: true });
    expect(firm).toMatch(/Galileo no se dejó doblar/);
  });

  it('ignora las variables que la historia no declara', async () => {
    await expect(text('d1', { desnivel: 40, rama_inventada: true })).resolves.toMatch(/Roma/);
  });
});
