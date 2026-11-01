/** Einheitliche Strich-Icons (24 × 24, Linienfarbe = Textfarbe) für die Oberfläche. */
const PATHS = {
  paper: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 11h7M9 14.5h7M9 18h4"/>',
  machine: '<path d="M7 9V5h10v4"/><path d="M4 9h16l1.5 11h-19z"/><path d="M7 13h.01M10.5 13h.01M14 13h.01M17 13h.01M8 17h8"/>',
  read: '<path d="M12 6.5C10 5 7 4.5 3 4.8v14c4-.3 7 .2 9 1.7 2-1.5 5-2 9-1.7v-14c-4-.3-7 .2-9 1.7z"/><path d="M12 6.5v14"/>',
  sheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M12.5 11v6M9.5 14h6"/>',
  download: '<path d="M12 4v11"/><path d="M7.5 11 12 15.5 16.5 11"/><path d="M4.5 20h15"/>',
  share: '<path d="M10 14a4 4 0 0 0 6 .4l3-3a4 4 0 0 0-5.7-5.7l-1.4 1.4"/><path d="M14 10a4 4 0 0 0-6-.4l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
  window: '<path d="M4 3h16v18H4z"/><path d="M12 3v18M4 11h16"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2"/><circle cx="12" cy="12" r="7"/>',
  keyboard: '<path d="M2.5 6.5h19v11h-19z"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M18 13.5h.01M9 14h6"/>',
  fresh: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  coffee: '<path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3v3M12 3v3"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8a3.5 3.5 0 0 1 0 7z"/><path d="M8.5 18l-1 3M12.5 18l-1 3M16.5 18l-1 3"/>',
  leaf: '<path d="M5 19C4 10 10 4 20 4c0 10-6 16-15 15z"/><path d="M4 21 14 10"/>',
  snow: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  stars: '<path d="m10 4 1.8 4.7L16.5 10.500l-4.700 1.800L10 17l-1.800-4.700L3.500 10.500l4.700-1.800z"/><path d="M18 3v4M16 5h4M18 16v4M16 18h4"/>',
  waves: '<path d="M2.500 9c2 0 2-2 4.750-2s2.750 2 4.750 2 2-2 4.750-2 2.750 2 4.750 2"/><path d="M2.500 14c2 0 2-2 4.750-2s2.750 2 4.750 2 2-2 4.750-2 2.750 2 4.750 2"/><path d="M2.500 19c2 0 2-2 4.750-2s2.750 2 4.750 2 2-2 4.750-2 2.750 2 4.750 2"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[name];
  return svg;
}
