import * as THREE from 'three';
import { animator, ease } from '../../animation/Tweens';
import { DIMS, PRINT_POINT } from '../dims';
import type { Materials } from '../materials';
import { beam, orientBeam, shadow } from './util';

const RIBBON_H = 0.62;
const REST_DROP = 0.75;
const SPOOL_X = 10;
const SPOOL_Z = -6.4;

/** Farbband: zwei Spulen, Bandführung und Farbbandgabel, die sich beim Anschlag hebt. */
export class Ribbon {
  readonly group = new THREE.Group();
  private readonly vibrator = new THREE.Group();
  private readonly spools: THREE.Group[] = [];
  private readonly strands: THREE.Mesh[] = [];
  private readonly ribbonZ = PRINT_POINT.z + 0.12;
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();

  constructor(m: Materials) {
    this.group.name = 'ribbon';
    for (const side of [-1, 1]) {
      const spool = new THREE.Group();
      spool.position.set(side * SPOOL_X, DIMS.deckY, SPOOL_Z);
      const cup = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.9, 32, 1, true), m.chrome));
      cup.position.y = 0.45;
      spool.add(cup);
      const wound = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.62, 32), m.ribbon));
      wound.position.y = 0.5;
      spool.add(wound);
      const hub = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 6), m.steel));
      hub.position.y = 0.55;
      spool.add(hub);
      this.spools.push(spool);
      this.group.add(spool);

      const strand = beam(RIBBON_H, 0.02, m.ribbon);
      this.strands.push(strand);
      this.group.add(strand);
    }

    // Farbbandgabel mit sichtbarem Bandstück (oben schwarz, unten rot)
    this.vibrator.position.set(0, PRINT_POINT.y - REST_DROP, this.ribbonZ);
    const black = new THREE.Mesh(new THREE.PlaneGeometry(4.2, RIBBON_H / 2), m.ribbon);
    black.position.y = RIBBON_H / 4;
    const red = new THREE.Mesh(new THREE.PlaneGeometry(4.2, RIBBON_H / 2), m.ribbonRed);
    red.position.y = -RIBBON_H / 4;
    this.vibrator.add(black, red);
    for (const side of [-1, 1]) {
      const fork = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), m.chrome));
      fork.position.set(side * 0.9, -0.3, 0.06);
      this.vibrator.add(fork);
    }
    this.group.add(this.vibrator);
    this.updateStrands();
  }

  /** Gabel hebt das Band vor den Druckpunkt und senkt es wieder (Sicht auf das Geschriebene). */
  lift(upDuration: number): void {
    const restY = PRINT_POINT.y - REST_DROP;
    const upY = PRINT_POINT.y - 0.05;
    const from = this.vibrator.position.y;
    animator.add({
      duration: upDuration,
      ease: ease.outQuad,
      onUpdate: (t) => {
        this.vibrator.position.y = from + (upY - from) * t;
        this.updateStrands();
      },
      onComplete: () =>
        animator.add({
          delay: 0.02,
          duration: 0.12,
          ease: ease.outCubic,
          onUpdate: (t) => {
            this.vibrator.position.y = upY + (restY - upY) * t;
            this.updateStrands();
          },
        }),
    });
  }

  /** Band transportiert: Spulen drehen minimal. */
  advance(): void {
    this.spools[0].rotation.y += 0.04;
    this.spools[1].rotation.y += 0.04;
  }

  private updateStrands(): void {
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      this.tmpA.set(side * (SPOOL_X - 1.2), DIMS.deckY + 0.5, SPOOL_Z + 0.9);
      this.tmpB.set(side * 2.1, this.vibrator.position.y, this.ribbonZ);
      orientBeam(this.strands[i], this.tmpA, this.tmpB);
      // Band liegt flach in Laufrichtung: Breite zeigt nach oben
      this.strands[i].rotateY(Math.PI / 2);
    }
  }
}
