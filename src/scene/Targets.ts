import * as THREE from 'three';
import { softTexture } from './Cozy';

export type RoomTargetId = 'candle' | 'lamp' | 'window' | 'stack' | 'radio' | 'mug';

interface Target {
  id: RoomTargetId;
  hit: THREE.Object3D;
  aura: THREE.Sprite;
  auraPower: number;
  marker: THREE.Sprite;
  /** Punkt soll gezeigt werden (Hinweise an, noch nicht benutzt) */
  shown: boolean;
  markerLevel: number;
}

const AURA = '#ffc982';
const AURA_OPACITY = 0.3;

let dotTex: THREE.Texture | undefined;
/** Bernsteinfarbener Punkt mit dunklem Rand: auf heller Wand wie im Dunkeln gut zu sehen. */
function dotTexture(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,24,10,0.45)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#f2a93f';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff1d0';
  ctx.stroke();
  dotTex = new THREE.CanvasTexture(c);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}

/**
 * Was im Zimmer bedienbar ist, soll man im Zimmer sehen: Ein sanft pulsierender Punkt sitzt an
 * jedem Ding, bis man es einmal benutzt hat, und unter dem Mauszeiger leuchtet es warm auf.
 */
export class RoomTargets {
  readonly group = new THREE.Group();
  private readonly list: Target[] = [];
  private hovered?: Target;
  private time = 0;
  private uiVisible = true;
  /** Punkte pulsieren nicht, wenn Bewegung reduziert ist */
  calm = false;

  /** `hit` ist unsichtbar und darf größer sein als das Ding, damit es leicht zu treffen ist. */
  add(id: RoomTargetId, hit: THREE.Object3D, anchor: THREE.Vector3, auraSize: number, throughObjects = true): void {
    hit.traverse((o) => (o.visible = false));
    const aura = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: softTexture(), color: AURA, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: !throughObjects }),
    );
    aura.position.copy(hit.position);
    aura.scale.setScalar(auraSize);
    aura.visible = false;
    aura.renderOrder = 20;
    const marker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: dotTexture(), transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false, sizeAttenuation: false }),
    );
    marker.position.copy(anchor);
    marker.visible = false;
    marker.renderOrder = 21;
    this.group.add(hit, aura, marker);
    this.list.push({ id, hit, aura, auraPower: 0, marker, shown: false, markerLevel: 0 });
  }

  /** Nächstes bedienbares Ding entlang des Strahls samt Entfernung. */
  pick(ray: THREE.Raycaster, allowed: (id: RoomTargetId) => boolean): { id: RoomTargetId; distance: number } | undefined {
    let best: { id: RoomTargetId; distance: number } | undefined;
    for (const t of this.list) {
      if (!allowed(t.id)) continue;
      const hit = ray.intersectObject(t.hit, true)[0];
      if (hit && (!best || hit.distance < best.distance)) best = { id: t.id, distance: hit.distance };
    }
    return best;
  }

  setHovered(id: RoomTargetId | undefined): void {
    this.hovered = this.list.find((t) => t.id === id);
  }

  /** Welche Punkte überhaupt noch gezeigt werden sollen. */
  setShown(shown: (id: RoomTargetId) => boolean): void {
    for (const t of this.list) t.shown = shown(t.id);
  }

  /** Beim Tippen tritt alles zurück, auch die Punkte. */
  setUiVisible(on: boolean): void {
    this.uiVisible = on;
  }

  /** Läuft gerade noch eine Überblendung? Dann darf die Bildrate nicht sinken. */
  get settling(): boolean {
    return this.list.some((t) => t.auraPower > 0.01 && t !== this.hovered);
  }

  update(dt: number): void {
    this.time += dt;
    const step = Math.min(1, dt * 9);
    this.list.forEach((t, i) => {
      t.auraPower += ((t === this.hovered ? 1 : 0) - t.auraPower) * step;
      t.aura.visible = t.auraPower > 0.01;
      (t.aura.material as THREE.SpriteMaterial).opacity = AURA_OPACITY * t.auraPower;

      const wanted = t.shown && this.uiVisible ? 1 : 0;
      t.markerLevel += (wanted - t.markerLevel) * Math.min(1, dt * 4);
      t.marker.visible = t.markerLevel > 0.01;
      if (!t.marker.visible) return;
      const pulse = this.calm ? 0.6 : 0.5 + 0.5 * Math.sin(this.time * 2 + i * 1.3);
      // Überall gleich groß, egal wie nah das Ding steht
      t.marker.scale.setScalar(0.024 + pulse * 0.008);
      (t.marker.material as THREE.SpriteMaterial).opacity = t.markerLevel * (0.7 + pulse * 0.3);
    });
  }
}
