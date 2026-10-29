import * as THREE from 'three';
import { PAGE } from '../state/Document';

const ROWS = 260;
const DEG = Math.PI / 180;
/** Winkel auf der Walze (0 = oben, 90° = vorne): Druckpunkt, Ablösepunkt nach oben, Einzugspunkt hinten. */
const PHI_PRINT = 90 * DEG;
const PHI_EXIT = 72 * DEG;
const PHI_ENTRY = 245 * DEG;

/**
 * Papierblatt, das um die Walze geführt wird. Lokaler Ursprung = Walzenachse.
 * Die Geometrie wird entlang eines Pfads gebogen: oberhalb des Druckpunkts steht das
 * beschriebene Papier nach oben, unterhalb wickelt es sich um die Walze und läuft hinten hinaus.
 */
export class Paper {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly radius: number;
  /** Abstand Blattoberkante → aktuelle Druckzeile (Grundlinie) in cm */
  private feedCm = 0;

  constructor(texture: THREE.Texture, platenRadius: number) {
    this.radius = platenRadius + 0.025;
    const positions = new Float32Array((ROWS + 1) * 2 * 3);
    const uvs = new Float32Array((ROWS + 1) * 2 * 2);
    const indices: number[] = [];
    for (let i = 0; i <= ROWS; i++) {
      const v = 1 - i / ROWS;
      uvs.set([0, v, 1, v], i * 4);
      if (i < ROWS) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setIndex(indices);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.setFeed(PAGE.marginTopCm);
  }

  get feed(): number {
    return this.feedCm;
  }

  /** Positioniert das Blatt so, dass `cm` (von der Blattoberkante) am Druckpunkt liegt. */
  setFeed(cm: number): void {
    this.feedCm = cm;
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const half = PAGE.widthCm / 2;
    // Grundlinie liegt minimal unterhalb des Typenaufschlags-Zentrums
    const offset = 0.12;
    for (let i = 0; i <= ROWS; i++) {
      const s = (i / ROWS) * PAGE.heightCm - cm - offset;
      const [y, z] = this.path(s);
      pos.setXYZ(i * 2, -half, y, z);
      pos.setXYZ(i * 2 + 1, half, y, z);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }

  /** Pfad (y, z) relativ zur Walzenachse für Bogenlänge s (s < 0: oberhalb des Druckpunkts). */
  private path(s: number): [number, number] {
    const R = this.radius;
    const at = (phi: number): [number, number] => [R * Math.cos(phi), R * Math.sin(phi)];
    if (s <= 0) {
      const phi = PHI_PRINT + s / R;
      if (phi >= PHI_EXIT) return at(phi);
      const rest = (PHI_EXIT - phi) * R;
      const [y, z] = at(PHI_EXIT);
      return [y + Math.sin(PHI_EXIT) * rest, z - Math.cos(PHI_EXIT) * rest];
    }
    const phi = PHI_PRINT + s / R;
    if (phi <= PHI_ENTRY) return at(phi);
    const rest = (phi - PHI_ENTRY) * R;
    const [y, z] = at(PHI_ENTRY);
    // hinter der Walze: tangential nach oben/hinten (Papierauflage)
    return [y - Math.sin(PHI_ENTRY) * rest, z + Math.cos(PHI_ENTRY) * rest];
  }
}
