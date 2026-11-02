import * as THREE from 'three';

export type RoomTargetId = 'candle' | 'lamp' | 'window' | 'stack' | 'radio' | 'mug';

interface Target {
  id: RoomTargetId;
  hit: THREE.Object3D;
  marker: THREE.Sprite;
  /** Punkt soll gezeigt werden (Hinweise an, noch nicht benutzt) */
  shown: boolean;
  markerLevel: number;
}

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
 * jedem Ding, bis man es einmal benutzt hat. Unter dem Mauszeiger zeigt die Oberfläche nur eine
 * kleine Beschriftung: Ein Lichtschein in der Szene kostete je Pixel und lenkte beim Schreiben ab.
 */
export class RoomTargets {
  readonly group = new THREE.Group();
  private readonly list: Target[] = [];
  private time = 0;
  private uiVisible = true;
  /** Punkte pulsieren nicht, wenn Bewegung reduziert ist */
  calm = false;

  /** `hit` ist unsichtbar und darf größer sein als das Ding, damit es leicht zu treffen ist. */
  add(id: RoomTargetId, hit: THREE.Object3D, anchor: THREE.Vector3): void {
    hit.traverse((o) => (o.visible = false));
    const marker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: dotTexture(), transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false, sizeAttenuation: false }),
    );
    marker.position.copy(anchor);
    marker.visible = false;
    marker.renderOrder = 21;
    this.group.add(hit, marker);
    this.list.push({ id, hit, marker, shown: false, markerLevel: 0 });
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

  /** Welche Punkte überhaupt noch gezeigt werden sollen. */
  setShown(shown: (id: RoomTargetId) => boolean): void {
    for (const t of this.list) t.shown = shown(t.id);
  }

  /** Beim Tippen tritt alles zurück, auch die Punkte. */
  setUiVisible(on: boolean): void {
    this.uiVisible = on;
  }

  update(dt: number): void {
    this.time += dt;
    this.list.forEach((t, i) => {
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
