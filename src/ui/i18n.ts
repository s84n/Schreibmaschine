export type Lang = 'de' | 'en';

const STRINGS = {
  de: {
    start: 'Einfach lostippen',
    startHint: 'Klicken oder eine Taste drücken, um zu beginnen',
    hint: 'Enter = Wagenrücklauf · Tab = Tabulator · Rücktaste = Rückschritt',
    viewMachine: 'Maschine',
    viewPaper: 'Papier',
    newSheet: 'Neues Blatt',
    confirmNewSheet: 'Das aktuelle Blatt herausnehmen und ein neues einspannen? Der Text geht verloren (vorher exportieren!).',
    exportPng: 'PNG',
    exportPdf: 'PDF',
    exportTxt: 'Text',
    settings: 'Einstellungen',
    layout: 'Tastaturlayout',
    language: 'Sprache',
    volume: 'Lautstärke',
    mute: 'Stumm',
    quality: 'Grafik',
    qualityHigh: 'Hoch (Shader-Effekte)',
    qualityLow: 'Niedrig (schneller)',
    color: 'Gehäusefarbe',
    colors: { sage: 'Salbeigrün', bordeaux: 'Bordeaux', black: 'Schwarz', cream: 'Creme' },
    close: 'Schließen',
    pageEnd: 'Seitenende erreicht – bitte ein neues Blatt einspannen.',
    saved: 'Wird automatisch im Browser gespeichert',
    credits: 'Sounds: Wikimedia Commons (CC BY / CC0) · Schrift: Special Elite (Apache 2.0)',
  },
  en: {
    start: 'Just start typing',
    startHint: 'Click or press a key to begin',
    hint: 'Enter = carriage return · Tab = tabulator · Backspace = back space',
    viewMachine: 'Machine',
    viewPaper: 'Paper',
    newSheet: 'New sheet',
    confirmNewSheet: 'Remove the current sheet and insert a new one? The text will be lost (export first!).',
    exportPng: 'PNG',
    exportPdf: 'PDF',
    exportTxt: 'Text',
    settings: 'Settings',
    layout: 'Keyboard layout',
    language: 'Language',
    volume: 'Volume',
    mute: 'Mute',
    quality: 'Graphics',
    qualityHigh: 'High (shader effects)',
    qualityLow: 'Low (faster)',
    color: 'Body colour',
    colors: { sage: 'Sage green', bordeaux: 'Bordeaux', black: 'Black', cream: 'Cream' },
    close: 'Close',
    pageEnd: 'End of page – please insert a new sheet.',
    saved: 'Saved automatically in your browser',
    credits: 'Sounds: Wikimedia Commons (CC BY / CC0) · Font: Special Elite (Apache 2.0)',
  },
} as const;

export type Strings = (typeof STRINGS)[Lang];

export function strings(lang: Lang): Strings {
  return STRINGS[lang];
}
