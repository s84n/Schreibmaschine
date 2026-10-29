import * as THREE from 'three';
import { animator, ease } from '../../animation/Tweens';
import { DIMS, PRINT_POINT } from '../dims';
import type { Materials } from '../materials';
import { shadow } from './util';

const DEG = Math.PI / 180;
/** Dauer Aufschwung bis Aufschlag bzw. Rückfall in Sekunden */
export const STRIKE_UP = 0.05;
const STRIKE_DOWN = 0.13;
const SHIFT_DROP = 0.35;

interface Bar {
  pivot: THREE.Group;
  arm: THREE.Group;
  busy: boolean;
}

/** Typenkorb: Segment mit fächerförmig angeordneten Typenhebeln. */
export class Typebars {
  readonly group = new THREE.Group();
  private readonly basket = new THREE.Group();
  private bars: Bar[] = [];
  private readonly restAngle = DIMS.typebarRestDeg * DEG;
  private readonly barLength: number;
  private readonly barGeo: THREE.BufferGeometry;
  private readonly slugGeo: THREE.BufferGeometry;

  constructor(private readonly m: Materials, count: number) {
    this.group.name = 'typebars';
    const c = DIMS.segmentCenter;
    this.group.position.copy(c);
    this.group.add(this.basket);
    const h = PRINT_POINT.y - c.y;
    this.barLength = Math.hypot(h, DIMS.segmentRadius) - 0.15;

    const L = this.barLength;
    this.barGeo = new THREE.BoxGeometry(0.1, 0.22, L - 0.3);
    this.barGeo.translate(0, 0, (L - 0.3) / 2);
    this.slugGeo = new THREE.BoxGeometry(0.26, 0.5, 0.3);
    this.slugGeo.translate(0, 0, L - 0.15);

    // Segment (halber Ring) mit Schlitzen
    const spread = DIMS.segmentSpreadDeg * DEG;
    const segGeo = new THREE.TorusGeometry(DIMS.segmentRadius, 0.32, 12, 64, spread * 2 + 0.2);
    segGeo.rotateZ(Math.PI / 2 - spread - 0.1);
    segGeo.rotateX(Math.PI / 2);
    const segment = shadow(new THREE.Mesh(segGeo, m.steel));
    this.basket.add(segment);

    this.setCount(count);
  }

  get count(): number {
    return this.bars.length;
  }

  setCount(count: number): void {
    for (const bar of this.bars) this.basket.remove(bar.pivot);
    this.bars = [];
    const spread = DIMS.segmentSpreadDeg * DEG;
    for (let i = 0; i < count; i++) {
      const a = count === 1 ? 0 : -spread + (2 * spread * i) / (count - 1);
      const pivot = new THREE.Group();
      pivot.position.set(DIMS.segmentRadius * Math.sin(a), 0, DIMS.segmentRadius * Math.cos(a));
      pivot.rotation.y = a;
      const arm = new THREE.Group();
      arm.rotation.x = this.restAngle;
      arm.add(shadow(new THREE.Mesh(this.barGeo, this.m.steel)));
      arm.add(shadow(new THREE.Mesh(this.slugGeo, this.m.chrome)));
      pivot.add(arm);
      this.basket.add(pivot);
      this.bars.push({ pivot, arm, busy: false });
    }
  }

  /** Umschaltung: der Korb senkt sich, damit die obere Type der Schreibwalze gegenübersteht. */
  setShift(on: boolean): void {
    const from = this.basket.position.y;
    const to = on ? -SHIFT_DROP : 0;
    animator.add({
      duration: 0.08,
      ease: ease.outCubic,
      onUpdate: (t) => (this.basket.position.y = from + (to - from) * t),
    });
  }

  /** Schlägt Hebel `index` an; `onImpact` wird im Moment des Aufschlags aufgerufen. */
  strike(index: number, onImpact: () => void): void {
    const bar = this.bars[Math.max(0, Math.min(this.bars.length - 1, index))];
    const h = PRINT_POINT.y - (DIMS.segmentCenter.y + this.basket.position.y);
    const target = Math.atan2(-h, -DIMS.segmentRadius);
    const arm = bar.arm;
    const from = arm.rotation.x;
    bar.busy = true;
    animator.add({
      duration: STRIKE_UP,
      ease: ease.inQuad,
      onUpdate: (t) => (arm.rotation.x = from + (target - from) * t),
      onComplete: () => {
        onImpact();
        animator.add({
          duration: STRIKE_DOWN,
          ease: ease.outCubic,
          onUpdate: (t) => (arm.rotation.x = target + (this.restAngle - target) * t),
          onComplete: () => (bar.busy = false),
        });
      },
    });
  }
}
