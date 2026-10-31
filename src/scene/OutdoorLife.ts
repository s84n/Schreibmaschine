import * as THREE from 'three';

export type ParticleKind = 'birds' | 'snow' | 'leaves' | 'fireflies';

/** Was sich in einer Aussicht bewegt; Bereiche in v der Panoramatextur (0 unten, 1 oben). */
export interface ViewLife {
  /** Himmel beginnt oberhalb dieser Höhe: dort ziehen Wolken */
  sky?: number;
  water?: [number, number];
  foliage?: [number, number];
  stars?: boolean;
  particles?: ParticleKind;
}

const uniforms = {
  uLifeTime: { value: 0 },
  uLifeOn: { value: 1 },
  uSkyFrom: { value: 2 },
  uWaterRange: { value: new THREE.Vector2(2, 2) },
  uFoliageRange: { value: new THREE.Vector2(2, 2) },
  uStars: { value: 0 },
};

const LIFE_HEAD = /* glsl */ `
  uniform float uLifeTime, uLifeOn, uSkyFrom, uStars;
  uniform vec2 uWaterRange, uFoliageRange;
  float lifeHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float lifeNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(lifeHash(i), lifeHash(i + vec2(1, 0)), f.x), mix(lifeHash(i + vec2(0, 1)), lifeHash(i + vec2(1, 1)), f.x), f.y);
  }
  float lifeFbm(vec2 p) {
    return 0.55 * lifeNoise(p) + 0.3 * lifeNoise(p * 2.1 + 3.7) + 0.15 * lifeNoise(p * 4.3 + 9.1);
  }
  float lifeBand(float v, vec2 r) {
    return smoothstep(r.x, r.x + 0.02, v) * smoothstep(r.y, r.y - 0.02, v);
  }
`;

// Bis das erste Bild geladen ist, hat das Material noch keine Textur
const LIFE_MAP = /* glsl */ `
  #ifdef USE_MAP
  vec2 lifeUv = vMapUv;
  vec4 lifeBase = texture2D(map, lifeUv);
  vec2 lifeOff = vec2(0.0);
  vec3 lifeAdd = vec3(0.0);
  float lifeCloud = 0.0;
  if (uLifeOn > 0.5) {
    float t = uLifeTime;
    // Eine Einheit entspricht 10 Grad; das Band ist 360 x 60 Grad groß
    vec2 p = lifeUv * vec2(36.0, 6.0);
    float lum = dot(lifeBase.rgb, vec3(0.3, 0.55, 0.15));
    float gust = 0.4 + 0.6 * lifeNoise(vec2(p.x * 0.3 + t * 0.12, t * 0.07));

    float leaf = lifeBand(lifeUv.y, uFoliageRange);
    if (leaf > 0.0) {
      vec2 q = p * 5.0;
      lifeOff += leaf * gust * vec2(sin(t * 1.3 + lifeNoise(q) * 6.3), 0.6 * cos(t * 1.7 + lifeNoise(q + 7.0) * 6.3)) * vec2(0.00022, 0.0011);
    }

    float water = lifeBand(lifeUv.y, uWaterRange);
    if (water > 0.0) {
      // Wellen werden zum Betrachter hin größer
      float near = mix(2.0, 0.7, clamp((lifeUv.y - uWaterRange.x) / max(uWaterRange.y - uWaterRange.x, 0.01), 0.0, 1.0));
      vec2 q = vec2(p.x * 4.0 / near, p.y * 26.0 / near);
      float a = lifeNoise(q + vec2(t * 0.25, t * 0.5));
      float b = lifeNoise(q * 1.7 - vec2(t * 0.2, t * 0.6));
      lifeOff += water * near * (vec2(a, b) - 0.5) * vec2(0.0005, 0.0045);
      lifeAdd += water * lum * 0.35 * pow(a * b, 5.0) * vec3(1.0, 0.98, 0.92);
    }

    if (lifeUv.y > uSkyFrom) {
      // Nur Himmel, also blau oder hell und ungesättigt; Berge, Bäume und Häuser bleiben stehen
      vec3 c = lifeBase.rgb;
      float blue = smoothstep(0.0, 0.08, c.b - c.r);
      float pale = smoothstep(0.55, 0.75, lum) * smoothstep(0.12, 0.04, max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)));
      float sky = max(blue, pale) * smoothstep(uSkyFrom, uSkyFrom + 0.05, lifeUv.y);
      vec2 wind = vec2(t * 0.012, t * 0.002);
      vec2 s = vec2(p.x * 0.55, p.y * 1.3) + wind;
      lifeOff += sky * (vec2(lifeFbm(s * 1.6), lifeFbm(s * 1.6 + 5.0)) - 0.5) * vec2(0.002, 0.004);
      lifeCloud = sky * smoothstep(0.48, 0.74, lifeFbm(s + lifeFbm(s * 0.6 - wind) * 0.5)) * 0.42;
    }

    if (uStars > 0.5 && lifeUv.y > uSkyFrom + 0.04) {
      vec2 g = lifeUv * vec2(900.0, 150.0);
      float h = lifeHash(floor(g));
      float star = step(0.992, h) * smoothstep(0.42, 0.1, length(fract(g) - 0.5));
      lifeAdd += star * smoothstep(0.1, 0.2, lum) * (0.45 + 0.55 * sin(t * (1.0 + h * 2.0) + h * 90.0)) * vec3(0.9, 0.95, 1.0) * 0.7;
    }
  }
  vec4 sampledDiffuseColor = texture2D(map, lifeUv + lifeOff);
  sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.96, 0.97, 1.0), lifeCloud) + lifeAdd;
  diffuseColor *= sampledDiffuseColor;
  #endif
`;

/**
 * Erweckt das Panorama im Shader: ziehende Wolken, Wellen, Wind im Laub und funkelnde Sterne.
 * Die Naht des Bands (u = 0) muss hinter der Kamera liegen, dort springt das Rauschen.
 */
export function animatePanorama(mat: THREE.MeshBasicMaterial): void {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = LIFE_HEAD + shader.fragmentShader.replace('#include <map_fragment>', LIFE_MAP);
  };
}

const PARTICLE_VERT = /* glsl */ `
  attribute vec4 seed;
  uniform float uTime, uKind, uScale;
  varying float vSeed, vFlap, vTurn;
  const vec3 BOX = vec3(320.0, 130.0, 150.0);
  void main() {
    vec3 p = seed.xyz * BOX;
    float t = uTime;
    float size = 3.0;
    if (uKind < 0.5) {
      // Vögel: kleine Schwärme ziehen langsam quer durchs Bild
      float flock = floor(seed.w * 3.0);
      p = vec3(seed.x * 26.0 + t * (5.0 + flock) + flock * 110.0, 42.0 + flock * 13.0 + seed.y * 11.0 + sin(t * 0.3 + flock) * 3.0, -190.0 - flock * 30.0 + seed.z * 12.0);
      p.x = mod(p.x, 320.0) - 160.0;
      vFlap = sin(t * (6.0 + seed.w * 3.0) + seed.w * 40.0);
      size = 2.6;
    } else if (uKind < 1.5) {
      p.y = mod(p.y - t * (3.0 + seed.w * 3.0), BOX.y) - 25.0;
      p.x += sin(t * 0.5 + seed.w * 20.0) * 3.0;
      size = 0.6 + seed.w * 0.8;
    } else if (uKind < 2.5) {
      p.y = mod(p.y - t * (3.5 + seed.w * 2.5), BOX.y) - 25.0;
      p.x += sin(t * 0.7 + seed.w * 20.0) * 7.0 + t * 1.2;
      p.x = mod(p.x, BOX.x);
      vTurn = t * (1.0 + seed.w) + seed.w * 30.0;
      size = 1.8 + seed.w;
    } else {
      p.y = p.y * 0.2 - 10.0 + sin(t * 0.4 + seed.w * 30.0) * 3.0;
      p.x += sin(t * 0.3 + seed.w * 50.0) * 6.0;
      vFlap = 0.5 + 0.5 * sin(t * (0.8 + seed.w) + seed.w * 60.0);
      size = 0.9;
    }
    if (uKind > 0.5) p += vec3(-160.0, 0.0, -230.0);
    vSeed = seed.w;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uScale / -mv.z;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  uniform float uKind, uAlpha;
  varying float vSeed, vFlap, vTurn;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    vec3 col;
    float a;
    if (uKind < 0.5) {
      float wing = abs(c.x) * (0.75 * vFlap) + 0.0;
      a = smoothstep(0.075, 0.03, abs(c.y + wing)) * step(abs(c.x), 0.48);
      col = vec3(0.1, 0.1, 0.13);
    } else if (uKind < 1.5) {
      a = smoothstep(0.5, 0.1, length(c)) * 0.85;
      col = vec3(1.0);
    } else if (uKind < 2.5) {
      float s = sin(vTurn), k = cos(vTurn);
      vec2 r = vec2(k * c.x - s * c.y, s * c.x + k * c.y) * vec2(1.0, 0.35 + 1.4 * abs(sin(vTurn * 0.7)));
      a = smoothstep(0.42, 0.3, length(r) * 1.3);
      col = mix(vec3(0.85, 0.15, 0.08), vec3(1.0, 0.72, 0.2), vSeed);
    } else {
      a = pow(smoothstep(0.5, 0.0, length(c)), 2.5) * vFlap;
      col = vec3(1.0, 0.9, 0.45) * 1.6;
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a * uAlpha);
    #include <colorspace_fragment>
  }
`;

const KIND_INDEX: Record<ParticleKind, number> = { birds: 0, snow: 1, leaves: 2, fireflies: 3 };

/** Bewegliches vor dem Panorama; die Zimmerwand verdeckt es, zu sehen ist es nur durchs Fenster. */
export class OutdoorParticles {
  readonly points: THREE.Points;
  private readonly u = { uTime: { value: 0 }, uKind: { value: 0 }, uAlpha: { value: 0 }, uScale: { value: 1000 } };
  private kind?: ParticleKind;
  private readonly geometry = new THREE.BufferGeometry();

  constructor() {
    const count = 150;
    const seed = new Float32Array(count * 4).map(() => Math.random());
    this.geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.points = new THREE.Points(
      this.geometry,
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG, transparent: true, depthWrite: false }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  setKind(kind?: ParticleKind): void {
    this.kind = kind;
    this.points.visible = !!kind;
    if (!kind) return;
    this.u.uKind.value = KIND_INDEX[kind];
    this.geometry.setDrawRange(0, kind === 'birds' ? 16 : kind === 'leaves' ? 70 : 150);
  }

  /** Vögel gibt es nur am trockenen Tag; Glühwürmchen stören sich weder an Nacht noch Regen. */
  setLight(fade: number, night: number, rain: number): void {
    const k = this.kind === 'birds' ? (1 - night) * (1 - rain) : this.kind === 'fireflies' ? 1 - rain : 1 - 0.6 * night;
    this.u.uAlpha.value = fade * k;
  }

  update(dt: number, viewportHeight: number): void {
    this.u.uTime.value += dt;
    this.u.uScale.value = viewportHeight * 1.6;
  }
}

/** Stellt den Shader auf die Aussicht ein. */
export function setPanoramaLife(life: ViewLife | undefined): void {
  uniforms.uSkyFrom.value = life?.sky ?? 2;
  uniforms.uWaterRange.value.set(...(life?.water ?? [2, 2]));
  uniforms.uFoliageRange.value.set(...(life?.foliage ?? [2, 2]));
  uniforms.uStars.value = life?.stars ? 1 : 0;
}

export function setPanoramaMotion(on: boolean): void {
  uniforms.uLifeOn.value = on ? 1 : 0;
}

export function tickPanorama(dt: number): void {
  uniforms.uLifeTime.value += dt;
}
