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

/**
 * Filmischer Look: Tiefenschärfe auf den Druckpunkt, dezentes Glühen auf Chrom,
 * Vignette, Filmkorn und ACES-Tonemapping.
 */
export class PostFX {
  readonly composer: EffectComposer;
  private readonly dof: DepthOfFieldEffect;
  private readonly normalPass: NormalPass;
  private readonly aoPass: EffectPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, focus: THREE.Vector3) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.addPass(new RenderPass(scene, camera));

    // Kontaktschatten (Maße in cm). Reine Lichteffekte ohne Tiefe (Flamme, Staub, Regen) zählen nicht als Oberfläche.
    this.normalPass = new NormalPass(scene, camera);
    // Das Blatt ist doppelseitig, das Ersatzmaterial dieses Passes nicht: Ohne DoubleSide fehlte es
    // hier, und die Kontaktschatten zeichneten die Vorhangfalten dahinter aufs Papier.
    const normals = (this.normalPass as unknown as { renderPass: { overrideMaterial: THREE.Material } }).renderPass.overrideMaterial;
    normals.side = THREE.DoubleSide;
    const renderNormals = this.normalPass.render.bind(this.normalPass);
    this.normalPass.render = (...args) => {
      const hidden: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (mat && mat.depthWrite === false) hidden.push(o);
      });
      hidden.forEach((o) => (o.visible = false));
      renderNormals(...args);
      hidden.forEach((o) => (o.visible = true));
    };
    this.composer.addPass(this.normalPass);
    this.aoPass = new EffectPass(
      camera,
      new SSAOEffect(camera, this.normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        samples: 12,
        rings: 4,
        radius: 0.045,
        intensity: 1.6,
        luminanceInfluence: 0.55,
        worldDistanceThreshold: 110,
        worldDistanceFalloff: 25,
        worldProximityThreshold: 2.2,
        worldProximityFalloff: 0.6,
        resolutionScale: 0.5,
      }),
    );
    this.composer.addPass(this.aoPass);

    this.dof = new DepthOfFieldEffect(camera, { focusRange: 22, bokehScale: 3.2, resolutionScale: 0.5 });
    this.dof.target = focus;
    this.composer.addPass(new EffectPass(camera, this.dof));

    const bloom = new BloomEffect({ intensity: 0.35, luminanceThreshold: 0.9, luminanceSmoothing: 0.2, mipmapBlur: true });
    const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.62 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.07;
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.composer.addPass(new EffectPass(camera, bloom, vignette, noise, tone));
  }

  setAO(on: boolean): void {
    this.normalPass.enabled = on;
    this.aoPass.enabled = on;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
