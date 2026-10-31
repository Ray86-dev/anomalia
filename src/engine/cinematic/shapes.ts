/**
 * Formas de las cinemáticas (D-87): funciones puras que colocan N partículas. No dependen de
 * Three ni del DOM, así que se prueban sin navegador. Coordenadas en una caja de unos
 * x ∈ [−1, 1], y ∈ [−1, 1.4], z ∈ [−1.5, 1]; el motor encuadra la cámara.
 *
 * Cada partícula tiene un tono (0 = color profundo, 0,5 = medio, 1 = acento de la paleta, que
 * también la hace más brillante) y un tamaño relativo (1 = normal).
 */

export type Rng = () => number;

/** Generador pseudoaleatorio con semilla (mulberry32): la misma forma en todos los móviles. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ShapeData = {
  readonly positions: Float32Array;
  readonly tones: Float32Array;
  readonly sizes: Float32Array;
};

export type ShapeId =
  | 'canarias'
  | 'ciudad'
  | 'calor'
  | 'parpadeo'
  | 'archivo'
  | 'hilo'
  | 'balanza'
  | 'cronistas'
  | 'portal'
  | 'ari'
  | 'hilo-cerrado'
  | 'tecnocracia'
  | 'cuidado'
  | 'fractura'
  | 'estancamiento'
  | 'equilibrio';

/** Rellena los arrays por partes; la última parte se queda con lo que sobre. */
class Builder {
  readonly positions: Float32Array;
  readonly tones: Float32Array;
  readonly sizes: Float32Array;
  readonly count: number;
  readonly rng: Rng;
  private index = 0;

  constructor(count: number, rng: Rng) {
    this.count = count;
    this.rng = rng;
    this.positions = new Float32Array(count * 3);
    this.tones = new Float32Array(count);
    this.sizes = new Float32Array(count);
  }

  get left(): number {
    return this.count - this.index;
  }

  /** Cuántas partículas tocan a una parte con este peso (0–1) del total. */
  share(weight: number): number {
    return Math.min(this.left, Math.floor(this.count * weight));
  }

  add(x: number, y: number, z: number, tone: number, size = 1): void {
    if (this.index >= this.count) return;
    const i = this.index++;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.tones[i] = Math.min(1, Math.max(0, tone));
    this.sizes[i] = size;
  }

  /** Mezcla el orden: así cualquier subconjunto (menos partículas en móviles lentos) cubre la forma. */
  done(): ShapeData {
    while (this.index < this.count) this.add(0, 0, 0, 0, 0);
    const { positions, tones, sizes, rng } = this;
    for (let i = this.count - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      for (let k = 0; k < 3; k++) {
        const a = positions[i * 3 + k] ?? 0;
        positions[i * 3 + k] = positions[j * 3 + k] ?? 0;
        positions[j * 3 + k] = a;
      }
      const tone = tones[i] ?? 0;
      tones[i] = tones[j] ?? 0;
      tones[j] = tone;
      const size = sizes[i] ?? 0;
      sizes[i] = sizes[j] ?? 0;
      sizes[j] = size;
    }
    return { positions, tones, sizes };
  }
}

const TAU = Math.PI * 2;
const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
/** Normal aproximada (suma de uniformes): nubes y racimos con borde suave. */
const gauss = (rng: Rng) => (rng() + rng() + rng() + rng() - 2) / 2;

type Tower = { x: number; z: number; w: number; d: number; h: number };

/** Edificios de una ciudad costera, más altos hacia el centro. */
function towers(rng: Rng, heightScale: number): Tower[] {
  const list: Tower[] = [];
  for (let i = 0; i < 26; i++) {
    const x = between(rng, -0.95, 0.95);
    const centre = 1 - Math.abs(x);
    list.push({
      x,
      z: between(rng, -0.9, 0.5),
      w: between(rng, 0.07, 0.15),
      d: between(rng, 0.07, 0.15),
      h: (0.25 + rng() * 0.6 + centre * 0.7) * heightScale,
    });
  }
  return list;
}

const GROUND = -0.85;

/** Ventanas de los edificios: puntos en las fachadas, alineados en pisos. */
function addCity(
  b: Builder,
  rng: Rng,
  n: number,
  list: readonly Tower[],
  lit = 0.25,
  dark = 0.45,
): void {
  const areas = list.map((t) => t.h * (t.w + t.d));
  const total = areas.reduce((sum, a) => sum + a, 0);
  for (let i = 0; i < n; i++) {
    let pick = rng() * total;
    let tower = list[0];
    for (const [k, a] of areas.entries()) {
      pick -= a;
      tower = list[k];
      if (pick <= 0) break;
    }
    if (tower === undefined) return;
    const floor = Math.floor(rng() * Math.max(1, tower.h / 0.045));
    const y = GROUND + floor * 0.045 + 0.02;
    const side = rng();
    const u = rng() - 0.5;
    const x = side < 0.5 ? tower.x + u * tower.w : tower.x + (side < 0.75 ? -1 : 1) * (tower.w / 2);
    const z = side < 0.5 ? tower.z + (tower.d / 2) * (side < 0.25 ? -1 : 1) : tower.z + u * tower.d;
    const on = rng() < lit;
    b.add(x, Math.min(y, GROUND + tower.h), z, on ? 0.95 : dark, on ? 1.1 : 0.8);
  }
}

/** Calles: una rejilla en el suelo. */
function addStreets(b: Builder, rng: Rng, n: number): void {
  for (let i = 0; i < n; i++) {
    const along = between(rng, -1.2, 1.2);
    const line = Math.round(between(rng, -4, 4)) * 0.25;
    if (rng() < 0.5) b.add(along, GROUND, line * 0.8 - 0.2, 0.2, 0.7);
    else b.add(line, GROUND, along * 0.7 - 0.2, 0.2, 0.7);
  }
}

/** El mar delante de la costa, con un poco de oleaje. */
function addSea(b: Builder, rng: Rng, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = between(rng, -1.5, 1.5);
    const z = between(rng, 0.6, 1.3);
    b.add(x, GROUND - 0.05 + Math.sin(x * 9 + z * 5) * 0.015, z, 0.12, 0.7);
  }
}

function canarias(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  // Mar de nubes a media ladera.
  for (let i = 0, n = b.share(0.4); i < n; i++) {
    const x = between(rng, -1.7, 1.7);
    const z = between(rng, -1.6, 1);
    const y = -0.45 + Math.sin(x * 3 + z * 2) * 0.05 + gauss(rng) * 0.05;
    b.add(x, y, z, between(rng, 0.15, 0.4), between(rng, 0.8, 1.3));
  }
  // El Teide: un cono con la cumbre más clara (nieve, piedra).
  for (let i = 0, n = b.share(0.4); i < n; i++) {
    const h = Math.min(0.94, 1 - Math.sqrt(rng()));
    const angle = rng() * TAU;
    const r = 1.05 * (1 - h) * (1 + gauss(rng) * 0.06);
    b.add(r * Math.cos(angle), -0.75 + h * 1.55, r * Math.sin(angle) * 0.7 - 0.3, 0.3 + h * 0.7);
  }
  // Estrellas.
  for (let i = 0, n = b.left; i < n; i++) {
    b.add(
      between(rng, -1.8, 1.8),
      between(rng, 0.55, 1.5),
      between(rng, -2, -0.6),
      0.9,
      between(rng, 0.4, 1.3),
    );
  }
  return b.done();
}

function ciudad(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  addCity(b, rng, b.share(0.62), towers(seeded(7), 1));
  addStreets(b, rng, b.share(0.16));
  addSea(b, rng, b.share(0.14));
  // Drones de reparto sobre la ciudad.
  for (let i = 0, n = b.left; i < n; i++) {
    b.add(between(rng, -1, 1), between(rng, 0.55, 1.1), between(rng, -0.7, 0.2), 1, 1.05);
  }
  return b.done();
}

function calor(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  addCity(b, rng, b.share(0.38), towers(seeded(7), 0.65), 0.1);
  // Un sol enorme detrás de la calima.
  for (let i = 0, n = b.share(0.22); i < n; i++) {
    const angle = rng() * TAU;
    const r = 0.6 * Math.sqrt(rng()) ** 0.4;
    b.add(r * Math.cos(angle), 0.75 + r * Math.sin(angle), -1.4, 0.75 + r * 0.4, 1.2);
  }
  // Calima: polvo suspendido.
  for (let i = 0, n = b.left; i < n; i++) {
    b.add(
      between(rng, -1.6, 1.6),
      between(rng, -0.9, 1),
      between(rng, -1.2, 1),
      between(rng, 0.25, 0.6),
      0.7,
    );
  }
  return b.done();
}

/** La misma ciudad, pero un edificio se deshace y otros se desdoblan: el mundo parpadea. */
function parpadeo(count: number, rng: Rng): ShapeData {
  // Misma semilla que la ciudad: casi todas las partículas se quedan quietas al pasar de una a otra.
  const city = ciudad(count, seeded(seedFor('ciudad')));
  const { positions, tones, sizes } = city;
  for (let i = 0; i < count; i++) {
    const roll = rng();
    if (roll < 0.18) {
      positions[i * 3] = (positions[i * 3] ?? 0) + (rng() < 0.5 ? -0.14 : 0.14);
      tones[i] = 1;
    } else if (roll < 0.26) {
      positions[i * 3] = between(rng, -0.5, 0.5);
      positions[i * 3 + 1] = between(rng, -0.8, 0.9);
      positions[i * 3 + 2] = between(rng, -0.5, 0.5);
      sizes[i] = 0.6;
    }
  }
  return city;
}

function archivo(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  const cy = 0.35;
  // Esfera de datos (reparto de Fibonacci).
  const sphere = b.share(0.38);
  for (let i = 0; i < sphere; i++) {
    const y = 1 - (2 * (i + 0.5)) / sphere;
    const r = Math.sqrt(1 - y * y);
    const angle = i * 2.399963;
    b.add(0.72 * r * Math.cos(angle), cy + 0.72 * y, 0.72 * r * Math.sin(angle), 0.55);
  }
  // Anillos inclinados.
  const rings = [
    { r: 1.0, tilt: 0.35 },
    { r: 0.9, tilt: -0.6 },
    { r: 1.12, tilt: 1.2 },
  ];
  for (let i = 0, n = b.share(0.3); i < n; i++) {
    const ring = rings[i % rings.length] ?? { r: 1, tilt: 0 };
    const angle = rng() * TAU;
    const x = ring.r * Math.cos(angle);
    const z = ring.r * Math.sin(angle);
    b.add(x, cy + z * Math.sin(ring.tilt), z * Math.cos(ring.tilt), 0.9, 0.9);
  }
  // Núcleo.
  for (let i = 0, n = b.share(0.14); i < n; i++) {
    b.add(gauss(rng) * 0.22, cy + gauss(rng) * 0.22, gauss(rng) * 0.22, 1, 1.3);
  }
  // Columnas del Archivo bajo la esfera.
  for (let i = 0, n = b.left; i < n; i++) {
    const column = Math.floor(rng() * 9) - 4;
    b.add(column * 0.2, between(rng, -0.95, -0.45), -0.2 + (column % 2) * 0.2, 0.4, 0.8);
  }
  return b.done();
}

/** Alturas de los cinco nudos (las cinco decisiones abiertas) en el hilo temporal. */
export const KNOT_HEIGHTS = [-0.75, -0.3, 0.15, 0.6, 1.05] as const;

/** El hilo temporal; con `closed`, las cinco anomalías ya cerradas (epílogo): sin hebras sueltas. */
function thread(count: number, rng: Rng, closed: boolean): ShapeData {
  const b = new Builder(count, rng);
  const strand = (y: number, phase: number) => {
    const angle = y * 7 + phase;
    return [0.42 * Math.cos(angle), 0.42 * Math.sin(angle) * 0.6] as const;
  };
  for (let i = 0, n = b.share(closed ? 0.78 : 0.55); i < n; i++) {
    const y = between(rng, -1, 1.3);
    const [x, z] = strand(y, rng() < 0.5 ? 0 : Math.PI);
    b.add(x + gauss(rng) * 0.01, y, z, closed ? 0.6 : 0.5, 0.9);
  }
  for (let i = 0, n = b.share(closed ? 0.22 : 0.2); i < n; i++) {
    const knot = KNOT_HEIGHTS[i % KNOT_HEIGHTS.length] ?? 0;
    const spread = closed ? 0.08 : 0.14;
    b.add(gauss(rng) * spread, knot + gauss(rng) * 0.07, gauss(rng) * spread, 1, 1.4);
  }
  // Hebras sueltas: el hilo se deshilacha cerca de cada nudo.
  for (let i = 0, n = b.left; i < n; i++) {
    const knot = KNOT_HEIGHTS[Math.floor(rng() * KNOT_HEIGHTS.length)] ?? 0;
    const angle = rng() * TAU;
    const reach = 0.2 + rng() * 0.6;
    b.add(
      Math.cos(angle) * reach,
      knot + gauss(rng) * 0.2,
      Math.sin(angle) * reach * 0.5,
      0.3,
      0.7,
    );
  }
  return b.done();
}

const hilo = (count: number, rng: Rng) => thread(count, rng, false);
const hiloCerrado = (count: number, rng: Rng) => thread(count, rng, true);

/** Una balanza: datos ordenados en un platillo y razones (una nube viva) en el otro. */
function balanza(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  const line = (n: number, x0: number, y0: number, x1: number, y1: number, tone: number) => {
    for (let i = 0; i < n; i++) {
      const t = rng();
      b.add(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, gauss(rng) * 0.01, tone, 0.8);
    }
  };
  line(b.share(0.1), 0, -0.9, 0, 0.75, 0.35);
  line(b.share(0.1), -0.85, 0.75, 0.85, 0.75, 0.4);
  line(b.share(0.03), -0.7, 0.75, -0.7, 0.05, 0.3);
  line(b.share(0.03), 0.7, 0.75, 0.7, 0.05, 0.3);
  for (let i = 0, n = b.share(0.04); i < n; i++) {
    const angle = rng() * TAU;
    b.add(0.3 * Math.cos(angle), -0.9, 0.12 * Math.sin(angle), 0.35);
  }
  for (const side of [-1, 1]) {
    for (let i = 0, n = b.share(0.05); i < n; i++) {
      const u = between(rng, -1, 1);
      b.add(side * 0.7 + u * 0.32, 0.05 - (1 - u * u) * 0.08, gauss(rng) * 0.05, 0.4);
    }
  }
  // Datos: una rejilla perfecta, medida y contada.
  for (let i = 0, n = b.share(0.27); i < n; i++) {
    const cell = i % 125;
    const gx = (cell % 5) - 2;
    const gy = Math.floor(cell / 5) % 5;
    const gz = Math.floor(cell / 25) - 2;
    b.add(-0.7 + gx * 0.07, 0.1 + gy * 0.07, gz * 0.07, 0.5, 1);
  }
  // Razones: una nube orgánica que se discute.
  for (let i = 0, n = b.left; i < n; i++) {
    b.add(0.7 + gauss(rng) * 0.2, 0.3 + Math.abs(gauss(rng)) * 0.3, gauss(rng) * 0.2, 1, 1.1);
  }
  return b.done();
}

/** La clase: unos 25 Cronistas conectados con el Archivo. */
export const CHRONICLERS = 25;

function cronistas(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  const nodes: (readonly [number, number, number])[] = [];
  for (let i = 0; i < CHRONICLERS; i++) {
    const y = 1 - (2 * (i + 0.5)) / CHRONICLERS;
    const r = Math.sqrt(1 - y * y);
    const angle = i * 2.399963;
    const reach = 0.9 + rng() * 0.15;
    nodes.push([reach * r * Math.cos(angle), 0.3 + reach * y * 0.95, reach * r * Math.sin(angle)]);
  }
  for (let i = 0, n = b.share(0.08); i < n; i++) {
    b.add(gauss(rng) * 0.12, 0.3 + gauss(rng) * 0.12, gauss(rng) * 0.12, 0.6, 1.2);
  }
  for (let i = 0, n = b.share(0.3); i < n; i++) {
    const [x, y, z] = nodes[i % CHRONICLERS] ?? [0, 0, 0];
    b.add(x + gauss(rng) * 0.025, y + gauss(rng) * 0.025, z + gauss(rng) * 0.025, 1, 1.3);
  }
  // Los canales que los unen al Archivo.
  for (let i = 0, n = b.share(0.47); i < n; i++) {
    const [x, y, z] = nodes[i % CHRONICLERS] ?? [0, 0, 0];
    const t = rng();
    b.add(x * t, 0.3 + (y - 0.3) * t, z * t, 0.4, 0.7);
  }
  for (let i = 0, n = b.left; i < n; i++) {
    b.add(between(rng, -1.6, 1.6), between(rng, -0.9, 1.5), between(rng, -1.5, 0.5), 0.15, 0.6);
  }
  return b.done();
}

/** Un túnel de anillos hacia el fondo: el viaje en el tiempo. */
function portal(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  for (let i = 0, n = b.share(0.85); i < n; i++) {
    const depth = rng() ** 0.7;
    const angle = rng() * TAU + depth * 9;
    const r = 0.95 - depth * 0.15 + gauss(rng) * 0.02;
    b.add(r * Math.cos(angle), 0.3 + r * Math.sin(angle), 0.6 - depth * 7, 0.3 + depth * 0.7, 1.1);
  }
  for (let i = 0, n = b.left; i < n; i++) {
    b.add(gauss(rng) * 0.25, 0.3 + gauss(rng) * 0.25, -6.5, 1, 1.6);
  }
  return b.done();
}

/**
 * Ari: un busto de espaldas a la luz, sin rostro ni rasgos de género (D-66), con el móvil
 * encendido en las manos.
 */
function shoulderWidth(y: number): number {
  if (y > 0.62) return 0;
  if (y > 0.35) return 0.12 + 0.6 * Math.sqrt(Math.max(0, 1 - ((y - 0.35) / 0.28) ** 2));
  return 0.72 - (0.35 - y) * 0.06;
}

function insideAri(x: number, y: number): boolean {
  const head = (x / 0.25) ** 2 + ((y - 0.92) / 0.3) ** 2 <= 1;
  const neck = Math.abs(x) <= 0.1 && y >= 0.5 && y <= 0.7;
  const body = y >= -0.95 && Math.abs(x) <= shoulderWidth(y);
  return head || neck || body;
}

const PHONE = { x: 0, y: -0.15, w: 0.22, h: 0.36 } as const;

function ari(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  // Cuerpo: relleno tenue.
  for (let i = 0, n = b.share(0.62); i < n;) {
    const x = between(rng, -0.8, 0.8);
    const y = between(rng, -0.95, 1.25);
    if (!insideAri(x, y)) continue;
    b.add(x, y, gauss(rng) * 0.12, 0.42, 1);
    i++;
  }
  // Contorno iluminado.
  for (let i = 0, n = b.share(0.18); i < n; i++) {
    if (rng() < 0.35) {
      const angle = rng() * TAU;
      b.add(0.25 * Math.cos(angle), 0.92 + 0.3 * Math.sin(angle), 0, 0.85, 1.05);
    } else {
      const y = between(rng, -0.95, 0.6);
      b.add((rng() < 0.5 ? -1 : 1) * shoulderWidth(y), y, 0, 0.85, 1.05);
    }
  }
  // El móvil encendido.
  for (let i = 0, n = b.share(0.14); i < n; i++) {
    b.add(
      PHONE.x + between(rng, -0.5, 0.5) * PHONE.w,
      PHONE.y + between(rng, -0.5, 0.5) * PHONE.h,
      0.18,
      1,
      1.25,
    );
  }
  for (let i = 0, n = b.left; i < n; i++) {
    b.add(between(rng, -1.5, 1.5), between(rng, -0.9, 1.5), between(rng, -1.5, -0.3), 0.2, 0.6);
  }
  return b.done();
}

// ── Los cinco 2077 del epílogo (D-89): la misma ciudad, reorganizada según el final ──

/** Tecnocracia genómica: una rejilla perfecta, «válidos» encendidos y «no válidos» a oscuras. */
function tecnocracia(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  const grid: Tower[] = [];
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 4; gz++) {
      grid.push({
        x: -0.85 + gx * 0.34,
        z: -0.9 + gz * 0.4,
        w: 0.12,
        d: 0.12,
        h: gx < 3 ? 1.5 : 0.55,
      });
    }
  }
  addCity(
    b,
    rng,
    b.share(0.42),
    grid.filter((t) => t.x < 0),
    0.9,
  );
  addCity(
    b,
    rng,
    b.share(0.22),
    grid.filter((t) => t.x >= 0),
    0,
    0.26,
  );
  // Haces de escaneo que recorren la ciudad.
  const beams = [-0.45, 0.05, 0.55] as const;
  for (let i = 0, n = b.share(0.2); i < n; i++) {
    const y = beams[i % beams.length] ?? 0;
    b.add(between(rng, -1.15, 1.15), y + gauss(rng) * 0.008, -0.3 + gauss(rng) * 0.02, 1, 0.8);
  }
  addStreets(b, rng, b.left);
  return b.done();
}

/** Era del cuidado: edificios bajos con jardines y arcos que lo comparten todo. */
function cuidado(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  const list = towers(seeded(7), 0.6);
  addCity(b, rng, b.share(0.34), list, 0.5);
  for (let i = 0, n = b.share(0.28); i < n; i++) {
    const tower = list[Math.floor(rng() * list.length)];
    if (tower === undefined) continue;
    const top = GROUND + tower.h + 0.05;
    b.add(
      tower.x + gauss(rng) * 0.07,
      top + Math.abs(gauss(rng)) * 0.08,
      tower.z + gauss(rng) * 0.07,
      0.55,
      1,
    );
  }
  for (let i = 0, n = b.share(0.26); i < n; i++) {
    const a = list[i % list.length];
    const c = list[(i * 7 + 3) % list.length];
    if (a === undefined || c === undefined) continue;
    const t = rng();
    const lift = GROUND + Math.max(a.h, c.h) * 0.6 + Math.sin(t * Math.PI) * 0.35;
    b.add(a.x + (c.x - a.x) * t, lift, a.z + (c.z - a.z) * t, 1, 0.8);
  }
  addSea(b, rng, b.left);
  return b.done();
}

/** La ciudad de siempre (misma semilla), para que los finales salgan de ella. */
const baseCity = (count: number) => ciudad(count, seeded(seedFor('ciudad')));

/** Fractura: la ciudad partida en bloques que se alejan y partículas sueltas. */
function fractura(count: number, rng: Rng): ShapeData {
  const city = baseCity(count);
  const { positions, tones, sizes } = city;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    if (rng() < 0.15) {
      positions[i * 3] = between(rng, -1.6, 1.6);
      positions[i * 3 + 1] = between(rng, -0.9, 1.3);
      positions[i * 3 + 2] = between(rng, -1.2, 0.6);
      tones[i] = 0.9;
      sizes[i] = 0.7;
      continue;
    }
    positions[i * 3] = x + (x < 0 ? -0.32 : 0.32);
    positions[i * 3 + 1] = (positions[i * 3 + 1] ?? 0) + (x < 0 ? 0.08 : -0.1);
    positions[i * 3 + 2] = z + (z < -0.2 ? -0.25 : 0.2);
  }
  return city;
}

/** Estancamiento: la ciudad hundida, apagada, bajo la calima. */
function estancamiento(count: number, rng: Rng): ShapeData {
  const city = baseCity(count);
  const { positions, tones, sizes } = city;
  for (let i = 0; i < count; i++) {
    if (rng() < 0.22) {
      positions[i * 3] = between(rng, -1.5, 1.5);
      positions[i * 3 + 1] = between(rng, -0.9, 0.7);
      positions[i * 3 + 2] = between(rng, -1.2, 1);
      tones[i] = 0.35;
      sizes[i] = 0.7;
      continue;
    }
    const y = positions[i * 3 + 1] ?? 0;
    positions[i * 3 + 1] = GROUND + (y - GROUND) * 0.5;
    tones[i] = (tones[i] ?? 0) * 0.8;
  }
  return city;
}

/** Equilibrio frágil: media ciudad ordenada y media a la deriva, bajo una línea en equilibrio. */
function equilibrio(count: number, rng: Rng): ShapeData {
  const b = new Builder(count, rng);
  addCity(
    b,
    rng,
    b.share(0.38),
    towers(seeded(7), 1).filter((t) => t.x < 0.05),
    0.4,
  );
  for (let i = 0, n = b.share(0.34); i < n; i++) {
    b.add(
      0.55 + gauss(rng) * 0.35,
      0.05 + gauss(rng) * 0.5,
      gauss(rng) * 0.35,
      between(rng, 0.4, 1),
      0.9,
    );
  }
  for (let i = 0, n = b.share(0.1); i < n; i++) {
    b.add(between(rng, -1.1, 1.1), 0.75, -0.2, 0.9, 0.8);
  }
  addStreets(b, rng, b.left);
  return b.done();
}

const BUILDERS: Record<ShapeId, (count: number, rng: Rng) => ShapeData> = {
  canarias,
  ciudad,
  calor,
  parpadeo,
  archivo,
  hilo,
  balanza,
  cronistas,
  portal,
  ari,
  'hilo-cerrado': hiloCerrado,
  tecnocracia,
  cuidado,
  fractura,
  estancamiento,
  equilibrio,
};

function seedFor(id: ShapeId): number {
  let seed = 0;
  for (const char of id) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return seed;
}

/** Forma lista para el motor: siempre la misma para el mismo id y número de partículas. */
export function buildShape(id: ShapeId, count: number): ShapeData {
  return BUILDERS[id](count, seeded(seedFor(id)));
}

export const SHAPE_IDS = Object.keys(BUILDERS) as ShapeId[];
