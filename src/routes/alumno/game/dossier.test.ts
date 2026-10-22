import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
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
  reflection: 'La ciencia explica.\n\nPero no decide por nosotros: eso nos toca a nosotros. 🙂',
  answers: [
    {
      dilemmaId: 'd1',
      choice: 'A',
      justification: 'Prefiero que siga vivo para que pueda seguir investigando.',
      objector: 'kaltz',
      objection: '¿Y si callar a tiempo enseña a callar siempre?',
      reply: null,
    },
    // Respuesta de un dilema que ya no existe en el contenido: no rompe el expediente.
    {
      dilemmaId: 'd9',
      choice: 'B',
      justification: null,
      objector: null,
      objection: null,
      reply: null,
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

  it('una entrada por dilema contestado, con sus cinco apartados', () => {
    expect(input.entries).toHaveLength(1);
    const [entry] = input.entries;
    expect(entry?.heading).toBe('Roma, 1633 · Galileo ante la Inquisición');
    expect(entry?.sections.map((s) => s.label)).toEqual([
      'Decisión',
      'Justificación',
      'Objeción de Inés Kaltz',
      'Réplica',
      'Archivo real',
    ]);
    expect(entry?.sections[3]?.text).toBe('(sin respuesta)');
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

  it('desnivel con signo, pie con el código y nombre de archivo', () => {
    expect(input.world.gap).toBe('+30');
    expect(input.footer(2, 5)).toBe('ANOMALÍA · ANM-7F3K-92QD · Página 2 de 5');
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
