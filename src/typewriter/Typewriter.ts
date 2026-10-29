import * as THREE from 'three';
import { animator, ease } from '../animation/Tweens';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Layout } from '../input/layouts';
import { InkCanvas } from '../paper/InkCanvas';
import { BELL_COLS_BEFORE_END, MAX_COLS, MAX_LINES, PAGE, TypedDocument } from '../state/Document';
import { createMaterials, BODY_COLORS, type BodyColorId, type Materials } from './materials';
import { buildBody } from './parts/Body';
import { Carriage } from './parts/Carriage';
import { Keyboard, type Key } from './parts/Keys';
import { Ribbon } from './parts/Ribbon';
import { STRIKE_UP, Typebars } from './parts/Typebars';

/** Mindestabstand zwischen zwei Anschlägen (zwei Typen können nicht gleichzeitig am Druckpunkt sein). */
const STRIKE_GAP = 0.045;
/** Maximaler Rückstau an Eingaben in Sekunden – darüber wird ignoriert ("verklemmt"). */
const MAX_BACKLOG = 0.8;
/** Zeitpunkt des Anschlags im Rücklauf-Sample (Wagen schlägt an). */
const RETURN_THUNK_AT = 1.15;

export type TypewriterEvent = 'pageEnd' | 'change';

/**
 * Die komplette Maschine: Aufbau der 3D-Teile und Mechanik-Logik.
 * Logischer Zustand (Dokument) wird sofort aktualisiert, die sichtbaren/hörbaren
 * Ereignisse werden auf einer Zeitleiste nacheinander abgespielt.
 */
export class Typewriter {
  readonly group = new THREE.Group();
  readonly ink = new InkCanvas();
  private readonly m: Materials;
  private readonly keyboard: Keyboard;
  private readonly typebars: Typebars;
  private readonly carriage: Carriage;
  private readonly ribbon: Ribbon;
  private barOfKey = new Map<Key, number>();
  private shiftHeld = { left: false, right: false };
  private shiftLocked = false;
  private busyUntil = 0;
  private listeners: Partial<Record<TypewriterEvent, (() => void)[]>> = {};

  constructor(
    layout: Layout,
    private readonly audio: AudioEngine,
    readonly doc: TypedDocument,
  ) {
    this.m = createMaterials();
    this.group.add(buildBody(this.m));
    this.keyboard = new Keyboard(this.m, layout);
    this.group.add(this.keyboard.group);
    this.typebars = new Typebars(this.m, this.keyboard.charKeys.length);
    this.group.add(this.typebars.group);
    this.ribbon = new Ribbon(this.m);
    this.group.add(this.ribbon.group);
    this.carriage = new Carriage(this.m, this.ink.texture);
    this.group.add(this.carriage.group);
    this.mapBars();
    this.restore();
  }

  on(ev: TypewriterEvent, fn: () => void): void {
    (this.listeners[ev] ??= []).push(fn);
  }

  private emit(ev: TypewriterEvent): void {
    this.listeners[ev]?.forEach((fn) => fn());
  }

  /** Zeichnet den gespeicherten Zustand neu und setzt den Wagen ohne Animation. */
  restore(): void {
    this.ink.redraw(this.doc.strikes);
    this.carriage.snapTo(this.doc.col, this.doc.line);
  }

  setLayout(layout: Layout): void {
    this.keyboard.rebuild(layout);
    this.typebars.setCount(this.keyboard.charKeys.length);
    this.mapBars();
  }

  setBodyColor(id: BodyColorId): void {
    this.m.lacquer.color.set(BODY_COLORS[id]);
  }

  /** Pro Frame: Papiertextur bei Bedarf hochladen. */
  update(): void {
    this.ink.flush();
  }

  // ───────────────────────── Eingaben ─────────────────────────

  type(ch: string, code: string): void {
    const key = this.keyboard.find(ch, code);
    if (key?.def && this.shiftLocked && ch === key.def.lower) ch = key.def.upper;
    const slot = this.reserve(STRIKE_GAP);
    if (slot < 0) return;
    if (key) this.at(slot, () => this.keyboard.press(key));

    if (this.doc.col >= MAX_COLS) {
      // Zeilenende: Tastensperre – die Taste geht nur schwer herunter.
      this.audio.play('jam', slot);
      return;
    }
    const strike = { line: this.doc.line, col: this.doc.col, ch, seed: (Math.random() * 2 ** 32) >>> 0 };
    this.doc.strikes.push(strike);
    this.doc.col++;
    const col = this.doc.col;
    this.doc.scheduleSave();
    this.emit('change');

    const bar = key ? this.barOfKey.get(key) ?? 0 : Math.floor(this.typebars.count / 2);
    this.audio.play('strike', slot + STRIKE_UP - 0.004);
    if (col === MAX_COLS - BELL_COLS_BEFORE_END) this.audio.play('bell', slot + STRIKE_UP + 0.02);
    this.at(slot, () => {
      this.ribbon.lift(STRIKE_UP);
      this.typebars.strike(bar, () => {
        this.ink.draw(strike);
        this.ribbon.advance();
        this.carriage.moveToCol(col);
      });
    });
  }

  space(): void {
    const slot = this.reserve(0.035);
    if (slot < 0) return;
    const bar = this.keyboard.getSpecial('space');
    this.at(slot, () => this.keyboard.press(bar));
    if (this.doc.col >= MAX_COLS) {
      this.audio.play('jam', slot);
      return;
    }
    this.doc.col++;
    const col = this.doc.col;
    this.doc.scheduleSave();
    this.audio.play('space', slot + 0.02);
    if (col === MAX_COLS - BELL_COLS_BEFORE_END) this.audio.play('bell', slot + 0.05);
    this.at(slot + 0.02, () => this.carriage.moveToCol(col));
  }

  backspace(): void {
    const slot = this.reserve(0.06);
    if (slot < 0) return;
    this.at(slot, () => this.keyboard.press(this.keyboard.getSpecial('backspace')));
    if (this.doc.col === 0) return;
    this.doc.col--;
    const col = this.doc.col;
    this.doc.scheduleSave();
    this.audio.play('soft', slot + 0.02);
    this.at(slot + 0.02, () => this.carriage.moveToCol(col, 0.06));
  }

  tab(): void {
    const target = Math.min(MAX_COLS, Math.floor(this.doc.col / 5) * 5 + 5);
    const dist = target - this.doc.col;
    const duration = 0.05 + dist * 0.012;
    const slot = this.reserve(duration);
    if (slot < 0) return;
    this.at(slot, () => this.keyboard.press(this.keyboard.getSpecial('tab')));
    this.doc.col = target;
    this.doc.scheduleSave();
    this.audio.play('soft', slot + duration);
    this.at(slot, () => this.carriage.moveToCol(target, duration));
  }

  carriageReturn(): void {
    const frac = this.doc.col / MAX_COLS;
    const duration = 0.16 + 0.42 * frac;
    const slot = this.reserve(duration + 0.12);
    if (slot < 0) return;
    const canFeed = this.doc.line + 1 < MAX_LINES;
    this.doc.col = 0;
    if (canFeed) this.doc.line++;
    const line = this.doc.line;
    this.doc.scheduleSave();
    this.emit('change');
    this.audio.play('return', slot, { offset: Math.max(0, RETURN_THUNK_AT - (duration + 0.06)) });
    this.at(slot, () => this.carriage.carriageReturn(0, line, duration, canFeed));
    if (!canFeed) this.emit('pageEnd');
  }

  setShift(side: 'left' | 'right', down: boolean): void {
    if (this.shiftHeld[side] === down) return;
    this.shiftHeld[side] = down;
    const key = this.keyboard.getSpecial(side === 'left' ? 'shiftL' : 'shiftR');
    if (down) {
      this.keyboard.press(key, true);
      this.audio.play('soft', 0, { gain: 0.5 });
    } else {
      this.keyboard.release(key);
    }
    this.updateBasket();
  }

  toggleShiftLock(): void {
    this.shiftLocked = !this.shiftLocked;
    const key = this.keyboard.getSpecial('shiftLock');
    key.locked = this.shiftLocked;
    this.keyboard.press(key);
    if (!this.shiftLocked) this.keyboard.release(key, 0.04);
    this.audio.play('soft', 0, { gain: 0.7 });
    this.updateBasket();
  }

  /** Blatt herausdrehen und ein neues einspannen. */
  newSheet(): void {
    const slot = this.reserve(2.0);
    if (slot < 0) return;
    this.audio.play('return', slot, { offset: 0.3, gain: 0.6 });
    this.at(slot, () => this.carriage.ejectPaper(0.8));
    this.at(slot + 0.9, () => {
      this.doc.clear();
      this.ink.clear();
      this.emit('change');
      this.carriage.snapTo(0, 0);
      const target = PAGE.marginTopCm;
      const from = -26;
      this.carriage.paper.setFeed(from);
      animator.add({
        duration: 0.9,
        ease: ease.inOutCubic,
        onUpdate: (t) => this.carriage.paper.setFeed(from + (target - from) * t),
      });
      this.audio.play('soft', 0.85);
    });
  }

  // ───────────────────────── Hilfsfunktionen ─────────────────────────

  private updateBasket(): void {
    this.typebars.setShift(this.shiftLocked || this.shiftHeld.left || this.shiftHeld.right);
  }

  private mapBars(): void {
    const sorted = [...this.keyboard.charKeys].sort((a, b) => a.x - b.x);
    this.barOfKey = new Map(sorted.map((k, i) => [k, i]));
  }

  /** Reserviert ein Zeitfenster auf der Mechanik-Zeitleiste; liefert Verzögerung in s oder -1. */
  private reserve(duration: number): number {
    const now = performance.now() / 1000;
    const start = Math.max(now, this.busyUntil);
    if (start - now > MAX_BACKLOG) return -1;
    this.busyUntil = start + duration;
    return start - now;
  }

  private at(delay: number, fn: () => void): void {
    if (delay <= 0) fn();
    else animator.after(delay, fn);
  }
}
