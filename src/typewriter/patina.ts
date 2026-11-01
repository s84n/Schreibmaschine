import * as THREE from 'three';

/** Kantenlänge der Gebrauchsspuren-Kachel in Texeln. */
const SIZE = 512;
/** Eine Kachel deckt 14 Einheiten (cm) der Maschine ab. */
const TILE_SCALE = 1 / 14;

/** Fester Zufall: Die Maschine trägt nach jedem Laden dieselben Spuren. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kachelbares Wolkenrauschen im Bereich 0–1. */
function cloudNoise(seed: number, startCells: number, octaves: number): Float32Array {
  const random = seeded(seed);
  const out = new Float32Array(SIZE * SIZE);
  let amplitude = 1;
  let total = 0;
  let cells = startCells;
  for (let o = 0; o < octaves; o++) {
    const grid = new Float32Array(cells * cells).map(() => random());
    for (let y = 0; y < SIZE; y++) {
      const gy = (y / SIZE) * cells;
      const y0 = Math.floor(gy);
      const y1 = (y0 + 1) % cells;
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < SIZE; x++) {
        const gx = (x / SIZE) * cells;
        const x0 = Math.floor(gx);
        const x1 = (x0 + 1) % cells;
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const top = grid[y0 * cells + x0] * (1 - sx) + grid[y0 * cells + x1] * sx;
        const bottom = grid[y1 * cells + x0] * (1 - sx) + grid[y1 * cells + x1] * sx;
        out[y * SIZE + x] += (top * (1 - sy) + bottom * sy) * amplitude;
      }
    }
    total += amplitude;
    amplitude *= 0.55;
    cells *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Feine Kratzer; jede Linie wird neunmal versetzt gezeichnet, damit die Kachel nahtlos bleibt. */
function scratchLayer(seed: number): Uint8ClampedArray {
  const random = seeded(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = random() * SIZE;
    const y = random() * SIZE;
    const angle = random() * Math.PI * 2;
    const length = 15 + random() ** 2 * 170;
    const bend = (random() - 0.5) * length * 0.25;
    const ex = Math.cos(angle) * length;
    const ey = Math.sin(angle) * length;
    const light = Math.round(70 + random() * 185);
    ctx.strokeStyle = `rgb(${light},${light},${light})`;
    ctx.lineWidth = 0.5 + random() * 0.8;
    for (let ox = -SIZE; ox <= SIZE; ox += SIZE) {
      for (let oy = -SIZE; oy <= SIZE; oy += SIZE) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(x + ox + ex / 2 - ey / length * bend, y + oy + ey / 2 + ex / length * bend, x + ox + ex, y + oy + ey);
        ctx.stroke();
      }
    }
  }
  return ctx.getImageData(0, 0, SIZE, SIZE).data;
}

let shared: THREE.DataTexture | null = null;

/** R: Anlaufwolken, G: Kratzer, B: feine Poren, A: großflächige Abplatzungen. */
function patinaTexture(): THREE.DataTexture {
  if (shared) return shared;
  const clouds = cloudNoise(11, 4, 5);
  const pores = cloudNoise(23, 96, 2);
  const chips = cloudNoise(37, 10, 5);
  const scratches = scratchLayer(41);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = clouds[i] * 255;
    data[i * 4 + 1] = scratches[i * 4];
    data[i * 4 + 2] = pores[i] * 255;
    data[i * 4 + 3] = chips[i] * 255;
  }
  shared = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.minFilter = THREE.LinearMipmapLinearFilter;
  shared.magFilter = THREE.LinearFilter;
  shared.generateMipmaps = true;
  shared.anisotropy = 4;
  shared.needsUpdate = true;
  return shared;
}

export interface PatinaOptions {
  /** Abdunklung in den Anlaufwolken, 0–1. */
  grime: number;
  /** Farbe und Stärke des Anlaufens. */
  tarnish: string;
  tarnishAmount: number;
  /** Farbe und Stärke der Poren (Rostpunkte, Lochfraß). */
  pit: string;
  pitAmount: number;
  /** Farbe und Stärke der Kratzer. */
  scratch: string;
  scratchAmount: number;
  /** Rauheit: Untergrenze und Zuwachs in den Anlaufwolken. */
  roughnessMin: number;
  roughnessAdd: number;
  /** Prägetiefe der Oberfläche in Einheiten. */
  bump: number;
  /** Abgeplatzter Lack: Fläche 0–1 und freigelegtes Blech (nur Lack). */
  chip?: number;
  bare?: string;
  /** Rest des Klarlacks, 0–1; 0 auf matten Stellen. */
  coat?: number;
}

/**
 * Legt Gebrauchsspuren über ein Material: Anlaufen, Kratzer, Poren und beim Lack abgeplatzte Stellen.
 * Die Kachel wird dreiseitig über die Objektkoordinaten projiziert, weil Box- und Extrude-Geometrie
 * keine brauchbaren UVs mitbringen und `mergeStatic` nur Position, Normale und UV erhält.
 */
export function applyPatina(material: THREE.MeshStandardMaterial, options: PatinaOptions): void {
  const uniforms = {
    uPatinaMap: { value: patinaTexture() },
    uPatinaScale: { value: TILE_SCALE },
    uPatinaGrime: { value: options.grime },
    uPatinaTarnish: { value: new THREE.Color(options.tarnish) },
    uPatinaTarnishAmount: { value: options.tarnishAmount },
    uPatinaPit: { value: new THREE.Color(options.pit) },
    uPatinaPitAmount: { value: options.pitAmount },
    uPatinaScratch: { value: new THREE.Color(options.scratch) },
    uPatinaScratchAmount: { value: options.scratchAmount },
    uPatinaRoughMin: { value: options.roughnessMin },
    uPatinaRoughAdd: { value: options.roughnessAdd },
    uPatinaBump: { value: options.bump },
    uPatinaChip: { value: options.chip ?? 0 },
    uPatinaBare: { value: new THREE.Color(options.bare ?? '#000000') },
    uPatinaCoat: { value: options.coat ?? 1 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPatinaPos;\nvarying vec3 vPatinaNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPatinaPos = position;\nvPatinaNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vPatinaPos;
        varying vec3 vPatinaNormal;
        uniform sampler2D uPatinaMap;
        uniform float uPatinaScale, uPatinaGrime, uPatinaTarnishAmount, uPatinaPitAmount, uPatinaScratchAmount;
        uniform float uPatinaRoughMin, uPatinaRoughAdd, uPatinaBump, uPatinaChip, uPatinaCoat;
        uniform vec3 uPatinaTarnish, uPatinaPit, uPatinaScratch, uPatinaBare;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 patinaAxis = normalize(vPatinaNormal);
        vec3 patinaWeight = pow(abs(patinaAxis), vec3(4.0));
        patinaWeight /= patinaWeight.x + patinaWeight.y + patinaWeight.z;
        vec3 patinaUv = vPatinaPos * uPatinaScale;
        vec4 patinaTex = texture2D(uPatinaMap, patinaUv.zy) * patinaWeight.x
          + texture2D(uPatinaMap, patinaUv.xz + 0.37) * patinaWeight.y
          + texture2D(uPatinaMap, patinaUv.xy + 0.71) * patinaWeight.z;
        float patinaCloud = smoothstep(0.3, 0.7, patinaTex.r);
        // Poren häufen sich dort, wo die Oberfläche ohnehin angelaufen ist
        float patinaPit = smoothstep(0.64, 0.78, patinaTex.b) * patinaCloud;
        // Schräge Flächen sitzen auf den Fasen der Gehäusekanten: Dort reibt sich der Lack zuerst ab
        float patinaEdge = 2.0 * abs(patinaAxis.x) * sqrt(max(0.0, 1.0 - patinaAxis.x * patinaAxis.x));
        float patinaChip = uPatinaChip > 0.0
          ? smoothstep(0.0, 0.025, patinaTex.a + patinaTex.b * 0.12 + smoothstep(0.25, 0.8, patinaEdge) * 0.16 + uPatinaChip - 0.9)
          : 0.0;
        diffuseColor.rgb *= 1.0 - uPatinaGrime * patinaCloud;
        diffuseColor.rgb = mix(diffuseColor.rgb, uPatinaTarnish, uPatinaTarnishAmount * patinaCloud);
        diffuseColor.rgb = mix(diffuseColor.rgb, uPatinaPit, uPatinaPitAmount * patinaPit);
        diffuseColor.rgb = mix(diffuseColor.rgb, uPatinaScratch, uPatinaScratchAmount * patinaTex.g);
        diffuseColor.rgb = mix(diffuseColor.rgb, uPatinaBare, patinaChip);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = max(roughnessFactor, uPatinaRoughMin) + uPatinaRoughAdd * patinaCloud + 0.2 * patinaPit * uPatinaPitAmount;`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        /* glsl */ `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.9, patinaChip);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          float patinaHeight = (patinaTex.r * 0.5 + patinaTex.b * 0.5 - patinaTex.g * 0.35 - patinaChip * 0.4) * uPatinaBump;
          vec3 patinaDx = dFdx(-vViewPosition);
          vec3 patinaDy = dFdy(-vViewPosition);
          vec3 patinaR1 = cross(patinaDy, normal);
          vec3 patinaR2 = cross(normal, patinaDx);
          float patinaDet = dot(patinaDx, patinaR1) * faceDirection;
          vec3 patinaGrad = sign(patinaDet) * (dFdx(patinaHeight) * patinaR1 + dFdy(patinaHeight) * patinaR2);
          normal = normalize(abs(patinaDet) * normal - patinaGrad);
        }`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        /* glsl */ `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat *= uPatinaCoat * (1.0 - patinaChip) * (1.0 - 0.6 * patinaCloud);
        #endif`,
      );
  };
  material.customProgramCacheKey = () => 'patina';
}
