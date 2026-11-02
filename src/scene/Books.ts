import * as THREE from 'three';
import { rng } from '../paper/InkCanvas';
import { applyPatina } from '../typewriter/patina';
import { woodBox } from './Decor';

/** So viele cm zeigt die Gewebekachel des Einbands. */
const CLOTH_TILE_CM = 5;
/** So weit wölbt sich der Rücken über die Buchdecken hinaus, bezogen auf die Buchdicke. */
const SPINE_BULGE = 0.16;

const shadowed = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true;
  });
  return o;
};

const canvasTexture = (size: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
};

let clothTex: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | undefined;
/** Buchleinen: ein grobes Gewebe mit dicken und dünnen Fäden, kachelbar, damit es jede Größe bedeckt. */
function bookCloth() {
  if (clothTex) return clothTex;
  const S = 256;
  const THREAD = 4;
  // Dieselben Fäden für Farbe und Prägung, sonst säßen die Schatten neben dem Gewebe
  const r = rng(13);
  const threads = Array.from({ length: (S / THREAD) * 2 }, () => r());
  const weave = (ctx: CanvasRenderingContext2D, base: number, depth: number) => {
    ctx.fillStyle = `rgb(${base},${base},${base})`;
    ctx.fillRect(0, 0, S, S);
    threads.forEach((t, i) => {
      const v = Math.round(base + (t - 0.5) * depth);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      const at = (i % (S / THREAD)) * THREAD;
      if (i < S / THREAD) ctx.fillRect(at, 0, THREAD - 1, S);
      else {
        ctx.globalAlpha = 0.6;
        ctx.fillRect(0, at, S, THREAD - 1);
        ctx.globalAlpha = 1;
      }
    });
  };
  const map = canvasTexture(S, S, (ctx) => weave(ctx, 225, 60));
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = canvasTexture(S, S, (ctx) => weave(ctx, 130, 150));
  clothTex = { map, bump };
  return clothTex;
}

const covers = new Map<string, THREE.MeshStandardMaterial>();
/** Leineneinband, abgegriffen wie ein Buch, das schon lange herumliegt. */
function coverMaterial(color: string): THREE.MeshStandardMaterial {
  let mat = covers.get(color);
  if (mat) return mat;
  const { map, bump } = bookCloth();
  mat = new THREE.MeshStandardMaterial({ color, map, bumpMap: bump, bumpScale: 0.6, roughness: 0.9 });
  applyPatina(mat, {
    grime: 0.28,
    tarnish: '#2c241b',
    tarnishAmount: 0.12,
    pit: '#1d1712',
    pitAmount: 0.25,
    scratch: '#cdbb9d',
    scratchAmount: 0.08,
    roughnessMin: 0.8,
    roughnessAdd: 0.1,
    bump: 0.05,
  });
  covers.set(color, mat);
  return mat;
}

let pageMat: THREE.MeshStandardMaterial | undefined;
/** Schnitt des Buchblocks: viele Blattkanten, leicht vergilbt und nicht ganz bündig. */
function pagesMaterial(): THREE.MeshStandardMaterial {
  if (pageMat) return pageMat;
  const S = 128;
  const r = rng(29);
  const lines = Array.from({ length: S }, () => r());
  const stripes = (ctx: CanvasRenderingContext2D, light: number, range: number) => {
    lines.forEach((t, y) => {
      const v = Math.round(light - t ** 2 * range);
      ctx.fillStyle = `rgb(${v},${v},${Math.round(v * 0.93)})`;
      ctx.fillRect(0, y, S, 1);
    });
  };
  const map = canvasTexture(S, S, (ctx) => stripes(ctx, 245, 95));
  map.colorSpace = THREE.SRGBColorSpace;
  pageMat = new THREE.MeshStandardMaterial({ color: '#e6d9bd', map, bumpMap: canvasTexture(S, S, (ctx) => stripes(ctx, 220, 200)), bumpScale: 0.5, roughness: 0.95 });
  return pageMat;
}

let foilMat: THREE.MeshStandardMaterial | undefined;
/** Goldprägung auf dem Rücken: matt und etwas abgerieben, kein Spiegel. */
function foilMaterial(): THREE.MeshStandardMaterial {
  foilMat ??= new THREE.MeshStandardMaterial({ color: '#b3904a', metalness: 0.85, roughness: 0.5 });
  return foilMat;
}

/** Der Länge nach halbierter, flach gedrückter Zylinder: der gewölbte Rücken, Scheitel bei −x. */
function spineArc(thickness: number, length: number, mat: THREE.Material, grow = 0): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(thickness / 2, thickness / 2, length, 14, 1, false, Math.PI, Math.PI);
  geo.rotateX(Math.PI / 2);
  geo.scale(SPINE_BULGE * 2 + grow, 1, 1);
  // Das Gewebe bleibt im selben Maßstab wie auf den Buchdecken
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * thickness * 1.5) / CLOTH_TILE_CM, (uv.getY(i) * length) / CLOTH_TILE_CM);
  return new THREE.Mesh(geo, mat);
}

interface BookOptions {
  /** Vom Rücken zum Schnitt (x) */
  width: number;
  thickness: number;
  /** Entlang des Rückens (z) */
  height: number;
  color: string;
  /** Goldbänder und Titelfeld auf dem Rücken */
  tooled: boolean;
  seed: number;
}

/** Ein liegendes Buch: Rücken bei −x, Unterseite auf y = 0, mittig um z. */
function buildBook({ width, thickness, height, color, tooled, seed }: BookOptions): THREE.Group {
  const r = rng(seed);
  const book = new THREE.Group();
  const cover = coverMaterial(color);
  const BOARD = 0.22;
  for (const y of [BOARD / 2, thickness - BOARD / 2]) {
    const board = woodBox(width, BOARD, height, cover, seed + y, CLOTH_TILE_CM);
    board.position.y = y;
    book.add(board);
  }
  const block = new THREE.Mesh(new THREE.BoxGeometry(width - 0.4, thickness - BOARD * 2, height - 0.4), pagesMaterial());
  block.position.set(-0.05, thickness / 2, 0);
  book.add(block);

  const spineX = -width / 2;
  const spine = spineArc(thickness, height, cover);
  spine.position.set(spineX, thickness / 2, 0);
  book.add(spine);
  if (!tooled) return book;

  // Erhabene Goldbünde nahe den Enden des Rückens
  for (const end of [-1, 1]) {
    for (const inset of [0.09, 0.14]) {
      const band = spineArc(thickness, 0.16, foilMaterial(), 0.015);
      band.position.set(spineX, thickness / 2, end * height * (0.5 - inset));
      book.add(band);
    }
  }
  // Dunkles Titelfeld mit angedeuteter Prägeschrift
  const fieldAt = height * (0.16 + r() * 0.08);
  const field = spineArc(thickness, height * 0.17, coverMaterial('#1f1b18'), 0.01);
  field.position.set(spineX, thickness / 2, fieldAt);
  book.add(field);
  const tip = spineX - thickness * SPINE_BULGE - 0.015;
  const lines = thickness > 2.6 ? 3 : 2;
  for (let i = 0; i < lines; i++) {
    const glyphs = new THREE.Mesh(new THREE.BoxGeometry(0.05, thickness * (0.42 + r() * 0.2), height * 0.012), foilMaterial());
    glyphs.position.set(tip, thickness / 2, fieldAt + (i - (lines - 1) / 2) * height * 0.04);
    book.add(glyphs);
  }
  return book;
}

/** Bücherreihe; Ursprung = linke untere Kante, Rücken zeigen nach +z. */
export function buildBooks(seed: number, count: number, maxHeight: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const colors = ['#7a2e2a', '#2d4a6b', '#c9b48a', '#355e3b', '#5b3a5e', '#a36a2c', '#2a2a30', '#8c8c80'];
  // Buch aufrichten: Dicke zeigt nach x, Rücken nach +z
  const upright = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)),
  );
  let x = 0;
  let last: THREE.Group | undefined;
  for (let i = 0; i < count; i++) {
    const thickness = 1.6 + r() * 2.2;
    const height = maxHeight * (0.72 + r() * 0.28);
    const width = 10 + r() * 3;
    const book = buildBook({
      width,
      thickness,
      height,
      color: colors[Math.floor(r() * colors.length)],
      tooled: r() > 0.25,
      seed: seed * 100 + i,
    });
    book.quaternion.copy(upright);
    book.position.set(x, height / 2, -width / 2);
    g.add(book);
    last = book;
    x += thickness + 0.08;
  }
  // letztes Buch angelehnt
  if (last) {
    last.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -0.28);
    last.position.x += 1.6;
  }
  return shadowed(g);
}

/** Stapel liegender Bücher. Ursprung = Tischplatte. */
export function buildBookStack(seed: number): THREE.Group {
  const r = rng(seed);
  const g = new THREE.Group();
  const colors = ['#6a2a26', '#27415e', '#3e5a3f', '#8a6a3a'];
  let y = 0;
  for (let i = 0; i < 3; i++) {
    const thickness = 1.8 + r() * 1.2;
    const book = buildBook({
      width: 19 - i * 2 + r(),
      thickness,
      height: 13 - i + r(),
      color: colors[Math.floor(r() * colors.length)],
      tooled: true,
      seed: seed * 100 + i,
    });
    book.position.y = y;
    book.rotation.y = (r() - 0.5) * 0.35;
    g.add(book);
    y += thickness;
  }
  return shadowed(g);
}
