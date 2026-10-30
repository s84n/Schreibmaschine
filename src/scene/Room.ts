import * as THREE from 'three';
import { animator, ease, type TweenHandle } from '../animation/Tweens';
import { buildBookStack, buildCurtain, buildPaperStack, buildPencilCup, buildRainGlass, Candle, FairyLights, Steam } from './Cozy';
import { buildBooks, buildMug, buildPicture, buildShelf, buildTrailingPlant, MUG_TURN, type DecorMaterials } from './Decor';

export type ViewId = 'alps' | 'winterlake' | 'nordiclake' | 'mediterranean' | 'starnight' | 'istanbul' | 'newyork' | 'dubai';

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
  /** Bild zeigt schon Dämmerung/Nacht: wird im Nachtmodus kaum abgedunkelt */
  dusk?: boolean;
}

export const VIEWS: Record<ViewId, OutdoorView> = {
  alps: { file: 'alps_field.jpg', u: 0.75, drop: 11, light: '#fff3e0', lightIntensity: 2.2, ambient: 0.55 },
  winterlake: { file: 'lago_disola.jpg', u: 0.8, drop: 16, light: '#e8f0ff', lightIntensity: 2.0, ambient: 0.55 },
  nordiclake: { file: 'lakeside.jpg', u: 0.68, drop: 3, light: '#fff6e8', lightIntensity: 2.3, ambient: 0.55 },
  mediterranean: { file: 'spiaggia_di_mondello.jpg', u: 0.03, drop: 4, light: '#ffe9c4', lightIntensity: 2.6, ambient: 0.6 },
  istanbul: { file: 'istanbul.jpg', u: 0.5, drop: 3, light: '#fff1dc', lightIntensity: 2.4, ambient: 0.58 },
  newyork: { file: 'newyork.jpg', u: 0.5, drop: 2, light: '#f4f6ff', lightIntensity: 2.2, ambient: 0.58 },
  dubai: { file: 'dubai.jpg', u: 0.5, drop: 10, light: '#ff9fb0', lightIntensity: 0.6, ambient: 0.28, dusk: true },
  starnight: { file: 'lakeside_night.jpg', u: 0.4, drop: 5, light: '#ffb070', lightIntensity: 0.35, ambient: 0.18, dusk: true },
};

const DESK_Y = -0.45;
const WALL_Z = -34;
/** Fensterausschnitt in der Wand (Brüstung knapp über der Tischplatte) */
const WIN = { x0: -46, x1: 14, y0: 2.6, y1: 54 };
/** Zimmermaße: Tischhöhe 76 cm über dem Boden */
const ROOM = { x0: -100, x1: 100, z0: WALL_Z, z1: 130, floor: DESK_Y - 76, ceil: 150 };
/** Wandfarbe: gebrochenes Weiß für Kontrast zum dunklen Tisch */
const WALL_COLOR = '#fbf7f0';
const MUG_POS = { x: 27, z: 0 };
/** Elevationsbereich des Panorama-Bands (aus dem Zuschnitt) */
const BAND_TOP_DEG = 34.94;
const BAND_HEIGHT_DEG = 60.06;
/** Nachtzustand von Fensterlicht, Umgebung und Aussicht */
const MOON_LIGHT = new THREE.Color('#7f9be0');
const NIGHT_LIGHT = 0.28;
const NIGHT_AMBIENT = 0.045;
const NIGHT_TINT = new THREE.Color(0.075, 0.1, 0.2);
const DUSK_TINT = new THREE.Color(0.75, 0.75, 0.8);
/** Regenwetter: grauer Himmel, weniger Licht von draußen */
const RAIN_TINT = new THREE.Color(0.48, 0.52, 0.58);

/** Zimmer: Schreibtisch, geschlossener Raum mit Sprossenfenster, austauschbarer Aussicht und etwas Deko. */
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
  /** Tagwerte der aktuellen Aussicht; der Nachtfaktor wird in applyLight() daraufgerechnet */
  private readonly dayLight = { color: new THREE.Color('#fff3e0'), intensity: 2, ambient: 0.55 };
  private night = 0;
  private fade = 0;
  private dusk = false;
  private rain = 0;
  private rainTween?: TweenHandle;
  private readonly rainGlass = buildRainGlass(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
  readonly candle = new Candle();
  private readonly steam = new Steam();
  private readonly fairy = new FairyLights(WIN.x0 - 10, WIN.x1 + 10, WIN.y1 + 7, WALL_Z + 2.2);
  /** Unsichtbarer, etwas größerer Klickbereich um die Tasse */
  readonly mugHit: THREE.Mesh;

  constructor(private readonly scene: THREE.Scene, private readonly anisotropy: number) {
    this.group.name = 'room';
    const deskMat = this.deskMaterial();
    this.group.add(this.buildDesk(deskMat), this.buildShell(), this.buildReveal(), this.buildWindow(), this.buildDecor({ wood: deskMat }));

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

    this.mugHit = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 14, 12), new THREE.MeshBasicMaterial());
    this.mugHit.position.set(MUG_POS.x, DESK_Y + 6, MUG_POS.z);
    this.mugHit.visible = false;
    this.group.add(this.mugHit);
    this.applyLight();
  }

  /** Überblendet zwischen Tag (0) und Nacht (1). */
  setNight(n: number): void {
    this.night = n;
    this.candle.setNight(n);
    this.fairy.setNight(n);
    this.applyLight();
  }

  /** Regenwetter mit weicher Überblendung (beim Start ohne). */
  setRain(on: boolean, animate = true): void {
    const to = on ? 1 : 0;
    this.rainTween?.cancel();
    if (!animate) {
      this.applyRain(to);
      return;
    }
    const from = this.rain;
    this.rainTween = animator.add({ duration: 2, ease: ease.inOutCubic, onUpdate: (t) => this.applyRain(from + (to - from) * t) });
  }

  private applyRain(r: number): void {
    this.rain = r;
    this.rainGlass.mesh.visible = r > 0.01;
    this.rainGlass.uniforms.uRain.value = r;
    this.applyLight();
  }

  update(dt: number, camera: THREE.Camera): void {
    this.candle.update(dt, camera);
    this.steam.update(dt);
    this.rainGlass.uniforms.uTime.value += dt;
  }

  private applyLight(): void {
    const n = this.night;
    this.windowLight.color.copy(this.dayLight.color).lerp(MOON_LIGHT, n);
    const r = this.rain;
    const day = this.dayLight;
    this.windowLight.intensity = (day.intensity + (NIGHT_LIGHT - day.intensity) * n) * (1 - 0.55 * r);
    this.scene.environmentIntensity = (day.ambient + (NIGHT_AMBIENT - day.ambient) * n) * (1 - 0.25 * r * (1 - n));
    this.outsideMat.color.setScalar(1).lerp(this.dusk ? DUSK_TINT : NIGHT_TINT, n).multiplyScalar(this.fade);
    this.outsideMat.color.r *= 1 + (RAIN_TINT.r - 1) * r;
    this.outsideMat.color.g *= 1 + (RAIN_TINT.g - 1) * r;
    this.outsideMat.color.b *= 1 + (RAIN_TINT.b - 1) * r;
    // Tropfen spiegeln nachts nur noch wenig Himmel
    this.rainGlass.uniforms.uLight.value = 1 + (0.22 - 1) * n;
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
    const fromLight = this.dayLight.color.clone();
    const fromIntensity = this.dayLight.intensity;
    const fromAmbient = this.dayLight.ambient;
    const toLight = new THREE.Color(view.light);
    animator.add({
      duration: fadeOut,
      onUpdate: (t) => {
        this.fade = 1 - t;
        this.applyLight();
      },
      onComplete: () => {
        mat.map = tex;
        mat.needsUpdate = true;
        this.aim(view.u);
        this.tilt.rotation.x = -THREE.MathUtils.degToRad(view.drop);
        this.dusk = !!view.dusk;
        animator.add({
          duration: 0.5,
          ease: ease.outQuad,
          onUpdate: (t) => {
            this.fade = t;
            this.applyLight();
          },
        });
      },
    });
    animator.add({
      duration: 0.8,
      ease: ease.inOutCubic,
      onUpdate: (t) => {
        this.dayLight.color.copy(fromLight).lerp(toLight, t);
        this.dayLight.intensity = fromIntensity + (view.lightIntensity - fromIntensity) * t;
        this.dayLight.ambient = fromAmbient + (view.ambient - fromAmbient) * t;
        this.applyLight();
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

  private deskMaterial(): THREE.MeshStandardMaterial {
    const repeat: [number, number] = [2.2, 1.3];
    return new THREE.MeshStandardMaterial({
      map: this.tex('desk_diff.jpg', repeat, true),
      normalMap: this.tex('desk_nor.jpg', repeat, false),
      roughnessMap: this.tex('desk_rough.jpg', repeat, false),
      roughness: 0.85,
      normalScale: new THREE.Vector2(0.8, 0.8),
    });
  }

  private buildDesk(mat: THREE.Material): THREE.Object3D {
    const g = new THREE.Group();
    const depth = 110;
    const cz = WALL_Z + depth / 2 - 2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(180, 3, depth), mat);
    top.position.set(0, DESK_Y - 1.5, cz);
    top.castShadow = top.receiveShadow = true;
    g.add(top);
    // Zarge und Beine
    const apron = new THREE.Mesh(new THREE.BoxGeometry(170, 9, depth - 10), mat);
    apron.position.set(0, DESK_Y - 7.5, cz);
    g.add(apron);
    const legH = 76 - 3;
    for (const x of [-82, 82]) {
      for (const z of [cz - depth / 2 + 6, cz + depth / 2 - 6]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(6, legH, 6), mat);
        leg.position.set(x, DESK_Y - 3 - legH / 2, z);
        leg.castShadow = true;
        g.add(leg);
      }
    }
    return g;
  }

  /** Wandfläche mit UVs im Weltmaßstab (1 Kachel = 60 cm). */
  private wallPlane(mat: THREE.Material, w: number, h: number, u0: number, v0: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + uv.getX(i) * w) / 60, (v0 + uv.getY(i) * h) / 60);
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  }

  /** Raumhülle: Rückwand mit Fensteröffnung, Seitenwände, Vorderwand, Boden, Decke, Fußleisten. */
  private buildShell(): THREE.Object3D {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      map: this.tex('wall_diff.jpg', [1, 1], true),
      normalMap: this.tex('wall_nor.jpg', [1, 1], false),
      roughnessMap: this.tex('wall_rough.jpg', [1, 1], false),
      roughness: 0.95,
      normalScale: new THREE.Vector2(0.6, 0.6),
    });
    // Die Putztextur ist mittelgrau – Farbe über 1 hellt sie zu gebrochenem Weiß auf
    mat.color.set(WALL_COLOR).multiplyScalar(1.45);
    const R = ROOM;
    const H = R.ceil - R.floor;
    const D = R.z1 - R.z0;
    const W = R.x1 - R.x0;

    // Rückwand aus vier Teilen um das Fenster
    const pieces: [number, number, number, number][] = [
      [R.x0, WIN.x0, R.floor, R.ceil],
      [WIN.x1, R.x1, R.floor, R.ceil],
      [WIN.x0, WIN.x1, WIN.y1, R.ceil],
      [WIN.x0, WIN.x1, R.floor, WIN.y0],
    ];
    for (const [x0, x1, y0, y1] of pieces) {
      const m = this.wallPlane(mat, x1 - x0, y1 - y0, x0, y0);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z);
      g.add(m);
    }
    // Seitenwände und Vorderwand (zeigen nach innen)
    const left = this.wallPlane(mat, D, H, 0, R.floor);
    left.rotation.y = Math.PI / 2;
    left.position.set(R.x0, (R.floor + R.ceil) / 2, (R.z0 + R.z1) / 2);
    const right = this.wallPlane(mat, D, H, 0, R.floor);
    right.rotation.y = -Math.PI / 2;
    right.position.set(R.x1, (R.floor + R.ceil) / 2, (R.z0 + R.z1) / 2);
    const front = this.wallPlane(mat, W, H, 0, R.floor);
    front.rotation.y = Math.PI;
    front.position.set(0, (R.floor + R.ceil) / 2, R.z1);
    g.add(left, right, front);

    // Decke
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#f6f3ee', roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, R.ceil, (R.z0 + R.z1) / 2);
    g.add(ceiling);

    // Dielenboden
    const repeat: [number, number] = [W / 120, D / 120];
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({
        map: this.tex('floor_diff.jpg', repeat, true),
        normalMap: this.tex('floor_nor.jpg', repeat, false),
        roughnessMap: this.tex('floor_rough.jpg', repeat, false),
        roughness: 0.7,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, R.floor, (R.z0 + R.z1) / 2);
    floor.receiveShadow = true;
    g.add(floor);

    // Weiße Fußleisten
    const skirtMat = new THREE.MeshStandardMaterial({ color: '#f2eee6', roughness: 0.5 });
    const skirt = (w: number, x: number, z: number, rotY: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 9, 1.4), skirtMat);
      b.position.set(x, R.floor + 4.5, z);
      b.rotation.y = rotY;
      g.add(b);
    };
    skirt(W, 0, R.z0 + 0.7, 0);
    skirt(W, 0, R.z1 - 0.7, 0);
    skirt(D, R.x0 + 0.7, (R.z0 + R.z1) / 2, Math.PI / 2);
    skirt(D, R.x1 - 0.7, (R.z0 + R.z1) / 2, Math.PI / 2);
    return g;
  }

  /** Deko: Regale mit Pflanzen und Büchern, Bild, Tasse, Kerze, Schreibtisch-Kleinigkeiten, Vorhänge, Lichterkette. */
  private buildDecor(m: DecorMaterials): THREE.Object3D {
    const g = new THREE.Group();
    const shelfY = 34;
    const shelf = buildShelf(m, 46, 16);
    shelf.position.set(46, shelfY, WALL_Z);
    const plant = buildTrailingPlant(7, new THREE.Vector3(0, 0, 1), 34);
    // Ganz rechts auf dem Regal: Die Ranken dürfen nicht über die Tasse hängen
    plant.position.set(56, shelfY + 2, WALL_Z + 7);
    const books = buildBooks(3, 7, 15);
    books.position.set(25, shelfY + 2, WALL_Z + 14.5);
    g.add(shelf, plant, books);

    // Bild an der linken Wand
    const picture = buildPicture(m, 44, 30, 11);
    picture.rotation.y = Math.PI / 2;
    picture.position.set(ROOM.x0 + 0.2, 52, 25);
    g.add(picture);

    // Regal an der rechten Wand mit Büchern und zweiter Pflanze
    const rightShelf = buildShelf(m, 60, 18);
    rightShelf.rotation.y = -Math.PI / 2;
    rightShelf.position.set(ROOM.x1, 46, 30);
    const rightBooks = buildBooks(21, 10, 18);
    rightBooks.rotation.y = -Math.PI / 2;
    rightBooks.position.set(ROOM.x1 - 16, 48, 14);
    const rightPlant = buildTrailingPlant(42, new THREE.Vector3(-1, 0, 0), 40);
    rightPlant.position.set(ROOM.x1 - 8, 48, 48);
    g.add(rightShelf, rightBooks, rightPlant);

    // Kaffeetasse rechts neben der Maschine
    const mug = buildMug();
    mug.position.set(MUG_POS.x, DESK_Y, MUG_POS.z);
    mug.rotation.y = -MUG_TURN;
    this.steam.group.position.set(MUG_POS.x, DESK_Y + 8, MUG_POS.z);
    g.add(mug, this.steam.group);

    // Kerze links neben der Maschine (außerhalb der Wagenbahn)
    this.candle.group.position.set(-32, DESK_Y, 3);
    g.add(this.candle.group);

    // Schreibtisch-Kleinigkeiten
    const stack = buildBookStack(9);
    stack.position.set(38, DESK_Y, -24);
    stack.rotation.y = 0.25;
    const pencils = buildPencilCup(4);
    pencils.position.set(-38, DESK_Y, -20);
    const paper = buildPaperStack(13);
    paper.position.set(29, DESK_Y, 21);
    paper.rotation.y = -0.12;
    g.add(stack, pencils, paper);

    // Vorhänge an einer Stange und Lichterkette über dem Fenster
    const rodY = WIN.y1 + 8;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, WIN.x1 - WIN.x0 + 36, 12),
      new THREE.MeshStandardMaterial({ color: '#2b2118', metalness: 0.5, roughness: 0.45 }),
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set((WIN.x0 + WIN.x1) / 2, rodY, WALL_Z + 3.4);
    g.add(rod);
    for (const [x, seed] of [[WIN.x0 - 5, 3], [WIN.x1 + 2, 8]] as const) {
      const curtain = buildCurtain(15, rodY - 0.5 - DESK_Y, seed);
      curtain.position.set(x, rodY - 0.3, WALL_Z + 3.4);
      g.add(curtain);
    }
    g.add(this.fairy.group);
    return g;
  }

  /** Fensterlaibung (Wandstärke). */
  private buildReveal(): THREE.Object3D {
    const g = new THREE.Group();
    const depth = 8;
    const reveal = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.95 });
    const sides: [number, number, number, number, number][] = [
      [WIN.x0, (WIN.y0 + WIN.y1) / 2, 0.01, WIN.y1 - WIN.y0, 0],
      [WIN.x1, (WIN.y0 + WIN.y1) / 2, 0.01, WIN.y1 - WIN.y0, 0],
      [(WIN.x0 + WIN.x1) / 2, WIN.y1, WIN.x1 - WIN.x0, 0.01, 0],
      [(WIN.x0 + WIN.x1) / 2, WIN.y0, WIN.x1 - WIN.x0, 0.01, 0],
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
    this.rainGlass.mesh.position.set(cx, cy, z - 0.1);
    g.add(glass, this.rainGlass.mesh);
    return g;
  }
}
