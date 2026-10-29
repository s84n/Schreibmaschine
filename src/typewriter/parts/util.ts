import * as THREE from 'three';

export function shadow<T extends THREE.Object3D>(obj: T, cast = true, receive = true): T {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

export function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
}

/** Zylinder entlang der x-Achse. */
export function cylinderX(radius: number, length: number, mat: THREE.Material, segments = 32): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, length, segments);
  geo.rotateZ(Math.PI / 2);
  return shadow(new THREE.Mesh(geo, mat));
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();

/** Flaches Band (Box) zwischen zwei Punkten; lokale y-Achse zeigt von a nach b. */
export function beam(width: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, 1, thickness);
  return shadow(new THREE.Mesh(geo, mat));
}

export function orientBeam(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  tmpDir.subVectors(b, a);
  const len = tmpDir.length();
  mesh.position.copy(a).addScaledVector(tmpDir, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, tmpDir.normalize());
}

/** Text auf Canvas als Textur. */
export function textTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
