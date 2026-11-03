import { trackTitle, TRACKS, type TrackId } from '../audio/Music';
import { DONATE_URL } from '../config';
import { LAYOUTS, type LayoutId } from '../input/layouts';
import { layoutText } from '../state/TextLayout';
import { VIEWS, type ViewId } from '../scene/Room';
import type { RoomTargetId } from '../scene/Targets';
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
/** Reiter der Einstellungen; „Start“ gibt es nur, wenn die Werkzeugleiste aus Platzgründen fehlt. */
type PanelTab = 'start' | 'writing' | 'room' | 'sound' | 'general';

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

const MOOD_ICONS: Record<MoodId, IconName> = { rainnight: 'rain', sunday: 'coffee', kyoto: 'leaf', winter: 'snow', stars: 'stars', bosporus: 'waves', rio: 'waves', paris: 'coffee', udaipur: 'sun', elmina: 'waves', granada: 'sun', laboca: 'rain', andes: 'mountain', serengeti: 'sun', alps: 'mountain', nordic: 'snow', manhattan: 'city', dubai: 'moon' };

/** Symbol in der Beschriftung am Mauszeiger. */
const ROOM_ICONS: Record<RoomTargetId, IconName> = { candle: 'flame', lamp: 'lamp', window: 'window', stack: 'read', radio: 'music', mug: 'coffee' };

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
  private docOpen = false;
  private panelTab: PanelTab = small.matches ? 'start' : 'writing';
  private labelFor?: RoomTargetId;
  private phone?: PhoneState;
  private phoneText = '';
  private phoneFast = false;
  private coffeeOpen = false;
  private typed = 0;
  private uiHidden = false;
  private readonly label = el('div', 'room-label');
  private readonly fps = el('div', 'fps');
  private pages = 0;
  private letter?: LetterState;
  private keyboardOpen = false;
  private toastTimer = 0;

  constructor(root: HTMLElement, settings: Settings, private readonly actions: OverlayActions) {
    this.root = root;
    this.settings = { ...settings };
    this.label.hidden = true;
    document.body.append(this.label, this.fps);
    this.render();
    small.addEventListener('change', () => this.render());
    // Ein Klick daneben schließt die Klappmenüs wieder. Erst beim Klick, nicht schon beim Drücken:
    // Sonst baut das Neuzeichnen den Knopf unter dem Zeiger ab und der Klick auf ihn geht verloren.
    window.addEventListener('click', (e) => {
      const target = e.target as Element;
      const closeMoods = this.moodsOpen && !target.closest?.('.moods');
      const closeDoc = this.docOpen && !target.closest?.('.menu-wrap');
      if (!closeMoods && !closeDoc) return;
      if (closeMoods) this.moodsOpen = false;
      if (closeDoc) this.docOpen = false;
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
    if (on && (this.moodsOpen || this.docOpen)) {
      this.moodsOpen = this.docOpen = false;
      this.render();
    }
    document.body.classList.toggle('typing', on);
    if (on) this.setRoomLabel(undefined, 0, 0);
    this.actions.onUiVisible(!on);
  }

  /** Beschriftung am Mauszeiger über einem Ding im Zimmer. */
  setRoomLabel(id: RoomTargetId | undefined, x: number, y: number): void {
    this.label.hidden = !id;
    if (id !== this.labelFor) {
      this.labelFor = id;
      if (id) this.label.replaceChildren(icon(ROOM_ICONS[id]), this.t.roomLabels[id]);
    }
    if (!id) return;
    this.label.style.transform = `translate(${Math.min(x + 16, innerWidth - 300)}px, ${Math.max(y - 34, 6)}px)`;
  }

  /** Bildrate in der Ecke; unter 80 % des Ziels kommt der Rechner nicht mehr mit. */
  setFps(fps: number, target: number): void {
    if (this.fps.hidden) return;
    this.fps.textContent = `${fps} / ${target} fps`;
    this.fps.classList.toggle('slow', fps < target * 0.8);
  }

  /** Esc: das oberste Fenster schließen. Liefert false, wenn keines offen war. */
  closeTop(): boolean {
    if (!this.coffeeOpen && !this.panelOpen && !this.moodsOpen && !this.docOpen) return false;
    if (this.moodsOpen) this.moodsOpen = false;
    else if (this.docOpen) this.docOpen = false;
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
    const scroll = this.root.querySelector('.panel-body')?.scrollTop ?? 0;
    this.root.replaceChildren();
    this.root.classList.toggle('compact', small.matches);
    document.documentElement.lang = s.lang;
    this.fps.hidden = isPhone || !s.fps;
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
    const gear = iconBtn('gear', t.settings, this.panelOpen ? 'active' : '');
    gear.onclick = () => {
      this.panelOpen = !this.panelOpen;
      this.render();
    };
    const tools: HTMLElement[] = [];
    if (!small.matches) {
      const lamp = iconBtn('lamp', t.lamp, s.lamp ? 'active' : '');
      lamp.onclick = () => this.update({ lamp: !s.lamp });
      const mute = iconBtn(s.muted ? 'mute' : 'sound', t.mute, s.muted ? 'active' : '');
      mute.onclick = () => this.update({ muted: !s.muted });
      tools.push(...this.writingButtons(), el('span', 'sep'), this.documentMenu(), el('span', 'sep'), ...this.pickers(), el('span', 'sep'), lamp, mute);
    }
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
      panel.querySelector('.panel-body')!.scrollTop = scroll;
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

  /** Was man beim Schreiben ständig braucht. */
  private writingButtons(): HTMLElement[] {
    const t = this.t;
    const toPaper = this.view === 'machine';
    const viewBtn = toolBtn(toPaper ? 'paper' : 'machine', toPaper ? t.viewPaper : t.viewMachine);
    viewBtn.onclick = () => {
      this.view = this.view === 'machine' ? 'paper' : 'machine';
      this.actions.onView(this.view);
      this.render();
    };
    const readBtn = toolBtn('read', t.read, t.roomLabels.stack);
    readBtn.onclick = () => this.actions.onRead();
    if (this.letter) return [viewBtn, readBtn];
    const sheetBtn = toolBtn('sheet', t.newSheet, t.newSheetTitle);
    sheetBtn.onclick = () => this.actions.onNewSheet();
    return [viewBtn, readBtn, sheetBtn];
  }

  /** Was aus dem Manuskript hinausführt: speichern, teilen, neu anfangen. */
  private documentButtons(after: () => void = () => undefined): HTMLElement[] {
    const t = this.t;
    const items: HTMLElement[] = [];
    for (const [kind, label] of [['pdf', t.exportPdf], ['png', t.exportPng], ['txt', t.exportTxt]] as const) {
      const title = `${t.exportTitle} ${label}`;
      const b = toolBtn('download', label, title);
      b.onclick = () => {
        after();
        this.actions.onExport(kind);
      };
      items.push(b);
    }
    const share = toolBtn('share', t.share, t.shareTitle);
    share.onclick = () => {
      after();
      this.actions.onShare();
    };
    items.push(share);
    if (!this.letter) {
      const fresh = toolBtn('fresh', t.newDocument, t.newDocumentTitle);
      fresh.onclick = () => {
        this.panelOpen = false;
        after();
        this.render();
        this.actions.onNewDocument();
      };
      items.push(fresh);
    }
    return items;
  }

  /** Klappmenü in der Leiste, damit die Formate dort nicht dauerhaft Platz belegen. */
  private documentMenu(): HTMLElement {
    const t = this.t;
    const wrap = el('div', 'menu-wrap');
    const toggle = toolBtn('download', t.document, t.documentTitle, this.docOpen ? 'active' : '');
    toggle.setAttribute('aria-expanded', String(this.docOpen));
    toggle.append(chevronIcon());
    toggle.onclick = () => {
      this.docOpen = !this.docOpen;
      this.render();
    };
    wrap.append(toggle);
    if (this.docOpen) {
      const menu = el('div', 'doc-menu');
      menu.append(
        ...this.documentButtons(() => {
          this.docOpen = false;
          this.render();
        }),
      );
      wrap.append(menu);
    }
    return wrap;
  }

  /** Aussicht und Musik wechselt man oft: Sie bleiben in der Leiste direkt erreichbar. */
  private pickers(): HTMLElement[] {
    const t = this.t;
    const s = this.settings;
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
    return [
      picker('window', t.view, '', (Object.keys(VIEWS) as ViewId[]).map((id) => [id, t.views[id]]), s.view, (v) => this.update({ view: v as ViewId })),
      picker('music', t.music, s.track ? 'active' : '', [['', t.musicOff], ...TRACKS.map((id): [string, string] => [id, trackTitle(id)])], s.track, (v) => this.update({ track: v as TrackId | '' })),
    ];
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

  /** Einstellungen nach Themen in Reitern; die Leiste ist nur die Abkürzung für das Häufigste. */
  private renderPanel(): HTMLElement {
    const t = this.t;
    const panel = el('section', 'panel settings');

    const head = el('header', 'panel-head');
    const close = iconBtn('close', t.close);
    close.onclick = () => {
      this.panelOpen = false;
      this.render();
    };
    head.append(el('h2', '', t.settings), close);

    // Auf großen Fenstern steckt „Start“ in der Leiste; beim Umschalten zurück auf den ersten Reiter
    const tab = !small.matches && this.panelTab === 'start' ? 'writing' : this.panelTab;
    const tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'tablist');
    const entries: [PanelTab, string][] = [['writing', t.groupWriting], ['room', t.groupRoom], ['sound', t.groupSound], ['general', t.tabGeneral]];
    if (small.matches) entries.unshift(['start', t.tabStart]);
    for (const [id, label] of entries) {
      const b = el('button', `tab${id === tab ? ' active' : ''}`, label);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(id === tab));
      b.onclick = () => {
        this.panelTab = id;
        this.render();
        this.root.querySelector('.panel-body')!.scrollTop = 0;
      };
      tabs.append(b);
    }

    const body = el('div', 'panel-body');
    if (tab === 'start') this.fillStartTab(body);
    else if (tab === 'writing') this.fillWritingTab(body);
    else if (tab === 'room') this.fillRoomTab(body);
    else if (tab === 'sound') this.fillSoundTab(body);
    else this.fillGeneralTab(body);
    panel.append(head, tabs, body);
    return panel;
  }

  /** Bausteine für die Zeilen eines Reiters. */
  private rows(body: HTMLElement) {
    const row = (label: string, control: HTMLElement) => {
      const r = el('label', 'row');
      r.append(el('span', '', label), control);
      body.append(r);
    };
    return {
      row,
      group: (label: string) => body.append(el('h3', '', label)),
      select: <T extends string>(label: string, value: T, options: [T, string][], onChange: (v: T) => void) => {
        const sel = el('select');
        for (const [v, text] of options) {
          const o = el('option', '', text);
          o.value = v;
          o.selected = v === value;
          sel.append(o);
        }
        sel.onchange = () => onChange(sel.value as T);
        row(label, sel);
      },
      toggle: (label: string, checked: boolean, onChange: (v: boolean) => void) => {
        const c = el('input');
        c.type = 'checkbox';
        c.checked = checked;
        c.onchange = () => onChange(c.checked);
        row(label, c);
      },
    };
  }

  /** Nur auf kleinen Displays: alles, was sonst in der Leiste sitzt. */
  private fillStartTab(body: HTMLElement): void {
    if (!this.letter) body.append(this.renderMoods(false));
    const tools = el('div', 'tools');
    tools.append(...this.writingButtons(), ...this.documentButtons());
    body.append(tools);
  }

  private fillWritingTab(body: HTMLElement): void {
    const t = this.t;
    const s = this.settings;
    const { group, select, toggle } = this.rows(body);
    group(t.groupMachine);
    select<ModelId>(t.model, s.model, (Object.keys(MODELS) as ModelId[]).map((id) => [id, t.models[id]]), (model) => this.update({ model, color: MODELS[model].color }));
    select<BodyColorId>(t.color, s.color, (Object.keys(BODY_COLORS) as BodyColorId[]).map((id) => [id, t.colors[id]]), (color) => this.update({ color }));
    select<RibbonId>(t.ribbon, s.ribbon, (Object.keys(RIBBONS) as RibbonId[]).map((id) => [id, t.ribbons[id]]), (ribbon) => this.update({ ribbon }));
    select<LayoutId>(t.layout, s.layout, (Object.keys(LAYOUTS) as LayoutId[]).map((id) => [id, LAYOUTS[id].label]), (layout) => this.update({ layout }));
    group(t.groupPaper);
    select<PaperTone>(t.paperTone, s.paperTone, [['classic', t.paperTones.classic], ['cream', t.paperTones.cream]], (paperTone) => this.update({ paperTone }));
    select<TextSize>(t.textSize, s.textSize, [['normal', t.textSizes.normal], ['large', t.textSizes.large], ['xlarge', t.textSizes.xlarge]], (textSize) => this.update({ textSize }));
    toggle(t.softWrap, s.softWrap, (softWrap) => this.update({ softWrap }));
    toggle(t.correction, s.correction, (correction) => this.update({ correction }));
    body.append(el('p', 'credits', t.correctionHint));
  }

  private fillRoomTab(body: HTMLElement): void {
    const t = this.t;
    const s = this.settings;
    const { group, select, toggle } = this.rows(body);
    group(t.groupOutlook);
    select<ViewId>(t.view, s.view, (Object.keys(VIEWS) as ViewId[]).map((id) => [id, t.views[id]]), (view) => this.update({ view }));
    toggle(t.night, s.time === 'night', (night) => this.update({ time: night ? 'night' : 'day' }));
    toggle(t.lamp, s.lamp, (lamp) => this.update({ lamp }));
    toggle(t.rain, s.rain, (rain) => this.update({ rain }));
    toggle(t.life, s.life, (life) => this.update({ life }));
    toggle(t.hints, s.hints, (hints) => this.update({ hints, hintsSeen: hints ? [] : s.hintsSeen }));
    group(t.groupGraphics);
    select<Quality>(t.quality, s.quality, [['high', t.qualityHigh], ['low', t.qualityLow]], (quality) => this.update({ quality }));
    toggle(t.saver, s.saver, (saver) => this.update({ saver }));
    toggle(t.viewDepth, s.viewDepth, (viewDepth) => this.update({ viewDepth }));
    toggle(t.dust, s.dust, (dust) => this.update({ dust }));
    toggle(t.shafts, s.shafts, (shafts) => this.update({ shafts }));
    toggle(t.ao, s.ao, (ao) => this.update({ ao }));
    toggle(t.fps, s.fps, (fps) => this.update({ fps }));
    body.append(el('p', 'credits', t.fpsHint));
  }

  private fillSoundTab(body: HTMLElement): void {
    const t = this.t;
    const s = this.settings;
    const { row, group, select, toggle } = this.rows(body);
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
    toggle(t.mute, s.muted, (muted) => this.update({ muted }));
    group(t.groupMusic);
    select<TrackId | ''>(t.song, s.track, [['', t.musicOff], ...TRACKS.map((id): [TrackId, string] => [id, trackTitle(id)])], (track) => this.update({ track }));
    slider(t.musicVolume, 'musicVolume');
    slider(t.rainVolume, 'rainVolume');
    group(t.groupTyping);
    toggle(t.softStrike, s.softStrike, (softStrike) => this.update({ softStrike }));
    slider(t.volume, 'volume');
    slider(t.bellVolume, 'bellVolume');
    slider(t.returnVolume, 'returnVolume');
  }

  private fillGeneralTab(body: HTMLElement): void {
    const t = this.t;
    const s = this.settings;
    const { select, toggle } = this.rows(body);
    select<Lang>(t.language, s.lang, [['de', 'Deutsch'], ['en', 'English']], (lang) => this.update({ lang }));
    toggle(t.calm, s.calm, (calm) => this.update({ calm }));
    const extras = el('div', 'tools');
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
    if (extras.childElementCount) body.append(extras);
    body.append(el('p', 'credits', t.credits));
  }
}
