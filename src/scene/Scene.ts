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

/** Tageslicht im Zimmer: gedämpft, hell ist vor allem die Aussicht selbst. */
const LAMP = 1150;
const RIM = 0.4;
const HEMI = 0.16;

/** Bildraten: voll, solange etwas passiert, sonst reicht weniger für Kerze und Regen. */
const FPS = { active: 60, idle: 30, longIdle: 20, background: 15, covered: 5 };
const FPS_SAVER = { active: 30, idle: 15, longIdle: 12, background: 10, covered: 5 };
/** So lange nach der letzten Eingabe gilt die Szene als aktiv bzw. noch nicht lange still (ms). */
const ACTIVE_MS = 1500;
/**
 * Atmende Kamera: Ein Atemzug alle gut 4 s hebt und neigt den Blick, dazu ein langsames Treiben zur
 * Seite (Bogenmaß bzw. cm). Anschläge geben der Feder kleine Stöße. Beim Schreiben atmet sie etwas tiefer.
 */
const BREATH = { pitch: 0.0035, lift: 0.22, dolly: 0.5, yaw: 0.0045, rate: 1.45 };
const BREATH_TYPING = 1.35;
/** So schnell blendet das Atmen ein und aus (pro Sekunde) */
const BREATH_FADE = 0.5;
const SPRING = { stiffness: 55, damping: 9 };
const KICK = { key: 0.012, return: 0.022 };
/** Nach dem letzten Anschlag so lange tiefer atmen */
const TYPING_BREATH_S = 6;
const IDLE_MS = 30000;
/** Selbsthilfe bei schwacher Grafik: Stufen der Auflösung, danach Grafik „niedrig“. */
const SCALE_STEPS = [1, 0.85, 0.7, 0.6];
/** Über diesem Schnitt sinkt die Auflösung, darunter steigt sie wieder, über HOPELESS die Grafikstufe. */
const SLOW_FRAME_MS = 21;
const FAST_FRAME_MS = 18;
const HOPELESS_FRAME_MS = 36;
const SLOW_SAMPLES = 90;
/** So viele schnelle Messfenster in Folge, bevor die Auflösung probeweise wieder steigt. */
const FAST_WINDOWS = 8;
/** Mehr Pixel lohnen sich nicht: 4K wird mit rund 3200 × 1800 berechnet und hochskaliert. */
const MAX_PIXELS = 5_800_000;
/** Mindestabstand der Schattenkarten in ms: Die Kerze flackert, tagsüber bewegt sich nur die Maschine. */
const SHADOW_MS = { day: 33, nightMoving: 50, nightStill: 125 };
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
  private quality: Quality;
  /** Mit Nachbearbeitung wäre die Kantenglättung des Canvas doppelte Arbeit. */
  private readonly nativeAA: boolean;
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
  /** Zweimal je Sekunde: erreichte und angestrebte Bildrate. */
  onFps?: (fps: number, target: number) => void;
  private fpsFrames = 0;
  private fpsExpected = 0;
  private fpsSince = performance.now();
  /** Grafik wurde automatisch gesenkt, weil der Rechner nicht hinterherkam. */
  onQualityDrop?: () => void;
  private readonly startedAt = performance.now();
  private lastActivity = performance.now();
  private nextFrame = 0;
  private saver = false;
  private calm = false;
  /** Atmende Kamera: eingeschaltet, Hüllkurve, Zeit, Federauslenkung (Neigen, Schwenken, Vor/Zurück) und Tempo */
  private breathe = true;
  private sway = 0;
  private swayClock = 0;
  private typedAt = -Infinity;
  /** Die Feder schwingt: dann volle Bildrate, das ruhige Atmen kommt mit der gedrosselten aus */
  private swayKicked = false;
  private readonly swayOff = new THREE.Vector3();
  private readonly swayVel = new THREE.Vector3();
  private readonly swayPos = new THREE.Vector3();
  private readonly swayQuat = new THREE.Quaternion();
  private paperZoom = 1;
  private scaleStep = 0;
  private fastWindows = 0;
  /** Eine höhere Auflösung wurde probiert und war zu viel: nicht noch einmal versuchen. */
  private scaleLocked = false;
  private triedUp = false;
  private lastShadow = 0;
  private shadowDirty = true;
  private wasMoving = false;
  private readonly lastCamPos = new THREE.Vector3();
  private readonly lastCamQuat = new THREE.Quaternion();
  private slowSum = 0;
  private slowCount = 0;
  /** Wer nach einem automatischen Senken wieder „hoch“ wählt, entscheidet selbst. */
  private adaptive = true;
  readonly room: Room;
  private readonly focus = PRINT_POINT.clone();

  constructor(container: HTMLElement, private readonly onFrame: (dt: number) => void, initialQuality: Quality) {
    this.quality = initialQuality;
    this.nativeAA = initialQuality === 'low';
    this.renderer = new THREE.WebGLRenderer({ antialias: this.nativeAA, powerPreference: 'high-performance', preserveDrawingBuffer: false });
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
    // Die 4K-Maserung nur dort, wo auch die Grafikstufe „hoch“ läuft
    this.room = new Room(this.scene, this.renderer.capabilities.getMaxAnisotropy(), initialQuality === 'high' && this.renderer.capabilities.maxTextureSize >= 4096);
    this.room.onShadowsChanged = () => (this.shadowDirty = true);
    this.scene.add(this.room.group);
    this.setQuality(initialQuality);

    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    // Schattenkarten werden gezielt erneuert: Im Stillstand kosten sie sonst am meisten
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.bindTargets();
    // Eine bloße Mausbewegung ändert am Bild nichts; dreht sie die Kamera, meldet das die Steuerung
    for (const ev of ['keydown', 'pointerdown', 'wheel', 'touchmove']) window.addEventListener(ev, () => this.poke(), { passive: true });
    this.controls.addEventListener('change', () => this.poke());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
    // Erst wenn das erste Bild steht, und nur auf Rechnern mit Nachbearbeitung
    window.setTimeout(() => void this.precompile(), 1500);
  }

  /**
   * Übersetzt die Shader aller Lichtzustände im Voraus. Ausgeschaltete Lichter sind unsichtbar und
   * sparen dadurch in jedem Pixel Rechenzeit, ein neuer Zustand bräuchte aber neue Shader: Ohne
   * diese Vorarbeit ruckelte der erste Wechsel zur Nacht oder das erste Schalten der Lampe.
   */
  private async precompile(): Promise<void> {
    // Ohne paralleles Übersetzen stünde das Bild dabei still; dann lieber einmal beim Wechsel
    if (!this.renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const { lamp: main, rim } = this;
    const { candle: { light: candle }, lamp: { light: desk }, fairy: { fill } } = this.room;
    const saved = [main.visible, main.castShadow, rim.visible, candle.visible, candle.castShadow, desk.visible, fill.visible] as const;
    const restore = () => {
      [main.visible, main.castShadow, rim.visible, candle.visible, candle.castShadow, desk.visible, fill.visible] = saved;
    };
    //  Tag, Überblendung vor und nach der Mitte, Nacht
    const phases = [
      { main: true, mainShadow: true, candle: false, candleShadow: false },
      { main: true, mainShadow: true, candle: true, candleShadow: false },
      { main: true, mainShadow: false, candle: true, candleShadow: true },
      { main: false, mainShadow: false, candle: true, candleShadow: true },
    ];
    for (const lit of [true, false]) {
      for (const p of phases) {
        const post = this.post;
        if (!post || this.quality !== 'high') return;
        main.visible = rim.visible = p.main;
        main.castShadow = p.mainShadow;
        candle.visible = fill.visible = p.candle;
        candle.castShadow = p.candleShadow;
        desk.visible = lit;
        // Die Shader müssen zum Ziel passen, in das später wirklich gezeichnet wird
        this.renderer.setRenderTarget(post.composer.inputBuffer);
        const done = this.renderer.compileAsync(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
        restore();
        await done;
      }
    }
  }

  /** Etwas hat sich außerhalb der Animationen geändert: Schatten und Kontaktschatten erneuern. */
  invalidate(): void {
    this.shadowDirty = true;
    this.post?.touch();
  }

  /** Meldet Aktivität: Die Szene läuft kurz mit voller Bildrate. */
  poke(): void {
    this.lastActivity = performance.now();
    // Nicht auf das nächste gedrosselte Bild warten, aber die aktive Bildrate gilt weiter:
    // Sonst rechnete jede Mausbewegung auf 144-Hz-Monitoren mit voller Bildwiederholrate
    this.nextFrame = Math.min(this.nextFrame, this.last + 1000 / (this.saver ? FPS_SAVER : FPS).active);
  }

  /** Akku-Modus: halbe Bildrate, geringere Auflösung, keine Kontaktschatten. */
  setSaver(on: boolean): void {
    this.saver = on;
    this.post?.setAO(this.ao && !on);
    this.resize();
  }

  /** Ruhige Bewegung: Die Kamera fährt nicht, sondern wechselt direkt. */
  setBreathe(on: boolean): void {
    this.breathe = on;
  }

  private get breathing(): boolean {
    return this.breathe && !this.calm;
  }

  /** Ein Anschlag oder der Wagenrücklauf: Die Kamera nickt leicht mit. */
  nudge(kind: 'key' | 'return'): void {
    if (!this.breathing) return;
    this.typedAt = performance.now();
    const k = KICK[kind];
    if (kind === 'key') this.swayVel.add(new THREE.Vector3(-k * (0.6 + Math.random() * 0.4), k * (Math.random() - 0.5) * 0.6, 0));
    // Der Wagen fährt zurück: ein kleiner Schwenk mit, dazu ein Hauch nach vorn
    else this.swayVel.add(new THREE.Vector3(-k * 0.3, k, k * 40));
  }

  /** Atmen und Feder fortschreiben. Liefert, ob sich die Kamera bewegt und ob die Feder gerade schwingt. */
  private updateSway(dt: number, now: number): { moving: boolean; kicked: boolean } {
    const off = this.swayOff;
    const vel = this.swayVel;
    const typing = now - this.typedAt < TYPING_BREATH_S * 1000;
    const target = this.breathing ? (typing ? BREATH_TYPING : 1) : 0;
    const step = Math.min(dt, 0.2) * BREATH_FADE;
    this.sway += Math.max(-step, Math.min(step, target - this.sway));
    // In kleinen Schritten, damit die Feder auch bei niedriger Bildrate nicht aufschaukelt
    const steps = Math.min(Math.ceil(dt / 0.01), 20);
    const h = Math.min(dt, 0.2) / steps;
    for (let i = 0; i < steps; i++) {
      vel.addScaledVector(off, -SPRING.stiffness * h).multiplyScalar(1 - SPRING.damping * h);
      off.addScaledVector(vel, h);
    }
    const settled = off.lengthSq() < 1e-10 && vel.lengthSq() < 1e-9;
    if (settled) {
      off.set(0, 0, 0);
      vel.set(0, 0, 0);
    }
    if (this.sway > 0) this.swayClock += Math.min(dt, 0.2);
    return { moving: this.sway > 0 || !settled, kicked: !settled };
  }

  /** Versatz der atmenden Kamera auflegen; restoreSway() nimmt ihn nach dem Bild wieder ab. */
  private applySway(): void {
    const cam = this.camera;
    this.swayPos.copy(cam.position);
    this.swayQuat.copy(cam.quaternion);
    const e = this.sway;
    const t = this.swayClock;
    // Ein Atemzug: einatmen hebt und neigt leicht nach oben, ausatmen sinkt zurück; nicht ganz regelmäßig
    const breath = Math.sin(t * BREATH.rate + 0.35 * Math.sin(t * 0.37));
    const drift = Math.sin(t * 0.29 + 2) + 0.5 * Math.sin(t * 0.11);
    cam.rotateX(this.swayOff.x + e * BREATH.pitch * breath);
    cam.rotateY(this.swayOff.y + e * BREATH.yaw * drift);
    // Heben und Vorrücken im Verhältnis zum Abstand: Nah am Blatt wirkte derselbe Weg viel größer
    const near = cam.position.distanceTo(this.controls.target) / 66;
    cam.translateY(e * BREATH.lift * breath * near);
    cam.translateZ(-(this.swayOff.z + e * BREATH.dolly * Math.sin(t * BREATH.rate * 0.5 + 1)) * near);
  }

  private restoreSway(): void {
    this.camera.position.copy(this.swayPos);
    this.camera.quaternion.copy(this.swayQuat);
  }

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
    const base = Math.min(dpr, cap);
    const budget = Math.min(1, Math.sqrt(MAX_PIXELS / (window.innerWidth * window.innerHeight * base * base)));
    this.renderer.setPixelRatio(Math.max(0.75, base * budget * SCALE_STEPS[this.scaleStep]));
  }

  setQuality(q: Quality): void {
    if (q === 'high' && this.quality === 'low') this.adaptive = false;
    this.quality = q;
    this.syncShadows();
    this.room.setShaftStrength(q === 'high' ? 0.5 : 0.25);
    this.lamp.shadow.mapSize.setScalar(q === 'high' ? 2048 : 512);
    this.lamp.shadow.map?.dispose();
    this.lamp.shadow.map = null;
    this.post?.dispose();
    this.post = undefined;
    if (q === 'high' || !this.nativeAA) {
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.post = new PostFX(this.renderer, this.scene, this.camera, this.focus, q === 'high');
      this.post.setAO(this.ao && !this.saver);
    } else {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
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
    // Was kaum noch beiträgt, kostet sonst weiter in jedem Pixel
    this.lamp.visible = this.rim.visible = n < 0.999;
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
    this.shadowDirty = true;
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
      if (e.pointerType !== 'mouse') return;
      if (!e.buttons) this.pendingHover = e;
      // Beim Kameradrehen bliebe die Beschriftung sonst an einem Ding hängen, das längst woanders ist
      else if (this.hovered) this.setHovered(undefined, 0, 0);
    });
    el.addEventListener('pointerleave', () => this.setHovered(undefined, 0, 0));
  }

  private setHovered(id: RoomTargetId | undefined, x: number, y: number): void {
    const changed = id !== this.hovered;
    this.hovered = id;
    if (changed) this.renderer.domElement.style.cursor = id ? 'pointer' : '';
    this.onHover?.(id, x, y);
  }

  /** Höchstens einmal je Bild prüfen: Der Strahltest gegen die Maschine ist nicht umsonst. */
  private updateHover(): void {
    const e = this.pendingHover;
    if (!e) return;
    this.pendingHover = undefined;
    this.setHovered(this.canInteract() ? this.targetAt(e) : undefined, e.clientX, e.clientY);
  }

  /** Smartphone: im Hochformat weiter zurück, damit die ganze Maschine samt Wagenweg ins Bild passt. */
  frameForPhone(): void {
    const { pos, target } = CAMERAS.machine;
    const back = this.camera.aspect < 0.8 ? 1.25 : 1;
    this.controls.maxDistance = 85 * back;
    this.camera.position.copy(target).add(pos.clone().sub(target).multiplyScalar(back));
    this.controls.target.copy(target);
    this.poke();
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
    this.applyPixelRatio();
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
    const saverBudget = this.saver ? (1000 / FPS_SAVER.active) * 1.3 : 0;
    this.slowSum += frameMs;
    if (++this.slowCount < SLOW_SAMPLES) return;
    const mean = this.slowSum / this.slowCount;
    this.slowSum = this.slowCount = 0;
    if (mean > Math.max(SLOW_FRAME_MS, saverBudget)) {
      this.fastWindows = 0;
      if (this.triedUp) this.scaleLocked = true;
      if (this.scaleStep < SCALE_STEPS.length - 1) {
        this.scaleStep++;
        this.resize();
      } else if (mean > Math.max(HOPELESS_FRAME_MS, saverBudget)) {
        this.onQualityDrop?.();
      }
    } else if (!this.saver && mean < FAST_FRAME_MS && this.scaleStep > 0 && !this.scaleLocked && ++this.fastWindows >= FAST_WINDOWS) {
      this.fastWindows = 0;
      this.triedUp = true;
      this.scaleStep--;
      this.resize();
    }
  }

  /** Schattenkarten kosten ein Mehrfaches eines Bildes: nur erneuern, wenn sich wirklich etwas ändert. */
  private updateShadows(now: number, moving: boolean): void {
    if (this.wasMoving && !moving) this.shadowDirty = true;
    this.wasMoving = moving;
    const night = this.night > 0.5;
    // Nachts flackert die Kerze auch im Stillstand; ruhig gestellt oder verdeckt nicht
    const still = this.covered || this.calm ? Infinity : SHADOW_MS.nightStill;
    const gap = night ? (moving ? SHADOW_MS.nightMoving : still) : moving ? SHADOW_MS.day : Infinity;
    if (!this.shadowDirty && now - this.lastShadow < gap) return;
    this.renderer.shadowMap.needsUpdate = true;
    this.lastShadow = now;
    this.shadowDirty = false;
  }

  /** Kontaktschatten hängen nur an Kamera und Geometrie. */
  private updateAO(moving: boolean): void {
    const cam = this.camera;
    if (moving || !cam.position.equals(this.lastCamPos) || !cam.quaternion.equals(this.lastCamQuat)) this.post?.touch();
    this.lastCamPos.copy(cam.position);
    this.lastCamQuat.copy(cam.quaternion);
  }

  /** Die Wunschrate wechselt laufend: Sie wird über das Messfenster gemittelt wie die erreichte. */
  private measureFps(now: number, target: number): void {
    this.fpsFrames++;
    this.fpsExpected += ((now - this.last) / 1000) * target;
    const elapsed = now - this.fpsSince;
    if (elapsed < 500) return;
    this.onFps?.(Math.round((this.fpsFrames * 1000) / elapsed), Math.round((this.fpsExpected * 1000) / elapsed));
    this.fpsFrames = this.fpsExpected = 0;
    this.fpsSince = now;
  }

  private frame(): void {
    const now = performance.now();
    // Die Bildrate folgt dem, was gerade passiert: Das hält den Lüfter leise
    const quiet = now - this.lastActivity;
    const busy = animator.busy || quiet < ACTIVE_MS || this.swayKicked;
    const rates = this.saver ? FPS_SAVER : FPS;
    const fps = this.covered ? rates.covered : busy ? rates.active : !document.hasFocus() ? rates.background : quiet < IDLE_MS ? rates.idle : rates.longIdle;
    if (now < this.nextFrame - 1) return;
    this.nextFrame = Math.max(now, this.nextFrame + 1000 / fps);
    this.measureFps(now, fps);
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
    const moving = animator.busy;
    const sway = this.updateSway(dt, now);
    const swaying = sway.moving;
    this.swayKicked = sway.kicked;
    this.updateShadows(now, moving);
    // Die Steuerung sieht den Versatz nie: Sonst hielte sie ihn für eine Mausbewegung
    if (swaying) this.applySway();
    this.updateAO(moving || swaying);
    if (this.post) this.post.render(dt);
    else this.renderer.render(this.scene, this.camera);
    if (swaying) this.restoreSway();
  }
}
