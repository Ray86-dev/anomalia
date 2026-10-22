import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS } from '@shared/schemas/partida.ts';
import type { MyDossier } from '@shared/schemas/state.ts';
import { buildDossierPdf } from '../../../engine/pdf/dossier.ts';
import boldFont from '../../../../public/assets/fonts/AtkinsonHyperlegible-Bold.ttf?inline';
import regularFont from '../../../../public/assets/fonts/AtkinsonHyperlegible-Regular.ttf?inline';
import { dossierFileName, dossierPdfInput, endingFor } from './dossier.ts';

const dossier: MyDossier = {
  alias: 'Hipatia',
  classLabel: '4.º ESO B',
  verifyCode: 'ANM-7F3K-92QD',
  ending: null,
  finishedAt: '2026-10-22T10:00:00Z',
  world: { poder: 80, responsabilidad: 50, equidad: 30, confianza: 50 },
  emblem: null,
  progress: EMPTY_PROGRESS,
  reflection: 'La ciencia explica.\n\nPero no decide por nosotros: eso nos toca a nosotros. 🙂',
  answers: [
    {
      dilemmaId: 'd1',
      choice: 'A',
      firstChoice: 'A',
      justification: 'Prefiero que siga vivo para que pueda seguir investigando.',
      objector: 'kaltz',
      objection: '¿Y si callar a tiempo enseña a callar siempre?',
      reply: null,
      replyStance: null,
    },
    // Respuesta de un dilema que ya no existe en el contenido: no rompe el expediente.
    {
      dilemmaId: 'd9',
      choice: 'B',
      firstChoice: null,
      justification: null,
      objector: null,
      objection: null,
      reply: null,
      replyStance: null,
    },
  ],
};

describe('dossierPdfInput', () => {
  const input = dossierPdfInput(dossier, 'Ada Pérez Núñez', new Date('2026-10-22T12:00:00Z'));

  it('la portada lleva el nombre escrito en el móvil, el grupo, el alias y el código', () => {
    expect(input.cover).toMatchObject({
      name: 'Ada Pérez Núñez',
      group: '4.º ESO B',
      alias: 'Hipatia',
      code: 'ANM-7F3K-92QD',
      ending: 'Tecnocracia genómica',
    });
  });

  it('sin final guardado usa el que corresponde al estado del mundo', () => {
    expect(endingFor(null, dossier.world).id).toBe('tecnocracia');
    expect(endingFor('fractura', dossier.world).id).toBe('fractura');
  });

  it('una entrada por dilema contestado: decisión y sus cuatro apartados', () => {
    expect(input.entries).toHaveLength(1);
    const [entry] = input.entries;
    expect(entry).toMatchObject({
      year: '1633',
      place: 'Roma',
      title: 'Galileo ante la Inquisición',
      color: '#e3c08a',
      decision: { letter: 'A', note: 'La mantuvo tras el giro.' },
    });
    expect(entry?.blocks.map((b) => [b.label, b.tone])).toEqual([
      ['Justificación', 'plain'],
      ['Objeción de Inés Kaltz', 'quote'],
      ['Réplica', 'plain'],
      ['Archivo real', 'archive'],
    ]);
    expect(entry?.blocks[1]?.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(entry?.blocks[2]?.text).toBe('(sin respuesta)');
    // Las marcas de revisión nunca llegan al expediente (D-72).
    expect(entry?.blocks[3]?.text).not.toMatch(/TODO/);
  });

  it('la réplica indica la postura y la decisión cambiada dice cuál era la primera', () => {
    const changed = dossierPdfInput(
      {
        ...dossier,
        answers: [
          {
            ...dossier.answers[0],
            dilemmaId: 'd1',
            choice: 'B',
            firstChoice: 'A',
            justification: null,
            objector: 'novak',
            objection: null,
            reply: 'Sí, pero no siempre.',
            replyStance: 'matiza',
          },
        ],
      },
      'Ada',
      new Date(),
    );
    const [entry] = changed.entries;
    expect(entry?.decision.note).toBe('La cambió tras el giro (antes eligió la A).');
    expect(entry?.blocks[2]?.label).toBe('Réplica · Matizo mi postura');
  });

  it('sello de rango y página de logros, que no cuentan para la nota', () => {
    expect(input.badge.rank).toBe('Aprendiz del Archivo');
    expect(input.badge.emblemColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(input.achievements.note).toMatch(/no forman parte de la nota/);
    expect(input.achievements.summary).toBe('Aprendiz del Archivo · 0 puntos');
    expect(input.achievements.items.every((item) => item.count === 0)).toBe(true);
    expect(input.achievements.stars).toHaveLength(20);
    expect(input.achievements.fichas).toEqual([]);
  });

  it('la rúbrica indica los criterios de evaluación oficiales de cada criterio', () => {
    expect(input.rubric.reference).toBe('Filosofía 4.º ESO · Decreto 30/2023 (Canarias)');
    expect(input.rubric.criteria.map((c) => c.curriculum)).toEqual([
      'Criterios de evaluación: 1.1',
      'Criterios de evaluación: 3.1',
      'Criterios de evaluación: 2.1',
      'Criterios de evaluación: 1.1',
      'Criterios de evaluación: 2.1 y 3.1',
    ]);
  });

  it('desnivel con signo, cabecera, pie con el código y nombre de archivo', () => {
    expect(input.world.gap).toBe(30);
    expect(input.world.gapText).toBe('+30');
    expect(input.footer(2, 5)).toBe('ANM-7F3K-92QD · 2 / 5');
    expect(input.labels.cabecera).toBe('Expediente de Hipatia');
    expect(dossierFileName('ANM-7F3K-92QD')).toBe('ANOMALIA-expediente-ANM-7F3K-92QD.pdf');
  });
});

describe('buildDossierPdf', () => {
  /** Las fuentes llegan como data: URL (`?inline`) para no depender de node:fs. */
  const bytes = (dataUrl: string) =>
    Uint8Array.from(atob(dataUrl.split(',')[1] ?? ''), (char) => char.charCodeAt(0));

  it('genera un PDF válido con la fuente incrustada, tildes, eñes y emojis', async () => {
    const input = dossierPdfInput(dossier, 'Ada Pérez Núñez', new Date());
    const pdf = await PDFDocument.load(
      await buildDossierPdf(input, { regular: bytes(regularFont), bold: bytes(boldFont) }),
    );
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(pdf.getTitle()).toBe('ANOMALÍA · Expediente del cronista');
  });
});
