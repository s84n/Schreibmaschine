import * as THREE from 'three';
import { PAGE, RIBBONS, type Strike } from '../state/Document';

/** Pixel pro cm der Papiertextur (80 px/cm ≈ 200 dpi). */
export const PX_PER_CM = 80;
export const TYPE_FONT = '"Special Elite", "Courier New", monospace';

const W = Math.round(PAGE.widthCm * PX_PER_CM);
const H = Math.round(PAGE.heightCm * PX_PER_CM);
const CELL = PAGE.pitchCm * PX_PER_CM;
const FONT_PX = Math.round(0.44 * PX_PER_CM);
const GLYPH_BOX = Math.ceil(FONT_PX * 1.6);

export type PaperTone = 'classic' | 'cream';
const PAPER_COLORS: Record<PaperTone, string> = { classic: '#f4efe3', cream: '#efe2c6' };

/** Deterministischer Zufallsgenerator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Das Blatt als 2D-Canvas: Papierstruktur + Anschläge mit Farbband-Unregelmäßigkeiten.
 * Dient direkt als Textur für das Papier-Mesh und als Quelle für PNG/PDF-Export.
 */
export class InkCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private paper: HTMLCanvasElement;
  private readonly glyph: HTMLCanvasElement;
  private readonly gctx: CanvasRenderingContext2D;
  private dirty = false;

  constructor(private tone: PaperTone = 'classic') {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.paper = this.makePaper();
    this.glyph = document.createElement('canvas');
    this.glyph.width = this.glyph.height = GLYPH_BOX;
    this.gctx = this.glyph.getContext('2d', { willReadFrequently: false })!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.clear();
  }

  clear(): void {
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.paper, 0, 0);
    this.dirty = true;
  }

  redraw(strikes: Strike[]): void {
    this.clear();
    for (const s of strikes) this.draw(s);
  }

  /** Neuer Papierton; der Text muss danach neu gezeichnet werden. */
  setTone(tone: PaperTone): void {
    if (tone === this.tone) return;
    this.tone = tone;
    this.paper = this.makePaper();
  }

  /**
   * Stellt die Spalten col0–col1 einer Zeile wieder her, als stünde dort nur noch `strikes`.
   * So kostet Korrigieren und Umbrechen nicht das Neuzeichnen des ganzen Blatts.
   */
  repaint(line: number, col0: number, col1: number, strikes: Strike[]): void {
    const x = (PAGE.marginLeftCm + col0 * PAGE.pitchCm) * PX_PER_CM - 3;
    const w = (col1 - col0 + 1) * CELL + 6;
    const baseline = (PAGE.marginTopCm + line * PAGE.lineCm) * PX_PER_CM;
    const y = baseline - FONT_PX * 0.85;
    const h = FONT_PX * 1.25;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.paper, 0, 0);
    // Nachbarn ragen in den Bereich hinein und müssen mitgezeichnet werden
    for (const s of strikes) {
      if (Math.abs(s.line - line) <= 1 && s.col >= col0 - 2 && s.col <= col1 + 2) this.draw(s);
    }
    ctx.restore();
    this.dirty = true;
  }

  /** Zeichnet einen Anschlag: Glyphe mit Druckvariation, Farbbandstruktur und leichtem Versatz. */
  draw(s: Strike): void {
    const r = rng(s.seed);
    const g = this.gctx;
    const B = GLYPH_BOX;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, B, B);
    g.font = `${FONT_PX}px ${TYPE_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = RIBBONS[s.ink ?? 'black'].ink;
    g.save();
    g.translate(B / 2, B * 0.68);
    g.rotate((r() - 0.5) * 0.035);
    g.fillText(s.ch, 0, 0);
    // leichtes "Ausbluten" der Tinte
    g.globalAlpha = 0.18;
    g.fillText(s.ch, 0.6, 0.3);
    g.restore();

    // Ungleichmäßiger Anschlagdruck: eine Kante der Type druckt schwächer.
    g.globalCompositeOperation = 'destination-out';
    const angle = r() * Math.PI * 2;
    const grad = g.createLinearGradient(
      B / 2 + Math.cos(angle) * B * 0.4, B / 2 + Math.sin(angle) * B * 0.4,
      B / 2 - Math.cos(angle) * B * 0.4, B / 2 - Math.sin(angle) * B * 0.4,
    );
    const weak = 0.1 + r() * 0.35;
    grad.addColorStop(0, `rgba(0,0,0,${weak})`);
    grad.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, B, B);
    // Farbbandgewebe: feine Fehlstellen
    const speckles = 30 + Math.floor(r() * 40);
    for (let i = 0; i < speckles; i++) {
      g.globalAlpha = 0.3 + r() * 0.7;
      const size = 0.6 + r() * 1.4;
      g.fillRect(r() * B, r() * B, size, size);
    }
    g.globalAlpha = 1;

    const ctx = this.ctx;
    const x = (PAGE.marginLeftCm + (s.col + 0.5) * PAGE.pitchCm) * PX_PER_CM + (r() - 0.5) * CELL * 0.08;
    const baseline = (PAGE.marginTopCm + s.line * PAGE.lineCm) * PX_PER_CM + (r() - 0.5) * 1.6;
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.86 + r() * 0.14;
    ctx.drawImage(this.glyph, x - B / 2, baseline - B * 0.68);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.dirty = true;
  }

  /** Lädt die Textur höchstens einmal pro Frame neu hoch. */
  flush(): void {
    if (!this.dirty) return;
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  private makePaper(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = PAPER_COLORS[this.tone];
    ctx.fillRect(0, 0, W, H);
    const r = rng(1234);
    // Fasern
    ctx.lineWidth = 1;
    for (let i = 0; i < 9000; i++) {
      const x = r() * W;
      const y = r() * H;
      const len = 3 + r() * 14;
      const a = r() * Math.PI;
      ctx.strokeStyle = r() < 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // Wolkige Helligkeitsschwankungen
    for (let i = 0; i < 60; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 80 + r() * 300;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(150,130,90,${0.015 + r() * 0.02})`);
      grad.addColorStop(1, 'rgba(150,130,90,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return c;
  }
}
