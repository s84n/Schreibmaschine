import { LAYOUTS, type LayoutId } from '../input/layouts';
import type { Quality, ViewId } from '../scene/Scene';
import { BODY_COLORS, type BodyColorId } from '../typewriter/materials';
import { APP_VERSION } from '../version';
import { strings, type Lang } from './i18n';
import type { Settings } from './Settings';

export interface OverlayActions {
  onView(view: ViewId): void;
  onNewSheet(): void;
  onExport(kind: 'png' | 'pdf' | 'txt'): void;
  onSettings(next: Settings): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** HTML-Oberfläche über der 3D-Szene: Werkzeugleiste, Einstellungen, Startschirm, Hinweise. */
export class Overlay {
  private readonly root: HTMLElement;
  private settings: Settings;
  private view: ViewId = 'machine';
  private started = false;
  private panelOpen = false;
  private toastTimer = 0;

  constructor(root: HTMLElement, settings: Settings, private readonly actions: OverlayActions) {
    this.root = root;
    this.settings = { ...settings };
    this.render();
  }

  get isPanelOpen(): boolean {
    return this.panelOpen;
  }

  /** Startschirm ausblenden (erste Eingabe). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.root.querySelector('.start')?.classList.add('hidden');
  }

  toast(msg: string): void {
    const t = this.root.querySelector<HTMLElement>('.toast')!;
    t.textContent = msg;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 4000);
  }

  get t() {
    return strings(this.settings.lang);
  }

  private update(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.actions.onSettings(this.settings);
    this.render();
  }

  private render(): void {
    const t = this.t;
    const s = this.settings;
    this.root.replaceChildren();
    document.documentElement.lang = s.lang;

    // Werkzeugleiste
    const bar = el('nav', 'toolbar');
    const viewBtn = el('button', 'btn', this.view === 'machine' ? t.viewPaper : t.viewMachine);
    viewBtn.title = this.view === 'machine' ? t.viewPaper : t.viewMachine;
    viewBtn.onclick = () => {
      this.view = this.view === 'machine' ? 'paper' : 'machine';
      this.actions.onView(this.view);
      this.render();
    };
    const sheetBtn = el('button', 'btn', t.newSheet);
    sheetBtn.onclick = () => {
      if (confirm(t.confirmNewSheet)) this.actions.onNewSheet();
    };
    const png = el('button', 'btn', t.exportPng);
    png.onclick = () => this.actions.onExport('png');
    const pdf = el('button', 'btn', t.exportPdf);
    pdf.onclick = () => this.actions.onExport('pdf');
    const txt = el('button', 'btn', t.exportTxt);
    txt.onclick = () => this.actions.onExport('txt');
    const gear = el('button', 'btn icon', '⚙');
    gear.title = t.settings;
    gear.setAttribute('aria-label', t.settings);
    gear.onclick = () => {
      this.panelOpen = !this.panelOpen;
      this.render();
    };
    bar.append(viewBtn, sheetBtn, el('span', 'sep'), png, pdf, txt, el('span', 'sep'), gear);
    // Buttons sollen keinen Tastaturfokus behalten (sonst löst Leertaste/Enter sie aus)
    bar.querySelectorAll('button').forEach((b) => b.addEventListener('mouseup', () => b.blur()));
    this.root.append(bar);

    if (this.panelOpen) this.root.append(this.renderPanel());

    // Startschirm
    const start = el('div', `start${this.started ? ' hidden' : ''}`);
    start.append(el('h1', '', 'Schreibmaschine'), el('p', 'lead', t.start), el('p', 'sub', t.startHint));
    this.root.append(start);

    const hint = el('div', 'hint', t.hint);
    const footer = el('footer', 'footer', `Schreibmaschine v${APP_VERSION} · ${t.saved}`);
    footer.title = t.credits;
    this.root.append(hint, footer, el('div', 'toast'));
  }

  private renderPanel(): HTMLElement {
    const t = this.t;
    const s = this.settings;
    const panel = el('section', 'panel');
    panel.append(el('h2', '', t.settings));

    const row = (label: string, control: HTMLElement) => {
      const r = el('label', 'row');
      r.append(el('span', '', label), control);
      panel.append(r);
    };
    const select = <T extends string>(value: T, options: [T, string][], onChange: (v: T) => void) => {
      const sel = el('select');
      for (const [v, label] of options) {
        const o = el('option', '', label);
        o.value = v;
        o.selected = v === value;
        sel.append(o);
      }
      sel.onchange = () => onChange(sel.value as T);
      return sel;
    };

    row(t.layout, select<LayoutId>(s.layout, (Object.keys(LAYOUTS) as LayoutId[]).map((id) => [id, LAYOUTS[id].label]), (layout) => this.update({ layout })));
    row(t.language, select<Lang>(s.lang, [['de', 'Deutsch'], ['en', 'English']], (lang) => this.update({ lang })));
    row(t.quality, select<Quality>(s.quality, [['high', t.qualityHigh], ['low', t.qualityLow]], (quality) => this.update({ quality })));
    row(t.color, select<BodyColorId>(s.color, (Object.keys(BODY_COLORS) as BodyColorId[]).map((id) => [id, t.colors[id]]), (color) => this.update({ color })));

    const vol = el('input');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '1';
    vol.step = '0.05';
    vol.value = String(s.volume);
    vol.oninput = () => {
      this.settings.volume = Number(vol.value);
      this.actions.onSettings(this.settings);
    };
    row(t.volume, vol);

    const mute = el('input');
    mute.type = 'checkbox';
    mute.checked = s.muted;
    mute.onchange = () => this.update({ muted: mute.checked });
    row(t.mute, mute);

    const close = el('button', 'btn', t.close);
    close.onclick = () => {
      this.panelOpen = false;
      this.render();
    };
    panel.append(el('p', 'credits', t.credits), close);
    return panel;
  }
}
