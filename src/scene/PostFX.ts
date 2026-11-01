import * as THREE from 'three';
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  NormalPass,
  RenderPass,
  ToneMappingEffect,
  SSAOEffect,
  ToneMappingMode,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing';

/** Kantenglättung nach Pixelzahl: Ab 1440p fallen die Treppen kaum auf, die Bandbreite sehr. */
const samplesFor = (renderer: THREE.WebGLRenderer) => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  return size.x * size.y >= 3_000_000 ? 2 : 4;
};

/**
 * Filmischer Look: Tiefenschärfe auf den Druckpunkt, dezentes Glühen auf Chrom,
 * Vignette, Filmkorn und ACES-Tonemapping. Mit `full = false` bleibt nur Kantenglättung und
 * Tonemapping (Grafik „niedrig“, wenn der Canvas selbst keine Kantenglättung mitbringt).
 */
export class PostFX {
  readonly composer: EffectComposer;
  private dof?: DepthOfFieldEffect;
  private normalPass?: NormalPass;
  private aoPass?: EffectPass;
  /** So viele Bilder lang müssen die Kontaktschatten noch neu berechnet werden. */
  private aoFrames = 2;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, focus: THREE.Vector3, full = true) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: samplesFor(renderer) });
    this.composer.addPass(new RenderPass(scene, camera));
    if (!full) {
      this.composer.addPass(new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));
      return;
    }

    // Kontaktschatten (Maße in cm). Reine Lichteffekte ohne Tiefe (Flamme, Staub, Regen) zählen nicht als Oberfläche.
    // Halbe Auflösung: Die Schatten werden ohnehin weich gezeichnet
    const normalPass = (this.normalPass = new NormalPass(scene, camera, { resolutionScale: 0.5 }));
    // Das Blatt ist doppelseitig, das Ersatzmaterial dieses Passes nicht: Ohne DoubleSide fehlte es
    // hier, und die Kontaktschatten zeichneten die Vorhangfalten dahinter aufs Papier.
    const normals = (normalPass as unknown as { renderPass: { overrideMaterial: THREE.Material } }).renderPass.overrideMaterial;
    normals.side = THREE.DoubleSide;
    const renderNormals = normalPass.render.bind(normalPass);
    normalPass.render = (...args) => {
      // Steht alles still, gilt das letzte Ergebnis weiter
      if (this.aoFrames <= 0) return;
      const hidden: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (mat && mat.depthWrite === false) hidden.push(o);
      });
      hidden.forEach((o) => (o.visible = false));
      renderNormals(...args);
      hidden.forEach((o) => (o.visible = true));
    };
    this.composer.addPass(normalPass);
    const ssao = new SSAOEffect(camera, normalPass.texture, {
      blendFunction: BlendFunction.MULTIPLY,
      samples: 9,
      rings: 3,
      radius: 0.045,
      intensity: 1.6,
      luminanceInfluence: 0.55,
      worldDistanceThreshold: 110,
      worldDistanceFalloff: 25,
      worldProximityThreshold: 2.2,
      worldProximityFalloff: 0.6,
      resolutionScale: 0.5,
    });
    const updateAO = ssao.update.bind(ssao);
    ssao.update = (...args) => {
      if (this.aoFrames <= 0) return;
      this.aoFrames--;
      updateAO(...args);
    };
    this.aoPass = new EffectPass(camera, ssao);
    this.composer.addPass(this.aoPass);

    this.dof = new DepthOfFieldEffect(camera, { focusRange: 22, bokehScale: 1.5, resolutionScale: 0.4 });
    this.dof.target = focus;
    this.composer.addPass(new EffectPass(camera, this.dof));

    const bloom = new BloomEffect({ intensity: 0.35, luminanceThreshold: 0.9, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6 });
    const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.62 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.07;
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.composer.addPass(new EffectPass(camera, bloom, vignette, noise, tone));
  }

  /** Kamera oder Maschine haben sich bewegt: Kontaktschatten neu berechnen. */
  touch(): void {
    // Zwei Bilder: Das zweite sieht die Tiefe des letzten Standes
    this.aoFrames = 2;
  }

  setAO(on: boolean): void {
    if (!this.normalPass || !this.aoPass) return;
    this.normalPass.enabled = on;
    this.aoPass.enabled = on;
    this.touch();
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
    this.composer.multisampling = samplesFor(this.composer.getRenderer());
    this.touch();
  }

  render(dt: number): void {
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
