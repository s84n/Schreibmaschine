import type { Typewriter } from '../typewriter/Typewriter';

/** Platzhalter im Eingabefeld, damit auch am „leeren“ Feld die Rücktaste ein Ereignis auslöst. */
const SENTINEL = '    ';

/**
 * Smartphone-Tastatur. Sie öffnet sich nur, wenn ein Eingabefeld den Fokus bekommt, und liefert
 * auf Android oft keine brauchbaren keydown-Ereignisse (key = "Unidentified", Composition).
 * Daher wird der Feldinhalt nach jeder Eingabe mit dem vorherigen Stand verglichen.
 */
export class SoftKeyboard {
  private readonly input = document.createElement('textarea');
  private last = SENTINEL;
  private composing = false;
  private baseHeight = 0;
  private shrunk = false;
  private fallbackTimer = 0;

  constructor(
    private readonly tw: Typewriter,
    canvas: HTMLElement,
    private readonly onChange: (open: boolean) => void,
    private readonly reserveBottom: (factor: number) => void,
  ) {
    const i = this.input;
    i.className = 'soft-input';
    i.setAttribute('autocapitalize', 'none');
    i.setAttribute('autocomplete', 'off');
    i.setAttribute('autocorrect', 'off');
    i.setAttribute('enterkeyhint', 'enter');
    i.setAttribute('aria-hidden', 'true');
    i.spellcheck = false;
    i.tabIndex = -1;
    i.value = SENTINEL;
    document.body.append(i);

    i.addEventListener('compositionstart', () => (this.composing = true));
    i.addEventListener('compositionend', () => {
      this.composing = false;
      this.sync();
    });
    i.addEventListener('input', () => this.sync());
    i.addEventListener('focus', () => this.onChange(true));
    i.addEventListener('blur', () => {
      window.clearTimeout(this.fallbackTimer);
      this.reserveBottom(1);
      this.onChange(false);
    });

    // Antippen der Szene (Kamera drehen) soll die Tastatur nicht schließen
    canvas.addEventListener('mousedown', (e) => {
      if (this.isOpen) e.preventDefault();
    });

    const vv = window.visualViewport;
    vv?.addEventListener('resize', () => this.onViewport());
    // iOS schiebt die Seite beim Fokussieren nach oben
    vv?.addEventListener('scroll', () => window.scrollTo(0, 0));
    screen.orientation?.addEventListener('change', () => (this.baseHeight = 0));
    this.onViewport();
  }

  get isOpen(): boolean {
    return document.activeElement === this.input;
  }

  /** Muss direkt aus einer Nutzergeste kommen, sonst öffnen die Browser die Tastatur nicht. */
  toggle(): void {
    if (this.isOpen && this.shrunk) {
      this.input.blur();
      return;
    }
    this.input.blur();
    this.input.focus({ preventScroll: true });
    this.resetField();
    // Im Vollbild melden manche Android-Browser die Tastatur nicht: dann Platz freihalten
    window.clearTimeout(this.fallbackTimer);
    this.fallbackTimer = window.setTimeout(() => {
      if (this.isOpen && !this.shrunk && document.fullscreenElement) this.reserveBottom(0.45);
    }, 600);
  }

  /** Wurde die Tastatur am Gerät weggeklickt, bleibt der Fokus – den geben wir hier frei. */
  private onViewport(): void {
    const h = window.visualViewport?.height ?? window.innerHeight;
    this.baseHeight = Math.max(this.baseHeight, h);
    const shrunk = h < this.baseHeight * 0.8;
    if (this.shrunk && !shrunk && this.isOpen) this.input.blur();
    this.shrunk = shrunk;
  }

  private sync(): void {
    const now = this.input.value;
    let p = 0;
    while (p < now.length && p < this.last.length && now[p] === this.last[p]) p++;
    for (let n = this.last.length - p; n > 0; n--) this.tw.backspace();
    for (const ch of now.slice(p)) {
      if (ch === '\n') this.tw.carriageReturn();
      else if (ch === ' ') this.tw.space();
      else if (ch === '\t') this.tw.tab();
      else this.tw.type(ch, '');
    }
    this.last = now;
    if (!this.composing) this.resetField();
  }

  private resetField(): void {
    this.input.value = this.last = SENTINEL;
    this.input.setSelectionRange(SENTINEL.length, SENTINEL.length);
  }
}
