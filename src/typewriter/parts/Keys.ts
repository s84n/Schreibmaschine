import * as THREE from 'three';
import { animator, ease } from '../../animation/Tweens';
import type { KeyDef, Layout } from '../../input/layouts';
import { keyboardDeckY } from '../dims';
import type { Materials } from '../materials';
import { shadow, textTexture } from './util';

export type SpecialKey = 'space' | 'backspace' | 'shiftL' | 'shiftR' | 'shiftLock' | 'tab';

export interface Key {
  /** bewegliche Gruppe (Kappe + Stößel) */
  obj: THREE.Group;
  restY: number;
  def?: KeyDef;
  special?: SpecialKey;
  /** x-Position, bestimmt die Zuordnung zum Typenhebel */
  x: number;
  locked?: boolean;
}

const KEY_PITCH = 1.9;
const KEY_RADIUS = 0.7;
const ROW_Z = [4.9, 6.8, 8.7, 10.6];
const ROW_OFFSET = [-0.4, 0.2, 0.55, 1.0];
const TRAVEL = 0.55;
const LEGEND_FONT = '"Futura", "Century Gothic", "Helvetica Neue", Arial, sans-serif';

const capGeo = new THREE.CylinderGeometry(KEY_RADIUS * 0.95, KEY_RADIUS * 0.95, 0.16, 32);
const ringGeo = new THREE.TorusGeometry(KEY_RADIUS, 0.085, 10, 36);
ringGeo.rotateX(Math.PI / 2);
const legendGeo = new THREE.CircleGeometry(KEY_RADIUS * 0.9, 32);
legendGeo.rotateX(-Math.PI / 2);

/** Tastatur mit runden Glasrand-Tasten, Leertaste und Sondertasten. */
export class Keyboard {
  readonly group = new THREE.Group();
  readonly charKeys: Key[] = [];
  private readonly byChar = new Map<string, Key>();
  private readonly byCode = new Map<string, Key>();
  private readonly special = new Map<SpecialKey, Key>();
  private readonly textures: THREE.Texture[] = [];
  private readonly legendMats: THREE.Material[] = [];

  constructor(private readonly m: Materials, layout: Layout) {
    this.group.name = 'keyboard';
    this.build(layout);
  }

  rebuild(layout: Layout): void {
    this.dispose();
    this.build(layout);
  }

  find(ch: string, code: string): Key | undefined {
    return this.byChar.get(ch) ?? this.byChar.get(ch.toLowerCase()) ?? this.byCode.get(code);
  }

  getSpecial(id: SpecialKey): Key {
    return this.special.get(id)!;
  }

  /** Taste drücken: schnell runter, federnd zurück. */
  press(key: Key, hold = false): void {
    const o = key.obj;
    const from = o.position.y;
    const down = key.restY - TRAVEL;
    animator.add({
      duration: 0.035,
      ease: ease.outQuad,
      onUpdate: (t) => (o.position.y = from + (down - from) * t),
      onComplete: () => {
        if (hold || key.locked) return;
        this.release(key, 0.03);
      },
    });
  }

  release(key: Key, delay = 0): void {
    const o = key.obj;
    const down = key.restY - TRAVEL;
    const target = key.locked ? key.restY - TRAVEL * 0.6 : key.restY;
    animator.add({
      delay,
      duration: 0.1,
      ease: ease.outBack,
      onUpdate: (t) => (o.position.y = down + (target - down) * t),
    });
  }

  private build(layout: Layout): void {
    layout.rows.forEach((row, r) => {
      const z = ROW_Z[r];
      const x0 = -((row.length - 1) * KEY_PITCH) / 2 + ROW_OFFSET[r];
      row.forEach((def, i) => {
        const key = this.makeRoundKey(x0 + i * KEY_PITCH, z, this.legendFor(def));
        key.def = def;
        this.charKeys.push(key);
        this.byCode.set(def.code, key);
        if (!this.byChar.has(def.lower)) this.byChar.set(def.lower, key);
        if (!this.byChar.has(def.upper)) this.byChar.set(def.upper, key);
      });
    });

    const lastX = (r: number) => -((layout.rows[r].length - 1) * KEY_PITCH) / 2 + ROW_OFFSET[r];
    const rowEnd = (r: number) => lastX(r) + (layout.rows[r].length - 1) * KEY_PITCH;
    this.addSpecial('backspace', rowEnd(0) + KEY_PITCH, ROW_Z[0], '←');
    this.addSpecial('tab', lastX(1) - KEY_PITCH, ROW_Z[1], '⇥');
    this.addSpecial('shiftLock', lastX(2) - KEY_PITCH, ROW_Z[2], '⇪');
    this.addSpecial('shiftL', lastX(3) - KEY_PITCH, ROW_Z[3], '⇧');
    this.addSpecial('shiftR', rowEnd(3) + KEY_PITCH, ROW_Z[3], '⇧');
    this.addSpaceBar();
  }

  private legendFor(def: KeyDef): string[] {
    const isLetter = def.lower.toUpperCase() === def.upper && def.lower !== def.upper;
    return isLetter ? [def.upper] : [def.upper, def.lower];
  }

  private addSpecial(id: SpecialKey, x: number, z: number, label: string): void {
    const key = this.makeRoundKey(x, z, [label]);
    key.special = id;
    this.special.set(id, key);
  }

  private makeRoundKey(x: number, z: number, legend: string[]): Key {
    const deckY = keyboardDeckY(z);
    const stemLen = 1.7;
    const restY = deckY + stemLen;
    const obj = new THREE.Group();
    obj.position.set(x, restY, z);

    const tex = textTexture(
      (ctx, w, h) => {
        ctx.fillStyle = '#121110';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#efe9da';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (legend.length === 1) {
          ctx.font = `bold ${legend[0].length > 1 ? 40 : 60}px ${LEGEND_FONT}`;
          ctx.fillText(legend[0], w / 2, h / 2 + 2);
        } else {
          ctx.font = `bold 42px ${LEGEND_FONT}`;
          ctx.fillText(legend[0], w / 2, h * 0.32);
          ctx.fillText(legend[1], w / 2, h * 0.7);
        }
      },
      128,
      128,
    );
    this.textures.push(tex);
    const legendMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
    this.legendMats.push(legendMat);

    const cap = shadow(new THREE.Mesh(capGeo, this.m.bakelite));
    obj.add(cap);
    const face = new THREE.Mesh(legendGeo, legendMat);
    face.position.y = 0.081;
    obj.add(face);
    const ring = shadow(new THREE.Mesh(ringGeo, this.m.chrome));
    ring.position.y = 0.02;
    obj.add(ring);
    const stem = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, stemLen, 0.3), this.m.steel));
    stem.position.y = -stemLen / 2;
    obj.add(stem);
    // leichte Neigung zum Betrachter
    obj.rotation.x = 0.12;

    this.group.add(obj);
    return { obj, restY, x };
  }

  private addSpaceBar(): void {
    const z = 12.3;
    const restY = keyboardDeckY(z) + 1.1;
    const obj = new THREE.Group();
    obj.position.set(0, restY, z);
    const bar = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 15, 8, 16), this.m.chrome));
    bar.rotation.z = Math.PI / 2;
    obj.add(bar);
    for (const x of [-6.5, 6.5]) {
      const arm = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.2), this.m.steel));
      arm.position.set(x, -0.2, -1.1);
      obj.add(arm);
    }
    this.group.add(obj);
    this.special.set('space', { obj, restY, x: 0, special: 'space' });
  }

  private dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry !== capGeo && mesh.geometry !== ringGeo && mesh.geometry !== legendGeo) {
        mesh.geometry.dispose();
      }
    });
    this.group.clear();
    this.textures.forEach((t) => t.dispose());
    this.legendMats.forEach((mat) => mat.dispose());
    this.textures.length = 0;
    this.legendMats.length = 0;
    this.charKeys.length = 0;
    this.byChar.clear();
    this.byCode.clear();
    this.special.clear();
  }
}

