import { MAX_COLS, MAX_LINES, RIBBONS, type RibbonId, type Strike } from './Document';

/** Zusammenhängende Anschläge: Zeile, Startspalte, Text, Farbband (ohne Angabe: schwarz). */
type Run = [number, number, string, RibbonId?];

/** Schutz vor manipulierten Links: Mehr entpacken wir nicht. */
const MAX_DECODED = 2_000_000;
const PARAM = 'brief=';

function toRuns(strikes: Strike[]): Run[] {
  const runs: Run[] = [];
  let next = { line: -1, col: -1, ink: 'black' as RibbonId };
  for (const s of strikes) {
    const ink = s.ink ?? 'black';
    const last = runs[runs.length - 1];
    if (last && s.line === next.line && s.col === next.col && ink === next.ink) last[2] += s.ch;
    else runs.push(ink === 'black' ? [s.line, s.col, s.ch] : [s.line, s.col, s.ch, ink]);
    next = { line: s.line, col: s.col + 1, ink };
  }
  return runs;
}

/** Reihenfolge bleibt erhalten, die Tintenvariation entsteht beim Empfänger neu. */
function fromRuns(runs: unknown): Strike[] {
  if (!Array.isArray(runs)) throw new Error('Ungültiger Brief');
  const strikes: Strike[] = [];
  let line = 0;
  for (const run of runs) {
    const [l, c, text, ink] = run as Run;
    if (!Number.isInteger(l) || !Number.isInteger(c) || typeof text !== 'string' || l < line || l >= MAX_LINES || c < 0) throw new Error('Ungültiger Brief');
    if (ink !== undefined && !Object.hasOwn(RIBBONS, ink)) throw new Error('Ungültiger Brief');
    line = l;
    let col = c;
    for (const ch of text) {
      if (col >= MAX_COLS) throw new Error('Ungültiger Brief');
      strikes.push({ line: l, col: col++, ch, seed: (Math.random() * 2 ** 32) >>> 0, ink });
    }
  }
  return strikes;
}

async function pipe(data: Uint8Array, stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> }): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(data as BufferSource).then(() => writer.close()).catch(() => undefined);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_DECODED) {
      void reader.cancel();
      throw new Error('Brief zu groß');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Baut den Link. Der Text steckt im #-Teil der Adresse und erreicht damit keinen Server. */
export async function letterUrl(pages: Strike[][]): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, p: pages.map(toRuns) }));
  const packed = await pipe(json, new CompressionStream('deflate-raw') as never);
  let binary = '';
  for (const byte of packed) binary += String.fromCharCode(byte);
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}${location.pathname}#${PARAM}${b64}`;
}

/** Liest einen Brief aus der aktuellen Adresse; null, wenn keiner darin steht. Wirft bei kaputten Links. */
export async function readLetter(): Promise<Strike[][] | null> {
  if (!location.hash.startsWith(`#${PARAM}`)) return null;
  const b64 = location.hash.slice(PARAM.length + 1).replace(/-/g, '+').replace(/_/g, '/');
  const packed = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const json = await pipe(packed, new DecompressionStream('deflate-raw') as never);
  const data = JSON.parse(new TextDecoder().decode(json)) as { v?: number; p?: unknown };
  if (data.v !== 1 || !Array.isArray(data.p)) throw new Error('Ungültiger Brief');
  return data.p.map(fromRuns);
}
