import type { AmbienceId } from '../audio/Ambience';
import { DONATE_URL } from '../config';
import { LAYOUTS, type LayoutId } from '../input/layouts';
import { VIEWS, type ViewId } from '../scene/Room';
import type { CameraView, Quality } from '../scene/Scene';
import { RIBBONS, type RibbonId } from '../state/Document';
import { BODY_COLORS, MODELS, type BodyColorId, type ModelId } from '../typewriter/materials';
import { APP_VERSION } from '../version';
import { strings, type Lang } from './i18n';
import type { Settings } from './Settings';

export interface OverlayActions {
  onView(view: CameraView): void;
  onNewSheet(): void;
  onExport(kind: 'png' | 'pdf' | 'txt'): void;
  onSettings(next: Settings): void;
  onKeyboard(): void;
}

const touch = matchMedia('(pointer: coarse)');
/** Wenig Platz (Smartphone): Werkzeugleiste verschwindet ins Zahnrad-Menü. */
const small = matchMedia('(max-width: 820px), (max-height: 520px)');

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
  private view: CameraView = 'machine';
  private started = false;
  private panelOpen = false;
  private coffeeOpen = false;
  private keyboardOpen = false;
  private toastTimer = 0;

  constructor(root: HTMLElement, settings: Settings, private readonly actions: OverlayActions) {
    this.root = root;
    this.settings = { ...settings };
    this.render();
    small.addEventListener('change', () => this.render());
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

  /** Hält die Anzeige synchron, wenn die Kamera von außen wechselt (Bildschirmtastatur). */
  setView(view: CameraView): void {
    this.view = view;
    this.render();
  }

  setKeyboardOpen(open: boolean): void {
    this.keyboardOpen = open;
    this.root.querySelector('.kb')?.classList.toggle('active', open);
  }

  openCoffee(): void {
    this.coffeeOpen = true;
    this.render();
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
    const scroll = this.root.querySelector('.panel')?.scrollTop ?? 0;
    this.root.replaceChildren();
    this.root.classList.toggle('compact', small.matches);
    document.documentElement.lang = s.lang;

    // Werkzeugleiste – auf kleinen Displays nur Tag/Nacht, Tastatur und Zahnrad
    const bar = el('nav', 'toolbar');
    const night = s.time === 'night';
    const time = el('button', 'btn icon', night ? '☾\uFE0E' : '☀\uFE0E');
    time.title = t.dayNight;
    time.setAttribute('aria-label', t.dayNight);
    time.onclick = () => this.update({ time: night ? 'day' : 'night' });
    const gear = el('button', 'btn icon', '⚙\uFE0E');
    gear.title = t.settings;
    gear.setAttribute('aria-label', t.settings);
    gear.onclick = () => {
      this.panelOpen = !this.panelOpen;
      this.render();
    };
    const tools: HTMLElement[] = [];
    if (!small.matches) tools.push(...this.actionButtons(), el('span', 'sep'));
    tools.push(time);
    if (touch.matches) {
      const kb = el('button', `btn icon kb${this.keyboardOpen ? ' active' : ''}`, '⌨\uFE0E');
      kb.title = t.keyboard;
      kb.setAttribute('aria-label', t.keyboard);
      // Fokus nicht vorab verlieren, sonst klappt die Tastatur zu und sofort wieder auf
      kb.onpointerdown = (e) => e.preventDefault();
      kb.onmousedown = (e) => e.preventDefault();
      kb.onclick = () => this.actions.onKeyboard();
      tools.push(kb);
    }
    tools.push(gear);
    bar.append(...tools);
    // Buttons sollen keinen Tastaturfokus behalten (sonst löst Leertaste/Enter sie aus)
    bar.querySelectorAll('button').forEach((b) => b.addEventListener('mouseup', () => b.blur()));
    this.root.append(bar);

    if (this.panelOpen) {
      const panel = this.renderPanel();
      this.root.append(panel);
      panel.scrollTop = scroll;
    }
    if (this.coffeeOpen) this.root.append(this.renderCoffee());

    // Startschirm
    const start = el('div', `start${this.started ? ' hidden' : ''}`);
    start.append(el('h1', '', 'Schreibmaschine'), el('p', 'lead', t.start), el('p', 'sub', touch.matches ? t.startHintTouch : t.startHint));
    this.root.append(start);

    const hint = el('div', 'hint', t.hint);
    const footer = el('footer', 'footer', `Schreibmaschine v${APP_VERSION} · ${t.saved}`);
    footer.title = t.credits;
    this.root.append(hint, footer, el('div', 'toast'), this.renderRotate());
  }

  /** Werkzeuge, die je nach Platz in der Leiste oder im Menü sitzen. */
  private actionButtons(): HTMLElement[] {
    const t = this.t;
    const s = this.settings;
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
    const outlook = el('select', 'btn select');
    outlook.title = t.view;
    outlook.setAttribute('aria-label', t.view);
    for (const id of Object.keys(VIEWS) as ViewId[]) {
      const o = el('option', '', t.views[id]);
      o.value = id;
      o.selected = id === s.view;
      outlook.append(o);
    }
    outlook.onchange = () => {
      this.update({ view: outlook.value as ViewId });
      outlook.blur();
    };
    const music = el('button', `btn${s.music ? ' active' : ''}`, `♪ ${t.music}`);
    music.title = t.musicTitle;
    music.setAttribute('aria-pressed', String(s.music));
    music.onclick = () => this.update({ music: !this.settings.music });
    return [viewBtn, sheetBtn, el('span', 'sep'), png, pdf, txt, el('span', 'sep'), outlook, music];
  }

  /** Hinweis im Hochformat auf Smartphones; sichtbar nur per CSS-Media-Query. */
  private renderRotate(): HTMLElement {
    const t = this.t;
    const box = el('div', 'rotate');
    box.append(el('div', 'rotate-icon', '📱'), el('h2', '', t.rotateTitle), el('p', '', t.rotateText));
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (orientation?.lock && document.documentElement.requestFullscreen) {
      // Nur im Vollbild erlaubt, und iOS Safari kann es gar nicht – dort bleibt der Hinweis
      const force = el('button', 'btn primary', t.rotateButton);
      force.onclick = () => {
        void document.documentElement
          .requestFullscreen({ navigationUI: 'hide' })
          .then(() => orientation.lock!('landscape'))
          .catch(() => this.toast(t.rotateText));
      };
      box.append(force);
    }
    return box;
  }

  private renderCoffee(): HTMLElement {
    const t = this.t;
    const box = el('section', 'panel coffee');
    box.append(el('h2', '', t.coffeeTitle), el('p', '', t.coffeeText));
    const link = el('a', 'btn primary', t.coffeeLink);
    link.href = DONATE_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const close = el('button', 'btn', t.close);
    close.onclick = () => {
      this.coffeeOpen = false;
      this.render();
    };
    box.append(link, close);
    return box;
  }

  private renderPanel(): HTMLElement {
    const t = this.t;
    const s = this.settings;
    const panel = el('section', 'panel');
    panel.append(el('h2', '', t.settings));

    if (small.matches) {
      const tools = el('div', 'tools');
      tools.append(...this.actionButtons().filter((b) => !b.classList.contains('sep')));
      panel.append(tools);
    }
    const extras = el('div', 'tools');
    if (document.documentElement.requestFullscreen) {
      const fs = el('button', 'btn', `⛶ ${t.fullscreen}`);
      fs.onclick = () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
      };
      extras.append(fs);
    }
    if (DONATE_URL) {
      const coffee = el('button', 'btn', t.coffee);
      coffee.onclick = () => this.openCoffee();
      extras.append(coffee);
    }
    if (extras.childElementCount) panel.append(extras);

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

    row(t.model, select<ModelId>(s.model, (Object.keys(MODELS) as ModelId[]).map((id) => [id, t.models[id]]), (model) => this.update({ model, color: MODELS[model].color })));
    row(t.ribbon, select<RibbonId>(s.ribbon, (Object.keys(RIBBONS) as RibbonId[]).map((id) => [id, t.ribbons[id]]), (ribbon) => this.update({ ribbon })));
    const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
      const c = el('input');
      c.type = 'checkbox';
      c.checked = checked;
      c.onchange = () => onChange(c.checked);
      row(label, c);
    };
    toggle(t.rain, s.rain, (rain) => this.update({ rain }));
    toggle(t.cat, s.cat, (cat) => this.update({ cat }));
    row(t.ambience, select<AmbienceId>(s.ambience, (['off', 'fire'] as const).map((id) => [id, t.ambiences[id]]), (ambience) => this.update({ ambience })));
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

    const mvol = el('input');
    mvol.type = 'range';
    mvol.min = '0';
    mvol.max = '1';
    mvol.step = '0.05';
    mvol.value = String(s.musicVolume);
    mvol.oninput = () => {
      this.settings.musicVolume = Number(mvol.value);
      this.actions.onSettings(this.settings);
    };
    row(t.musicVolume, mvol);

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
