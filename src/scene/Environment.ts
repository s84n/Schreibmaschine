import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Licht und Umgebungsreflexionen (Tisch, Wand und Fenster: siehe Room). */
export function buildEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): { lamp: THREE.SpotLight; rim: THREE.DirectionalLight; hemi: THREE.HemisphereLight } {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  scene.background = new THREE.Color('#15110e');
  scene.fog = new THREE.Fog('#15110e', 160, 400);

  // Warme Schreibtischlampe links oben
  const lamp = new THREE.SpotLight('#ffd9a8', 2600, 160, Math.PI / 5, 0.55, 1.6);
  lamp.position.set(-30, 55, 22);
  lamp.target.position.set(0, 6, -2);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0002;
  lamp.shadow.normalBias = 0.03;
  lamp.shadow.camera.near = 20;
  lamp.shadow.camera.far = 120;
  scene.add(lamp, lamp.target);

  // Kühles Gegenlicht für Konturen
  const rim = new THREE.DirectionalLight('#9fb6ff', 0.6);
  rim.position.set(30, 25, -40);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight('#fff1dd', '#2b1d12', 0.25);
  scene.add(hemi);
  return { lamp, rim, hemi };
}
