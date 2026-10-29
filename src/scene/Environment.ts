import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rng } from '../paper/InkCanvas';

/** Schreibtisch, Licht und Umgebungsreflexionen. */
export function buildEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): { lamp: THREE.SpotLight } {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  scene.background = new THREE.Color('#15110e');
  scene.fog = new THREE.Fog('#15110e', 90, 220);

  // Schreibtisch aus Holz
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 160),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62, metalness: 0 }),
  );
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.45;
  desk.receiveShadow = true;
  scene.add(desk);

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

  scene.add(new THREE.HemisphereLight('#fff1dd', '#2b1d12', 0.25));
  return { lamp };
}

function woodTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const r = rng(77);
  ctx.fillStyle = '#4a2f1d';
  ctx.fillRect(0, 0, w, h);
  // Bretter mit Maserung
  const boards = 6;
  for (let b = 0; b < boards; b++) {
    const y0 = (b * h) / boards;
    const tint = 0.85 + r() * 0.3;
    ctx.fillStyle = `rgba(${Math.round(90 * tint)},${Math.round(58 * tint)},${Math.round(36 * tint)},1)`;
    ctx.fillRect(0, y0, w, h / boards);
    for (let i = 0; i < 70; i++) {
      const y = y0 + r() * (h / boards);
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '30,18,10' : '140,95,60'},${0.08 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.006 + i) * 3 + (r() - 0.5) * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(15,8,4,0.6)';
    ctx.fillRect(0, y0, w, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1.4);
  tex.rotation = Math.PI / 2;
  tex.anisotropy = 8;
  return tex;
}
