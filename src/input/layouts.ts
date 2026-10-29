export type LayoutId = 'qwertz' | 'qwerty';

/** Eine Zeichentaste der Maschine: physischer Code + Klein-/Großzeichen auf dem Typenhebel. */
export interface KeyDef {
  code: string;
  lower: string;
  upper: string;
}

export interface Layout {
  id: LayoutId;
  label: string;
  rows: KeyDef[][];
}

const k = (code: string, lower: string, upper: string): KeyDef => ({ code, lower, upper });

const letters = (codes: string): KeyDef[] =>
  codes.split('').map((c) => k(`Key${c.toUpperCase()}`, c.toLowerCase(), c.toUpperCase()));

const digitRow = (uppers: string[]): KeyDef[] =>
  '1234567890'.split('').map((d, i) => k(`Digit${d}`, d, uppers[i]));

export const LAYOUTS: Record<LayoutId, Layout> = {
  qwertz: {
    id: 'qwertz',
    label: 'QWERTZ',
    rows: [
      [...digitRow(['!', '"', '§', '$', '%', '&', '/', '(', ')', '=']), k('Minus', 'ß', '?'), k('Equal', '´', '`')],
      [...letters('qwertzuiop').map((d) => (d.lower === 'z' ? k('KeyY', 'z', 'Z') : d)), k('BracketLeft', 'ü', 'Ü'), k('BracketRight', '+', '*')],
      [...letters('asdfghjkl'), k('Semicolon', 'ö', 'Ö'), k('Quote', 'ä', 'Ä'), k('Backslash', '#', "'")],
      [k('IntlBackslash', '<', '>'), ...letters('yxcvbnm').map((d) => (d.lower === 'y' ? k('KeyZ', 'y', 'Y') : d)), k('Comma', ',', ';'), k('Period', '.', ':'), k('Slash', '-', '_')],
    ],
  },
  qwerty: {
    id: 'qwerty',
    label: 'QWERTY',
    rows: [
      [...digitRow(['!', '@', '#', '$', '%', '^', '&', '*', '(', ')']), k('Minus', '-', '_'), k('Equal', '=', '+')],
      [...letters('qwertyuiop'), k('BracketLeft', '[', '{'), k('BracketRight', ']', '}')],
      [...letters('asdfghjkl'), k('Semicolon', ';', ':'), k('Quote', "'", '"')],
      [...letters('zxcvbnm'), k('Comma', ',', '<'), k('Period', '.', '>'), k('Slash', '/', '?')],
    ],
  },
};
