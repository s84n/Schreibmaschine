import '@fontsource/special-elite/400.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { AudioEngine } from './audio/AudioEngine';
import { RainSound } from './audio/RainSound';
import { Music, TRACKS, type TrackId } from './audio/Music';
import { DONATE_URL } from './config';
import { exportPdf, exportPng, exportText } from './export/Export';
import { bindKeyboard } from './input/Keyboard';
import { LAYOUTS } from './input/layouts';
import { SoftKeyboard } from './input/SoftKeyboard';
import { InkCanvas, TYPE_FONT } from './paper/InkCanvas';
import { VIEWS, type ViewId } from './scene/Room';
import { Stage, type CameraView } from './scene/Scene';
import type { RoomTargetId } from './scene/Targets';
import { MAX_COLS, TypedDocument, type Strike } from './state/Document';
import { letterUrl, readLetter } from './state/Letter';
import { Typewriter } from './typewriter/Typewriter';
import { Overlay } from './ui/Overlay';
import { Reader } from './ui/Reader';
import { loadSettings, saveSettings, type Settings, type TextSize } from './ui/Settings';

/** Wie nah die Papieransicht an das Blatt heranrückt. */
const PAPER_ZOOM: Record<TextSize, number> = { normal: 1, large: 1.3, xlarge: 1.65 };

async function main(): Promise<void> {
  // Schrift muss geladen sein, bevor gespeicherter Text auf das Papier gezeichnet wird.
  await document.fonts.load(`32px ${TYPE_FONT}`).catch(() => undefined);

  let settings = loadSettings();
  const audio = new AudioEngine();
  audio.init();
  audio.setVolume(settings.volume);
  audio.setMuted(settings.muted);
  audio.setMusicVolume(settings.musicVolume);
  audio.setRainVolume(settings.rainVolume);
  audio.setSoft(settings.softStrike);
  audio.setBellVolume(settings.bellVolume);
  audio.setReturnVolume(settings.returnVolume);
  document.body.classList.toggle('calm', settings.calm);
  let music: Music | undefined;
  let rainSound: RainSound | undefined;
  let unlocked = false;
  const syncMusic = () => {
    if (!unlocked) return;
    if (music || settings.track) (music ??= new Music(audio.music.ctx, audio.music.out)).set(settings.track);
    if (rainSound || settings.rain) (rainSound ??= new RainSound(audio.rain.ctx, audio.rain.out)).set(settings.rain);
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
  tw.ink.setTone(settings.paperTone);
  tw.restore();
  tw.softWrap = settings.softWrap;
  // Ein empfangener Brief wird gezeigt, wie er getippt wurde
  tw.correction = settings.correction && !letter;

  const stage = new Stage(document.getElementById('app')!, () => tw.update());
  stage.scene.add(tw.group);
  stage.setQuality(settings.quality);
  void stage.room.setView(settings.view);
  stage.setTime(settings.time, false);
  stage.room.setRain(settings.rain, false);
  stage.room.setLife(settings.life);
  stage.room.setDust(settings.dust);
  stage.room.setShafts(settings.shafts);
  stage.setAO(settings.ao);
  stage.setSaver(settings.saver);
  stage.setCalm(settings.calm);
  stage.setPaperZoom(PAPER_ZOOM[settings.textSize], 'machine');
  stage.room.lamp.setOn(settings.lamp, false);
  stage.room.radio.setOn(!!settings.track);
  stage.blockers = [tw.group];

  // Zweite Tintenfläche zum Rendern fertiger Blätter (PDF, oberstes Blatt des Stapels), bei Bedarf erzeugt
  let sheetInk: InkCanvas | undefined;
  const renderSheet = (strikes: Strike[]): HTMLCanvasElement => {
    sheetInk ??= new InkCanvas(settings.paperTone);
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
    onUiVisible: (on) => stage.room.targets.setUiVisible(on),
    onRead: () => reader.open(),
    onShare: () => void share(),
    onNewDocument: () => {
      // Nichts geht verloren: Das Manuskript wandert in die Schublade
      if (!doc.allPages().length) return;
      if (!doc.archive()) return overlay.toast(overlay.t.drawerFull);
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
      if (next.life !== settings.life) stage.room.setLife(next.life);
      if (next.dust !== settings.dust) stage.room.setDust(next.dust);
      if (next.shafts !== settings.shafts) stage.room.setShafts(next.shafts);
      if (next.ao !== settings.ao) stage.setAO(next.ao);
      if (next.saver !== settings.saver) stage.setSaver(next.saver);
      if (next.calm !== settings.calm) {
        stage.setCalm(next.calm);
        document.body.classList.toggle('calm', next.calm);
      }
      if (next.lamp !== settings.lamp) stage.room.lamp.setOn(next.lamp);
      if (next.track !== settings.track) stage.room.radio.setOn(!!next.track);
      if (next.textSize !== settings.textSize) stage.setPaperZoom(PAPER_ZOOM[next.textSize], view);
      tw.softWrap = next.softWrap;
      tw.correction = next.correction && !letter;
      if (next.paperTone !== settings.paperTone) {
        tw.ink.setTone(next.paperTone);
        sheetInk?.setTone(next.paperTone);
        tw.restore();
        syncStack();
      }
      audio.setSoft(next.softStrike);
      audio.setBellVolume(next.bellVolume);
      audio.setReturnVolume(next.returnVolume);
      audio.setVolume(next.volume);
      audio.setMuted(next.muted);
      audio.setMusicVolume(next.musicVolume);
      audio.setRainVolume(next.rainVolume);
      if (next.view !== settings.view) void stage.room.setView(next.view);
      const soundChanged = next.track !== settings.track || next.rain !== settings.rain;
      const hintsChanged = next.hints !== settings.hints || next.hintsSeen !== settings.hintsSeen;
      settings = { ...next };
      saveSettings(settings);
      if (hintsChanged) syncHints();
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

  // Leseansicht und Schublade
  const reader = new Reader({
    t: () => overlay.t,
    size: () => settings.textSize,
    pages: () => doc.allPages(),
    render: renderSheet,
    drawer: () => doc.drawer,
    onTake: (id) => {
      if (!doc.takeFromDrawer(id)) return overlay.toast(overlay.t.drawerFull);
      tw.restore();
      syncStack();
      reader.close();
      overlay.toast(overlay.t.drawerTaken);
    },
    onDelete: (id) => doc.deleteFromDrawer(id),
    onToggle: (open) => {
      stage.covered = open;
      if (!open) stage.poke();
    },
  });

  // Dinge im Zimmer
  const targetEnabled = (id: RoomTargetId) => id !== 'mug' || !!DONATE_URL;
  const syncHints = () => stage.room.targets.setShown((id) => settings.hints && targetEnabled(id) && !settings.hintsSeen.includes(id));
  syncHints();
  stage.targetEnabled = targetEnabled;
  stage.canInteract = () => overlay.isStarted && !overlay.isUiHidden;
  stage.onHover = (id, x, y) => overlay.setRoomLabel(id && overlay.t.roomLabels[id], x, y);
  stage.onTarget = (id) => {
    const t = overlay.t;
    const seen = settings.hintsSeen.includes(id) ? settings.hintsSeen : [...settings.hintsSeen, id];
    if (id === 'candle') overlay.change({ time: settings.time === 'night' ? 'day' : 'night', hintsSeen: seen });
    else if (id === 'lamp') overlay.change({ lamp: !settings.lamp, hintsSeen: seen });
    else if (id === 'window') {
      const ids = Object.keys(VIEWS) as ViewId[];
      const next = ids[(ids.indexOf(settings.view) + 1) % ids.length];
      overlay.change({ view: next, hintsSeen: seen });
      overlay.toast(t.views[next]);
    } else if (id === 'radio') {
      const order: (TrackId | '')[] = ['', ...TRACKS];
      const track = order[(order.indexOf(settings.track) + 1) % order.length];
      overlay.change({ track, hintsSeen: seen });
      overlay.toast(track ? `♪ ${track}` : t.musicOff);
    } else if (id === 'stack') {
      overlay.change({ hintsSeen: seen });
      reader.open();
    } else {
      overlay.change({ hintsSeen: seen });
      overlay.openCoffee();
    }
  };
  stage.onQualityDrop = () => {
    overlay.change({ quality: 'low' });
    overlay.toast(overlay.t.qualityDropped);
  };

  tw.on('input', () => {
    stage.poke();
    overlay.noteTyping();
  });
  tw.on('pageEnd', () => {
    if (doc.strikes.length) newSheetPending = true;
  });
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
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (reader.isOpen) reader.back();
    else if (!overlay.closeTop()) overlay.revealUi();
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
  // Die Oberfläche kommt zurück, sobald man wirklich zur Maus greift oder den Schirm berührt
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) >= 3) overlay.revealUi();
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') overlay.revealUi();
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
  bindKeyboard(tw, begin, () => !letter && !reader.isOpen);
  if (letter) {
    overlay.start();
    overlay.setLetter('ready');
  }
  if (letterBroken) overlay.toast(overlay.t.letterBroken);
  window.addEventListener('beforeunload', () => doc.saveNow());

  registerSW({ immediate: true });
}

void main();
