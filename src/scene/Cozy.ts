import * as THREE from 'three';
import { rng } from '../paper/InkCanvas';

let glowTex: THREE.Texture | undefined;
/** Weicher, runder Lichthof für Kerze, Lichterkette und Dampf. */
export function softTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

const shadowed = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true;
  });
  return o;
};

const FLAME_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    float y = vUv.y;
    float x = (vUv.x - 0.5) * 2.0;
    x += (sin(uTime * 7.0) * 0.07 + sin(uTime * 13.0 + 1.5) * 0.05) * y * y * 2.0;
    float w = 0.62 * pow(max(y, 0.0), 0.5) * pow(max(1.0 - y, 0.0), 0.75) * 1.7;
    float d = abs(x) / max(w, 0.001);
    float body = smoothstep(1.0, 0.25, d) * smoothstep(0.0, 0.05, y);
    vec3 edge = vec3(1.0, 0.36, 0.06);
    vec3 core = vec3(1.0, 0.86, 0.55);
    vec3 col = mix(edge, core, smoothstep(0.85, 0.15, d) * smoothstep(0.98, 0.45, y));
    col = mix(vec3(0.16, 0.26, 0.9), col, smoothstep(0.03, 0.26, y));
    gl_FragColor = vec4(col * body * uPower, body);
    #include <colorspace_fragment>
  }
`;

/** Brennende Kerze im Messinghalter. Ursprung = Tischplatte. */
export class Candle {
  readonly group = new THREE.Group();
  readonly light = new THREE.PointLight('#ffb066', 0, 170, 1.6);
  private readonly flame: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly wax: THREE.MeshPhysicalMaterial;
  private readonly uniforms = { uTime: { value: 0 }, uPower: { value: 3.2 } };
  private night = 0;
  private time = 0;

  constructor() {
    const brass = new THREE.MeshStandardMaterial({ color: '#b08a45', metalness: 1, roughness: 0.32 });
    const dish = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[0, 0], [4.6, 0], [5.2, 0.5], [5.3, 1.0], [4.9, 0.9], [1.9, 0.6], [1.75, 2.0], [1.5, 2.0], [1.45, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)),
        40,
      ),
      brass,
    );
    this.group.add(dish);

    // Wachs: Verlauf nach oben als Emissive – das Licht scheint durch die Kerze
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#ffb060');
    grad.addColorStop(0.28, '#8f4a1c');
    grad.addColorStop(0.7, '#000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 128);
    const emissiveMap = new THREE.CanvasTexture(c);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    this.wax = new THREE.MeshPhysicalMaterial({ color: '#f2e6cf', roughness: 0.55, sheen: 0.4, emissive: '#ffffff', emissiveMap, emissiveIntensity: 0 });
    const H = 9;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.5, H, 32), this.wax);
    candle.position.y = 2 + H / 2 - 1.2;
    this.group.add(candle);
    const top = 2 + H - 1.2;

    // Mulde und Wachstropfen
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshPhysicalMaterial({ color: '#ffe3b0', roughness: 0.1, clearcoat: 1 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = top + 0.01;
    this.group.add(pool);
    const r = rng(77);
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      const len = 0.8 + r() * 3.2;
      const drip = new THREE.Mesh(new THREE.CapsuleGeometry(0.17 + r() * 0.08, len, 4, 8), this.wax);
      drip.position.set(Math.cos(a) * 1.46, top - len / 2 - 0.2, Math.sin(a) * 1.46);
      this.group.add(drip);
    }
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), new THREE.MeshStandardMaterial({ color: '#191411', roughness: 1 }));
    wick.position.y = top + 0.4;
    wick.rotation.z = 0.12;
    this.group.add(wick);
    shadowed(this.group);

    this.flame = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 4.2),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: FLAME_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.flame.position.y = top + 2.05;
    this.flame.castShadow = false;
    this.flame.visible = false;

    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: softTexture(), color: '#ff9a42', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }),
    );
    this.glow.position.y = top + 1.6;
    this.glow.visible = false;

    this.light.position.y = top + 3.2;
    this.light.shadow.mapSize.setScalar(512);
    this.light.shadow.camera.near = 1;
    this.light.shadow.camera.far = 140;
    this.light.shadow.bias = -0.002;
    this.light.shadow.normalBias = 0.05;
    this.group.add(this.flame, this.glow, this.light);
  }

  setNight(n: number): void {
    this.night = n;
    const lit = n > 0.02;
    this.flame.visible = lit;
    this.glow.visible = lit;
    if (!lit) this.light.intensity = 0;
    this.wax.emissiveIntensity = n * 0.75;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.time += dt;
    const t = this.time;
    this.uniforms.uTime.value = t;
    if (this.night <= 0.02) return;
    // Überlagerte Schwingungen plus seltenes Aufflackern
    const flick = 0.86 + 0.08 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 17.3 + 1) + 0.04 * Math.sin(t * 31.7) + 0.1 * Math.max(0, Math.sin(t * 1.3)) ** 12;
    this.light.intensity = 620 * this.night * flick;
    this.light.position.x = Math.sin(t * 11) * 0.14;
    this.light.position.z = Math.cos(t * 13) * 0.14;
    const size = 15 * flick;
    this.glow.scale.set(size, size, 1);
    (this.glow.material as THREE.SpriteMaterial).opacity = 0.42 * this.night * flick;
    this.uniforms.uPower.value = 3.2 * this.night;
    // Flamme dreht sich nur um die Hochachse zur Kamera
    const p = this.group.position;
    this.flame.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
  }
}

/** Aufsteigender Dampf über der Tasse. Ursprung = Kaffeeoberfläche. */
export class Steam {
  readonly group = new THREE.Group();
  private readonly puffs: { s: THREE.Sprite; phase: number; drift: number }[] = [];
  private time = 0;

  constructor() {
    const r = rng(5);
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: '#ffffff', transparent: true, depthWrite: false, opacity: 0 }));
      this.puffs.push({ s, phase: i / 7, drift: r() * Math.PI * 2 });
      this.group.add(s);
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const p of this.puffs) {
      const f = (this.time * 0.14 + p.phase) % 1;
      p.s.position.set(Math.sin(f * 5 + p.drift) * (0.4 + f * 1.6), f * 15, Math.cos(f * 4 + p.drift) * f);
      p.s.scale.setScalar(1.8 + f * 5.5);
      (p.s.material as THREE.SpriteMaterial).opacity = 0.13 * Math.sin(Math.PI * f) ** 1.5;
    }
  }
}

/** Lichterkette in zwei Bögen; nachts leuchten die Birnchen samt Lichthof. */
export class FairyLights {
  readonly group = new THREE.Group();
  private readonly bulbs: THREE.InstancedMesh;
  private readonly glow: THREE.PointsMaterial;
  private readonly bulbMat = new THREE.MeshBasicMaterial({ color: '#6b5a42', toneMapped: false });
  private readonly fill = new THREE.PointLight('#ffb36b', 0, 110, 1.5);

  constructor(x0: number, x1: number, y: number, z: number) {
    const pts: THREE.Vector3[] = [];
    const N = 34;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const swag = Math.sin(t * Math.PI * 2 % Math.PI) * 4.5;
      pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - swag, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.07, 5), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.8 }));
    this.group.add(wire);

    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), this.bulbMat, N - 1);
    const m = new THREE.Matrix4();
    const pos = new Float32Array((N - 1) * 3);
    for (let i = 1; i < N; i++) {
      m.makeTranslation(pts[i].x, pts[i].y - 0.45, pts[i].z);
      this.bulbs.setMatrixAt(i - 1, m);
      pos.set([pts[i].x, pts[i].y - 0.45, pts[i].z + 0.3], (i - 1) * 3);
    }
    this.group.add(this.bulbs);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.glow = new THREE.PointsMaterial({ map: softTexture(), color: '#ffb066', size: 5.5, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.group.add(new THREE.Points(geo, this.glow));

    this.fill.position.set((x0 + x1) / 2, y - 6, z + 8);
    this.group.add(this.fill);
  }

  setNight(n: number): void {
    const dim = new THREE.Color('#6b5a42');
    this.bulbMat.color.copy(dim).lerp(new THREE.Color(2.6, 1.7, 0.85), n);
    this.glow.opacity = 0.85 * n;
    this.glow.visible = n > 0.02;
    this.fill.intensity = 170 * n;
  }
}

/** Gefalteter Vorhang. Ursprung = obere Mitte, hängt nach unten. */
export function buildCurtain(width: number, height: number, seed: number): THREE.Mesh {
  const r = rng(seed);
  const geo = new THREE.PlaneGeometry(width, height, 72, 10);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const ph = r() * 6;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const v = (pos.getY(i) + height / 2) / height;
    pos.setZ(i, Math.sin(x * 1.75 + ph) * (1 + (1 - v) * 0.5) + Math.sin(x * 0.7 + ph * 2) * 0.5);
  }
  geo.translate(0, -height / 2, 0);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: 0.95, side: THREE.DoubleSide }));
  // Keine empfangenen Schatten: die Kerzen-Cubemap zeichnet sonst harte Streifen in die Falten
  m.castShadow = true;
  return m;
}

/** Stapel liegender Bücher. Ursprung = Tischplatte. */
export function buildBookStack(seed: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const colors = ['#6a2a26', '#27415e', '#3e5a3f', '#8a6a3a'];
  const pages = new THREE.MeshStandardMaterial({ color: '#e8dfca', roughness: 0.95 });
  let y = 0;
  for (let i = 0; i < 3; i++) {
    const h = 1.8 + r() * 1.2;
    const w = 19 - i * 2 + r();
    const d = 13 - i + r();
    const cover = new THREE.MeshStandardMaterial({ color: colors[Math.floor(r() * colors.length)], roughness: 0.7 });
    const book = new THREE.Group();
    for (const dy of [0.11, h - 0.11]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), cover);
      board.position.y = dy;
      book.add(board);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, d), cover);
    spine.position.set(-w / 2, h / 2, 0);
    const block = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, h - 0.44, d - 0.4), pages);
    block.position.y = h / 2;
    book.add(spine, block);
    book.position.y = y;
    book.rotation.y = (r() - 0.5) * 0.35;
    g.add(book);
    y += h;
  }
  return shadowed(g);
}

/** Becher mit Bleistiften. Ursprung = Tischplatte. */
export function buildPencilCup(seed: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(3.3, 3.1, 9, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: '#3d4a43', roughness: 0.6, side: THREE.DoubleSide }),
  );
  cup.position.y = 4.5;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(3.1, 32), new THREE.MeshStandardMaterial({ color: '#2a332e' }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.3;
  g.add(cup, bottom);
  const paints = ['#d8a53a', '#b5402f', '#2f5c86', '#d8a53a', '#2d6b49', '#1e1e1e'];
  const wood = new THREE.MeshStandardMaterial({ color: '#d9b98a', roughness: 0.8 });
  paints.forEach((color, i) => {
    const pencil = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 15, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 6), wood);
    tip.position.y = 8.05;
    pencil.add(body, tip);
    const a = (i / paints.length) * Math.PI * 2 + r();
    pencil.position.set(Math.cos(a) * 1.5, 7.8, Math.sin(a) * 1.5);
    pencil.rotation.set(Math.sin(a) * 0.2, r() * 3, -Math.cos(a) * 0.2);
    g.add(pencil);
  });
  return shadowed(g);
}

/** Papierstapel mit leicht versetzten Blättern. Ursprung = Tischplatte. */
export function buildPaperStack(seed: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#efe9da', roughness: 0.95 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(21, 1.1, 29.7), mat);
  block.position.y = 0.55;
  g.add(block);
  for (let i = 0; i < 4; i++) {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(21, 0.04, 29.7), mat);
    sheet.position.set((r() - 0.5) * 0.7, 1.12 + i * 0.05, (r() - 0.5) * 0.7);
    sheet.rotation.y = (r() - 0.5) * 0.05;
    g.add(sheet);
  }
  return shadowed(g);
}

const RAIN_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uRain;
  uniform float uLight;
  uniform vec2 uSize;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Herablaufende Tropfen mit Spur in einem Raster; x = Deckung, y = Schattierung
  vec2 drops(vec2 cm, float cell, float t) {
    vec2 aspect = vec2(2.0, 1.0);
    vec2 uv = cm / cell * aspect;
    uv.y += t * 0.25;
    vec2 gv = fract(uv) - 0.5;
    vec2 id = floor(uv);
    float n = hash(id);
    if (n < 0.35) return vec2(0.0, 0.5);
    t += n * 6.2831;
    float w = cm.y * 0.35;
    float x = (n - 0.5) * 0.7;
    x += (0.35 - abs(x)) * sin(3.0 * w) * pow(abs(sin(w)), 6.0) * 0.4;
    float y = -sin(t + sin(t + sin(t) * 0.5)) * 0.42;
    y -= (gv.x - x) * (gv.x - x);
    vec2 d = (gv - vec2(x, y)) / aspect;
    d.y *= 0.72;
    float drop = smoothstep(0.052, 0.034, length(d));
    vec2 tp = (gv - vec2(x, t * 0.25)) / aspect;
    tp.y = (fract(tp.y * 7.0) - 0.5) / 7.0;
    float trail = smoothstep(0.03, 0.012, length(tp));
    float above = smoothstep(-0.04, 0.04, d.y) * smoothstep(0.5, y, gv.y);
    return vec2(max(drop, trail * above * 0.7), 0.5 - d.y * 10.0);
  }

  void main() {
    vec2 cm = vUv * uSize;
    vec2 a = drops(cm, 7.0, uTime * 1.3);
    vec2 b = drops(cm * 1.35 + 11.0, 5.0, uTime * 1.0);
    float cover = max(a.x, b.x);
    float shade = a.x > b.x ? a.y : b.y;
    // Feine Regenfäden draußen
    vec2 s = vec2(cm.x * 3.2 + cm.y * 0.2, cm.y * 0.07 + uTime * 3.2);
    float line = step(0.96, hash(floor(s))) * smoothstep(0.0, 0.25, fract(s.y)) * smoothstep(1.0, 0.6, fract(s.y));
    // Tropfen sind Linsen: fast durchsichtig, oben dunkler, unten ein schmaler heller Rand
    float sh = clamp(shade, 0.0, 1.0);
    vec3 lens = mix(vec3(0.1, 0.12, 0.15), vec3(0.8, 0.84, 0.9), sh);
    float lensAlpha = cover * (0.1 + 0.42 * abs(sh - 0.5) * 2.0);
    float mist = 0.1 + line * 0.09;
    float alpha = lensAlpha + mist * (1.0 - lensAlpha);
    vec3 col = (lens * lensAlpha + vec3(0.72, 0.76, 0.82) * mist * (1.0 - lensAlpha)) / max(alpha, 0.001);
    gl_FragColor = vec4(col * uLight, alpha * uRain);
    #include <colorspace_fragment>
  }
`;

/** Regen auf der Fensterscheibe: Tropfen, Spuren, Beschlag und Fäden, rein prozedural. */
export function buildRainGlass(w: number, h: number) {
  const uniforms = { uTime: { value: 0 }, uRain: { value: 0 }, uLight: { value: 1 }, uSize: { value: new THREE.Vector2(w, h) } };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.visible = false;
  return { mesh, uniforms };
}
