import { describe, expect, it } from 'vitest';
import { hasStory, loadInkLines } from './ink.ts';

const text = async (story: string, variables = {}) =>
  (await loadInkLines(story, 'escena', variables)).map((line) => line.text).join('\n');

describe('historias Ink', () => {
  it('cada dilema tiene su escena y su versión de lectura fácil', () => {
    for (const id of ['d1', 'd2', 'd3', 'd4', 'd5']) {
      expect(hasStory(id)).toBe(true);
      expect(hasStory(`${id}-facil`)).toBe(true);
    }
    expect(hasStory('prologo-facil')).toBe(true);
    expect(hasStory('d9')).toBe(false);
  });

  it('D5 describe el 2077 que ha construido el alumno', async () => {
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
    expect(unstable).toMatch(/Solo quien puede pagarlas/);
    expect(unstable).toMatch(/no se fía/);
    expect(unstable).toMatch(/Galileo no se dejó doblar/);
    expect(unstable).toMatch(/protegen a quien denuncia/);
  });

  it('ignora las variables que la historia no declara', async () => {
    await expect(text('d1', { desnivel: 40, rama_inventada: true })).resolves.toMatch(/Roma/);
  });
});
