import * as THREE from 'three';
import { rng } from '../paper/InkCanvas';
import { mergeStatic } from './merge';

/** Gemeinsame Materialien der Deko. */
export interface DecorMaterials {
  wood: THREE.Material;
}

const shadowed = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true;
  });
  return o;
};

/** Herzförmiges Blatt (Efeutute), Spitze zeigt entlang +y, Basis im Ursprung. */
function leafGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-1.6, 0.2, -2.0, 2.0, -0.9, 3.2);
  s.bezierCurveTo(-0.5, 3.7, -0.15, 4.2, 0, 4.6);
  s.bezierCurveTo(0.15, 4.2, 0.5, 3.7, 0.9, 3.2);
  s.bezierCurveTo(2.0, 2.0, 1.6, 0.2, 0, 0);
  const g = new THREE.ShapeGeometry(s, 10);
  // leicht gewölbt entlang der Mittelrippe
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, -0.18 * x * x);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Topfpflanze mit herabhängenden Ranken (Efeutute). Ursprung = Topfboden.
 * `hangDir` zeigt in die Richtung, in die die Ranken über die Kante fallen.
 */
export function buildTrailingPlant(seed: number, hangDir: THREE.Vector3, hangDepth: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: '#b5603a', roughness: 0.85 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 3.6, 7.5, 28), potMat);
  pot.position.y = 3.75;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.45, 8, 28), potMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 7.4;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(4.3, 24), new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 7.0;
  g.add(pot, rim, soil);

  const leaf = leafGeometry();
  const greens = ['#2f6b2c', '#3d7f34', '#4a8f3c', '#356f30'].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide }),
  );
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4f7a35', roughness: 0.7 });
  const Y = new THREE.Vector3(0, 1, 0);
  const addLeaf = (p: THREE.Vector3, dir: THREE.Vector3, scale: number) => {
    const m = new THREE.Mesh(leaf, greens[Math.floor(r() * greens.length)]);
    m.position.copy(p);
    m.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
    m.rotateY((r() - 0.5) * 2.4);
    m.scale.setScalar(scale);
    g.add(m);
  };

  // Busch oben im Topf
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const out = new THREE.Vector3(Math.cos(a), 0.6 + r() * 1.2, Math.sin(a));
    addLeaf(new THREE.Vector3(Math.cos(a) * r() * 2, 7.2, Math.sin(a) * r() * 2), out, 0.9 + r() * 0.5);
  }

  // Ranken: über den Topfrand in Hängerichtung, dann nach unten
  const side = new THREE.Vector3().crossVectors(hangDir, Y).normalize();
  for (let v = 0; v < 5; v++) {
    const spread = (v - 2) * 2.2 + (r() - 0.5) * 1.5;
    const len = hangDepth * (0.45 + r() * 0.65);
    const start = new THREE.Vector3().addScaledVector(side, spread * 0.6).setY(7.5);
    const pts = [
      start,
      start.clone().addScaledVector(hangDir, 5).add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(side, spread * 0.4),
      start.clone().addScaledVector(hangDir, 9 + r() * 2).setY(2).addScaledVector(side, spread),
      start.clone().addScaledVector(hangDir, 10 + r() * 3).setY(-len * 0.5).addScaledVector(side, spread * 1.3),
      start.clone().addScaledVector(hangDir, 9 + r() * 4).setY(-len).addScaledVector(side, spread * 1.5 + (r() - 0.5) * 3),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.13, 5), stemMat));
    const n = Math.floor(curve.getLength() / 2.6);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 0.5);
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const alt = i % 2 === 0 ? 1 : -1;
      const dir = new THREE.Vector3().addScaledVector(side, alt).addScaledVector(hangDir, 0.8).addScaledVector(tangent, 0.5).add(new THREE.Vector3(0, -0.2, 0));
      addLeaf(p, dir, 0.75 + r() * 0.35 - t * 0.2);
    }
  }
  return shadowed(g);
}

/** Bücherreihe; Ursprung = linke untere Kante, Rücken zeigen nach +z. */
export function buildBooks(seed: number, count: number, maxHeight: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const colors = ['#7a2e2a', '#2d4a6b', '#c9b48a', '#355e3b', '#5b3a5e', '#a36a2c', '#1f1f24', '#8c8c80'];
  // Gleiche Farbe, gleiches Material: Das lässt sich zusammenfügen
  const covers = new Map(colors.map((color) => [color, new THREE.MeshStandardMaterial({ color, roughness: 0.75 })]));
  let x = 0;
  for (let i = 0; i < count; i++) {
    const w = 1.6 + r() * 2.2;
    const h = maxHeight * (0.72 + r() * 0.28);
    const d = 10 + r() * 3;
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      covers.get(colors[Math.floor(r() * colors.length)])!,
    );
    book.position.set(x + w / 2, h / 2, -d / 2);
    g.add(book);
    x += w + 0.08;
  }
  // letztes Buch angelehnt
  const lean = g.children[g.children.length - 1];
  lean.rotation.z = -0.28;
  lean.position.x += 1.6;
  return shadowed(g);
}

/** Wandregal: Brett mit zwei schwarzen Konsolen. Ursprung = Wandmitte unter dem Brett, Tiefe nach +z. */
export function buildShelf(m: DecorMaterials, width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, 2, depth), m.wood);
  board.position.set(0, 1, depth / 2);
  g.add(board);
  const metal = new THREE.MeshStandardMaterial({ color: '#1c1c1c', metalness: 0.6, roughness: 0.45 });
  for (const x of [-width * 0.32, width * 0.32]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 0.6), metal);
    v.position.set(x, -4, 0.3);
    const h = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, depth * 0.85), metal);
    h.position.set(x, -0.3, depth * 0.425);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, Math.hypot(7, depth * 0.7)), metal);
    brace.position.set(x, -4, depth * 0.35);
    brace.rotation.x = Math.atan2(7, depth * 0.7);
    g.add(v, h, brace);
  }
  return shadowed(g);
}

/** Drehung der Tasse im Zimmer (Henkel nach vorn rechts). */
export const MUG_TURN = 0.6;
/** Winkel des Aufdrucks auf der Tasse, sodass er im Zimmer zur Standardkamera zeigt. */
const PRINT_FACING = 0.22;

/** Kaffeetasse; Ursprung = Boden. */
export function buildMug(): THREE.Group {
  const g = new THREE.Group();
  const ceramic = new THREE.MeshPhysicalMaterial({ color: '#efe8dc', roughness: 0.25, clearcoat: 0.8 });
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(3.4, 0),
    new THREE.Vector2(3.8, 0.6),
    new THREE.Vector2(4.0, 9),
    new THREE.Vector2(3.6, 9),
    new THREE.Vector2(3.45, 1),
    new THREE.Vector2(0, 1),
  ];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 40), ceramic));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.55, 12, 24, Math.PI * 1.2), ceramic);
  handle.rotation.z = -Math.PI * 0.6;
  handle.position.set(4.2, 4.8, 0);
  g.add(handle);
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 32),
    new THREE.MeshPhysicalMaterial({ color: '#2a170c', roughness: 0.1, clearcoat: 1 }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 7.6;
  g.add(coffee);

  // Aufdruck auf der dem Betrachter zugewandten Seite
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 300;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a2416';
  ctx.textAlign = 'center';
  ctx.font = '74px "Special Elite", serif';
  ctx.fillText('made with', 256, 118);
  ctx.font = '104px "Special Elite", serif';
  ctx.fillText('coffee', 256, 222);
  ctx.fillRect(166, 250, 180, 5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const arc = 2.2;
  const print = new THREE.Mesh(
    new THREE.CylinderGeometry(3.975, 3.86, 5, 32, 1, true, PRINT_FACING - arc / 2, arc),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4 }),
  );
  print.position.y = 5;
  g.add(print);
  return shadowed(g);
}

/** Gerahmtes Bild mit einer gemalten Landschaft. Ursprung = Bildmitte, Vorderseite +z. */
export function buildPicture(m: DecorMaterials, w: number, h: number, seed: number): THREE.Group {
  const r = rng(seed);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const ctx = c.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, c.height);
  sky.addColorStop(0, '#e9c79a');
  sky.addColorStop(0.55, '#f3e2c4');
  sky.addColorStop(1, '#9fb0a0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, c.width, c.height);
  // Hügelketten im Aquarell-Stil
  const layers = ['#9aa59a', '#7d8f83', '#5f7568', '#44594d'];
  layers.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    const base = c.height * (0.5 + i * 0.12);
    ctx.moveTo(0, c.height);
    for (let x = 0; x <= c.width; x += 16) {
      ctx.lineTo(x, base - Math.sin(x * 0.012 + i * 2 + r()) * 30 - r() * 10);
    }
    ctx.lineTo(c.width, c.height);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff6e0';
  ctx.beginPath();
  ctx.arc(c.width * 0.7, c.height * 0.3, 26, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const g = new THREE.Group();
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  canvas.position.z = 0.6;
  // Passepartout
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(w + 8, h + 8), new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 1 }));
  mat.position.z = 0.55;
  g.add(canvas, mat);
  const F = 2;
  const frame = (fw: number, fh: number, x: number, y: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 2), m.wood);
    b.position.set(x, y, 0.9);
    g.add(b);
  };
  frame(w + 8 + 2 * F, F, 0, (h + 8) / 2 + F / 2);
  frame(w + 8 + 2 * F, F, 0, -(h + 8) / 2 - F / 2);
  frame(F, h + 8, -(w + 8) / 2 - F / 2, 0);
  frame(F, h + 8, (w + 8) / 2 + F / 2, 0);
  return shadowed(g);
}

/** Röhrenradio aus Holz; Ursprung = Boden, Front zeigt nach +z. */
export class Radio {
  readonly group = new THREE.Group();
  readonly size = { w: 17, h: 10, d: 7 };
  private readonly dial = new THREE.MeshBasicMaterial({ color: '#4a3f2c', toneMapped: false });

  constructor() {
    const { w, h, d } = this.size;
    const wood = new THREE.MeshStandardMaterial({ color: '#5d3620', roughness: 0.5 });
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
    cabinet.position.y = h / 2;
    this.group.add(cabinet);

    // Bespannung des Lautsprechers mit feinem Webmuster
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#b09a78';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#8c7758';
    for (let i = 0; i < 64; i += 4) {
      ctx.fillRect(i, 0, 1, 64);
      ctx.fillRect(0, i, 64, 1);
    }
    const cloth = new THREE.CanvasTexture(c);
    cloth.colorSpace = THREE.SRGBColorSpace;
    cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
    cloth.repeat.set(3, 2);
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.6), new THREE.MeshStandardMaterial({ map: cloth, roughness: 1 }));
    grille.position.set(-3, h / 2, d / 2 + 0.02);
    this.group.add(grille);

    const dial = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.2), this.dial);
    dial.position.set(5, h / 2 + 2, d / 2 + 0.02);
    this.group.add(dial);
    const brass = new THREE.MeshStandardMaterial({ color: '#b08a45', metalness: 1, roughness: 0.35 });
    for (const x of [3.3, 6.7]) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 1, 20), brass);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(x, h / 2 - 1.9, d / 2 + 0.5);
      this.group.add(knob);
    }
    shadowed(this.group);
    mergeStatic(this.group);
    this.setOn(false);
  }

  /** Die Skala leuchtet, solange Musik läuft. */
  setOn(on: boolean): void {
    this.dial.color.set(on ? '#ffbf6a' : '#4a3f2c');
  }
}
