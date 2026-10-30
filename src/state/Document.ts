/** Maße eines A4-Blatts in cm und Pica-Teilung (10 Zeichen/Zoll, 6 Zeilen/Zoll). */
export const PAGE = {
  widthCm: 21,
  heightCm: 29.7,
  pitchCm: 0.254,
  lineCm: 0.4233,
  marginLeftCm: 2.1,
  marginTopCm: 2.5,
  marginBottomCm: 1.8,
};

export const MAX_COLS = Math.floor((PAGE.widthCm - 2 * PAGE.marginLeftCm) / PAGE.pitchCm); // 65
export const MAX_LINES = Math.floor((PAGE.heightCm - PAGE.marginTopCm - PAGE.marginBottomCm) / PAGE.lineCm); // 59
/** Glocke ertönt so viele Anschläge vor dem rechten Rand. */
export const BELL_COLS_BEFORE_END = 8;

export type RibbonId = 'black' | 'red' | 'blue' | 'green' | 'violet' | 'brown';

/** Farbbänder: Tinte auf dem Papier und Farbton des sichtbaren Bands. */
export const RIBBONS: Record<RibbonId, { ink: string; tape: string }> = {
  black: { ink: '#16161c', tape: '#0b0b0d' },
  red: { ink: '#a01c1c', tape: '#7a1010' },
  blue: { ink: '#1b3b82', tape: '#122a66' },
  green: { ink: '#1b5c3a', tape: '#113f27' },
  violet: { ink: '#54297e', tape: '#3a1b5c' },
  brown: { ink: '#5a3620', tape: '#3e2515' },
};

export interface Strike {
  line: number;
  col: number;
  ch: string;
  /** Zufalls-Seed für reproduzierbare Tintenvariation */
  seed: number;
  /** Farbband zum Zeitpunkt des Anschlags (ältere Blätter: schwarz) */
  ink?: RibbonId;
}

interface Stored {
  v: 1;
  strikes: Strike[];
  line: number;
  col: number;
}

const STORAGE_KEY = 'schreibmaschine.doc';
const PAGES_KEY = 'schreibmaschine.pages';

/** Logischer Zustand des eingespannten Blatts: alle Anschläge + Wagenposition. */
export class TypedDocument {
  strikes: Strike[] = [];
  line = 0;
  col = 0;
  /** Fertige Blätter des Manuskripts, ältestes zuerst */
  pages: Strike[][] = [];
  /** Aus: Ein empfangener Brief darf das eigene Blatt nicht überschreiben. */
  persist = true;
  /** Wird gerufen, wenn der Browser-Speicher voll ist und nicht gesichert werden konnte. */
  onSaveFailed?: () => void;
  private saveTimer = 0;

  load(): boolean {
    try {
      const pages = JSON.parse(localStorage.getItem(PAGES_KEY) ?? '[]') as unknown;
      if (Array.isArray(pages)) this.pages = pages as Strike[][];
    } catch {
      /* beschädigte Blätter überspringen, das eingespannte Blatt trotzdem laden */
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as Stored;
      if (data.v !== 1 || !Array.isArray(data.strikes)) return false;
      this.strikes = data.strikes;
      this.line = Math.min(Math.max(0, data.line | 0), MAX_LINES - 1);
      this.col = Math.min(Math.max(0, data.col | 0), MAX_COLS);
      return true;
    } catch {
      return false;
    }
  }

  /** Speichert verzögert, damit schnelles Tippen nicht bei jedem Anschlag serialisiert. */
  scheduleSave(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 400);
  }

  saveNow(): void {
    if (!this.persist) return;
    const data: Stored = { v: 1, strikes: this.strikes, line: this.line, col: this.col };
    this.write(STORAGE_KEY, JSON.stringify(data));
  }

  private savePages(): void {
    if (this.persist) this.write(PAGES_KEY, JSON.stringify(this.pages));
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      this.onSaveFailed?.();
    }
  }

  /** Legt das Blatt aufs Manuskript (leere Blätter nicht) und beginnt ein neues. */
  nextSheet(): void {
    if (this.strikes.length) {
      this.pages.push(this.strikes);
      this.savePages();
    }
    this.strikes = [];
    this.line = 0;
    this.col = 0;
    this.saveNow();
  }

  /** Verwirft das ganze Manuskript samt eingespanntem Blatt. */
  discardAll(): void {
    this.pages = [];
    this.savePages();
    this.strikes = [];
    this.line = 0;
    this.col = 0;
    this.saveNow();
  }

  /** Alle Blätter in Reihenfolge; das eingespannte nur, wenn etwas darauf steht. */
  allPages(): Strike[][] {
    return this.strikes.length ? [...this.pages, this.strikes] : [...this.pages];
  }

  /** Text aller Blätter als reine Zeichenkette (überschriebene Zeichen: letzter Anschlag gewinnt). */
  toPlainText(): string {
    return this.allPages().map(pageText).join('\n\n\f\n');
  }
}

function pageText(strikes: Strike[]): string {
  const lines: string[][] = [];
  for (const s of strikes) {
    const row = (lines[s.line] ??= []);
    row[s.col] = s.ch;
  }
  return Array.from(lines, (row) => Array.from(row ?? [], (c) => c ?? ' ').join('').trimEnd()).join('\n');
}
