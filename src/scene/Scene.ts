import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animator, ease, type TweenHandle } from '../animation/Tweens';
import { PRINT_POINT } from '../typewriter/dims';
import { buildEnvironment } from './Environment';
import { Room } from './Room';
import { PostFX } from './PostFX';

export type Quality = 'high' | 'low';
export type CameraView = 'machine' | 'paper';
export type TimeOfDay = 'day' | 'night';

const LAMP = 2600;
const RIM = 0.6;
const HEMI = 0.25;

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
  private downAt?: { x: number; y: number };
  /** Wird aufgerufen, wenn die Tasse angeklickt wird (nur gesetzt, wenn ein Link hinterlegt ist). */
  onMug?: () => void;
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
    this.bindMug();
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    // Auch „niedrig“ nicht unter 1,5: Smartphones haben kleine, sehr dichte Displays
    this.renderer.setPixelRatio(Math.min(dpr, q === 'high' ? 2 : 1.5));
    this.syncShadows();
    this.lamp.shadow.mapSize.setScalar(q === 'high' ? 2048 : 512);
    this.lamp.shadow.map?.dispose();
    this.lamp.shadow.map = null;
    if (q === 'high') {
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.post ??= new PostFX(this.renderer, this.scene, this.camera, this.focus);
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
      duration: 1.6,
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

  /** Hält unten Platz frei, falls der Browser die Bildschirmtastatur nicht meldet. */
  setHeightFactor(f: number): void {
    this.heightFactor = f;
    this.resize();
  }

  private bindMug(): void {
    const el = this.renderer.domElement;
    const hitsMug = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      return this.raycaster.intersectObject(this.room.mugHit).length > 0;
    };
    el.addEventListener('pointerdown', (e) => (this.downAt = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      const d = this.downAt;
      this.downAt = undefined;
      // Nur echte Klicks, kein Kameradrehen
      if (this.onMug && d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && hitsMug(e)) this.onMug();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && !e.buttons) el.style.cursor = this.onMug && hitsMug(e) ? 'pointer' : '';
    });
  }

  /** Fliegt die Kamera sanft zu einer Ansicht. */
  flyTo(view: CameraView): void {
    const { pos, target } = CAMERAS[view];
    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    animator.add({
      duration: 0.9,
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

  private frame(): void {
    const now = performance.now();
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
