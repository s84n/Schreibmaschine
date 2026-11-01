import type { DrawerEntry, Strike } from '../state/Document';
import type { Strings } from './i18n';
import type { TextSize } from './Settings';

export interface ReaderDeps {
  t(): Strings;
  size(): TextSize;
  pages(): Strike[][];
  render(strikes: Strike[]): HTMLCanvasElement;
  drawer(): DrawerEntry[];
  /** Am Smartphone gibt es keine eigenen Manuskripte und damit keine Schublade. */
  hasDrawer: boolean;
  onTake(id: string): void;
  onDelete(id: string): void;
  /** Leseansicht geht auf oder zu. */
  onToggle(open: boolean): void;
}

type Tab = 'pages' | 'drawer';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Ruhige Leseansicht: Blätter flach umblättern und die Schublade mit abgelegten Manuskripten. */
export class Reader {
  private readonly root = el('div', 'reader');
  private open_ = false;
  private tab: Tab = 'pages';
  private index = 0;
  /** Gerade gelesenes Manuskript aus der Schublade; ohne Angabe das eigene */
  private reading?: DrawerEntry;
  /** Eintrag, dessen Löschen noch einmal bestätigt werden muss */
  private confirming?: string;

  constructor(private readonly deps: ReaderDeps) {
    this.root.hidden = true;
    document.body.append(this.root);
    window.addEventListener('keydown', (e) => {
      if (!this.open_ || this.tab !== 'pages') return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.turn(-1);
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') this.turn(1);
    });
  }

  get isOpen(): boolean {
    return this.open_;
  }

  /** Öffnet auf dem jüngsten Blatt, dort hört man ja gerade auf zu lesen. */
  open(tab: Tab = 'pages'): void {
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.tab = tab;
    this.reading = undefined;
    this.confirming = undefined;
    this.index = Math.max(0, this.deps.pages().length - 1);
    this.open_ = true;
    this.root.hidden = false;
    this.deps.onToggle(true);
    this.render();
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.root.hidden = true;
    this.root.replaceChildren();
    this.deps.onToggle(false);
  }

  /** Esc: aus einem gelesenen Schubladen-Manuskript erst zurück zur Schublade. */
  back(): void {
    if (this.reading) {
      this.reading = undefined;
      this.tab = 'drawer';
      this.render();
    } else {
      this.close();
    }
  }

  private get list(): Strike[][] {
    return this.reading?.pages ?? this.deps.pages();
  }

  private turn(by: number): void {
    const next = this.index + by;
    if (next < 0 || next >= this.list.length) return;
    this.index = next;
    this.render();
  }

  private render(): void {
    const t = this.deps.t();
    this.root.replaceChildren();
    const head = el('header', 'reader-head');
    const tab = (id: Tab, label: string) => {
      const b = el('button', `btn${this.tab === id && !this.reading ? ' active' : ''}`, label);
      b.onclick = () => {
        this.tab = id;
        this.reading = undefined;
        this.confirming = undefined;
        this.index = Math.max(0, this.deps.pages().length - 1);
        this.render();
      };
      return b;
    };
    head.append(tab('pages', t.readerPages));
    if (this.deps.hasDrawer) head.append(tab('drawer', `${t.readerDrawer} (${this.deps.drawer().length})`));
    if (this.reading) head.append(el('span', 'reader-title', this.reading.title || t.readerUntitled));
    const close = el('button', 'btn reader-close', t.readerClose);
    close.onclick = () => this.close();
    head.append(close);
    this.root.append(head, this.tab === 'pages' ? this.renderPages() : this.renderDrawer());
  }

  private renderPages(): HTMLElement {
    const t = this.deps.t();
    const box = el('div', 'reader-body');
    const pages = this.list;
    if (!pages.length) {
      box.append(el('p', 'reader-empty', t.readerEmpty));
      return box;
    }
    this.index = Math.min(this.index, pages.length - 1);
    const src = this.deps.render(pages[this.index]);
    const scroller = el('div', `reader-page size-${this.deps.size()}`);
    const canvas = el('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    canvas.getContext('2d')!.drawImage(src, 0, 0);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', t.pageOf(this.index + 1));
    scroller.append(canvas);

    const nav = el('footer', 'reader-nav');
    const prev = el('button', 'btn', '←');
    prev.setAttribute('aria-label', t.readerPrev);
    prev.disabled = this.index === 0;
    prev.onclick = () => this.turn(-1);
    const next = el('button', 'btn', '→');
    next.setAttribute('aria-label', t.readerNext);
    next.disabled = this.index >= pages.length - 1;
    next.onclick = () => this.turn(1);
    nav.append(prev, el('span', '', t.readerPosition(this.index + 1, pages.length)), next);
    box.append(scroller, nav);
    return box;
  }

  private renderDrawer(): HTMLElement {
    const t = this.deps.t();
    const box = el('div', 'reader-body drawer');
    const entries = this.deps.drawer();
    if (!entries.length) {
      box.append(el('p', 'reader-empty', t.drawerEmpty));
      return box;
    }
    for (const entry of entries) {
      const row = el('article', 'drawer-entry');
      const info = el('div', 'drawer-info');
      info.append(el('strong', '', entry.title || t.readerUntitled), el('span', '', `${new Date(entry.at).toLocaleDateString()} · ${t.readerSheets(entry.pages.length)}`));
      const read = el('button', 'btn', t.drawerRead);
      read.onclick = () => {
        this.reading = entry;
        this.tab = 'pages';
        this.index = 0;
        this.render();
      };
      const take = el('button', 'btn', t.drawerTake);
      take.onclick = () => this.deps.onTake(entry.id);
      const remove = el('button', `btn${this.confirming === entry.id ? ' danger' : ''}`, this.confirming === entry.id ? t.drawerDeleteSure : t.drawerDelete);
      remove.onclick = () => {
        if (this.confirming === entry.id) {
          this.confirming = undefined;
          this.deps.onDelete(entry.id);
        } else {
          this.confirming = entry.id;
        }
        this.render();
      };
      row.append(info, read, take, remove);
      box.append(row);
    }
    return box;
  }
}
