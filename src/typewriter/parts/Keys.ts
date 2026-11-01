import * as THREE from 'three';
import { animator, ease } from '../../animation/Tweens';
import type { KeyDef, Layout } from '../../input/layouts';
import { mergeStatic } from '../../scene/merge';
import { keyboardDeckY } from '../dims';
import type { Materials } from '../materials';
import { shadow } from './util';

export type SpecialKey = 'space' | 'backspace' | 'shiftL' | 'shiftR' | 'shiftLock' | 'tab';

export interface Key {
  /** Lage der Taste; runde Tasten werden daraus in die Instanzen übertragen */
  obj: THREE.Object3D;
  /** Platz in den Instanzen; die Leertaste ist ein eigenes Objekt */
  index?: number;
  restY: number;
  def?: KeyDef;
  special?: SpecialKey;
  /** x-Position, bestimmt die Zuordnung zum Typenhebel */
  x: number;
  locked?: boolean;
}

const KEY_PITCH = 1.9;
const KEY_RADIUS = 0.7;
const ROW_Z = [8.8, 10.7, 12.6, 14.5];
const ROW_OFFSET = [-0.4, 0.2, 0.55, 1.0];
const TRAVEL = 0.55;
const SPACE_ARMS = [-6.2, 6.2];
const LEGEND_FONT = '"Futura", "Century Gothic", "Helvetica Neue", Arial, sans-serif';

const STEM_LEN = 1.7;
/** Beschriftungen teilen sich eine Textur, sonst wäre jede Taste ein eigener Draw-Call. */
const ATLAS_CELLS = 8;
const ATLAS_CELL_PX = 128;

const capGeo = new THREE.CylinderGeometry(KEY_RADIUS * 0.95, KEY_RADIUS * 0.95, 0.16, 32);
const ringGeo = new THREE.TorusGeometry(KEY_RADIUS, 0.085, 10, 36);
ringGeo.rotateX(Math.PI / 2);
ringGeo.translate(0, 0.02, 0);
const stemGeo = new THREE.BoxGeometry(0.18, STEM_LEN, 0.3);
stemGeo.translate(0, -STEM_LEN / 2, 0);
const legendGeo = new THREE.CircleGeometry(KEY_RADIUS * 0.9, 32);
legendGeo.rotateX(-Math.PI / 2);
legendGeo.translate(0, 0.081, 0);

/** Tastatur mit runden Glasrand-Tasten, Leertaste und Sondertasten. */
export class Keyboard {
  readonly group = new THREE.Group();
  readonly charKeys: Key[] = [];
  private readonly byChar = new Map<string, Key>();
  private readonly byCode = new Map<string, Key>();
  private readonly special = new Map<SpecialKey, Key>();
  private readonly roundKeys: { key: Key; legend: string[] }[] = [];
  private readonly moved = new Set<Key>();
  private instanced: THREE.InstancedMesh[] = [];
  private readonly legendMat = new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  private readonly slotMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.9 });

  constructor(private readonly m: Materials, layout: Layout) {
    this.group.name = 'keyboard';
    // Jede Taste liest ihren Ausschnitt aus der gemeinsamen Beschriftungs-Textur
    this.legendMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', 'attribute vec2 legendCell;\n#include <common>')
        .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv = uv / ${ATLAS_CELLS}.0 + legendCell;`);
    };
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
      onUpdate: (t) => {
        o.position.y = from + (down - from) * t;
        this.moved.add(key);
      },
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
      onUpdate: (t) => {
        o.position.y = down + (target - down) * t;
        this.moved.add(key);
      },
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
    this.buildInstances();
    mergeStatic(this.group, [this.special.get('space')!.obj, ...this.instanced]);
  }

  /** Überträgt bewegte Tasten in die Instanzen; einmal pro Bild. */
  sync(): void {
    if (!this.moved.size) return;
    for (const key of this.moved) {
      if (key.index === undefined) continue;
      key.obj.updateMatrix();
      for (const mesh of this.instanced) mesh.setMatrixAt(key.index, key.obj.matrix);
    }
    for (const mesh of this.instanced) mesh.instanceMatrix.needsUpdate = true;
    this.moved.clear();
  }

  private buildInstances(): void {
    const n = this.roundKeys.length;
    const c = document.createElement('canvas');
    c.width = c.height = ATLAS_CELLS * ATLAS_CELL_PX;
    const ctx = c.getContext('2d')!;
    const cell = new Float32Array(n * 2);
    this.roundKeys.forEach(({ key, legend }, i) => {
      const col = i % ATLAS_CELLS;
      const row = Math.floor(i / ATLAS_CELLS);
      cell.set([col / ATLAS_CELLS, 1 - (row + 1) / ATLAS_CELLS], i * 2);
      ctx.save();
      ctx.translate(col * ATLAS_CELL_PX, row * ATLAS_CELL_PX);
      this.drawLegend(ctx, legend, ATLAS_CELL_PX);
      ctx.restore();
      key.index = i;
    });
    const atlas = new THREE.CanvasTexture(c);
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = 4;
    this.legendMat.map?.dispose();
    this.legendMat.map = atlas;
    this.legendMat.needsUpdate = true;

    const faces = legendGeo.clone();
    faces.setAttribute('legendCell', new THREE.InstancedBufferAttribute(cell, 2));
    this.instanced = [
      shadow(new THREE.InstancedMesh(capGeo, this.m.bakelite, n)),
      shadow(new THREE.InstancedMesh(ringGeo, this.m.chrome, n)),
      shadow(new THREE.InstancedMesh(stemGeo, this.m.steel, n)),
      shadow(new THREE.InstancedMesh(faces, this.legendMat, n), false, false),
    ];
    for (const mesh of this.instanced) {
      this.roundKeys.forEach(({ key }, i) => {
        key.obj.updateMatrix();
        mesh.setMatrixAt(i, key.obj.matrix);
      });
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  private drawLegend(ctx: CanvasRenderingContext2D, legend: string[], size: number): void {
    ctx.fillStyle = '#121110';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#efe9da';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (legend.length === 1) {
      ctx.font = `bold ${legend[0].length > 1 ? 40 : 60}px ${LEGEND_FONT}`;
      ctx.fillText(legend[0], size / 2, size / 2 + 2);
    } else {
      ctx.font = `bold 42px ${LEGEND_FONT}`;
      ctx.fillText(legend[0], size / 2, size * 0.32);
      ctx.fillText(legend[1], size / 2, size * 0.7);
    }
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
    const restY = deckY + STEM_LEN;
    const obj = new THREE.Object3D();
    obj.position.set(x, restY, z);
    // leichte Neigung zum Betrachter
    obj.rotation.x = 0.12;
    const key: Key = { obj, restY, x };
    this.roundKeys.push({ key, legend });
    return key;
  }

  /**
   * Leertaste vor der untersten Tastenreihe: Die Arme führen senkrecht in Schlitze der
   * Tastaturplatte und laufen nicht mehr unter den Tasten hindurch.
   */
  private addSpaceBar(): void {
    const z = 16.15;
    const deckY = keyboardDeckY(z);
    const restY = deckY + 1.1;
    const obj = new THREE.Group();
    obj.position.set(0, restY, z);
    const bar = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 16.5, 8, 20), this.m.chrome));
    bar.rotation.z = Math.PI / 2;
    bar.scale.z = 1.5;
    obj.add(bar);
    for (const x of SPACE_ARMS) {
      const arm = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.9, 0.2), this.m.steel));
      arm.position.set(x, -0.95, 0);
      obj.add(arm);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 0.42), this.slotMat);
      slot.position.set(x, deckY + 0.01, z);
      slot.rotation.x = Math.atan(0.33);
      this.group.add(slot);
    }
    this.group.add(obj);
    this.special.set('space', { obj, restY, x: 0, special: 'space' });
  }

  private dispose(): void {
    this.instanced.forEach((mesh) => mesh.dispose());
    this.instanced = [];
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && ![capGeo, ringGeo, stemGeo].includes(mesh.geometry as never)) mesh.geometry.dispose();
    });
    this.group.clear();
    // Noch laufende Animationen alter Tasten dürfen nichts mehr in die neuen Instanzen schreiben
    this.roundKeys.forEach(({ key }) => (key.index = undefined));
    this.roundKeys.length = 0;
    this.moved.clear();
    this.charKeys.length = 0;
    this.byChar.clear();
    this.byCode.clear();
    this.special.clear();
  }
}
