import * as THREE from 'three';
import { animator, ease } from '../animation/Tweens';

export type ViewId = 'alps' | 'winterlake' | 'nordiclake' | 'mediterranean' | 'starnight';

export interface OutdoorView {
  file: string;
  /** horizontale Bildposition (0–1 im Panorama), die mittig im Fenster erscheinen soll */
  u: number;
  /** Horizont um so viele Grad absenken (zeigt mehr Himmel/Berge) */
  drop: number;
  /** Licht, das durchs Fenster fällt */
  light: string;
  lightIntensity: number;
  /** Helligkeit der Raumbeleuchtung (Umgebung) */
  ambient: number;
}

export const VIEWS: Record<ViewId, OutdoorView> = {
  alps: { file: 'alps_field.jpg', u: 0.75, drop: 8, light: '#fff3e0', lightIntensity: 2.2, ambient: 0.55 },
  winterlake: { file: 'lago_disola.jpg', u: 0.8, drop: 12, light: '#e8f0ff', lightIntensity: 2.0, ambient: 0.55 },
  nordiclake: { file: 'lakeside.jpg', u: 0.68, drop: 1, light: '#fff6e8', lightIntensity: 2.3, ambient: 0.55 },
  mediterranean: { file: 'spiaggia_di_mondello.jpg', u: 0.03, drop: -1, light: '#ffe9c4', lightIntensity: 2.6, ambient: 0.6 },
  starnight: { file: 'lakeside_night.jpg', u: 0.4, drop: 0, light: '#ffb070', lightIntensity: 0.35, ambient: 0.18 },
};

const DESK_Y = -0.45;
const WALL_Z = -34;
/** Fensterausschnitt in der Wand */
const WIN = { x0: -46, x1: 14, y0: 12, y1: 60 };
/** Elevationsbereich des Panorama-Bands (aus dem Zuschnitt) */
const BAND_TOP_DEG = 34.94;
const BAND_HEIGHT_DEG = 60.06;

/** Zimmer: Schreibtisch, alte Putzwand mit Sprossenfenster und austauschbarer Aussicht. */
export class Room {
  readonly group = new THREE.Group();
  readonly windowLight: THREE.DirectionalLight;
  private readonly outside: THREE.Mesh;
  /** neigt die Außenkugel um die x-Achse (Horizonthöhe) */
  private readonly tilt = new THREE.Group();
  private readonly outsideMat: THREE.MeshBasicMaterial;
  private readonly loader = new THREE.TextureLoader();
  private readonly cache = new Map<ViewId, Promise<THREE.Texture>>();
  private current?: ViewId;

  constructor(private readonly scene: THREE.Scene, private readonly anisotropy: number) {
    this.group.name = 'room';
    this.group.add(this.buildDesk(), this.buildWall(), this.buildWindow());

    // Außenwelt: Kugelausschnitt mit Panorama, nur durchs Fenster sichtbar
    const geo = new THREE.SphereGeometry(
      300, 96, 24, 0, Math.PI * 2,
      THREE.MathUtils.degToRad(90 - BAND_TOP_DEG),
      THREE.MathUtils.degToRad(BAND_HEIGHT_DEG),
    );
    this.outsideMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, color: '#000' });
    this.outside = new THREE.Mesh(geo, this.outsideMat);
    this.tilt.position.set(0, 20, 40);
    this.tilt.add(this.outside);
    this.group.add(this.tilt);

    // Licht durchs Fenster (fällt von hinten links auf die Maschine)
    this.windowLight = new THREE.DirectionalLight('#fff3e0', 2);
    this.windowLight.position.set(-30, 45, -60);
    this.windowLight.target.position.set(0, 0, 0);
    this.group.add(this.windowLight, this.windowLight.target);
  }

  /** Wechselt die Aussicht mit kurzer Überblendung. */
  async setView(id: ViewId): Promise<void> {
    if (this.current === id) return;
    this.current = id;
    const view = VIEWS[id];
    const tex = await this.load(id);
    if (this.current !== id) return;

    const mat = this.outsideMat;
    const fadeOut = mat.map ? 0.25 : 0;
    const fromLight = this.windowLight.color.clone();
    const fromIntensity = this.windowLight.intensity;
    const fromAmbient = this.scene.environmentIntensity;
    const toLight = new THREE.Color(view.light);
    animator.add({
      duration: fadeOut,
      onUpdate: (t) => mat.color.setScalar(1 - t),
      onComplete: () => {
        mat.map = tex;
        mat.needsUpdate = true;
        this.aim(view.u);
        this.tilt.rotation.x = -THREE.MathUtils.degToRad(view.drop);
        animator.add({ duration: 0.5, ease: ease.outQuad, onUpdate: (t) => mat.color.setScalar(t) });
      },
    });
    animator.add({
      duration: 0.8,
      ease: ease.inOutCubic,
      onUpdate: (t) => {
        this.windowLight.color.copy(fromLight).lerp(toLight, t);
        this.windowLight.intensity = fromIntensity + (view.lightIntensity - fromIntensity) * t;
        this.scene.environmentIntensity = fromAmbient + (view.ambient - fromAmbient) * t;
      },
    });
  }

  /** Dreht die Kugel so, dass Panoramaposition u in Richtung Fenstermitte liegt. */
  private aim(u: number): void {
    const winCenter = new THREE.Vector3((WIN.x0 + WIN.x1) / 2, 0, WALL_Z);
    const d = winCenter.sub(this.tilt.position);
    const phiWorld = Math.atan2(d.z, -d.x);
    // Textur ist gespiegelt (Innenansicht): sichtbares u = 1 - phi / 2π
    const phiLocal = Math.PI * 2 * (1 - u);
    this.outside.rotation.y = phiWorld - phiLocal;
  }

  private load(id: ViewId): Promise<THREE.Texture> {
    let p = this.cache.get(id);
    if (!p) {
      p = this.loader.loadAsync(`${import.meta.env.BASE_URL}views/${VIEWS[id].file}`).then((tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1;
        tex.anisotropy = this.anisotropy;
        return tex;
      });
      this.cache.set(id, p);
    }
    return p;
  }

  private tex(file: string, repeat: [number, number], color: boolean): THREE.Texture {
    const t = this.loader.load(`${import.meta.env.BASE_URL}textures/${file}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.anisotropy = this.anisotropy;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private buildDesk(): THREE.Object3D {
    const repeat: [number, number] = [2.2, 1.3];
    const mat = new THREE.MeshStandardMaterial({
      map: this.tex('desk_diff.jpg', repeat, true),
      normalMap: this.tex('desk_nor.jpg', repeat, false),
      roughnessMap: this.tex('desk_rough.jpg', repeat, false),
      roughness: 0.85,
      normalScale: new THREE.Vector2(0.8, 0.8),
    });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(180, 3, 110), mat);
    desk.position.set(0, DESK_Y - 1.5, WALL_Z + 55 - 2);
    desk.receiveShadow = true;
    return desk;
  }

  private buildWall(): THREE.Object3D {
    const g = new THREE.Group();
    const repeat: [number, number] = [1, 1];
    const mat = new THREE.MeshStandardMaterial({
      map: this.tex('wall_diff.jpg', repeat, true),
      normalMap: this.tex('wall_nor.jpg', repeat, false),
      roughnessMap: this.tex('wall_rough.jpg', repeat, false),
      color: '#d8c3a2',
      roughness: 0.95,
    });
    // Wand aus vier Teilen um die Fensteröffnung; UVs in Weltmaßstab (1 Kachel = 60 cm)
    const W = { x0: -160, x1: 160, y0: -40, y1: 140 };
    const pieces: [number, number, number, number][] = [
      [W.x0, WIN.x0, W.y0, W.y1],
      [WIN.x1, W.x1, W.y0, W.y1],
      [WIN.x0, WIN.x1, WIN.y1, W.y1],
      [WIN.x0, WIN.x1, W.y0, WIN.y0],
    ];
    for (const [x0, x1, y0, y1] of pieces) {
      const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / 60, (y0 + uv.getY(i) * (y1 - y0)) / 60);
      }
      const m = new THREE.Mesh(geo, mat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z);
      m.receiveShadow = true;
      g.add(m);
    }
    // Fensterlaibung (Wandstärke)
    const depth = 8;
    const reveal = new THREE.MeshStandardMaterial({ color: '#cbb89a', roughness: 0.95 });
    const sides: [number, number, number, number, number][] = [
      [WIN.x0, (WIN.y0 + WIN.y1) / 2, 0.01, WIN.y1 - WIN.y0, 0],
      [WIN.x1, (WIN.y0 + WIN.y1) / 2, 0.01, WIN.y1 - WIN.y0, 0],
      [(WIN.x0 + WIN.x1) / 2, WIN.y1, WIN.x1 - WIN.x0, 0.01, 0],
    ];
    for (const [x, y, w, h] of sides) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w || 0.5, h || 0.5, depth), reveal);
      b.position.set(x, y, WALL_Z - depth / 2);
      g.add(b);
    }
    return g;
  }

  private buildWindow(): THREE.Object3D {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: '#ece4d4', roughness: 0.55 });
    const z = WALL_Z - 6;
    const w = WIN.x1 - WIN.x0;
    const h = WIN.y1 - WIN.y0;
    const cx = (WIN.x0 + WIN.x1) / 2;
    const cy = (WIN.y0 + WIN.y1) / 2;
    const bar = (bw: number, bh: number, x: number, y: number, d = 2.2) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), paint);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
    };
    const F = 2.4;
    // Blendrahmen
    bar(w, F, cx, WIN.y1 - F / 2);
    bar(w, F, cx, WIN.y0 + F / 2);
    bar(F, h, WIN.x0 + F / 2, cy);
    bar(F, h, WIN.x1 - F / 2, cy);
    // Flügel-Mittelpfosten und Kämpfer
    bar(2.6, h, cx, cy, 2.8);
    bar(w, 2.2, cx, WIN.y0 + h * 0.68, 2.8);
    // Sprossen
    for (const x of [cx - w / 4, cx + w / 4]) bar(1.1, h * 0.68, x, WIN.y0 + h * 0.34, 1.6);
    bar(w, 1.1, cx, WIN.y0 + h * 0.34, 1.6);

    // Leicht spiegelndes Glas
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.08 }),
    );
    glass.position.set(cx, cy, z - 0.2);
    g.add(glass);

    // Fensterbank
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 8, 1.6, 12), paint);
    sill.position.set(cx, WIN.y0 - 0.8, WALL_Z - 2);
    sill.castShadow = sill.receiveShadow = true;
    g.add(sill);
    return g;
  }
}
