import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animator, ease } from '../animation/Tweens';
import { PRINT_POINT } from '../typewriter/dims';
import { buildEnvironment } from './Environment';
import { Room } from './Room';
import { PostFX } from './PostFX';

export type Quality = 'high' | 'low';
export type CameraView = 'machine' | 'paper';

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

    this.lamp = buildEnvironment(this.scene, this.renderer).lamp;
    this.room = new Room(this.scene, this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.room.group);
    this.setQuality('high');

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 2) : 1);
    this.lamp.castShadow = q === 'high';
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
    const h = window.innerHeight;
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
    this.controls.update();
    if (this.post && this.quality === 'high') this.post.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
