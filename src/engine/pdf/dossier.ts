/**
 * Expediente del cronista en PDF (§9), generado en el móvil del alumno con pdf-lib.
 * No sabe nada del contenido del juego: recibe los textos ya resueltos y las fuentes.
 * El nombre real solo existe aquí, en memoria, mientras se genera el documento.
 */
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { wrapText } from './text.ts';

export type DossierLabels = {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly materia: string;
  readonly nombre: string;
  readonly grupo: string;
  readonly alias: string;
  readonly codigo: string;
  readonly fecha: string;
  readonly final: string;
  readonly verificacion: string;
  readonly ruta: string;
  readonly mundo: string;
  readonly desnivel: string;
  readonly reflexion: string;
  readonly rubrica: string;
  readonly criterio: string;
  readonly observaciones: string;
};

export type DossierSection = { readonly label: string; readonly text: string };

export type DossierPdfInput = {
  /** Título del documento (metadatos del PDF). */
  readonly documentTitle: string;
  readonly labels: DossierLabels;
  readonly cover: {
    readonly name: string;
    readonly group: string;
    readonly alias: string;
    readonly code: string;
    readonly date: string;
    readonly ending: string;
  };
  /** Una entrada por dilema: decisión, justificación, objeción, réplica y Archivo real. */
  readonly entries: readonly {
    readonly heading: string;
    readonly sections: readonly DossierSection[];
  }[];
  readonly world: {
    readonly meters: readonly { readonly label: string; readonly value: number }[];
    readonly gap: string;
  };
  readonly ending: { readonly title: string; readonly text: string };
  readonly reflection: { readonly question: string; readonly text: string };
  readonly rubric: {
    readonly levels: readonly string[];
    /** Norma de los criterios oficiales, bajo el título de la rúbrica. */
    readonly reference: string | null;
    readonly criteria: readonly {
      readonly name: string;
      readonly description: string;
      /** «Criterios de evaluación: 2.1 y 3.1», o `null` si no está vinculado. */
      readonly curriculum: string | null;
    }[];
  };
  /** Sello de la portada (M6): rango y emblema del cronista (trazado SVG de 24×24). */
  readonly badge: {
    readonly rank: string;
    readonly emblemPath: string;
    readonly emblemColor: string;
  };
  /** Última página (M6): logros del juego, con la nota de que no forman parte de la nota. */
  readonly achievements: {
    readonly title: string;
    readonly note: string;
    readonly groups: readonly { readonly label: string; readonly items: readonly string[] }[];
  };
  /** Pie de cada página: «… Página n de total». */
  readonly footer: (page: number, total: number) => string;
};

export type DossierImage = { readonly jpeg: Uint8Array; readonly credit: string };
export type DossierFonts = { readonly regular: Uint8Array; readonly bold: Uint8Array };

// ── Medidas y colores (A4, en puntos; pensado también para imprimir en blanco y negro) ──

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const BOTTOM = MARGIN + 18; // deja sitio al pie
const WIDTH = A4[0] - 2 * MARGIN;

const INK = rgb(0.1, 0.11, 0.14);
const MUTED = rgb(0.36, 0.39, 0.45);
const ACCENT = rgb(0.03, 0.4, 0.36);
const RULE = rgb(0.8, 0.82, 0.86);
const TRACK = rgb(0.9, 0.91, 0.93);

/** «#7fe0d0» → color de pdf-lib. */
function hexColor(hex: string): RGB {
  const channel = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
  return rgb(channel(1), channel(3), channel(5));
}

type Style = {
  readonly font: PDFFont;
  readonly size: number;
  readonly color: RGB;
  readonly leading: number;
};

/** Escribe de arriba abajo y pasa de página cuando no cabe lo siguiente. */
class Writer {
  page: PDFPage;
  /** Parte superior de la siguiente línea. */
  y = A4[1] - MARGIN;

  private readonly doc: PDFDocument;
  /** Quita los caracteres que la fuente no tiene (emojis…): si no, saldrían como cuadros. */
  private readonly printable: (text: string) => string;

  constructor(doc: PDFDocument, printable: (text: string) => string) {
    this.doc = doc;
    this.printable = printable;
    this.page = doc.addPage(A4);
  }

  newPage(): void {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  /** Pasa de página si no caben `height` puntos más. */
  ensure(height: number): void {
    if (this.y - height < BOTTOM) this.newPage();
  }

  space(height: number): void {
    this.y -= height;
  }

  line(text: string, style: Style, x = MARGIN): void {
    this.ensure(style.leading);
    this.page.drawText(this.printable(text), {
      x,
      y: this.y - style.size,
      size: style.size,
      font: style.font,
      color: style.color,
    });
    this.y -= style.leading;
  }

  /** Texto con párrafos, cortado al ancho disponible. */
  text(text: string, style: Style, indent = 0, width = WIDTH): void {
    const measure = (value: string) => style.font.widthOfTextAtSize(value, style.size);
    const paragraphs = wrapText(this.printable(text), width - indent, measure);
    paragraphs.forEach((lines, i) => {
      for (const line of lines) this.line(line, style, MARGIN + indent);
      if (i < paragraphs.length - 1) this.space(style.leading * 0.4);
    });
  }

  centered(text: string, style: Style, y: number): void {
    const width = style.font.widthOfTextAtSize(text, style.size);
    this.page.drawText(text, {
      x: (A4[0] - width) / 2,
      y,
      size: style.size,
      font: style.font,
      color: style.color,
    });
  }

  rule(color: RGB = RULE): void {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + WIDTH, y: this.y },
      thickness: 0.8,
      color,
    });
  }
}

export async function buildDossierPdf(
  input: DossierPdfInput,
  fonts: DossierFonts,
  image: DossierImage | null = null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Fuente completa (unos 55 kB): el subconjunto de fontkit da problemas con algunas fuentes.
  const regular = await doc.embedFont(fonts.regular, { subset: false });
  const bold = await doc.embedFont(fonts.bold, { subset: false });
  doc.setTitle(input.documentTitle, { showInWindowTitleBar: true });
  doc.setLanguage('es-ES');
  doc.setCreator(input.labels.titulo);
  doc.setProducer(input.labels.titulo);

  const s = {
    title: { font: bold, size: 32, color: ACCENT, leading: 38 },
    subtitle: { font: regular, size: 16, color: INK, leading: 22 },
    h1: { font: bold, size: 18, color: ACCENT, leading: 26 },
    h2: { font: bold, size: 13, color: INK, leading: 19 },
    label: { font: bold, size: 9.5, color: MUTED, leading: 14 },
    body: { font: regular, size: 11, color: INK, leading: 15.5 },
    muted: { font: regular, size: 10, color: MUTED, leading: 14 },
    value: { font: bold, size: 14, color: INK, leading: 20 },
    code: { font: bold, size: 24, color: ACCENT, leading: 30 },
    small: { font: regular, size: 8.5, color: MUTED, leading: 11 },
  } satisfies Record<string, Style>;

  const supported = new Set(regular.getCharacterSet());
  // Por puntos de código: un emoji compuesto se queda sin sus piezas, que la fuente tampoco tiene.
  const printable = (text: string) =>
    Array.from(text)
      .filter((char) => /\s/.test(char) || supported.has(char.codePointAt(0) ?? 0))
      .join('');
  const w = new Writer(doc, printable);
  const { labels, cover } = input;

  // ── Portada: sello con el emblema y el rango (arriba a la derecha) ──
  const seal = { x: A4[0] - MARGIN - 50, y: A4[1] - MARGIN - 62, r: 44 };
  w.page.drawCircle({ ...seal, size: seal.r, borderColor: ACCENT, borderWidth: 1.5 });
  w.page.drawCircle({ ...seal, size: 27, color: hexColor(input.badge.emblemColor) });
  // drawSvgPath usa el origen arriba a la izquierda, como SVG: caja de 24 escalada a 30 puntos.
  w.page.drawSvgPath(input.badge.emblemPath, {
    x: seal.x - 15,
    y: seal.y + 15,
    scale: 1.25,
    color: INK,
  });
  const rank = printable(input.badge.rank);
  const rankWidth = bold.widthOfTextAtSize(rank, s.label.size);
  w.page.drawText(rank, {
    x: seal.x - rankWidth / 2,
    y: seal.y - seal.r - 14,
    size: s.label.size,
    font: bold,
    color: ACCENT,
  });

  w.space(40);
  w.line(labels.titulo, s.title);
  w.line(labels.subtitulo, s.subtitle);
  w.line(labels.materia, s.muted);
  w.space(14);
  w.rule();
  w.space(26);
  const fields: [string, string][] = [
    [labels.nombre, cover.name],
    [labels.grupo, cover.group],
    [labels.alias, cover.alias],
    [labels.fecha, cover.date],
    [labels.final, cover.ending],
  ];
  for (const [label, value] of fields) {
    w.line(label.toUpperCase(), s.label);
    w.text(value, s.value);
    w.space(12);
  }
  w.space(10);
  const boxTop = w.y;
  w.space(16);
  w.line(labels.codigo.toUpperCase(), s.label, MARGIN + 16);
  w.line(cover.code, s.code, MARGIN + 16);
  w.text(labels.verificacion, s.muted, 16, WIDTH - 16);
  w.space(14);
  w.page.drawRectangle({
    x: MARGIN,
    y: w.y,
    width: WIDTH,
    height: boxTop - w.y,
    borderColor: ACCENT,
    borderWidth: 1.2,
  });

  // ── Ruta temporal ──
  w.newPage();
  w.line(labels.ruta, s.h1);
  w.space(6);
  for (const entry of input.entries) {
    w.ensure(s.h2.leading + s.label.leading + 3 * s.body.leading);
    w.space(6);
    w.text(entry.heading, s.h2);
    w.space(4);
    for (const section of entry.sections) {
      w.ensure(s.label.leading + 2 * s.body.leading);
      w.line(section.label.toUpperCase(), s.label);
      w.text(section.text, s.body);
      w.space(8);
    }
    w.space(4);
    w.rule();
    w.space(8);
  }

  // ── Estado final del mundo y final alcanzado ──
  w.newPage();
  w.line(labels.mundo, s.h1);
  w.space(8);
  const barX = MARGIN + 150;
  const barWidth = WIDTH - 150 - 40;
  for (const meter of input.world.meters) {
    w.ensure(22);
    const baseline = w.y - s.body.size;
    w.page.drawText(meter.label, {
      x: MARGIN,
      y: baseline,
      size: s.body.size,
      font: regular,
      color: INK,
    });
    w.page.drawRectangle({ x: barX, y: baseline - 1, width: barWidth, height: 8, color: TRACK });
    w.page.drawRectangle({
      x: barX,
      y: baseline - 1,
      width: (barWidth * Math.min(100, Math.max(0, meter.value))) / 100,
      height: 8,
      color: ACCENT,
    });
    const value = String(meter.value);
    w.page.drawText(value, {
      x: MARGIN + WIDTH - bold.widthOfTextAtSize(value, s.body.size),
      y: baseline,
      size: s.body.size,
      font: bold,
      color: INK,
    });
    w.space(22);
  }
  w.space(4);
  w.text(`${labels.desnivel}: ${input.world.gap}`, s.h2);
  w.space(18);
  w.line(labels.final.toUpperCase(), s.label);
  w.text(input.ending.title, s.h1);
  w.text(input.ending.text, s.body);

  if (image !== null) {
    const embedded = await doc.embedJpg(image.jpeg);
    const width = 170;
    const height = (embedded.height / embedded.width) * width;
    w.space(14);
    w.ensure(height + s.small.leading * 2);
    w.page.drawImage(embedded, { x: (A4[0] - width) / 2, y: w.y - height, width, height });
    w.space(height + 4);
    const measure = (value: string) => regular.widthOfTextAtSize(value, s.small.size);
    for (const lines of wrapText(image.credit, WIDTH, measure)) {
      for (const line of lines) {
        w.centered(line, s.small, w.y - s.small.size);
        w.space(s.small.leading);
      }
    }
  }

  // ── Reflexión final: en su propia página (100–180 palabras caben enteras) ──
  w.newPage();
  w.line(labels.reflexion, s.h1);
  w.text(input.reflection.question, s.muted);
  w.space(8);
  w.text(input.reflection.text, s.body);

  // ── Rúbrica en blanco para el docente ──
  w.newPage();
  w.line(labels.rubrica, s.h1);
  if (input.rubric.reference !== null) w.text(input.rubric.reference, s.muted);
  w.space(10);
  const { levels, criteria } = input.rubric;
  const nameWidth = WIDTH - levels.length * 62;
  const levelWidth = (WIDTH - nameWidth) / levels.length;
  const headerHeight = 30;
  const cell = { borderColor: RULE, borderWidth: 0.8 };
  let top = w.y;
  w.page.drawRectangle({
    x: MARGIN,
    y: top - headerHeight,
    width: nameWidth,
    height: headerHeight,
    ...cell,
  });
  w.page.drawText(labels.criterio, {
    x: MARGIN + 6,
    y: top - 19,
    size: 9.5,
    font: bold,
    color: MUTED,
  });
  levels.forEach((level, i) => {
    const x = MARGIN + nameWidth + i * levelWidth;
    w.page.drawRectangle({
      x,
      y: top - headerHeight,
      width: levelWidth,
      height: headerHeight,
      ...cell,
    });
    const size = 8.5;
    const textWidth = bold.widthOfTextAtSize(level, size);
    w.page.drawText(level, {
      x: x + Math.max(3, (levelWidth - textWidth) / 2),
      y: top - 19,
      size,
      font: bold,
      color: MUTED,
    });
  });
  top -= headerHeight;
  for (const criterion of criteria) {
    const measure = (value: string) => regular.widthOfTextAtSize(value, 9.5);
    const lines = wrapText(criterion.description, nameWidth - 12, measure).flat();
    const extra = criterion.curriculum === null ? 0 : 1;
    const height = Math.max(48, 22 + (lines.length + extra) * 12.5);
    if (top - height < BOTTOM) {
      w.newPage();
      top = w.y;
    }
    w.page.drawRectangle({ x: MARGIN, y: top - height, width: nameWidth, height, ...cell });
    w.page.drawText(criterion.name, {
      x: MARGIN + 6,
      y: top - 15,
      size: 10.5,
      font: bold,
      color: INK,
    });
    lines.forEach((line, i) => {
      w.page.drawText(line, {
        x: MARGIN + 6,
        y: top - 29 - i * 12.5,
        size: 9.5,
        font: regular,
        color: MUTED,
      });
    });
    if (criterion.curriculum !== null) {
      w.page.drawText(criterion.curriculum, {
        x: MARGIN + 6,
        y: top - 29 - lines.length * 12.5,
        size: 9,
        font: bold,
        color: ACCENT,
      });
    }
    levels.forEach((_, i) => {
      const x = MARGIN + nameWidth + i * levelWidth;
      w.page.drawRectangle({ x, y: top - height, width: levelWidth, height, ...cell });
      w.page.drawRectangle({
        x: x + levelWidth / 2 - 6,
        y: top - height / 2 - 6,
        width: 12,
        height: 12,
        borderColor: MUTED,
        borderWidth: 0.8,
      });
    });
    top -= height;
  }
  w.y = top - 20;
  w.ensure(140);
  w.line(labels.observaciones.toUpperCase(), s.label);
  w.page.drawRectangle({ x: MARGIN, y: w.y - 120, width: WIDTH, height: 120, ...cell });

  // ── Logros del cronista (M6): juego, no evaluación ──
  w.newPage();
  w.line(input.achievements.title, s.h1);
  w.text(input.achievements.note, s.muted);
  w.space(12);
  for (const group of input.achievements.groups) {
    w.ensure(s.label.leading + 2 * s.body.leading);
    w.line(group.label.toUpperCase(), s.label);
    w.text(group.items.join(' · '), s.body);
    w.space(12);
  }

  // ── Pie con el código en todas las páginas ──
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const footer = input.footer(i + 1, pages.length);
    const width = regular.widthOfTextAtSize(footer, s.small.size);
    page.drawText(footer, {
      x: (A4[0] - width) / 2,
      y: 30,
      size: s.small.size,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}
