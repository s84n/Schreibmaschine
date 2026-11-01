import { MAX_COLS, MAX_LINES, type Strike } from './Document';

const TAB_COLS = 5;

/** Bricht einen Text wortweise in die Zeilen des Blatts um; zu lange Wörter werden geteilt. */
function wrapLines(text: string): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line: string[] = [];
    let lastBreak = -1;
    for (const raw of paragraph) {
      if (raw === '\t') {
        const spaces = TAB_COLS - (line.length % TAB_COLS);
        for (let i = 0; i < spaces && line.length < MAX_COLS; i++) line.push(' ');
        lastBreak = line.length - 1;
        continue;
      }
      if (line.length >= MAX_COLS) {
        if (raw === ' ') {
          lines.push(line.join(''));
          line = [];
          lastBreak = -1;
          continue;
        }
        const keep = lastBreak >= 0 ? line.slice(0, lastBreak + 1) : line;
        const rest = lastBreak >= 0 ? line.slice(lastBreak + 1) : [];
        lines.push(keep.join('').trimEnd());
        line = rest;
        lastBreak = -1;
      }
      line.push(raw);
      if (raw === ' ') lastBreak = line.length - 1;
    }
    lines.push(line.join('').trimEnd());
  }
  return lines;
}

/** Setzt einen eingefügten Text als fertige Anschläge auf A4-Blätter; \f beginnt ein neues Blatt. */
export function layoutText(input: string): Strike[][] {
  const text = input
    .replace(/\r\n?/g, '\n')
    // Unsichtbare Steuerzeichen haben auf dem Papier nichts verloren
    .replace(/[\u0000-\u0008\u000b\u000e-\u001f\u007f​-‏﻿]/g, '')
    .replace(/ /g, ' ')
    .trim();
  if (!text) return [];
  const pages: Strike[][] = [];
  for (const sheet of text.split('\f')) {
    let page: Strike[] = [];
    let row = 0;
    for (const line of wrapLines(sheet)) {
      if (row >= MAX_LINES) {
        pages.push(page);
        page = [];
        row = 0;
      }
      [...line].forEach((ch, col) => {
        if (ch !== ' ') page.push({ line: row, col, ch, seed: (Math.random() * 2 ** 32) >>> 0, ink: 'black' });
      });
      row++;
    }
    if (page.length) pages.push(page);
  }
  return pages;
}
