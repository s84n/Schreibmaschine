import { TRACKS, type TrackId } from '../audio/Music';
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
  onFocus(on: boolean): void;
  onShare(): void;
  onNewDocument(): void;
  onLetterPlay(): void;
  onLetterSkip(): void;
  onLetterWrite(): void;
}

export type LetterState = 'ready' | 'playing' | 'done';

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
  private focus = false;
  private pages = 0;
  private letter?: LetterState;
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

  get isFocused(): boolean {
    return this.focus;
  }

  setFocus(on: boolean): void {
    this.focus = on;
    this.panelOpen = false;
    this.actions.onFocus(on);
    this.render();
    if (on) this.toast(this.t.focusHint);
  }

  /** Anzahl fertiger Blätter für die Fußzeile. */
  setPages(n: number): void {
    this.pages = n;
    this.render();
  }

  setLetter(state: LetterState | undefined): void {
    this.letter = state;
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
    if (this.focus) {
      const exit = el('button', 'btn', t.focusExit);
      exit.onclick = () => this.setFocus(false);
      tools.push(exit);
      bar.classList.add('faint');
    } else {
      if (!small.matches) tools.push(...this.actionButtons(), el('span', 'sep'));
      tools.push(time);
    }
    if (touch.matches && !this.letter) {
      const kb = el('button', `btn icon kb${this.keyboardOpen ? ' active' : ''}`, '⌨\uFE0E');
      kb.title = t.keyboard;
      kb.setAttribute('aria-label', t.keyboard);
      // Fokus nicht vorab verlieren, sonst klappt die Tastatur zu und sofort wieder auf
      kb.onpointerdown = (e) => e.preventDefault();
      kb.onmousedown = (e) => e.preventDefault();
      kb.onclick = () => this.actions.onKeyboard();
      tools.push(kb);
    }
    if (!this.focus) tools.push(gear);
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
    if (this.letter) this.root.append(this.renderLetter());

    // Startschirm
    const start = el('div', `start${this.started ? ' hidden' : ''}`);
    start.append(el('h1', '', 'Schreibmaschine'), el('p', 'lead', t.start), el('p', 'sub', touch.matches ? t.startHintTouch : t.startHint));
    this.root.append(start);

    const hint = el('div', 'hint', t.hint);
    const sheet = this.pages ? `${t.pageOf(this.pages + 1)} · ` : '';
    const footer = el('footer', 'footer', `Schreibmaschine v${APP_VERSION} · ${sheet}${t.saved}`);
    footer.title = t.credits;
    if (!this.focus) this.root.append(hint, footer);
    this.root.append(el('div', 'toast'), this.renderRotate());
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
    sheetBtn.title = t.newSheetTitle;
    sheetBtn.onclick = () => this.actions.onNewSheet();
    const share = el('button', 'btn', t.share);
    share.onclick = () => this.actions.onShare();
    const focusBtn = el('button', 'btn', t.focus);
    focusBtn.title = t.focusTitle;
    focusBtn.onclick = () => this.setFocus(true);
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
    const music = el('select', `btn select music${s.track ? ' active' : ''}`);
    music.title = t.music;
    music.setAttribute('aria-label', t.music);
    for (const [id, label] of [['', `♪ ${t.musicOff}`], ...TRACKS.map((id) => [id, `♪ ${id}`])]) {
      const o = el('option', '', label);
      o.value = id;
      o.selected = id === s.track;
      music.append(o);
    }
    music.onchange = () => {
      this.update({ track: music.value as TrackId | '' });
      music.blur();
    };
    if (this.letter) return [viewBtn, el('span', 'sep'), png, pdf, txt, el('span', 'sep'), outlook, music];
    return [viewBtn, focusBtn, sheetBtn, el('span', 'sep'), png, pdf, txt, share, el('span', 'sep'), outlook, music];
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

  private renderLetter(): HTMLElement {
    const t = this.t;
    const box = el('section', 'panel letter');
    if (this.letter === 'ready') {
      const play = el('button', 'btn primary', t.letterPlay);
      play.onclick = () => this.actions.onLetterPlay();
      box.append(el('h2', '', t.letterTitle), el('p', '', t.letterText), play);
    } else if (this.letter === 'playing') {
      const skip = el('button', 'btn', t.letterSkip);
      skip.onclick = () => this.actions.onLetterSkip();
      box.append(skip);
    } else {
      const write = el('button', 'btn primary', t.letterWrite);
      write.onclick = () => this.actions.onLetterWrite();
      box.append(write);
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
    if (!this.letter) {
      const fresh = el('button', 'btn', `✦ ${t.newDocument}`);
      fresh.title = t.newDocumentTitle;
      fresh.onclick = () => {
        this.panelOpen = false;
        this.render();
        this.actions.onNewDocument();
      };
      extras.append(fresh);
    }
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
    toggle(t.life, s.life, (life) => this.update({ life }));
    toggle(t.dust, s.dust, (dust) => this.update({ dust }));
    toggle(t.shafts, s.shafts, (shafts) => this.update({ shafts }));
    toggle(t.ao, s.ao, (ao) => this.update({ ao }));
    row(t.layout, select<LayoutId>(s.layout, (Object.keys(LAYOUTS) as LayoutId[]).map((id) => [id, LAYOUTS[id].label]), (layout) => this.update({ layout })));
    row(t.language, select<Lang>(s.lang, [['de', 'Deutsch'], ['en', 'English']], (lang) => this.update({ lang })));
    row(t.quality, select<Quality>(s.quality, [['high', t.qualityHigh], ['low', t.qualityLow]], (quality) => this.update({ quality })));
    row(t.color, select<BodyColorId>(s.color, (Object.keys(BODY_COLORS) as BodyColorId[]).map((id) => [id, t.colors[id]]), (color) => this.update({ color })));

    const slider = (label: string, key: 'volume' | 'musicVolume' | 'rainVolume') => {
      const r = el('input');
      r.type = 'range';
      r.min = '0';
      r.max = '1';
      r.step = '0.05';
      r.value = String(s[key]);
      r.oninput = () => {
        this.settings[key] = Number(r.value);
        this.actions.onSettings(this.settings);
      };
      row(label, r);
    };
    slider(t.volume, 'volume');
    slider(t.musicVolume, 'musicVolume');
    slider(t.rainVolume, 'rainVolume');

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
