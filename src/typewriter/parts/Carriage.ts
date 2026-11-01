import * as THREE from 'three';
import { animator, ease, type TweenHandle } from '../../animation/Tweens';
import { Paper } from '../../paper/Paper';
import { mergeStatic } from '../../scene/merge';
import { PAGE } from '../../state/Document';
import { DIMS } from '../dims';
import type { Materials } from '../materials';
import { box, cylinderX, shadow } from './util';

/** Wagen-x für Spalte `col`: die Spaltenmitte liegt am Druckpunkt (x = 0). */
export function carriageXForCol(col: number): number {
  return -(PAGE.marginLeftCm + (col + 0.5) * PAGE.pitchCm - PAGE.widthCm / 2);
}

/** Wagen mit Walze, Drehknöpfen, Papierauflage, Papierhalter, Zeilenschalthebel und Papier. */
export class Carriage {
  readonly group = new THREE.Group();
  readonly paper: Paper;
  private readonly platen: THREE.Group;
  private readonly lever: THREE.Group;
  private moveTween?: TweenHandle;
  private feedTween?: TweenHandle;

  constructor(m: Materials, paperTexture: THREE.Texture) {
    this.group.name = 'carriage';
    const C = DIMS.platenCenter;
    const r = DIMS.platenRadius;
    const half = DIMS.platenLength / 2;

    // Walze + Achse + Knöpfe (drehen sich gemeinsam)
    this.platen = new THREE.Group();
    this.platen.position.copy(C);
    this.platen.add(cylinderX(r, DIMS.platenLength, m.rubber, 48));
    this.platen.add(cylinderX(0.3, DIMS.platenLength + 3.4, m.chrome, 16));
    for (const side of [-1, 1]) {
      const knob = new THREE.Group();
      knob.position.x = side * (half + 1.3);
      knob.add(cylinderX(1.25, 1.3, m.bakelite, 40));
      // Griffrillen
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rib = box(1.2, 0.12, 0.12, m.bakelite);
        rib.position.set(0, Math.cos(a) * 1.25, Math.sin(a) * 1.25);
        knob.add(rib);
      }
      const cap = cylinderX(0.5, 1.4, m.chrome, 24);
      knob.add(cap);
      this.platen.add(knob);
    }
    this.group.add(this.platen);

    // Seitenschilde
    for (const side of [-1, 1]) {
      const plate = box(0.35, 3.6, 5.0, m.lacquer);
      plate.position.set(side * (half + 0.3), 10.4, C.z - 0.3);
      this.group.add(plate);
    }
    // Wagenschiene hinten
    const rail = cylinderX(0.28, DIMS.platenLength + 1.2, m.chrome, 16);
    rail.position.set(0, DIMS.deckY + 1.4, -8.4);
    this.group.add(rail);
    for (const side of [-1, 1]) {
      // Unterkante über den Farbbandspulen, damit der Wagen darüber hinwegfährt
      const bracket = box(0.3, 1.6, 3.2, m.steel);
      bracket.position.set(side * (half + 0.3), 9.3, -7.4);
      this.group.add(bracket);
    }

    // Papierauflage hinter der Walze (parallel zum einlaufenden Papier)
    const table = box(DIMS.platenLength - 1, 9, 0.12, m.lacquer);
    const tilt = -24.8 * (Math.PI / 180);
    table.rotation.x = tilt;
    table.position.set(0, C.y - 0.69 + 4.5 * Math.cos(tilt) - 0.08, C.z - 1.47 + 4.5 * Math.sin(tilt) - 0.2);
    this.group.add(table);

    // Papierhalter (Bügel mit Gummirollen)
    const bail = cylinderX(0.1, DIMS.platenLength - 1, m.chrome, 12);
    bail.position.set(0, C.y + 1.5, C.z + 1.42);
    this.group.add(bail);
    for (const x of [-5, 5]) {
      const roller = cylinderX(0.22, 0.8, m.rubber, 16);
      roller.position.set(x, C.y + 1.5, C.z + 1.38);
      this.group.add(roller);
    }
    for (const side of [-1, 1]) {
      const arm = box(0.15, 0.15, 2.2, m.chrome);
      arm.position.set(side * (half - 0.4), C.y + 1.5, C.z + 0.4);
      this.group.add(arm);
    }

    // Zeilenschalt- / Wagenrücklaufhebel links
    this.lever = new THREE.Group();
    this.lever.position.set(-half - 0.6, C.y + 1.2, C.z + 0.8);
    const leverArm = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6.5, 12), m.chrome));
    leverArm.rotation.x = Math.PI / 2 - 0.35;
    leverArm.rotation.z = 0.25;
    leverArm.position.set(-0.75, 1.0, 3.0);
    this.lever.add(leverArm);
    const paddle = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.0, 6, 12), m.chrome));
    paddle.rotation.x = Math.PI / 2;
    paddle.position.set(-1.6, 2.15, 6.0);
    this.lever.add(paddle);
    const hub = cylinderX(0.4, 0.5, m.chrome, 16);
    this.lever.add(hub);
    this.group.add(this.lever);

    // Papier
    this.paper = new Paper(paperTexture, r);
    this.paper.mesh.position.copy(C);
    this.group.add(this.paper.mesh);

    mergeStatic(this.platen);
    mergeStatic(this.lever);
    mergeStatic(this.group, [this.platen, this.lever, this.paper.mesh]);
  }

  /** Setzt Wagen und Papier ohne Animation. */
  snapTo(col: number, line: number): void {
    this.moveTween?.cancel();
    this.feedTween?.cancel();
    this.group.position.x = carriageXForCol(col);
    const feed = PAGE.marginTopCm + line * PAGE.lineCm;
    this.paper.setFeed(feed);
    this.platen.rotation.x = -feed / DIMS.platenRadius;
  }

  /** Schaltschritt (Hemmung) – kurze, ruckartige Bewegung. */
  moveToCol(col: number, duration = 0.03): void {
    this.moveTween?.cancel();
    const from = this.group.position.x;
    const to = carriageXForCol(col);
    this.moveTween = this.animate(duration, ease.outCubic, (t) => (this.group.position.x = from + (to - from) * t));
  }

  /** Wagenrücklauf: Hebel schwenkt, Zeile wird geschaltet, Wagen gleitet nach rechts zurück. */
  carriageReturn(col: number, line: number, duration: number, feedLine: boolean): void {
    animator.add({
      duration: 0.09,
      ease: ease.outQuad,
      onUpdate: (t) => (this.lever.rotation.y = 0.45 * t),
      onComplete: () =>
        animator.add({ delay: duration * 0.6, duration: 0.15, ease: ease.outBack, onUpdate: (t) => (this.lever.rotation.y = 0.45 * (1 - t)) }),
    });
    if (feedLine) this.feedTo(line, 0.12);
    this.moveTween?.cancel();
    const from = this.group.position.x;
    const to = carriageXForCol(col);
    this.moveTween = this.animate(duration, ease.inOutCubic, (t) => (this.group.position.x = from + (to - from) * t), 0.06);
  }

  feedTo(line: number, duration: number): void {
    this.feedTween?.cancel();
    const from = this.paper.feed;
    const to = PAGE.marginTopCm + line * PAGE.lineCm;
    this.feedTween = this.animate(duration, ease.outCubic, (t) => {
      const f = from + (to - from) * t;
      this.paper.setFeed(f);
      this.platen.rotation.x = -f / DIMS.platenRadius;
    });
  }

  /** Blatt nach oben herausdrehen (für "Neues Blatt"). */
  ejectPaper(duration: number): void {
    this.feedTween?.cancel();
    const from = this.paper.feed;
    const to = PAGE.heightCm + 4;
    this.feedTween = this.animate(duration, ease.inOutCubic, (t) => {
      const f = from + (to - from) * t;
      this.paper.setFeed(f);
      this.platen.rotation.x = -f / DIMS.platenRadius;
    });
  }

  private animate(duration: number, e: (t: number) => number, fn: (t: number) => void, delay = 0): TweenHandle {
    return animator.add({ duration, delay, ease: e, onUpdate: fn });
  }
}
