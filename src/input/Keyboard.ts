import type { Typewriter } from '../typewriter/Typewriter';

/**
 * Übersetzt echte Tastatureingaben in Maschinenaktionen.
 * Das gedruckte Zeichen kommt aus `event.key` (respektiert das Betriebssystem-Layout),
 * die animierte Taste wird über das Zeichen bzw. `event.code` gefunden.
 */
export function bindKeyboard(tw: Typewriter, onFirstInput: () => void, enabled: () => boolean): void {
  window.addEventListener('keydown', (e) => {
    if (!enabled()) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    const altGr = e.getModifierState('AltGraph');
    // Browser-Kürzel (Strg+R, Strg+P …) nicht abfangen
    if ((e.ctrlKey || e.metaKey) && !altGr) return;

    onFirstInput();

    switch (e.code) {
      case 'ShiftLeft':
      case 'ShiftRight':
        tw.setShift(e.code === 'ShiftLeft' ? 'left' : 'right', true);
        return;
      case 'CapsLock':
        if (!e.repeat) tw.toggleShiftLock();
        return;
    }
    if (e.repeat) {
      // Eine mechanische Maschine kennt keine Tastenwiederholung – außer beim Rücksetzer.
      if (e.key !== 'Backspace') {
        e.preventDefault();
        return;
      }
    }

    switch (e.key) {
      case 'Enter':
        tw.carriageReturn();
        break;
      case 'Backspace':
        // Umschalt+Rücktaste nimmt immer das Korrekturband
        tw.backspace(e.shiftKey);
        break;
      case 'Tab':
        tw.tab();
        break;
      case ' ':
        tw.space();
        break;
      default:
        if (e.key.length === 1) tw.type(e.key, e.code);
        else return;
    }
    e.preventDefault();
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      tw.setShift(e.code === 'ShiftLeft' ? 'left' : 'right', false);
    }
  });

  // Beim Fensterwechsel gedrückte Umschalttasten lösen
  window.addEventListener('blur', () => {
    tw.setShift('left', false);
    tw.setShift('right', false);
  });
}
