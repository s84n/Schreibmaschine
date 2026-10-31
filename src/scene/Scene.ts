import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animator, ease, type TweenHandle } from '../animation/Tweens';
import { PRINT_POINT } from '../typewriter/dims';
import { buildEnvironment } from './Environment';
import { Room } from './Room';
import { PostFX } from './PostFX';
import type { RoomTargetId } from './Targets';

export type Quality = 'high' | 'low';
export type CameraView = 'machine' | 'paper';
export type TimeOfDay = 'day' | 'night';

const LAMP = 2600;
const RIM = 0.6;
const HEMI = 0.25;

/** Bildraten: voll, solange etwas passiert, sonst reicht weniger für Kerze und Regen. */
const FPS = { active: 60, idle: 30, longIdle: 20, background: 15, covered: 5 };
const FPS_SAVER = { active: 30, idle: 15, longIdle: 12, background: 10, covered: 5 };
/** So lange nach der letzten Eingabe gilt die Szene als aktiv bzw. noch nicht lange still (ms). */
const ACTIVE_MS = 1500;
const IDLE_MS = 30000;
/** Selbsthilfe bei schwacher Grafik: Stufen der Auflösung, danach Grafik „niedrig“. */
const SCALE_STEPS = [1, 0.8, 0.65];
const SLOW_FRAME_MS = 36;
const SLOW_SAMPLES = 150;
const WARMUP_MS = 6000;

const CAMERAS: Record<CameraView, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  machine: { pos: new THREE.Vector3(0, 27, 62), target: new THREE.Vector3(0, 13, -4) },
  paper: { pos: new THREE.Vector3(0, 21, 20), target: new THREE.Vector3(0, 12.5, -4.5) },
};

/** Renderer, Kamera, Steuerung und Render-Schleife. */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private post?: PostFX;
  private ao = true;
  private quality: Quality = 'high';
  private last = performance.now();
  private readonly lamp: THREE.SpotLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private night = 0;
  private nightTween?: TweenHandle;
  /** Anteil der Bildhöhe, der sichtbar bleibt (Tastatur-Fallback im Vollbild) */
  private heightFactor = 1;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private downAt?: { x: number; y: number; armed: boolean };
  private pendingHover?: PointerEvent;
  private hovered?: RoomTargetId;
  /** Ein Ding im Zimmer wurde angeklickt. */
  onTarget?: (id: RoomTargetId) => void;
  /** Der Mauszeiger wechselt auf ein Ding (Position in Pixeln für die Beschriftung). */
  onHover?: (id: RoomTargetId | undefined, x: number, y: number) => void;
  /** Welche Dinge gerade bedienbar sind. */
  targetEnabled: (id: RoomTargetId) => boolean = () => true;
  /** Klick zählt nur, wenn die Oberfläche bereit ist: Der erste Klick weckt sonst nur auf. */
  canInteract: () => boolean = () => true;
  /** Was das Fenster und andere Dinge verdeckt (die Maschine). */
  blockers: THREE.Object3D[] = [];
  /** Die Sicht ist bedeckt (Leseansicht): Die Szene läuft auf Sparflamme. */
  covered = false;
  /** Grafik wurde automatisch gesenkt, weil der Rechner nicht hinterherkam. */
  onQualityDrop?: () => void;
  private readonly startedAt = performance.now();
  private lastActivity = performance.now();
  private nextFrame = 0;
  private frameCount = 0;
  private saver = false;
  private calm = false;
  private paperZoom = 1;
  private scaleStep = 0;
  private slowSum = 0;
  private slowCount = 0;
  /** Wer nach einem automatischen Senken wieder „hoch“ wählt, entscheidet selbst. */
  private adaptive = true;
  readonly room: Room;
  private readonly focus = PRINT_POINT.clone();

  constructor(container: HTMLElement, private readonly onFrame: (dt: number) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
    this.camera.position.copy(CAMERAS.machine.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(CAMERAS.machine.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 85;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.08;
    this.controls.minAzimuthAngle = -Math.PI / 2.2;
    this.controls.maxAzimuthAngle = Math.PI / 2.2;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;

    ({ lamp: this.lamp, rim: this.rim, hemi: this.hemi } = buildEnvironment(this.scene, this.renderer));
    this.room = new Room(this.scene, this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.room.group);
    this.setQuality('high');

    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    // Schattenkarten werden gezielt erneuert: Im Stillstand kosten sie sonst am meisten
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.bindTargets();
    for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchmove']) window.addEventListener(ev, () => this.poke(), { passive: true });
    this.controls.addEventListener('change', () => this.poke());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Meldet Aktivität: Die Szene läuft kurz mit voller Bildrate. */
  poke(): void {
    this.lastActivity = performance.now();
    // Nicht auf das nächste gedrosselte Bild warten: Eine Eingabe soll sofort sichtbar sein
    this.nextFrame = 0;
  }

  /** Akku-Modus: halbe Bildrate, geringere Auflösung, keine Kontaktschatten. */
  setSaver(on: boolean): void {
    this.saver = on;
    this.post?.setAO(this.ao && !on);
    this.applyPixelRatio();
    this.resize();
  }

  /** Ruhige Bewegung: Die Kamera fährt nicht, sondern wechselt direkt. */
  setCalm(on: boolean): void {
    this.calm = on;
    this.room.setCalm(on);
  }

  /** Papieransicht näher ans Blatt: Faktor 1 = normal, größer = größere Schrift. */
  setPaperZoom(k: number, current: CameraView): void {
    this.paperZoom = k;
    if (current === 'paper') this.flyTo('paper');
  }

  private applyPixelRatio(): void {
    const dpr = window.devicePixelRatio || 1;
    // Auch „niedrig“ nicht unter 1,5: Smartphones haben kleine, sehr dichte Displays
    const cap = this.saver ? 1.25 : this.quality === 'high' ? 2 : 1.5;
    this.renderer.setPixelRatio(Math.max(0.75, Math.min(dpr, cap) * SCALE_STEPS[this.scaleStep]));
  }

  setQuality(q: Quality): void {
    if (q === 'high' && this.quality === 'low') this.adaptive = false;
    this.quality = q;
    this.applyPixelRatio();
    this.syncShadows();
    this.room.setShaftStrength(q === 'high' ? 1 : 0.45);
    this.lamp.shadow.mapSize.setScalar(q === 'high' ? 2048 : 512);
    this.lamp.shadow.map?.dispose();
    this.lamp.shadow.map = null;
    if (q === 'high') {
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.post ??= new PostFX(this.renderer, this.scene, this.camera, this.focus);
      this.post.setAO(this.ao && !this.saver);
    } else {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.post?.dispose();
      this.post = undefined;
    }
    this.resize();
  }

  /** Tag/Nacht mit Überblendung (beim Start ohne). */
  setTime(time: TimeOfDay, animate = true): void {
    const to = time === 'night' ? 1 : 0;
    this.nightTween?.cancel();
    if (!animate) {
      this.applyNight(to);
      return;
    }
    const from = this.night;
    this.nightTween = animator.add({
      duration: 2.4,
      ease: ease.inOutCubic,
      onUpdate: (t) => this.applyNight(from + (to - from) * t),
    });
  }

  private applyNight(n: number): void {
    const wasNight = this.night > 0.5;
    this.night = n;
    this.lamp.intensity = LAMP * (1 - n);
    this.rim.intensity = RIM + (0.06 - RIM) * n;
    this.hemi.intensity = HEMI + (0.035 - HEMI) * n;
    this.room.setNight(n);
    if (wasNight !== n > 0.5) this.syncShadows();
  }

  /** Nur die jeweils führende Lichtquelle wirft Schatten – die Kerzen-Cubemap ist teuer. */
  private syncShadows(): void {
    const high = this.quality === 'high';
    const night = this.night > 0.5;
    this.lamp.castShadow = high && !night;
    this.room.candle.light.castShadow = high && night;
  }

  /** Kontaktschatten; wirken nur in der Grafikstufe „hoch“. */
  setAO(on: boolean): void {
    this.ao = on;
    this.post?.setAO(on && !this.saver);
  }

  /** Hält unten Platz frei, falls der Browser die Bildschirmtastatur nicht meldet. */
  setHeightFactor(f: number): void {
    this.heightFactor = f;
    this.resize();
  }

  /** Welches Ding liegt unter dem Zeiger? Die Maschine verdeckt, was hinter ihr steht. */
  private targetAt(e: PointerEvent): RoomTargetId | undefined {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.room.targets.pick(this.raycaster, this.targetEnabled);
    if (!hit) return undefined;
    const blocker = this.raycaster.intersectObjects(this.blockers, true)[0];
    return blocker && blocker.distance < hit.distance ? undefined : hit.id;
  }

  private bindTargets(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => (this.downAt = { x: e.clientX, y: e.clientY, armed: this.canInteract() }));
    el.addEventListener('pointerup', (e) => {
      const d = this.downAt;
      this.downAt = undefined;
      // Nur echte Klicks, kein Kameradrehen
      if (!d?.armed || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 8) return;
      const id = this.targetAt(e);
      if (id) this.onTarget?.(id);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && !e.buttons) this.pendingHover = e;
    });
    el.addEventListener('pointerleave', () => this.setHovered(undefined, 0, 0));
  }

  private setHovered(id: RoomTargetId | undefined, x: number, y: number): void {
    const changed = id !== this.hovered;
    this.hovered = id;
    if (changed) {
      this.room.targets.setHovered(id);
      this.renderer.domElement.style.cursor = id ? 'pointer' : '';
    }
    this.onHover?.(id, x, y);
  }

  /** Höchstens einmal je Bild prüfen: Der Strahltest gegen die Maschine ist nicht umsonst. */
  private updateHover(): void {
    const e = this.pendingHover;
    if (!e) return;
    this.pendingHover = undefined;
    this.setHovered(this.canInteract() ? this.targetAt(e) : undefined, e.clientX, e.clientY);
  }

  /** Fliegt die Kamera sanft zu einer Ansicht. */
  flyTo(view: CameraView): void {
    const { target } = CAMERAS[view];
    const pos = view === 'paper' ? target.clone().add(CAMERAS.paper.pos.clone().sub(target).divideScalar(this.paperZoom)) : CAMERAS[view].pos;
    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    animator.add({
      duration: this.calm ? 0 : 0.9,
      ease: ease.inOutCubic,
      onUpdate: (t) => {
        this.camera.position.lerpVectors(fromPos, pos, t);
        this.controls.target.lerpVectors(fromTarget, target, t);
      },
    });
  }

  private resize(): void {
    const w = window.innerWidth;
    // visualViewport schrumpft, wenn die Bildschirmtastatur offen ist
    const h = Math.round(Math.min(window.innerHeight, window.visualViewport?.height ?? Infinity) * this.heightFactor);
    this.camera.aspect = w / h;
    // Hochformat: weiter herauszoomen, damit die Maschine ganz sichtbar bleibt
    this.camera.fov = w / h < 1 ? 60 : 40;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post?.setSize(w, h);
  }

  /** Senkt die Auflösung und zuletzt die Grafikstufe, wenn das Bild dauerhaft zu langsam ist. */
  private watchLoad(frameMs: number, now: number): void {
    if (!this.adaptive || this.quality === 'low' || now - this.startedAt < WARMUP_MS || frameMs > 500 || !document.hasFocus()) return;
    const budget = Math.max(SLOW_FRAME_MS, (this.saver ? 1000 / FPS_SAVER.active : 0) * 1.3);
    this.slowSum += frameMs;
    if (++this.slowCount < SLOW_SAMPLES) return;
    const slow = this.slowSum / this.slowCount > budget;
    this.slowSum = this.slowCount = 0;
    if (!slow) return;
    if (this.scaleStep < SCALE_STEPS.length - 1) {
      this.scaleStep++;
      this.applyPixelRatio();
      this.resize();
    } else {
      this.onQualityDrop?.();
    }
  }

  private frame(): void {
    const now = performance.now();
    // Die Bildrate folgt dem, was gerade passiert: Das hält den Lüfter leise
    const quiet = now - this.lastActivity;
    const busy = animator.busy || quiet < ACTIVE_MS || this.room.targets.settling;
    const rates = this.saver ? FPS_SAVER : FPS;
    const fps = this.covered ? rates.covered : busy ? rates.active : !document.hasFocus() ? rates.background : quiet < IDLE_MS ? rates.idle : rates.longIdle;
    if (now < this.nextFrame - 1) return;
    this.nextFrame = Math.max(now, this.nextFrame + 1000 / fps);
    // Kerze und Fensterlicht bewegen sich kaum: Im Stillstand genügt jedes vierte Bild
    this.frameCount++;
    if (busy || this.frameCount % 4 === 0) this.renderer.shadowMap.needsUpdate = true;
    this.updateHover();
    // Nur Bilder mit voller Wunschrate sagen etwas über die Last aus
    if (busy && !this.covered) this.watchLoad(now - this.last, now);
    // Bewusst ungekappt: Animationen laufen in Echtzeit synchron zum Ton. Bei niedriger
    // Bildrate oder nach einem Tab-Wechsel springen sie einfach ans Ziel.
    const dt = (now - this.last) / 1000;
    this.last = now;
    animator.update(dt);
    this.onFrame(dt);
    this.room.update(dt, this.camera);
    this.controls.update();
    if (this.post && this.quality === 'high') this.post.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
