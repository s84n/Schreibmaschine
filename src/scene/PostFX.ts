import * as THREE from 'three';
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
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

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, focus: THREE.Vector3) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.addPass(new RenderPass(scene, camera));

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
