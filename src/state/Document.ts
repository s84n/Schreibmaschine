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
export const MAX_LINES = Math.floor((PAGE.heightCm - PAGE.marginTopCm - PAGE.marginBottomCm) / PAGE.lineCm); // 60
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
const DRAWER_KEY = 'schreibmaschine.drawer';

/** Ein abgelegtes Manuskript in der Schublade. */
export interface DrawerEntry {
  id: string;
  title: string;
  /** Zeitpunkt des Ablegens (ms seit 1970) */
  at: number;
  pages: Strike[][];
}

/** Logischer Zustand des eingespannten Blatts: alle Anschläge + Wagenposition. */
export class TypedDocument {
  strikes: Strike[] = [];
  line = 0;
  col = 0;
  /** Fertige Blätter des Manuskripts, ältestes zuerst */
  pages: Strike[][] = [];
  /** Abgelegte Manuskripte, neuestes zuerst */
  drawer: DrawerEntry[] = [];
  /** Aus: Ein empfangener Brief darf das eigene Blatt nicht überschreiben. */
  persist = true;
  /** Wird gerufen, wenn der Browser-Speicher voll ist und nicht gesichert werden konnte. */
  onSaveFailed?: () => void;
  private saveTimer = 0;

  load(): boolean {
    try {
      const drawer = JSON.parse(localStorage.getItem(DRAWER_KEY) ?? '[]') as unknown;
      if (Array.isArray(drawer)) this.drawer = drawer as DrawerEntry[];
    } catch {
      /* beschädigte Schublade überspringen */
    }
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

  private write(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      this.onSaveFailed?.();
      return false;
    }
  }

  /**
   * Legt das ganze Manuskript in die Schublade und beginnt leer.
   * Passt es nicht mehr in den Speicher, bleibt alles unverändert (Rückgabe false).
   */
  archive(): boolean {
    const pages = this.allPages();
    if (!pages.length) return true;
    const entry: DrawerEntry = { id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, title: titleOf(pages), at: Date.now(), pages };
    if (this.persist && !this.write(DRAWER_KEY, JSON.stringify([entry, ...this.drawer]))) return false;
    this.drawer.unshift(entry);
    this.discardAll();
    return true;
  }

  /** Spannt ein Manuskript aus der Schublade wieder ein; das aktuelle tauscht den Platz mit ihm. */
  takeFromDrawer(id: string): boolean {
    const entry = this.drawer.find((e) => e.id === id);
    if (!entry || !this.archive()) return false;
    this.deleteFromDrawer(id);
    const last = entry.pages[entry.pages.length - 1] ?? [];
    this.pages = entry.pages.slice(0, -1);
    this.strikes = [...last];
    const end = last.reduce<Strike | undefined>((a, s) => (!a || s.line > a.line || (s.line === a.line && s.col >= a.col) ? s : a), undefined);
    this.line = end?.line ?? 0;
    this.col = end ? Math.min(end.col + 1, MAX_COLS) : 0;
    this.savePages();
    this.saveNow();
    return true;
  }

  deleteFromDrawer(id: string): void {
    this.drawer = this.drawer.filter((e) => e.id !== id);
    if (this.persist) this.write(DRAWER_KEY, JSON.stringify(this.drawer));
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

/** Erste beschriebene Zeile als Titel. */
function titleOf(pages: Strike[][]): string {
  for (const page of pages) {
    const line = pageText(page).split('\n').map((l) => l.trim()).find(Boolean);
    if (line) return line.length > 48 ? `${line.slice(0, 47)}…` : line;
  }
  return '';
}

function pageText(strikes: Strike[]): string {
  const lines: string[][] = [];
  for (const s of strikes) {
    const row = (lines[s.line] ??= []);
    row[s.col] = s.ch;
  }
  return Array.from(lines, (row) => Array.from(row ?? [], (c) => c ?? ' ').join('').trimEnd()).join('\n');
}
