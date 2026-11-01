import { trackTitle, TRACKS, type TrackId } from '../audio/Music';
import { DONATE_URL } from '../config';
import { LAYOUTS, type LayoutId } from '../input/layouts';
import { layoutText } from '../state/TextLayout';
import { VIEWS, type ViewId } from '../scene/Room';
import type { CameraView, Quality } from '../scene/Scene';
import { RIBBONS, type RibbonId } from '../state/Document';
import { BODY_COLORS, MODELS, type BodyColorId, type ModelId } from '../typewriter/materials';
import { APP_VERSION } from '../version';
import { isPhone } from './Device';
import { strings, type Lang } from './i18n';
import { icon, type IconName } from './Icons';
import { activeMood, MOODS, type MoodId } from './Moods';
import type { Settings, TextSize } from './Settings';
import type { PaperTone } from '../paper/InkCanvas';

export interface OverlayActions {
  onView(view: CameraView): void;
  onNewSheet(): void;
  onExport(kind: 'png' | 'pdf' | 'txt'): void;
  onSettings(next: Settings): void;
  onKeyboard(): void;
  /** Oberfläche tritt beim Tippen zurück oder kommt wieder. */
  onUiVisible(on: boolean): void;
  onRead(): void;
  onShare(): void;
  onNewDocument(): void;
  onLetterPlay(): void;
  onLetterSkip(): void;
  onLetterWrite(): void;
  /** Smartphone: Text abtippen lassen, Tempo, Überspringen und von vorn. */
  onPhoneStart(text: string): void;
  onPhoneSpeed(fast: boolean): void;
  onPhoneSkip(): void;
  onPhoneNew(): void;
}

export type LetterState = 'ready' | 'playing' | 'done';
export type PhoneState = 'input' | 'playing' | 'done';

/** Längere Texte tippt auch die geduldigste Maschine nicht mehr in vertretbarer Zeit. */
const PHONE_MAX_CHARS = 30000;

const touch = matchMedia('(pointer: coarse)');
/** Wenig Platz (Smartphone): Werkzeugleiste verschwindet ins Zahnrad-Menü. */
const small = matchMedia('(max-width: 820px), (max-height: 520px)');
/** So viele Anschläge, dann blendet sich die Oberfläche aus. */
const TYPING_HIDE_AFTER = 3;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Knopf mit Symbol und Text; der Text bleibt als Tooltip, falls er aus Platzgründen ausgeblendet wird. */
const toolBtn = (name: IconName, label: string, title = label, cls = ''): HTMLButtonElement => {
  const b = el('button', `btn with-icon ${cls}`.trim());
  b.append(icon(name), el('span', 'lbl', label));
  b.title = title;
  b.setAttribute('aria-label', title);
  return b;
};

const iconBtn = (name: IconName, title: string, cls = ''): HTMLButtonElement => {
  const b = el('button', `btn icon ${cls}`.trim());
  b.append(icon(name));
  b.title = title;
  b.setAttribute('aria-label', title);
  return b;
};

const MOOD_ICONS: Record<MoodId, IconName> = { rainnight: 'rain', sunday: 'coffee', kyoto: 'leaf', winter: 'snow', stars: 'stars', bosporus: 'waves', rio: 'waves', paris: 'coffee', udaipur: 'sun', elmina: 'waves', granada: 'sun', laboca: 'rain', andes: 'mountain', serengeti: 'sun', alps: 'mountain', nordic: 'snow' };

/** Kleiner Pfeil für alles, was aufklappt. */
const chevronIcon = (): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 10 6');
  svg.setAttribute('class', 'chevron');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M1 1l4 4 4-4"/>';
  return svg;
};

/** HTML-Oberfläche über der 3D-Szene: Werkzeugleiste, Einstellungen, Startschirm, Hinweise. */
export class Overlay {
  private readonly root: HTMLElement;
  private settings: Settings;
  private view: CameraView = 'machine';
  private started = false;
  private panelOpen = false;
  private moodsOpen = false;
  private phone?: PhoneState;
  private phoneText = '';
  private phoneFast = false;
  private coffeeOpen = false;
  private typed = 0;
  private uiHidden = false;
  private readonly label = el('div', 'room-label');
  private pages = 0;
  private letter?: LetterState;
  private keyboardOpen = false;
  private toastTimer = 0;

  constructor(root: HTMLElement, settings: Settings, private readonly actions: OverlayActions) {
    this.root = root;
    this.settings = { ...settings };
    this.label.hidden = true;
    document.body.append(this.label);
    this.render();
    small.addEventListener('change', () => this.render());
    // Ein Klick daneben schließt die Stimmungen wieder
    window.addEventListener('pointerdown', (e) => {
      if (!this.moodsOpen || (e.target as Element).closest?.('.moods')) return;
      this.moodsOpen = false;
      this.render();
    });
  }

  get isStarted(): boolean {
    return this.started;
  }

  get isUiHidden(): boolean {
    return this.uiHidden;
  }

  /** Jeder Anschlag: Nach den ersten Buchstaben tritt alles zurück, nur das Schreiben bleibt. */
  noteTyping(): void {
    if (isPhone) return;
    if (this.letter || this.panelOpen || this.coffeeOpen || this.uiHidden) return;
    if (++this.typed >= TYPING_HIDE_AFTER) this.setUiHidden(true);
  }

  /** Mausbewegung oder Berührung: Die Oberfläche ist sofort wieder da. */
  revealUi(): void {
    this.typed = 0;
    if (this.uiHidden) this.setUiHidden(false);
  }

  private setUiHidden(on: boolean): void {
    this.uiHidden = on;
    if (on && this.moodsOpen) {
      this.moodsOpen = false;
      this.render();
    }
    document.body.classList.toggle('typing', on);
    if (on) this.label.hidden = true;
    this.actions.onUiVisible(!on);
  }

  /** Beschriftung am Mauszeiger über einem Ding im Zimmer. */
  setRoomLabel(text: string | undefined, x: number, y: number): void {
    this.label.hidden = !text;
    if (!text) return;
    this.label.textContent = text;
    this.label.style.transform = `translate(${Math.min(x + 16, innerWidth - 300)}px, ${Math.max(y - 34, 6)}px)`;
  }

  /** Esc: das oberste Fenster schließen. Liefert false, wenn keines offen war. */
  closeTop(): boolean {
    if (!this.coffeeOpen && !this.panelOpen && !this.moodsOpen) return false;
    if (this.moodsOpen) this.moodsOpen = false;
    else if (this.coffeeOpen) this.coffeeOpen = false;
    else this.panelOpen = false;
    this.render();
    return true;
  }

  /** Einstellungen von außen ändern (Dinge im Zimmer, automatische Grafik). */
  change(patch: Partial<Settings>): void {
    this.update(patch);
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

  /** Smartphone: Eingabefeld, laufende Simulation oder fertig. */
  setPhone(state: PhoneState): void {
    this.phone = state;
    this.render();
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
    if (isPhone) {
      this.renderPhone();
      this.root.append(el('div', 'toast'));
      return;
    }

    // Werkzeugleiste – auf kleinen Displays nur Tag/Nacht, Tastatur und Zahnrad
    const bar = el('nav', 'toolbar');
    const night = s.time === 'night';
    const time = iconBtn(night ? 'moon' : 'sun', t.dayNight);
    time.onclick = () => this.update({ time: night ? 'day' : 'night' });
    const gear = iconBtn('gear', t.settings);
    gear.onclick = () => {
      this.panelOpen = !this.panelOpen;
      this.render();
    };
    const tools: HTMLElement[] = [];
    if (!small.matches) tools.push(...this.actionButtons(), el('span', 'sep'));
    tools.push(time);
    if (touch.matches && !this.letter) {
      const kb = iconBtn('keyboard', t.keyboard, `kb${this.keyboardOpen ? ' active' : ''}`);
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
    if (!small.matches && !this.letter) this.root.append(this.renderMoods());

    if (this.panelOpen) {
      const panel = this.renderPanel();
      this.root.append(panel);
      panel.scrollTop = scroll;
    }
    if (this.coffeeOpen) this.root.append(this.renderCoffee());
    if (this.letter) this.root.append(this.renderLetter());

    // Startschirm
    const start = el('div', `start${this.started ? ' hidden' : ''}`);
    start.append(el('h1', '', 'Schreibmaschine'), el('p', 'lead', t.start), el('p', 'sub', touch.matches ? t.startHintTouch : t.startHint), el('p', 'room-note', t.startRoom));
    this.root.append(start);

    const hint = el('div', 'hint', t.hint);
    const sheet = this.pages ? `${t.pageOf(this.pages + 1)} · ` : '';
    const footer = el('footer', 'footer', `Schreibmaschine v${APP_VERSION} · ${sheet}${t.saved}`);
    footer.title = t.credits;
    this.root.append(hint, footer);
    this.root.append(el('div', 'toast'));
  }

  /** Werkzeuge, die je nach Platz in der Leiste oder im Menü sitzen. */
  private actionButtons(): HTMLElement[] {
    const t = this.t;
    const s = this.settings;
    const toPaper = this.view === 'machine';
    const viewBtn = toolBtn(toPaper ? 'paper' : 'machine', toPaper ? t.viewPaper : t.viewMachine);
    viewBtn.onclick = () => {
      this.view = this.view === 'machine' ? 'paper' : 'machine';
      this.actions.onView(this.view);
      this.render();
    };
    const sheetBtn = toolBtn('sheet', t.newSheet, t.newSheetTitle);
    sheetBtn.onclick = () => this.actions.onNewSheet();
    const share = toolBtn('share', t.share, t.shareTitle);
    share.onclick = () => this.actions.onShare();
    const readBtn = toolBtn('read', t.read, t.roomLabels.stack);
    readBtn.onclick = () => this.actions.onRead();
    const exportGroup = el('div', 'btn-group');
    exportGroup.setAttribute('role', 'group');
    exportGroup.setAttribute('aria-label', t.exportTitle);
    exportGroup.title = t.exportTitle;
    exportGroup.append(icon('download'));
    for (const [kind, label] of [['pdf', t.exportPdf], ['png', t.exportPng], ['txt', t.exportTxt]] as const) {
      const b = el('button', 'btn', label);
      b.title = `${t.exportTitle} ${label}`;
      b.onclick = () => this.actions.onExport(kind);
      exportGroup.append(b);
    }
    // Auswahlfeld mit Symbol: Das Symbol sagt, worum es geht, das Feld zeigt nur noch den Wert
    const picker = (name: IconName, title: string, cls: string, options: [string, string][], value: string, onChange: (v: string) => void) => {
      const wrap = el('label', `btn select-wrap ${cls}`.trim());
      wrap.title = title;
      const sel = el('select');
      sel.setAttribute('aria-label', title);
      for (const [id, label] of options) {
        const o = el('option', '', label);
        o.value = id;
        o.selected = id === value;
        sel.append(o);
      }
      sel.onchange = () => {
        onChange(sel.value);
        sel.blur();
      };
      wrap.append(icon(name), sel, chevronIcon());
      return wrap;
    };
    const outlook = picker('window', t.view, '', (Object.keys(VIEWS) as ViewId[]).map((id) => [id, t.views[id]]), s.view, (v) => this.update({ view: v as ViewId }));
    const music = picker('music', t.music, s.track ? 'active' : '', [['', t.musicOff], ...TRACKS.map((id): [string, string] => [id, trackTitle(id)])], s.track, (v) => this.update({ track: v as TrackId | '' }));
    if (this.letter) return [viewBtn, readBtn, el('span', 'sep'), exportGroup, el('span', 'sep'), outlook, music];
    return [viewBtn, readBtn, sheetBtn, el('span', 'sep'), exportGroup, share, el('span', 'sep'), outlook, music];
  }

  /** Stimmungen: ein Klick stellt alles passend ein. In der Leiste klappt die Liste erst auf Wunsch auf. */
  private renderMoods(foldable = true): HTMLElement {
    const t = this.t;
    const active = activeMood(this.settings);
    const box = el('nav', 'moods');
    box.setAttribute('aria-label', t.moods);
    if (foldable) {
      const label = active ? t.moodNames[active] : t.moods;
      const toggle = toolBtn(active ? MOOD_ICONS[active] : 'stars', label, t.moods, `mood-toggle${active ? ' active' : ''}`);
      toggle.setAttribute('aria-expanded', String(this.moodsOpen));
      toggle.append(chevronIcon());
      toggle.onclick = () => {
        this.moodsOpen = !this.moodsOpen;
        this.render();
      };
      box.append(toggle);
      if (!this.moodsOpen) return box;
    }
    const list = el('div', 'mood-list');
    for (const id of Object.keys(MOODS) as MoodId[]) {
      const b = toolBtn(MOOD_ICONS[id], t.moodNames[id], t.moodNames[id], `mood${id === active ? ' active' : ''}`);
      b.onclick = () => {
        this.moodsOpen = false;
        this.update(MOODS[id]);
      };
      list.append(b);
    }
    box.append(list);
    return box;
  }

  /** Smartphone: kein Menü, nur Eingabefeld und danach eine kleine Leiste. */
  private renderPhone(): void {
    if (this.letter) {
      this.root.append(this.renderLetter());
      return;
    }
    if (this.phone === 'input') this.root.append(this.renderPhoneInput());
    else if (this.phone) this.root.append(this.renderPhoneBar());
  }

  private renderPhoneInput(): HTMLElement {
    const t = this.t;
    const box = el('section', 'phone-input');
    const area = el('textarea');
    area.placeholder = t.phonePlaceholder;
    area.maxLength = PHONE_MAX_CHARS;
    area.value = this.phoneText;
    area.setAttribute('aria-label', t.phonePlaceholder);
    const count = el('span', 'phone-count');
    const start = toolBtn('play', t.phoneStart, t.phoneStart, 'primary phone-start');
    const sync = () => {
      this.phoneText = area.value;
      const sheets = layoutText(area.value).length;
      start.disabled = !sheets;
      count.textContent = sheets ? t.phoneSheets(area.value.trim().length, sheets) : '';
    };
    area.oninput = sync;
    start.onclick = () => this.actions.onPhoneStart(this.phoneText);
    const row = el('div', 'phone-row');
    if (navigator.clipboard?.readText) {
      const paste = toolBtn('paste', t.phonePaste);
      paste.onclick = () => {
        navigator.clipboard
          .readText()
          .then((text) => {
            area.value = text.slice(0, PHONE_MAX_CHARS);
            sync();
          })
          .catch(() => this.toast(t.phonePasteFailed));
      };
      row.append(paste);
    }
    row.append(count);
    box.append(el('h1', '', t.phoneTitle), el('p', 'phone-lead', t.phoneText), area, row, start, el('p', 'credits', t.phoneRoom), el('p', 'credits', `Schreibmaschine v${APP_VERSION} · ${t.credits}`));
    sync();
    return box;
  }

  private renderPhoneBar(): HTMLElement {
    const t = this.t;
    const box = el('nav', 'phone-bar');
    const muted = this.settings.muted;
    const sound = iconBtn(muted ? 'mute' : 'sound', t.phoneSound);
    sound.onclick = () => this.update({ muted: !muted });
    if (this.phone === 'playing') {
      box.append(el('p', 'phone-hint', t.phoneCamera));
      const speed = toolBtn('fast', `${t.phoneSpeed} ${this.phoneFast ? '×4' : '×1'}`, t.phoneSpeed, this.phoneFast ? 'active' : '');
      speed.onclick = () => {
        this.phoneFast = !this.phoneFast;
        this.actions.onPhoneSpeed(this.phoneFast);
        this.render();
      };
      const skip = toolBtn('skip', t.letterSkip);
      skip.onclick = () => this.actions.onPhoneSkip();
      box.append(speed, skip, sound);
      return box;
    }
    const read = toolBtn('read', t.read);
    read.onclick = () => this.actions.onRead();
    const pdf = toolBtn('download', t.exportPdf, `${t.exportTitle} ${t.exportPdf}`);
    pdf.onclick = () => this.actions.onExport('pdf');
    const share = toolBtn('share', t.share, t.shareTitle);
    share.onclick = () => this.actions.onShare();
    const fresh = toolBtn('paper', t.phoneNew, t.phoneNew, 'primary');
    fresh.onclick = () => this.actions.onPhoneNew();
    box.append(read, pdf, share, sound, fresh);
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
      if (!this.letter) panel.append(this.renderMoods(false));
      const tools = el('div', 'tools');
      tools.append(...this.actionButtons().filter((b) => !b.classList.contains('sep')));
      panel.append(tools);
    }
    const extras = el('div', 'tools');
    if (!this.letter) {
      const fresh = toolBtn('fresh', t.newDocument, t.newDocumentTitle);
      fresh.onclick = () => {
        this.panelOpen = false;
        this.render();
        this.actions.onNewDocument();
      };
      extras.append(fresh);
    }
    if (document.documentElement.requestFullscreen) {
      const fs = toolBtn('fullscreen', t.fullscreen);
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

    const group = (label: string) => panel.append(el('h3', '', label));

    group(t.groupWriting);
    row(t.model, select<ModelId>(s.model, (Object.keys(MODELS) as ModelId[]).map((id) => [id, t.models[id]]), (model) => this.update({ model, color: MODELS[model].color })));
    row(t.ribbon, select<RibbonId>(s.ribbon, (Object.keys(RIBBONS) as RibbonId[]).map((id) => [id, t.ribbons[id]]), (ribbon) => this.update({ ribbon })));
    const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
      const c = el('input');
      c.type = 'checkbox';
      c.checked = checked;
      c.onchange = () => onChange(c.checked);
      row(label, c);
    };
    toggle(t.softWrap, s.softWrap, (softWrap) => this.update({ softWrap }));
    toggle(t.correction, s.correction, (correction) => this.update({ correction }));
    panel.append(el('p', 'credits', t.correctionHint));
    row(t.paperTone, select<PaperTone>(s.paperTone, [['classic', t.paperTones.classic], ['cream', t.paperTones.cream]], (paperTone) => this.update({ paperTone })));
    row(t.textSize, select<TextSize>(s.textSize, [['normal', t.textSizes.normal], ['large', t.textSizes.large], ['xlarge', t.textSizes.xlarge]], (textSize) => this.update({ textSize })));
    row(t.layout, select<LayoutId>(s.layout, (Object.keys(LAYOUTS) as LayoutId[]).map((id) => [id, LAYOUTS[id].label]), (layout) => this.update({ layout })));
    row(t.language, select<Lang>(s.lang, [['de', 'Deutsch'], ['en', 'English']], (lang) => this.update({ lang })));
    row(t.color, select<BodyColorId>(s.color, (Object.keys(BODY_COLORS) as BodyColorId[]).map((id) => [id, t.colors[id]]), (color) => this.update({ color })));

    group(t.groupRoom);
    toggle(t.lamp, s.lamp, (lamp) => this.update({ lamp }));
    toggle(t.rain, s.rain, (rain) => this.update({ rain }));
    toggle(t.life, s.life, (life) => this.update({ life }));
    toggle(t.hints, s.hints, (hints) => this.update({ hints, hintsSeen: hints ? [] : s.hintsSeen }));

    group(t.groupComfort);
    toggle(t.calm, s.calm, (calm) => this.update({ calm }));
    toggle(t.saver, s.saver, (saver) => this.update({ saver }));

    group(t.groupGraphics);
    row(t.quality, select<Quality>(s.quality, [['high', t.qualityHigh], ['low', t.qualityLow]], (quality) => this.update({ quality })));
    toggle(t.dust, s.dust, (dust) => this.update({ dust }));
    toggle(t.shafts, s.shafts, (shafts) => this.update({ shafts }));
    toggle(t.ao, s.ao, (ao) => this.update({ ao }));

    group(t.groupSound);
    toggle(t.softStrike, s.softStrike, (softStrike) => this.update({ softStrike }));
    const slider = (label: string, key: 'volume' | 'musicVolume' | 'rainVolume' | 'bellVolume' | 'returnVolume') => {
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
      // Der Regler darf den Fokus nicht behalten, sonst läuft das Tippen danach ins Leere
      r.onpointerup = () => r.blur();
      r.onchange = () => r.blur();
      row(label, r);
    };
    slider(t.volume, 'volume');
    slider(t.bellVolume, 'bellVolume');
    slider(t.returnVolume, 'returnVolume');
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
