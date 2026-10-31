/**
 * Motor de las cinemáticas (D-87): unas 9000 partículas (5000 en móviles modestos) que pasan de
 * una forma a otra. Se carga bajo demanda desde Cinematic.tsx (este archivo y Three); Three y GSAP no entran nunca en
 * el bundle inicial.
 *
 * Rendimiento: resolución limitada, sin postprocesado (el brillo es la textura del punto con
 * mezcla aditiva), pausa con la pestaña oculta y, si va lento, la mitad de partículas.
 * Movimiento reducido: cada plano se pinta una vez, ya formado, sin cámara ni deriva.
 */
import type { ShotId } from '@shared/game/shots.ts';
import { gsap } from 'gsap';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { buildShape, type ShapeData, type ShapeId } from './shapes.ts';
import { SHOT_CONFIG, type Vec3 } from './shots.ts';

export type CinematicOptions = {
  readonly shot: ShotId;
  readonly instability: number;
  readonly reducedMotion: boolean;
  /** Se perdió el contexto WebGL: el componente quita el canvas y queda el fondo CSS. */
  readonly onLost: () => void;
};

export type CinematicScene = {
  show: (shot: ShotId) => void;
  /** Inestabilidad del mundo (0–1, según el Desnivel): se suma a la del plano. */
  setInstability: (level: number) => void;
  destroy: () => void;
};

const FOV = 50;
const TAU = Math.PI * 2;
const MORPH_SECONDS = 2.6;
/** Por debajo de unos 28 fps se quita la mitad de las partículas. */
const SLOW_FRAME = 1 / 28;

const VERTEX = /* glsl */ `
attribute vec3 aFrom;
attribute float aToneFrom;
attribute float aTone;
attribute float aSizeFrom;
attribute float aSize;
attribute float aSeed;
uniform float uMix;
uniform float uTime;
uniform float uDrift;
uniform float uInstability;
uniform float uScatter;
uniform float uPointScale;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec3 vColor;
varying float vAlpha;

vec3 hash3(float s) {
  return fract(sin(vec3(s * 127.1, s * 311.7, s * 74.7)) * 43758.5453) * 2.0 - 1.0;
}

void main() {
  float t = clamp((uMix - aSeed * 0.4) / 0.6, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 pos = mix(aFrom, position, t);
  // A medio camino las partículas se dispersan: los datos se deshacen y se rehacen.
  pos += hash3(aSeed) * sin(t * 3.14159) * uScatter;
  // Respiración en reposo.
  pos += vec3(
    sin(uTime * 0.6 + aSeed * 40.0),
    cos(uTime * 0.5 + aSeed * 30.0),
    sin(uTime * 0.4 + aSeed * 20.0)
  ) * 0.012 * uDrift;
  // Fallos de imagen: franjas horizontales que se desplazan a saltos.
  float band = floor(pos.y * 9.0);
  float tick = floor(uTime * 7.0);
  float glitch = fract(sin(band * 91.7 + tick * 13.3) * 43758.5453);
  float on = step(1.0 - uInstability * 0.35, glitch) * step(0.001, uInstability);
  pos.x += on * (glitch - 0.5) * 0.5 * uInstability;

  float tone = mix(aToneFrom, aTone, t);
  vec3 low = mix(uColorA, uColorB, clamp(tone * 2.0, 0.0, 1.0));
  vec3 high = mix(uColorB, uColorC, clamp(tone * 2.0 - 1.0, 0.0, 1.0));
  vColor = mix(mix(low, high, step(0.5, tone)), vec3(1.0, 0.32, 0.26), on * 0.8);
  float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + aSeed * 60.0);
  vAlpha = (0.35 + 0.65 * tone) * mix(1.0, twinkle, uDrift);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(aSizeFrom, aSize, t) * uPointScale / max(0.5, -mv.z);
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
uniform float uOpacity;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float glow = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, glow * glow * vAlpha * uOpacity);
}
`;

/** Mismo avance por partícula que el shader, para retomar una transición a medias. */
function progress(mix: number, seed: number): number {
  const t = Math.min(1, Math.max(0, (mix - seed * 0.4) / 0.6));
  return t * t * (3 - 2 * t);
}

function budget(): { readonly count: number; readonly low: boolean } {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const low = cores <= 4 || memory <= 3;
  return { count: low ? 5000 : 9000, low };
}

const toVector = ([x, y, z]: Vec3) => new Vector3(x, y, z);

export function createCinematic(host: HTMLElement, options: CinematicOptions): CinematicScene {
  const { count, low } = budget();
  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: true,
    powerPreference: 'low-power',
  });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  const group = new Group();
  scene.add(group);

  const shapes = new Map<ShapeId, ShapeData>();
  const shapeOf = (id: ShapeId): ShapeData => {
    const cached = shapes.get(id);
    if (cached !== undefined) return cached;
    const built = buildShape(id, count);
    shapes.set(id, built);
    return built;
  };

  let config = SHOT_CONFIG[options.shot];
  const start = shapeOf(config.shape);
  const from = new Float32Array(start.positions);
  const to = new Float32Array(start.positions);
  const toneFrom = new Float32Array(start.tones);
  const toneTo = new Float32Array(start.tones);
  const sizeFrom = new Float32Array(start.sizes);
  const sizeTo = new Float32Array(start.sizes);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();

  const geometry = new BufferGeometry();
  const attributes = {
    position: new BufferAttribute(to, 3),
    aFrom: new BufferAttribute(from, 3),
    aTone: new BufferAttribute(toneTo, 1),
    aToneFrom: new BufferAttribute(toneFrom, 1),
    aSize: new BufferAttribute(sizeTo, 1),
    aSizeFrom: new BufferAttribute(sizeFrom, 1),
  };
  for (const [name, attribute] of Object.entries(attributes))
    geometry.setAttribute(name, attribute);
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));

  const palette = config.palette.map((hex) => new Color(hex));
  const uniforms = {
    uMix: { value: 1 },
    uTime: { value: 0 },
    uDrift: { value: options.reducedMotion ? 0 : config.drift },
    uInstability: { value: Math.max(config.instability, options.instability) },
    uScatter: { value: 0 },
    uPointScale: { value: 1 },
    uOpacity: { value: 1 },
    uColorA: { value: palette[0] ?? new Color() },
    uColorB: { value: palette[1] ?? new Color() },
    uColorC: { value: palette[2] ?? new Color() },
  };
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);

  // Cámara: posición y objetivo del plano; `place` los encuadra según la pantalla.
  const cameraPosition = toVector(config.camera);
  const cameraTarget = toVector(config.target);
  let worldInstability = options.instability;
  let spinAngle = 0;
  let rollAngle = 0;
  let time = 0;
  let size = { width: 1, height: 1 };

  function place(): void {
    const aspect = size.width / size.height;
    // En vertical, la forma sube: el texto ocupa la parte de abajo de la pantalla.
    const drop = aspect < 0.8 ? 0.75 : 0.3;
    const offset = cameraPosition.clone().sub(cameraTarget);
    const needed = 1.25 / (Math.tan((FOV * Math.PI) / 360) * Math.min(1, aspect));
    const factor = Math.max(1, needed / offset.length());
    camera.position.copy(cameraTarget).addScaledVector(offset, factor);
    camera.position.y -= drop;
    camera.lookAt(cameraTarget.x, cameraTarget.y - drop, cameraTarget.z);
  }

  function pointScale(): number {
    return 2.6 * pixelRatio * (size.height / 700) * 4.5 * (low ? 1.3 : 1);
  }

  function render(): void {
    group.rotation.y = spinAngle + config.sway * Math.sin(time * 0.35);
    group.rotation.z = rollAngle;
    place();
    renderer.render(scene, camera);
  }

  function resize(): void {
    size = { width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) };
    renderer.setSize(size.width, size.height, false);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    uniforms.uPointScale.value = pointScale() * (degraded ? 1.2 : 1);
    if (options.reducedMotion) render();
  }

  // Bucle de animación, con vigilancia del ritmo de fotogramas.
  let degraded = false;
  let last = performance.now();
  let warmup = 0;
  let slowSum = 0;
  let slowFrames = 0;
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    uniforms.uTime.value = time;
    spinAngle += config.spin * dt;
    rollAngle += config.roll * dt;
    render();
    warmup += dt;
    if (!degraded && warmup > 2) {
      slowSum += dt;
      slowFrames += 1;
      if (slowFrames === 90) {
        if (slowSum / slowFrames > SLOW_FRAME) {
          degraded = true;
          geometry.setDrawRange(0, Math.floor(count * 0.55));
          uniforms.uPointScale.value = pointScale() * 1.2;
        }
        slowSum = 0;
        slowFrames = 0;
      }
    }
  }
  function play(): void {
    if (options.reducedMotion) return;
    last = performance.now();
    renderer.setAnimationLoop(frame);
  }
  function pause(): void {
    renderer.setAnimationLoop(null);
  }

  function updateAttributes(): void {
    for (const attribute of Object.values(attributes)) attribute.needsUpdate = true;
  }

  /** Vuelta completa más cercana: las formas que se ven de frente terminan de frente. */
  const nearestTurn = (angle: number) => Math.round(angle / TAU) * TAU;

  const tweens: gsap.core.Tween[] = [];
  function tween(target: object, vars: gsap.TweenVars): void {
    tweens.push(gsap.to(target, { duration: MORPH_SECONDS, ease: 'power2.inOut', ...vars }));
  }

  function show(shot: ShotId): void {
    const next = SHOT_CONFIG[shot];
    if (next === config) return;
    config = next;
    for (const running of tweens.splice(0)) running.kill();

    // Lo que se ve ahora (quizá a mitad de una transición) pasa a ser el punto de partida.
    const mix = uniforms.uMix.value;
    for (let i = 0; i < count; i++) {
      const t = progress(mix, seeds[i] ?? 0);
      for (let k = i * 3; k < i * 3 + 3; k++) {
        const a = from[k] ?? 0;
        from[k] = a + ((to[k] ?? 0) - a) * t;
      }
      const tone = toneFrom[i] ?? 0;
      toneFrom[i] = tone + ((toneTo[i] ?? 0) - tone) * t;
      const sz = sizeFrom[i] ?? 0;
      sizeFrom[i] = sz + ((sizeTo[i] ?? 0) - sz) * t;
    }
    const target = shapeOf(next.shape);
    to.set(target.positions);
    toneTo.set(target.tones);
    sizeTo.set(target.sizes);
    const colors = next.palette.map((hex) => new Color(hex));
    const instability = Math.max(next.instability, worldInstability);

    if (options.reducedMotion) {
      from.set(to);
      toneFrom.set(toneTo);
      sizeFrom.set(sizeTo);
      updateAttributes();
      uniforms.uMix.value = 1;
      uniforms.uInstability.value = instability;
      [uniforms.uColorA.value, uniforms.uColorB.value, uniforms.uColorC.value].forEach((color, i) =>
        color.copy(colors[i] ?? color),
      );
      cameraPosition.copy(toVector(next.camera));
      cameraTarget.copy(toVector(next.target));
      spinAngle = 0;
      rollAngle = 0;
      render();
      return;
    }

    updateAttributes();
    uniforms.uMix.value = 0;
    tween(uniforms.uMix, { value: 1, ease: 'power1.inOut' });
    tween(uniforms.uScatter, { value: 0.35, duration: MORPH_SECONDS / 2, ease: 'power1.out' });
    tween(uniforms.uScatter, {
      value: 0,
      duration: MORPH_SECONDS / 2,
      delay: MORPH_SECONDS / 2,
      ease: 'power1.in',
    });
    [uniforms.uColorA.value, uniforms.uColorB.value, uniforms.uColorC.value].forEach((color, i) => {
      const goal = colors[i] ?? color;
      tween(color, { r: goal.r, g: goal.g, b: goal.b });
    });
    tween(uniforms.uDrift, { value: next.drift });
    tween(uniforms.uInstability, { value: instability });
    const [cx, cy, cz] = next.camera;
    const [tx, ty, tz] = next.target;
    tween(cameraPosition, { x: cx, y: cy, z: cz, duration: MORPH_SECONDS + 0.4 });
    tween(cameraTarget, { x: tx, y: ty, z: tz, duration: MORPH_SECONDS + 0.4 });
    if (next.spin === 0) {
      const state = { angle: spinAngle };
      tween(state, {
        angle: nearestTurn(spinAngle),
        onUpdate: () => {
          spinAngle = state.angle;
        },
      });
    }
    if (next.roll === 0) {
      const state = { angle: rollAngle };
      tween(state, {
        angle: nearestTurn(rollAngle),
        onUpdate: () => {
          rollAngle = state.angle;
        },
      });
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const onVisibility = () => {
    if (document.hidden) pause();
    else play();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const canvas = renderer.domElement;
  const onLost = (event: Event) => {
    event.preventDefault();
    pause();
    options.onLost();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  if (options.reducedMotion) render();
  else play();

  return {
    show,
    setInstability(level) {
      worldInstability = level;
      const value = Math.max(config.instability, level);
      if (options.reducedMotion) {
        uniforms.uInstability.value = value;
        render();
      } else {
        tween(uniforms.uInstability, { value, duration: 0.8 });
      }
    },
    destroy() {
      for (const running of tweens.splice(0)) running.kill();
      pause();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
