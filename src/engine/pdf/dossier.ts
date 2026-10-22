/**
 * Expediente del cronista en PDF (§9), generado en el móvil del alumno con pdf-lib.
 * Maquetación: papel crema; portada con el cielo del 2077, las órbitas del viaje y el sello
 * del emblema; ruta temporal con el color de cada época; cabecera y pie en todas las páginas.
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
  readonly decision: string;
  readonly mundo: string;
  readonly desnivel: string;
  readonly desnivelAyuda: string;
  readonly reflexion: string;
  readonly rubrica: string;
  readonly criterio: string;
  readonly observaciones: string;
  /** Cabecera de las páginas interiores («Expediente de Hipatia»). */
  readonly cabecera: string;
  /** Parte izquierda del pie («ANOMALÍA · Filosofía 4.º ESO»). */
  readonly pie: string;
};

/** Apartado de una anomalía: texto normal, objeción de un consejero o Archivo real. */
export type DossierBlock = {
  readonly label: string;
  readonly text: string;
  readonly tone: 'plain' | 'quote' | 'archive';
  /** Color de la barra lateral (el del consejero, en las objeciones). */
  readonly accent?: string;
};

export type DossierEntry = {
  readonly year: string;
  readonly place: string;
  readonly title: string;
  /** Color de la época (hexadecimal). */
  readonly color: string;
  readonly decision: {
    readonly letter: string;
    readonly text: string;
    /** Si la mantuvo o la cambió tras el giro. */
    readonly note: string | null;
  };
  readonly blocks: readonly DossierBlock[];
};

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
  /** Sello de la portada (M6): rango, puntos y emblema (trazado SVG de 24×24). */
  readonly badge: {
    readonly rank: string;
    readonly points: string;
    readonly emblemPath: string;
    readonly emblemColor: string;
  };
  /** Una entrada por anomalía contestada, en el orden del juego. */
  readonly entries: readonly DossierEntry[];
  readonly world: {
    readonly meters: readonly { readonly label: string; readonly value: number }[];
    readonly gap: number;
    readonly gapText: string;
  };
  readonly ending: { readonly title: string; readonly summary: string; readonly text: string };
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
  /** Última página (M6): logros del juego, con la nota de que no forman parte de la nota. */
  readonly achievements: {
    readonly title: string;
    readonly note: string;
    readonly summary: string;
    readonly itemsLabel: string;
    /** Todos los logros; `count` 0 = aún no conseguido. */
    readonly items: readonly { readonly label: string; readonly count: number }[];
    readonly starsLabel: string;
    /** Los conceptos en su orden fijo: así la constelación sale igual que en el móvil. */
    readonly stars: readonly { readonly label: string; readonly lit: boolean }[];
    readonly fichasLabel: string;
    readonly fichas: readonly string[];
    readonly none: string;
  };
  /** Parte derecha del pie de cada página («ANM-7F3K-92QD · 2 / 7»). */
  readonly footer: (page: number, total: number) => string;
};

export type DossierImage = { readonly jpeg: Uint8Array; readonly credit: string };
export type DossierFonts = { readonly regular: Uint8Array; readonly bold: Uint8Array };

// ── Medidas (A4, en puntos) y paleta: cielo del 2077 sobre papel crema ──

const W = 595.28;
const H = 841.89;
const M = 54;
const CONTENT = W - 2 * M;
const HEADER = 30;
const TOP = H - HEADER - 36;
const BOTTOM = 64;

const channel = (value: string, i: number) => Number.parseInt(value.slice(i, i + 2), 16) / 255;

function hex(value: string): RGB {
  return rgb(channel(value, 1), channel(value, 3), channel(value, 5));
}

function mix(a: string, b: string, t: number): RGB {
  const at = (i: number) => channel(a, i) + (channel(b, i) - channel(a, i)) * t;
  return rgb(at(1), at(3), at(5));
}

const PAPER = hex('#fbf8f1');
const INK = hex('#1d2333');
const MUTED = hex('#5d6680');
const NIGHT = hex('#0b1426');
const TEAL = hex('#0e6b63');
const TEAL_LIGHT = hex('#7fe0d0');
const GOLD = hex('#a77d1c');
const GOLD_LIGHT = hex('#e3b341');
const RULE = hex('#dccfb0');
const TINT = hex('#f2ebda');
const ARCHIVE = hex('#ece2c8');
const CREAM = hex('#f3ebd8');
const MIST = hex('#9fb0c8');
const DANGER = hex('#b5482e');

type Style = {
  readonly font: PDFFont;
  readonly size: number;
  readonly color: RGB;
  readonly leading: number;
};

/** Pseudoaleatorio con semilla: las estrellas salen igual en cada copia del mismo expediente. */
function seeded(text: string): () => number {
  let state = 1779033703;
  for (let i = 0; i < text.length; i++) state = Math.imul(state ^ text.charCodeAt(i), 2654435761);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rectángulo redondeado como trazado SVG (origen arriba a la izquierda, como en SVG). */
function roundedRect(w: number, h: number, r: number): string {
  const n = (value: number) => value.toFixed(2);
  return (
    `M ${n(r)} 0 H ${n(w - r)} Q ${n(w)} 0 ${n(w)} ${n(r)} V ${n(h - r)} ` +
    `Q ${n(w)} ${n(h)} ${n(w - r)} ${n(h)} H ${n(r)} Q 0 ${n(h)} 0 ${n(h - r)} V ${n(r)} ` +
    `Q 0 0 ${n(r)} 0 Z`
  );
}

const DIAMOND = 'M 5 0 L 10 5 L 5 10 L 0 5 Z';

/** Escribe de arriba abajo, pasa de página cuando no cabe y pinta el fondo y la cabecera. */
class Layout {
  page: PDFPage;
  y = TOP;
  readonly printable: (text: string) => string;
  private readonly doc: PDFDocument;
  private chrome: ((page: PDFPage) => void) | null = null;

  constructor(doc: PDFDocument, printable: (text: string) => string) {
    this.doc = doc;
    this.printable = printable;
    this.page = this.addPage();
  }

  /** La cabecera de las páginas interiores (la portada no la lleva). */
  setChrome(chrome: (page: PDFPage) => void): void {
    this.chrome = chrome;
  }

  addPage(): PDFPage {
    this.page = this.doc.addPage([W, H]);
    this.page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    this.chrome?.(this.page);
    this.y = TOP;
    return this.page;
  }

  ensure(height: number): void {
    if (this.y - height < BOTTOM) this.addPage();
  }

  space(height: number): void {
    this.y -= height;
  }

  lines(text: string, style: Style, width: number): string[][] {
    const measure = (value: string) => style.font.widthOfTextAtSize(value, style.size);
    return wrapText(this.printable(text), width, measure);
  }

  height(text: string, style: Style, width: number, gap = 0.45): number {
    const paragraphs = this.lines(text, style, width);
    const count = paragraphs.reduce((n, lines) => n + lines.length, 0);
    return count * style.leading + Math.max(0, paragraphs.length - 1) * style.leading * gap;
  }

  /** Texto con párrafos cortado al ancho; cambia de página línea a línea si hace falta. */
  write(text: string, style: Style, x = M, width = CONTENT, gap = 0.45): void {
    const paragraphs = this.lines(text, style, width);
    paragraphs.forEach((lines, i) => {
      for (const line of lines) {
        this.ensure(style.leading);
        this.page.drawText(line, {
          x,
          y: this.y - style.size,
          size: style.size,
          font: style.font,
          color: style.color,
        });
        this.y -= style.leading;
      }
      if (i < paragraphs.length - 1) this.y -= style.leading * gap;
    });
  }

  /** Versalitas espaciadas (títulos de sección y etiquetas), como en un expediente. */
  spaced(text: string, x: number, y: number, style: Style, tracking: number, page = this.page) {
    let cursor = x;
    for (const char of this.printable(text)) {
      page.drawText(char, { x: cursor, y, size: style.size, font: style.font, color: style.color });
      cursor += style.font.widthOfTextAtSize(char, style.size) + tracking;
    }
    return cursor - x - tracking;
  }

  spacedWidth(text: string, style: Style, tracking: number): number {
    const clean = this.printable(text);
    return style.font.widthOfTextAtSize(clean, style.size) + tracking * (clean.length - 1);
  }

  /** Texto de una línea centrado en `x`. */
  centered(text: string, x: number, y: number, style: Style): void {
    const clean = this.printable(text);
    this.page.drawText(clean, {
      x: x - style.font.widthOfTextAtSize(clean, style.size) / 2,
      y,
      size: style.size,
      font: style.font,
      color: style.color,
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
    label: { font: bold, size: 8.5, color: MUTED, leading: 13 },
    section: { font: bold, size: 9.5, color: GOLD, leading: 14 },
    h2: { font: bold, size: 15, color: INK, leading: 20 },
    body: { font: regular, size: 11, color: INK, leading: 16 },
    strong: { font: bold, size: 11.5, color: INK, leading: 16 },
    muted: { font: regular, size: 10, color: MUTED, leading: 14.5 },
    small: { font: regular, size: 8, color: MUTED, leading: 11 },
    value: { font: bold, size: 13, color: INK, leading: 18 },
  } satisfies Record<string, Style>;

  const supported = new Set(regular.getCharacterSet());
  // Por puntos de código: un emoji compuesto se queda sin sus piezas, que la fuente tampoco tiene.
  const printable = (text: string) =>
    Array.from(text)
      .filter((char) => /\s/.test(char) || supported.has(char.codePointAt(0) ?? 0))
      .join('');

  const random = seeded(input.cover.code + input.cover.alias);
  const { labels, cover, badge } = input;
  const L = new Layout(doc, printable);

  // Cabecera de las páginas interiores: una franja del cielo del 2077.
  L.setChrome((page) => {
    page.drawRectangle({ x: 0, y: H - HEADER, width: W, height: HEADER, color: NIGHT });
    for (let i = 0; i < 26; i++) {
      // Las estrellas no caen sobre los textos de la cabecera.
      const x = M + 110 + random() * (W - 2 * M - 250);
      page.drawCircle({
        x,
        y: H - HEADER + 3 + random() * (HEADER - 6),
        size: 0.3 + random() * 0.7,
        color: CREAM,
        opacity: 0.3 + random() * 0.6,
      });
    }
    page.drawLine({
      start: { x: 0, y: H - HEADER },
      end: { x: W, y: H - HEADER },
      thickness: 1,
      color: GOLD_LIGHT,
    });
    L.spaced(labels.titulo, M, H - 19.5, { ...s.label, color: TEAL_LIGHT }, 2.2, page);
    const head = printable(labels.cabecera);
    page.drawText(head, {
      x: W - M - regular.widthOfTextAtSize(head, 8.5),
      y: H - 19.5,
      size: 8.5,
      font: regular,
      color: MIST,
    });
  });

  /** Título de sección: versalitas doradas y un filete hasta el margen. */
  const section = (title: string) => {
    L.ensure(48);
    const width = L.spaced(title.toUpperCase(), M, L.y - 10, s.section, 1.6);
    L.page.drawLine({
      start: { x: M + width + 10, y: L.y - 7 },
      end: { x: W - M, y: L.y - 7 },
      thickness: 0.6,
      color: RULE,
    });
    L.space(28);
  };

  const label = (text: string, color = MUTED, x = M) => {
    L.ensure(s.label.leading + s.body.leading);
    L.spaced(text.toUpperCase(), x, L.y - s.label.size, { ...s.label, color }, 1);
    L.space(s.label.leading + 2);
  };

  // ── Portada: el cielo del 2077 con las órbitas del viaje ──
  const bandHeight = 300;
  const bandY = H - bandHeight;
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    L.page.drawRectangle({
      x: 0,
      y: bandY + (bandHeight * i) / steps,
      width: W,
      // Cada franja pisa la siguiente: sin solape se ven líneas finas entre ellas.
      height: bandHeight / steps + 1.5,
      color: mix('#17294a', '#060b16', i / (steps - 1)),
    });
  }
  for (let i = 0; i < 150; i++) {
    const x = random() * W;
    const y = bandY + 4 + random() * (bandHeight - 8);
    // El título queda limpio de estrellas.
    if (x < M + 280 && y > H - 190 && y < H - 70) continue;
    L.page.drawCircle({
      x,
      y,
      size: 0.25 + random() * 1.05,
      color: random() < 0.1 ? GOLD_LIGHT : CREAM,
      opacity: 0.25 + random() * 0.7,
    });
  }
  const seal = { x: W - M - 78, y: bandY + 168 };
  const orbits: [number, number, number][] = [
    [156, 54, 0.9],
    [116, 40, 2.6],
    [80, 28, 4.4],
  ];
  for (const [rx, ry, angle] of orbits) {
    L.page.drawEllipse({
      x: seal.x,
      y: seal.y,
      xScale: rx,
      yScale: ry,
      borderColor: TEAL_LIGHT,
      borderWidth: 0.7,
      borderOpacity: 0.45,
    });
    L.page.drawCircle({
      x: seal.x + rx * Math.cos(angle),
      y: seal.y + ry * Math.sin(angle),
      size: 2.6,
      color: angle > 2 ? GOLD_LIGHT : TEAL_LIGHT,
    });
  }
  // Sello del cronista: emblema dentro de un anillo dorado, con el rango y los puntos debajo.
  L.page.drawCircle({ ...seal, size: 46, color: NIGHT, borderColor: GOLD_LIGHT, borderWidth: 1.6 });
  L.page.drawCircle({
    ...seal,
    size: 40.5,
    borderColor: GOLD_LIGHT,
    borderWidth: 0.5,
    borderOpacity: 0.6,
  });
  L.page.drawCircle({ ...seal, size: 29, color: hex(badge.emblemColor) });
  // drawSvgPath usa el origen arriba a la izquierda, como SVG: caja de 24 escalada a 32 puntos.
  L.page.drawSvgPath(badge.emblemPath, {
    x: seal.x - 16,
    y: seal.y + 16,
    scale: 32 / 24,
    color: NIGHT,
  });
  const rankStyle = { ...s.label, size: 9, color: GOLD_LIGHT };
  const rank = badge.rank.toUpperCase();
  L.spaced(rank, seal.x - L.spacedWidth(rank, rankStyle, 1.2) / 2, seal.y - 66, rankStyle, 1.2);
  L.centered(badge.points, seal.x, seal.y - 80, { ...s.small, size: 8.5, color: MIST });

  L.spaced(labels.titulo, M, H - 112, { font: bold, size: 40, color: CREAM, leading: 46 }, 3);
  L.page.drawText(printable(labels.subtitulo), {
    x: M,
    y: H - 142,
    size: 17,
    font: regular,
    color: TEAL_LIGHT,
  });
  L.page.drawText(printable(labels.materia), {
    x: M,
    y: H - 162,
    size: 10,
    font: regular,
    color: MIST,
  });
  L.page.drawLine({
    start: { x: M, y: H - 180 },
    end: { x: M + 64, y: H - 180 },
    thickness: 1.4,
    color: GOLD_LIGHT,
  });
  L.page.drawLine({
    start: { x: 0, y: bandY },
    end: { x: W, y: bandY },
    thickness: 1.6,
    color: GOLD_LIGHT,
  });

  // Datos del cronista.
  L.y = bandY - 30;
  label(labels.nombre);
  L.write(cover.name, { ...s.value, size: 20, leading: 26 });
  L.page.drawLine({
    start: { x: M, y: L.y - 4 },
    end: { x: W - M, y: L.y - 4 },
    thickness: 0.6,
    color: RULE,
  });
  L.space(18);
  const half = (CONTENT - 24) / 2;
  const grid: [string, string][][] = [
    [
      [labels.grupo, cover.group],
      [labels.alias, cover.alias],
    ],
    [
      [labels.fecha, cover.date],
      [labels.final, cover.ending],
    ],
  ];
  for (const row of grid) {
    const top = L.y;
    let bottom = top;
    row.forEach(([name, value], column) => {
      const x = M + column * (half + 24);
      L.y = top;
      label(name, MUTED, x);
      L.write(value, s.value, x, half);
      bottom = Math.min(bottom, L.y);
    });
    L.y = bottom - 12;
  }

  // Ruta temporal en la portada: un nodo por anomalía, del color de su época.
  if (input.entries.length > 0) {
    L.space(6);
    section(labels.ruta);
    const nodeY = L.y - 18;
    const count = input.entries.length;
    const xs = input.entries.map((_, i) =>
      count === 1 ? W / 2 : M + 26 + (i * (CONTENT - 52)) / (count - 1),
    );
    if (count > 1) {
      L.page.drawLine({
        start: { x: xs[0] ?? M, y: nodeY },
        end: { x: xs.at(-1) ?? W - M, y: nodeY },
        thickness: 1.2,
        color: GOLD,
        dashArray: [3, 3],
      });
    }
    input.entries.forEach((entry, i) => {
      const x = xs[i] ?? M;
      L.page.drawCircle({
        x,
        y: nodeY,
        size: 15,
        color: hex(entry.color),
        borderColor: INK,
        borderWidth: 0.8,
      });
      L.centered(entry.decision.letter, x, nodeY - 4.3, { ...s.value, size: 12, color: NIGHT });
      L.centered(entry.year, x, nodeY - 31, { ...s.value, size: 10 });
      L.centered(entry.place, x, nodeY - 43, { ...s.small, size: 8 });
    });
  }

  // Código de verificación, abajo.
  const boxHeight = 96;
  const boxY = BOTTOM + 4;
  L.page.drawSvgPath(roundedRect(CONTENT, boxHeight, 10), {
    x: M,
    y: boxY + boxHeight,
    color: TINT,
    borderColor: TEAL,
    borderWidth: 1.1,
  });
  L.spaced(
    labels.codigo.toUpperCase(),
    M + 18,
    boxY + boxHeight - 22,
    { ...s.label, color: TEAL },
    1,
  );
  L.page.drawText(printable(cover.code), {
    x: M + 18,
    y: boxY + boxHeight - 52,
    size: 26,
    font: bold,
    color: TEAL,
  });
  L.y = boxY + 30;
  L.write(labels.verificacion, s.muted, M + 18, CONTENT - 36);

  // ── Ruta temporal: cada anomalía con su decisión, sus textos y el Archivo real ──
  if (input.entries.length > 0) {
    L.addPage();
    section(labels.ruta);
  }
  input.entries.forEach((entry, index) => {
    const titleWidth = CONTENT - 60;
    L.ensure(56 + L.height(entry.title, s.h2, titleWidth) + 70);
    const top = L.y;
    L.page.drawCircle({
      x: M + 22,
      y: top - 22,
      size: 22,
      color: hex(entry.color),
      borderColor: INK,
      borderWidth: 0.8,
    });
    L.centered(entry.year, M + 22, top - 25.5, { ...s.value, size: 10, color: NIGHT });
    L.spaced(entry.place.toUpperCase(), M + 58, top - 12, s.label, 1.2);
    L.y = top - 18;
    L.write(entry.title, s.h2, M + 58, titleWidth);
    L.y = Math.min(L.y, top - 50) - 10;

    // Decisión: la letra en su insignia y, debajo, si la mantuvo o la cambió tras el giro.
    label(labels.decision);
    const textWidth = CONTENT - 30;
    L.ensure(L.height(entry.decision.text, s.strong, textWidth) + 4);
    L.page.drawCircle({
      x: M + 9,
      y: L.y - 8,
      size: 9,
      color: hex(entry.color),
      borderColor: INK,
      borderWidth: 0.7,
    });
    L.centered(entry.decision.letter, M + 9, L.y - 11.5, { ...s.value, size: 10, color: NIGHT });
    L.write(entry.decision.text, s.strong, M + 28, textWidth);
    if (entry.decision.note !== null) L.write(entry.decision.note, s.muted, M + 28, textWidth);
    L.space(10);

    for (const block of entry.blocks) {
      if (block.tone === 'plain') {
        label(block.label);
        L.write(block.text, s.body);
        L.space(10);
        continue;
      }
      // Recuadro con barra lateral: objeción (color del consejero) o Archivo real (dorado).
      const pad = 12;
      const inner = CONTENT - 2 * pad - 6;
      const boxH = pad + s.label.leading + 2 + L.height(block.text, s.body, inner) + pad - 4;
      L.ensure(boxH + 4);
      const boxTop = L.y;
      const archive = block.tone === 'archive';
      L.page.drawRectangle({
        x: M,
        y: boxTop - boxH,
        width: CONTENT,
        height: boxH,
        color: archive ? ARCHIVE : TINT,
      });
      L.page.drawRectangle({
        x: M,
        y: boxTop - boxH,
        width: 3.5,
        height: boxH,
        color: archive ? GOLD : hex(block.accent ?? '#5d6680'),
      });
      L.y = boxTop - pad;
      label(block.label, archive ? GOLD : MUTED, M + pad + 6);
      L.write(block.text, s.body, M + pad + 6, inner);
      L.y = boxTop - boxH - 12;
    }

    // Separador entre anomalías: tres rombos.
    if (index < input.entries.length - 1) {
      L.ensure(30);
      for (const dx of [-14, 0, 14]) {
        L.page.drawSvgPath(DIAMOND, {
          x: W / 2 + dx - 3,
          y: L.y - 6,
          scale: 0.6,
          color: dx === 0 ? GOLD : RULE,
        });
      }
      L.space(30);
    }
  });

  // ── Estado final del mundo y final alcanzado ──
  L.addPage();
  section(labels.mundo);
  const barX = M + 150;
  const barWidth = CONTENT - 150 - 40;
  for (const meter of input.world.meters) {
    L.ensure(28);
    const baseline = L.y - 11;
    L.page.drawText(printable(meter.label), {
      x: M,
      y: baseline,
      size: 11,
      font: regular,
      color: INK,
    });
    L.page.drawSvgPath(roundedRect(barWidth, 9, 4.5), {
      x: barX,
      y: baseline + 8,
      color: hex('#e7dec9'),
    });
    const filled = (barWidth * Math.min(100, Math.max(0, meter.value))) / 100;
    if (filled >= 9) {
      L.page.drawSvgPath(roundedRect(filled, 9, 4.5), { x: barX, y: baseline + 8, color: TEAL });
    }
    const value = String(meter.value);
    L.page.drawText(value, {
      x: W - M - bold.widthOfTextAtSize(value, 11),
      y: baseline,
      size: 11,
      font: bold,
      color: INK,
    });
    L.space(28);
  }

  // Desnivel prometeico: indicador circular, más intenso cuanto más inestable.
  L.space(6);
  L.ensure(84);
  const gauge = { x: M + 34, y: L.y - 34 };
  const level = input.world.gap >= 25 ? DANGER : input.world.gap >= 10 ? GOLD : TEAL;
  L.page.drawCircle({ ...gauge, size: 32, color: level, opacity: 0.12 });
  L.page.drawCircle({ ...gauge, size: 32, borderColor: level, borderWidth: 2 });
  L.centered(input.world.gapText, gauge.x, gauge.y - 7, { ...s.value, size: 20, color: level });
  const gapTop = L.y;
  L.y = gapTop - 14;
  L.write(labels.desnivel, s.strong, M + 84, CONTENT - 84);
  L.write(labels.desnivelAyuda, s.muted, M + 84, CONTENT - 84);
  L.y = Math.min(L.y, gapTop - 76) - 14;

  // Tarjeta del final, en el cielo del 2077.
  const cardPad = 18;
  const cardInner = CONTENT - 2 * cardPad;
  const titleStyle = { font: bold, size: 19, color: CREAM, leading: 25 };
  const summaryStyle = { font: regular, size: 11.5, color: TEAL_LIGHT, leading: 16 };
  const endingStyle = { font: regular, size: 10.5, color: hex('#dce3ee'), leading: 15.5 };
  const cardHeight =
    cardPad +
    s.label.leading +
    2 +
    L.height(input.ending.title, titleStyle, cardInner) +
    L.height(input.ending.summary, summaryStyle, cardInner) +
    8 +
    L.height(input.ending.text, endingStyle, cardInner) +
    cardPad;
  L.ensure(cardHeight);
  const cardTop = L.y;
  L.page.drawSvgPath(roundedRect(CONTENT, cardHeight, 12), { x: M, y: cardTop, color: NIGHT });
  L.y = cardTop - cardPad;
  label(labels.final, GOLD_LIGHT, M + cardPad);
  L.write(input.ending.title, titleStyle, M + cardPad, cardInner);
  L.write(input.ending.summary, summaryStyle, M + cardPad, cardInner);
  L.space(8);
  L.write(input.ending.text, endingStyle, M + cardPad, cardInner);
  L.y = cardTop - cardHeight - 16;

  if (image !== null) {
    const embedded = await doc.embedJpg(image.jpeg);
    const width = 200;
    const height = (embedded.height / embedded.width) * width;
    L.ensure(height + s.small.leading * 3);
    L.page.drawImage(embedded, { x: (W - width) / 2, y: L.y - height, width, height });
    L.space(height + 6);
    for (const lines of L.lines(image.credit, s.small, CONTENT)) {
      for (const line of lines) {
        L.centered(line, W / 2, L.y - s.small.size, s.small);
        L.space(s.small.leading);
      }
    }
  }

  // ── Reflexión final: en su propia página, entre comillas grandes ──
  L.addPage();
  section(labels.reflexion);
  L.write(input.reflection.question, { ...s.muted, size: 11, leading: 16 });
  L.space(16);
  const quote = printable('“');
  if (quote !== '') {
    L.page.drawText(quote, { x: M - 4, y: L.y - 46, size: 64, font: bold, color: GOLD_LIGHT });
  }
  L.space(8);
  L.write(input.reflection.text, { ...s.body, size: 12, leading: 18.5 }, M + 30, CONTENT - 30);

  // ── Rúbrica en blanco para el docente ──
  L.addPage();
  section(labels.rubrica);
  if (input.rubric.reference !== null) L.write(input.rubric.reference, s.muted);
  L.space(10);
  const { levels, criteria } = input.rubric;
  const nameWidth = CONTENT - levels.length * 62;
  const levelWidth = (CONTENT - nameWidth) / levels.length;
  const headerHeight = 30;
  let top = L.y;
  L.page.drawRectangle({
    x: M,
    y: top - headerHeight,
    width: CONTENT,
    height: headerHeight,
    color: NIGHT,
  });
  L.page.drawText(printable(labels.criterio), {
    x: M + 8,
    y: top - 19,
    size: 9.5,
    font: bold,
    color: CREAM,
  });
  levels.forEach((level, i) => {
    L.centered(level, M + nameWidth + (i + 0.5) * levelWidth, top - 19, {
      ...s.label,
      color: TEAL_LIGHT,
    });
  });
  top -= headerHeight;
  criteria.forEach((criterion, row) => {
    const measure = (value: string) => regular.widthOfTextAtSize(value, 9.5);
    const lines = wrapText(printable(criterion.description), nameWidth - 14, measure).flat();
    const extra = criterion.curriculum === null ? 0 : 1;
    const height = Math.max(50, 24 + (lines.length + extra) * 12.5);
    if (top - height < BOTTOM) {
      L.addPage();
      top = L.y;
    }
    L.page.drawRectangle({
      x: M,
      y: top - height,
      width: CONTENT,
      height,
      color: row % 2 === 0 ? PAPER : TINT,
      borderColor: RULE,
      borderWidth: 0.8,
    });
    L.page.drawText(printable(criterion.name), {
      x: M + 8,
      y: top - 16,
      size: 10.5,
      font: bold,
      color: INK,
    });
    lines.forEach((line, i) => {
      L.page.drawText(line, {
        x: M + 8,
        y: top - 30 - i * 12.5,
        size: 9.5,
        font: regular,
        color: MUTED,
      });
    });
    if (criterion.curriculum !== null) {
      L.page.drawText(printable(criterion.curriculum), {
        x: M + 8,
        y: top - 30 - lines.length * 12.5,
        size: 9,
        font: bold,
        color: TEAL,
      });
    }
    levels.forEach((_, i) => {
      const x = M + nameWidth + i * levelWidth;
      L.page.drawLine({
        start: { x, y: top },
        end: { x, y: top - height },
        thickness: 0.8,
        color: RULE,
      });
      L.page.drawSvgPath(roundedRect(13, 13, 3), {
        x: x + levelWidth / 2 - 6.5,
        y: top - height / 2 + 6.5,
        borderColor: MUTED,
        borderWidth: 0.8,
      });
    });
    top -= height;
  });
  L.y = top - 22;
  L.ensure(150);
  label(labels.observaciones);
  L.page.drawSvgPath(roundedRect(CONTENT, 120, 8), {
    x: M,
    y: L.y,
    borderColor: RULE,
    borderWidth: 0.8,
  });

  // ── Logros del cronista (M6): juego, no evaluación ──
  const a = input.achievements;
  L.addPage();
  section(a.title);
  L.write(a.note, s.muted);
  L.space(14);
  L.ensure(60);
  const badgeTop = L.y;
  const mini = { x: M + 24, y: badgeTop - 24 };
  L.page.drawCircle({ ...mini, size: 24, color: NIGHT, borderColor: GOLD_LIGHT, borderWidth: 1.2 });
  L.page.drawCircle({ ...mini, size: 16, color: hex(badge.emblemColor) });
  L.page.drawSvgPath(badge.emblemPath, {
    x: mini.x - 10,
    y: mini.y + 10,
    scale: 20 / 24,
    color: NIGHT,
  });
  L.y = badgeTop - 14;
  L.write(a.summary, { ...s.value, size: 15, leading: 20 }, M + 62, CONTENT - 62);
  L.y = Math.min(L.y, badgeTop - 56) - 12;

  // Logros: rejilla de dos columnas, con el rombo lleno si se consiguió.
  label(a.itemsLabel);
  const column = (CONTENT - 20) / 2;
  const rows = Math.ceil(a.items.length / 2);
  L.ensure(rows * 22 + 6);
  const gridTop = L.y;
  a.items.forEach((item, i) => {
    const x = M + (i % 2) * (column + 20);
    const y = gridTop - Math.floor(i / 2) * 22;
    const earned = item.count > 0;
    L.page.drawSvgPath(DIAMOND, {
      x,
      y: y - 2,
      color: earned ? TEAL : PAPER,
      borderColor: earned ? TEAL : RULE,
      borderWidth: 1,
    });
    const text = item.count > 1 ? `${item.label}  ×${String(item.count)}` : item.label;
    L.page.drawText(printable(text), {
      x: x + 18,
      y: y - 10.5,
      size: 10.5,
      font: earned ? bold : regular,
      color: earned ? INK : MUTED,
    });
  });
  L.y = gridTop - rows * 22 - 14;

  // Constelación de conceptos: las mismas posiciones que en el móvil, con sus nombres al lado.
  label(a.starsLabel);
  const skyWidth = 220;
  const skyHeight = 150;
  L.ensure(skyHeight + 10);
  const skyTop = L.y;
  L.page.drawSvgPath(roundedRect(skyWidth, skyHeight, 10), { x: M, y: skyTop, color: NIGHT });
  const centre = { x: M + skyWidth / 2, y: skyTop - skyHeight / 2 };
  const stars = a.stars.map((star, i) => {
    const angle = i * 2.39996;
    const radius = 44 * Math.sqrt((i + 0.6) / a.stars.length);
    return {
      ...star,
      x: centre.x + radius * 2.2 * Math.cos(angle),
      y: centre.y - radius * 1.55 * Math.sin(angle),
    };
  });
  const lit = stars.filter((star) => star.lit);
  lit.slice(1).forEach((star, i) => {
    const previous = lit[i];
    if (previous === undefined) return;
    L.page.drawLine({
      start: { x: previous.x, y: previous.y },
      end: { x: star.x, y: star.y },
      thickness: 0.6,
      color: TEAL_LIGHT,
      opacity: 0.6,
    });
  });
  for (const star of stars) {
    if (star.lit)
      L.page.drawCircle({ x: star.x, y: star.y, size: 6, color: GOLD_LIGHT, opacity: 0.2 });
    L.page.drawCircle({
      x: star.x,
      y: star.y,
      size: star.lit ? 3 : 1.3,
      color: star.lit ? hex('#ffe7a3') : hex('#4a5468'),
    });
  }
  L.y = skyTop - 4;
  const names = lit.map((star) => star.label);
  L.write(
    names.length > 0 ? names.join(' · ') : a.none,
    s.body,
    M + skyWidth + 18,
    CONTENT - skyWidth - 18,
  );
  L.y = Math.min(L.y, skyTop - skyHeight) - 18;

  label(a.fichasLabel);
  L.write(a.fichas.length > 0 ? a.fichas.join(' · ') : a.none, s.body);

  // ── Pie en todas las páginas ──
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawLine({
      start: { x: M, y: 42 },
      end: { x: W - M, y: 42 },
      thickness: 0.6,
      color: RULE,
    });
    page.drawText(printable(labels.pie), { x: M, y: 28, size: 8, font: regular, color: MUTED });
    const right = printable(input.footer(i + 1, pages.length));
    page.drawText(right, {
      x: W - M - regular.widthOfTextAtSize(right, 8),
      y: 28,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}
