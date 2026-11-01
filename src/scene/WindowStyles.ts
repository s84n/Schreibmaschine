import * as THREE from 'three';
import { rng } from '../paper/InkCanvas';
import { mergeStatic } from './merge';

export type WindowStyleId = 'panorama' | 'sprossen' | 'rundbogen' | 'spitzbogen' | 'rund';

/** Fensterausschnitt in der Wand (Brüstung knapp über der Tischplatte) */
export const WIN = { x0: -70, x1: 70, y0: 2.6, y1: 66 };

const FRAME = 2.4;
const FRAME_DEPTH = 2.2;
/** Wanddicke: So tief ist die Laibung um jede Öffnung. */
const REVEAL_DEPTH = 8;
/** Maßstab der Putztextur, wie bei den übrigen Wandflächen. */
const WALL_TILE = 60;

interface Opening {
  kind: 'rect' | 'arch' | 'pointed' | 'circle';
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Senkrechte und waagerechte Sprossen (absolute Lage) */
  v?: number[];
  h?: number[];
  /** Stärke dieser Sprossen */
  bar?: number;
  /** Speichen von `from` (Anteil des Radius) bis zum Rand, Winkel in Grad; Mitte ist Bogen- oder Kreismitte */
  spokes?: { angles: number[]; from: number };
  /** Innerer Ring im Rundfenster, Anteil des Radius */
  ring?: number;
}

export interface WindowStyle {
  openings: Opening[];
  /** Vorhänge passen nicht zu jedem Fenster */
  curtains: boolean;
  /** Lichtstrahlen müssen in einer Öffnung beginnen */
  shaftX: number;
}

const row = (count: number, width: number, gap: number, make: (x0: number, x1: number) => Opening): Opening[] =>
  Array.from({ length: count }, (_, i) => {
    const x0 = -(count * width + (count - 1) * gap) / 2 + i * (width + gap);
    return make(x0, x0 + width);
  });

const panoramaWidth = WIN.x1 - WIN.x0;
const height = WIN.y1 - WIN.y0;

export const WINDOW_STYLES: Record<WindowStyleId, WindowStyle> = {
  // Drei große Scheiben, darüber ein schmales Oberlicht
  panorama: {
    openings: [{ kind: 'rect', ...WIN, v: [-panoramaWidth / 6, panoramaWidth / 6], h: [WIN.y0 + height * 0.8], bar: 2.6 }],
    curtains: true,
    shaftX: 0,
  },
  // Altbau: drei Flügel mit Kreuzsprossen und Pfeilern dazwischen
  sprossen: {
    openings: row(3, 42, 6, (x0, x1) => ({
      kind: 'rect', x0, x1, y0: WIN.y0, y1: WIN.y1,
      v: [(x0 + x1) / 2],
      h: [WIN.y0 + height / 4, WIN.y0 + height / 2, WIN.y0 + (height * 3) / 4],
      bar: 1,
    })),
    curtains: true,
    shaftX: 0,
  },
  // Rundbögen mit Fächer im Bogenfeld
  rundbogen: {
    openings: row(3, 40, 6, (x0, x1) => ({
      kind: 'arch', x0, x1, y0: WIN.y0, y1: WIN.y1,
      v: [(x0 + x1) / 2],
      h: [WIN.y1 - 20, WIN.y0 + (WIN.y1 - 20 - WIN.y0) / 2],
      bar: 1.1,
      spokes: { angles: [45, 135], from: 0 },
    })),
    curtains: true,
    shaftX: 0,
  },
  // Spitzbögen, wie sie im Mittelmeerraum und im Orient üblich sind
  spitzbogen: {
    openings: row(3, 38, 7, (x0, x1) => ({
      kind: 'pointed', x0, x1, y0: WIN.y0, y1: WIN.y1,
      v: [(x0 + x1) / 2],
      h: [WIN.y1 - 38 * 0.866, WIN.y0 + (WIN.y1 - 38 * 0.866 - WIN.y0) / 2],
      bar: 1.1,
    })),
    curtains: true,
    shaftX: 0,
  },
  // Rundfenster mit Ring und Speichen
  rund: {
    openings: [{
      kind: 'circle', x0: -height / 2, x1: height / 2, y0: WIN.y0, y1: WIN.y1,
      v: [0], h: [(WIN.y0 + WIN.y1) / 2],
      bar: 1.1,
      ring: 0.45,
      spokes: { angles: [45, 135, 225, 315], from: 0.45 },
    }],
    curtains: false,
    shaftX: 17,
  },
};

/** Umriss einer Öffnung, um `inset` nach innen versetzt. */
function outline(o: Opening, inset: number): THREE.Shape {
  const s = new THREE.Shape();
  const { x0, x1, y0, y1 } = o;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  if (o.kind === 'circle') {
    s.absarc(cx, (y0 + y1) / 2, w / 2 - inset, 0, Math.PI * 2, false);
    return s;
  }
  s.moveTo(x0 + inset, y0 + inset);
  s.lineTo(x1 - inset, y0 + inset);
  if (o.kind === 'rect') {
    s.lineTo(x1 - inset, y1 - inset);
    s.lineTo(x0 + inset, y1 - inset);
  } else if (o.kind === 'arch') {
    s.absarc(cx, y1 - w / 2, w / 2 - inset, 0, Math.PI, false);
  } else {
    // Zwei Kreisbögen um den jeweils gegenüberliegenden Kämpferpunkt
    const spring = y1 - w * 0.866;
    const r = w - inset;
    const a = Math.acos(w / 2 / r);
    s.lineTo(x1 - inset, spring);
    s.absarc(x0, spring, r, 0, a, false);
    s.absarc(x1, spring, r, Math.PI - a, Math.PI, false);
  }
  s.closePath();
  return s;
}

/** Mittelpunkt und Radius des runden Teils einer Öffnung. */
function arcCenter(o: Opening): { x: number; y: number; r: number } {
  const r = (o.x1 - o.x0) / 2;
  return { x: (o.x0 + o.x1) / 2, y: o.kind === 'circle' ? (o.y0 + o.y1) / 2 : o.y1 - r, r };
}

function contains(o: Opening, x: number, y: number): boolean {
  if (x < o.x0 || x > o.x1 || y < o.y0 || y > o.y1) return false;
  const w = o.x1 - o.x0;
  const c = arcCenter(o);
  if (o.kind === 'rect') return true;
  if (o.kind === 'circle') return Math.hypot(x - c.x, y - c.y) <= c.r;
  if (o.kind === 'arch') return y <= c.y || Math.hypot(x - c.x, y - c.y) <= c.r;
  const spring = o.y1 - w * 0.866;
  return y <= spring || (Math.hypot(x - o.x0, y - spring) <= w && Math.hypot(x - o.x1, y - spring) <= w);
}

/** Abschnitt einer Sprosse innerhalb der Öffnung, entlang der Strecke von a nach b. */
function clip(o: Opening, ax: number, ay: number, bx: number, by: number): [number, number] {
  let first = 1;
  let last = 0;
  const STEPS = 240;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    if (contains(o, ax + (bx - ax) * t, ay + (by - ay) * t)) {
      first = Math.min(first, t);
      last = Math.max(last, t);
    }
  }
  return [first, last];
}

/** Alle Sprossen einer Öffnung als Strecken. */
function barLines(o: Opening): [number, number, number, number][] {
  const lines: [number, number, number, number][] = [];
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const [t0, t1] = clip(o, ax, ay, bx, by);
    if (t1 > t0) lines.push([ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1]);
  };
  const c = arcCenter(o);
  const hasRing = o.ring !== undefined;
  for (const x of o.v ?? []) {
    if (hasRing) {
      add(x, o.y0, x, c.y - c.r * o.ring!);
      add(x, c.y + c.r * o.ring!, x, o.y1);
    } else add(x, o.y0, x, o.y1);
  }
  for (const y of o.h ?? []) {
    if (hasRing) {
      add(o.x0, y, c.x - c.r * o.ring!, y);
      add(c.x + c.r * o.ring!, y, o.x1, y);
    } else add(o.x0, y, o.x1, y);
  }
  for (const deg of o.spokes?.angles ?? []) {
    const a = THREE.MathUtils.degToRad(deg);
    const from = o.spokes!.from * c.r;
    add(c.x + Math.cos(a) * from, c.y + Math.sin(a) * from, c.x + Math.cos(a) * c.r * 1.01, c.y + Math.sin(a) * c.r * 1.01);
  }
  return lines;
}

/** Baut Wandfüllung, Laibung, Rahmen und Sprossen einer Fensterart. Die Scheibe liegt dahinter und bleibt gemeinsam. */
export function buildWindowStyle(style: WindowStyle, wall: THREE.Material, wallZ: number): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#ece4d4', roughness: 0.55 });
  const reveal = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.95 });
  const z = wallZ - 6;

  // Wandstück um die Öffnungen; beim Panoramafenster füllt die Öffnung die ganze Fläche
  const filled = style.openings.length > 1 || style.openings[0].kind !== 'rect' || style.openings[0].x0 > WIN.x0;
  if (filled) {
    const plate = new THREE.Shape();
    plate.moveTo(WIN.x0, WIN.y0);
    plate.lineTo(WIN.x1, WIN.y0);
    plate.lineTo(WIN.x1, WIN.y1);
    plate.lineTo(WIN.x0, WIN.y1);
    plate.closePath();
    for (const o of style.openings) plate.holes.push(outline(o, 0));
    const geo = new THREE.ExtrudeGeometry(plate, { depth: REVEAL_DEPTH, bevelEnabled: false, curveSegments: 48 });
    // Die Stirnseite bekommt dieselben Weltmaß-UVs wie die Wand, damit der Putz ohne Naht durchläuft
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / WALL_TILE, uv.getY(i) / WALL_TILE);
    const m = new THREE.Mesh(geo, [wall, reveal]);
    m.position.z = wallZ - REVEAL_DEPTH;
    m.receiveShadow = true;
    g.add(m);
  }

  for (const o of style.openings) {
    const frame = outline(o, 0);
    frame.holes.push(outline(o, FRAME));
    const frameGeo = new THREE.ExtrudeGeometry(frame, { depth: FRAME_DEPTH, bevelEnabled: false, curveSegments: 48 });
    const frameMesh = new THREE.Mesh(frameGeo, paint);
    frameMesh.position.z = z - FRAME_DEPTH / 2;
    frameMesh.castShadow = true;
    g.add(frameMesh);

    if (o.ring !== undefined) {
      const c = arcCenter(o);
      const ring = new THREE.Shape();
      ring.absarc(c.x, c.y, c.r * o.ring + 0.55, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(c.x, c.y, c.r * o.ring - 0.55, 0, Math.PI * 2, true);
      ring.holes.push(hole);
      const ringMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: FRAME_DEPTH, bevelEnabled: false, curveSegments: 48 }), paint);
      ringMesh.position.z = z - FRAME_DEPTH / 2;
      g.add(ringMesh);
    }
    for (const [ax, ay, bx, by] of barLines(o)) {
      const len = Math.hypot(bx - ax, by - ay);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, o.bar ?? 1, FRAME_DEPTH + 0.3), paint);
      bar.position.set((ax + bx) / 2, (ay + by) / 2, z);
      bar.rotation.z = Math.atan2(by - ay, bx - ax);
      bar.castShadow = true;
      g.add(bar);
    }
  }
  mergeStatic(g);
  return g;
}

/**
 * Schmutz auf der Scheibe als Textur mit Deckkraft: Grauschleier, Dreck in den Ecken und an den Sprossen,
 * Laufspuren, Kalkringe von getrockneten Tropfen, Wischspuren und Fliegendreck.
 */
export function buildGlassDirt(style: WindowStyle, seed: number, hiRes: boolean): THREE.CanvasTexture {
  const r = rng(seed);
  const W = hiRes ? 2048 : 1024;
  const H = Math.round((W * (WIN.y1 - WIN.y0)) / (WIN.x1 - WIN.x0));
  const px = W / (WIN.x1 - WIN.x0);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const toX = (x: number) => (x - WIN.x0) * px;
  const toY = (y: number) => H - (y - WIN.y0) * px;
  const haze = '216,212,200';
  const dirt = '70,62,50';

  // Wolkiger Grauschleier: erst klein gerechnet und dann hochskaliert. Hunderte einzeln gezeichnete,
  // fast durchsichtige Verläufe runden in 8 Bit auf sichtbare Gitterlinien
  const hazeW = 256;
  const hazeH = Math.round((hazeW * H) / W);
  const cloud = new Float32Array(hazeW * hazeH);
  for (let i = 0; i < 260; i++) {
    const bx = r() * hazeW;
    const by = r() * hazeH;
    const rad = 3 + r() * 16;
    const peak = 0.012 + r() * 0.028;
    for (let y = Math.max(0, Math.floor(by - rad)); y < Math.min(hazeH, by + rad); y++) {
      for (let x = Math.max(0, Math.floor(bx - rad)); x < Math.min(hazeW, bx + rad); x++) {
        const d = Math.hypot(x - bx, y - by) / rad;
        if (d < 1) cloud[y * hazeW + x] += peak * (1 - d) * (1 - d) * (3 - 2 * (1 - d));
      }
    }
  }
  const hazeCanvas = document.createElement('canvas');
  hazeCanvas.width = hazeW;
  hazeCanvas.height = hazeH;
  const hazeCtx = hazeCanvas.getContext('2d')!;
  const pixels = hazeCtx.createImageData(hazeW, hazeH);
  for (let i = 0; i < cloud.length; i++) {
    pixels.data.set([216, 212, 200, Math.min(255, (0.035 + cloud[i]) * 255)], i * 4);
  }
  hazeCtx.putImageData(pixels, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(hazeCanvas, 0, 0, W, H);

  // Wischspuren: lange, flache Bögen, die der Putzlappen hinterlassen hat
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = (90 + r() * 240) * px / 14.6;
    const start = r() * Math.PI * 2;
    ctx.strokeStyle = `rgba(${haze},${0.02 + r() * 0.035})`;
    ctx.lineWidth = (14 + r() * 40) * px / 14.6;
    ctx.beginPath();
    ctx.arc(x, y, rad, start, start + 0.6 + r() * 1.1);
    ctx.stroke();
  }

  for (const o of style.openings) {
    // Dreck setzt sich in die Ecken und an die Unterkante: weiche, gestufte Ränder nach innen
    const points = outline(o, FRAME).getPoints(32);
    const path = new Path2D();
    points.forEach((p, i) => (i ? path.lineTo(toX(p.x), toY(p.y)) : path.moveTo(toX(p.x), toY(p.y))));
    path.closePath();
    ctx.save();
    ctx.clip(path);
    const edge = ctx.createLinearGradient(0, toY(o.y0), 0, toY(o.y1));
    for (const [width, alpha] of [[9, 0.028], [6, 0.04], [3.6, 0.055], [1.8, 0.08], [0.8, 0.11]] as const) {
      edge.addColorStop(0, `rgba(${dirt},${alpha * 1.5})`);
      edge.addColorStop(0.5, `rgba(${dirt},${alpha * 0.55})`);
      edge.addColorStop(1, `rgba(${dirt},${alpha * 0.8})`);
      ctx.strokeStyle = edge;
      ctx.lineWidth = width * px;
      ctx.stroke(path);
    }
    // Auch an den Sprossen bleibt Staub hängen
    for (const [ax, ay, bx, by] of barLines(o)) {
      for (const [width, alpha] of [[2.4, 0.03], [1.2, 0.05]] as const) {
        ctx.strokeStyle = `rgba(${dirt},${alpha})`;
        ctx.lineWidth = width * px + (o.bar ?? 1) * px;
        ctx.beginPath();
        ctx.moveTo(toX(ax), toY(ay));
        ctx.lineTo(toX(bx), toY(by));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Laufspuren von altem Regen
  for (let i = 0; i < 150; i++) {
    let x = r() * W;
    let y = r() * H * 0.75;
    const steps = 6 + Math.floor(r() * 16);
    const step = (5 + r() * 14) * px / 14.6;
    ctx.strokeStyle = `rgba(${r() < 0.6 ? haze : dirt},${0.03 + r() * 0.07})`;
    ctx.lineWidth = (0.8 + r() * 2.4) * px / 14.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      x += (r() - 0.5) * 3;
      y += step;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Kalkringe getrockneter Tropfen: heller Rand, fast klare Mitte
  for (let i = 0; i < 520; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = (1.5 + r() ** 2 * 9) * px / 14.6;
    ctx.strokeStyle = `rgba(232,228,216,${0.05 + r() * 0.14})`;
    ctx.lineWidth = Math.max(0.5, rad * 0.22);
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.8 + r() * 0.3), r() * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Fliegendreck und feine Krümel
  for (let i = 0; i < 700; i++) {
    const rad = (0.4 + r() ** 3 * 1.8) * px / 14.6;
    ctx.fillStyle = `rgba(${dirt},${0.12 + r() * 0.35})`;
    ctx.beginPath();
    ctx.arc(r() * W, r() * H, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
