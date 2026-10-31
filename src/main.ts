import '@fontsource/special-elite/400.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { AudioEngine } from './audio/AudioEngine';
import { RainSound } from './audio/RainSound';
import { Music } from './audio/Music';
import { DONATE_URL } from './config';
import { exportPdf, exportPng, exportText } from './export/Export';
import { bindKeyboard } from './input/Keyboard';
import { LAYOUTS } from './input/layouts';
import { SoftKeyboard } from './input/SoftKeyboard';
import { InkCanvas, TYPE_FONT } from './paper/InkCanvas';
import { Stage, type CameraView } from './scene/Scene';
import { MAX_COLS, TypedDocument, type Strike } from './state/Document';
import { letterUrl, readLetter } from './state/Letter';
import { Typewriter } from './typewriter/Typewriter';
import { Overlay } from './ui/Overlay';
import { loadSettings, saveSettings, type Settings } from './ui/Settings';

async function main(): Promise<void> {
  // Schrift muss geladen sein, bevor gespeicherter Text auf das Papier gezeichnet wird.
  await document.fonts.load(`32px ${TYPE_FONT}`).catch(() => undefined);

  let settings = loadSettings();
  const audio = new AudioEngine();
  audio.init();
  audio.setVolume(settings.volume);
  audio.setMuted(settings.muted);
  audio.setMusicVolume(settings.musicVolume);
  let music: Music | undefined;
  let rainSound: RainSound | undefined;
  let unlocked = false;
  const syncMusic = () => {
    if (!unlocked) return;
    if (settings.music) (music ??= new Music(audio.music.ctx, audio.music.out)).start();
    else music?.stop();
    if (rainSound || settings.rain) (rainSound ??= new RainSound(audio.music.ctx, audio.music.out)).set(settings.rain);
  };

  // Ein empfangener Brief läuft in einem eigenen Dokument, das eigene Blatt bleibt unangetastet
  let letter: Strike[][] | null = null;
  let letterBroken = false;
  try {
    letter = await readLetter();
  } catch {
    letterBroken = true;
  }
  const doc = new TypedDocument();
  if (letter) doc.persist = false;
  else doc.load();

  const tw = new Typewriter(LAYOUTS[settings.layout], audio, doc, settings.model);
  tw.setBodyColor(settings.color);
  tw.setRibbon(settings.ribbon, false);

  const stage = new Stage(document.getElementById('app')!, () => tw.update());
  stage.scene.add(tw.group);
  stage.setQuality(settings.quality);
  void stage.room.setView(settings.view);
  stage.setTime(settings.time, false);
  stage.room.setRain(settings.rain, false);
  stage.room.setDust(settings.dust);
  stage.room.setShafts(settings.shafts);
  stage.setAO(settings.ao);

  // Zweite Tintenfläche zum Rendern fertiger Blätter (PDF, oberstes Blatt des Stapels), bei Bedarf erzeugt
  let sheetInk: InkCanvas | undefined;
  const renderSheet = (strikes: Strike[]): HTMLCanvasElement => {
    sheetInk ??= new InkCanvas();
    sheetInk.redraw(strikes);
    return sheetInk.canvas;
  };
  function* pdfPages(): Iterable<HTMLCanvasElement> {
    for (const page of doc.pages) yield renderSheet(page);
    if (doc.strikes.length || !doc.pages.length) yield renderSheet(doc.strikes);
  }
  const syncStack = () => {
    const last = doc.pages[doc.pages.length - 1];
    stage.room.paper.setFinished(doc.pages.length, last && renderSheet(last));
    overlay.setPages(doc.pages.length);
  };

  let view: CameraView = 'machine';
  let viewBeforeFocus: CameraView = 'machine';
  const share = async () => {
    const t = overlay.t;
    const pages = doc.allPages();
    if (!pages.length) return overlay.toast(t.shareEmpty);
    try {
      const url = await letterUrl(pages);
      if (matchMedia('(pointer: coarse)').matches && navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      overlay.toast(url.length > 8000 ? t.shareLong : t.shareCopied);
    } catch (err) {
      // Abbruch im Teilen-Dialog ist kein Fehler
      if ((err as Error).name !== 'AbortError') overlay.toast(t.shareFailed);
    }
  };

  const overlay = new Overlay(document.getElementById('ui')!, settings, {
    onView: (v) => {
      view = v;
      stage.flyTo(v);
    },
    onKeyboard: () => softKeyboard.toggle(),
    onFocus: (on) => {
      if (on) viewBeforeFocus = view;
      view = on ? 'paper' : viewBeforeFocus;
      stage.flyTo(view);
    },
    onShare: () => void share(),
    onNewDocument: () => {
      const sheets = doc.allPages().length;
      if (sheets && !confirm(overlay.t.confirmNewDocument(sheets))) return;
      newDocumentPending = true;
      tw.newSheet(true);
    },
    onLetterPlay: () => void playLetter(),
    onLetterSkip: () => (letterSkipped = true),
    onLetterWrite: () => location.replace(location.pathname),
    onNewSheet: () => {
      if (doc.strikes.length) newSheetPending = true;
      tw.newSheet();
    },
    onExport: (kind) => {
      tw.update();
      if (kind === 'png') return exportPng(renderSheet(doc.strikes));
      if (kind === 'pdf') void exportPdf(pdfPages());
      else exportText(doc.toPlainText());
      // Mehrere Blätter ansagen, damit alte Texte im Export nicht überraschen
      const sheets = doc.allPages().length;
      if (sheets > 1) overlay.toast(overlay.t.exportedSheets(sheets));
    },
    onSettings: (next: Settings) => {
      if (next.layout !== settings.layout) tw.setLayout(LAYOUTS[next.layout]);
      if (next.quality !== settings.quality) stage.setQuality(next.quality);
      if (next.color !== settings.color) tw.setBodyColor(next.color);
      if (next.model !== settings.model) tw.setModel(next.model);
      if (next.ribbon !== settings.ribbon) tw.setRibbon(next.ribbon);
      if (next.time !== settings.time) stage.setTime(next.time);
      if (next.rain !== settings.rain) stage.room.setRain(next.rain);
      if (next.dust !== settings.dust) stage.room.setDust(next.dust);
      if (next.shafts !== settings.shafts) stage.room.setShafts(next.shafts);
      if (next.ao !== settings.ao) stage.setAO(next.ao);
      audio.setVolume(next.volume);
      audio.setMuted(next.muted);
      audio.setMusicVolume(next.musicVolume);
      if (next.view !== settings.view) void stage.room.setView(next.view);
      const soundChanged = next.music !== settings.music || next.rain !== settings.rain;
      settings = { ...next };
      saveSettings(settings);
      if (soundChanged) {
        audio.unlock();
        unlocked = true;
        syncMusic();
      }
    },
  });

  // Bei offener Bildschirmtastatur bleibt nur ein Streifen: dort das Papier zeigen
  let viewBeforeKeyboard: CameraView | undefined;
  const softKeyboard = new SoftKeyboard(
    tw,
    stage.renderer.domElement,
    (open) => {
      overlay.setKeyboardOpen(open);
      if (open) {
        viewBeforeKeyboard ??= view;
        view = 'paper';
      } else if (viewBeforeKeyboard) {
        view = viewBeforeKeyboard;
        viewBeforeKeyboard = undefined;
      }
      stage.flyTo(view);
      overlay.setView(view);
    },
    (factor) => stage.setHeightFactor(factor),
  );
  if (DONATE_URL) stage.onMug = () => overlay.openCoffee();

  tw.on('pageEnd', () => overlay.toast(overlay.t.pageEnd));
  let newSheetPending = false;
  let newDocumentPending = false;
  tw.on('sheet', () => {
    syncStack();
    if (newSheetPending) overlay.toast(overlay.t.sheetDone(doc.pages.length));
    else if (newDocumentPending) overlay.toast(overlay.t.newDocumentDone);
    newSheetPending = newDocumentPending = false;
  });
  doc.onSaveFailed = () => overlay.toast(overlay.t.saveFailed);
  if (doc.pages.length) syncStack();

  window.addEventListener('keydown', (e) => {
    if (letter) return;
    if (e.key === 'F2' || (e.key === 'Escape' && overlay.isFocused)) {
      e.preventDefault();
      overlay.setFocus(!overlay.isFocused);
    }
  });

  // Brief abspielen: dieselbe Mechanik wie beim Tippen, nur die Hände fehlen
  let letterSkipped = false;
  const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
  const settle = async (gap = 0) => {
    await sleep(tw.busyFor * 1000 + gap);
  };
  const playLetter = async () => {
    overlay.setLetter('playing');
    begin();
    const pages = letter!;
    for (let p = 0; p < pages.length && !letterSkipped; p++) {
      if (p > 0) {
        tw.newSheet();
        await settle(200);
      }
      for (const s of pages[p]) {
        if (letterSkipped) break;
        while (doc.line < s.line) {
          tw.carriageReturn();
          await settle(90);
        }
        while (doc.col < s.col && !letterSkipped) {
          tw.space();
          await settle(35 + Math.random() * 70);
        }
        while (doc.col > s.col && !letterSkipped) {
          tw.backspace();
          await settle(60);
        }
        tw.setRibbon(s.ink ?? 'black', false);
        tw.type(s.ch, '');
        await settle(45 + Math.random() ** 2 * 170);
      }
    }
    if (letterSkipped) {
      await settle(100);
      const last = pages[pages.length - 1];
      doc.pages = pages.slice(0, -1);
      doc.strikes = [...last];
      const end = last[last.length - 1];
      doc.line = end?.line ?? 0;
      doc.col = end ? Math.min(end.col + 1, MAX_COLS) : 0;
      tw.restore();
      syncStack();
    }
    overlay.setLetter('done');
  };

  const begin = () => {
    audio.unlock();
    overlay.start();
    if (!unlocked) {
      unlocked = true;
      syncMusic();
    }
  };
  window.addEventListener('pointerdown', begin);
  bindKeyboard(tw, begin, () => !letter);
  if (letter) {
    overlay.start();
    overlay.setLetter('ready');
  }
  if (letterBroken) overlay.toast(overlay.t.letterBroken);
  window.addEventListener('beforeunload', () => doc.saveNow());

  registerSW({ immediate: true });
}

void main();
