import '@fontsource/special-elite/400.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { Ambience } from './audio/Ambience';
import { AudioEngine } from './audio/AudioEngine';
import { Music } from './audio/Music';
import { DONATE_URL } from './config';
import { exportPdf, exportPng, exportText } from './export/Export';
import { bindKeyboard } from './input/Keyboard';
import { LAYOUTS } from './input/layouts';
import { SoftKeyboard } from './input/SoftKeyboard';
import { TYPE_FONT } from './paper/InkCanvas';
import { Stage, type CameraView } from './scene/Scene';
import { TypedDocument } from './state/Document';
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
  let ambience: Ambience | undefined;
  let rainSound: Ambience | undefined;
  let unlocked = false;
  const syncMusic = () => {
    if (!unlocked) return;
    if (settings.music) (music ??= new Music(audio.music.ctx, audio.music.out)).start();
    else music?.stop();
    if (ambience || settings.ambience !== 'off') (ambience ??= new Ambience(audio.music.ctx, audio.music.out)).set(settings.ambience);
    if (rainSound || settings.rain) (rainSound ??= new Ambience(audio.music.ctx, audio.music.out)).set(settings.rain ? 'rain' : 'off');
  };

  const doc = new TypedDocument();
  doc.load();

  const tw = new Typewriter(LAYOUTS[settings.layout], audio, doc, settings.model);
  tw.setBodyColor(settings.color);
  tw.setRibbon(settings.ribbon, false);

  const stage = new Stage(document.getElementById('app')!, () => tw.update());
  stage.scene.add(tw.group);
  stage.setQuality(settings.quality);
  void stage.room.setView(settings.view);
  stage.setTime(settings.time, false);
  stage.room.setRain(settings.rain, false);
  stage.room.setCat(settings.cat);

  let view: CameraView = 'machine';
  const overlay = new Overlay(document.getElementById('ui')!, settings, {
    onView: (v) => {
      view = v;
      stage.flyTo(v);
    },
    onKeyboard: () => softKeyboard.toggle(),
    onNewSheet: () => tw.newSheet(),
    onExport: (kind) => {
      tw.update();
      if (kind === 'png') exportPng(tw.ink.canvas);
      else if (kind === 'pdf') void exportPdf(tw.ink.canvas);
      else exportText(doc.toPlainText());
    },
    onSettings: (next: Settings) => {
      if (next.layout !== settings.layout) tw.setLayout(LAYOUTS[next.layout]);
      if (next.quality !== settings.quality) stage.setQuality(next.quality);
      if (next.color !== settings.color) tw.setBodyColor(next.color);
      if (next.model !== settings.model) tw.setModel(next.model);
      if (next.ribbon !== settings.ribbon) tw.setRibbon(next.ribbon);
      if (next.time !== settings.time) stage.setTime(next.time);
      if (next.rain !== settings.rain) stage.room.setRain(next.rain);
      if (next.cat !== settings.cat) stage.room.setCat(next.cat);
      audio.setVolume(next.volume);
      audio.setMuted(next.muted);
      audio.setMusicVolume(next.musicVolume);
      if (next.view !== settings.view) void stage.room.setView(next.view);
      const soundChanged = next.music !== settings.music || next.ambience !== settings.ambience || next.rain !== settings.rain;
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

  const begin = () => {
    audio.unlock();
    overlay.start();
    if (!unlocked) {
      unlocked = true;
      syncMusic();
    }
  };
  window.addEventListener('pointerdown', begin);
  bindKeyboard(tw, begin, () => true);
  window.addEventListener('beforeunload', () => doc.saveNow());

  registerSW({ immediate: true });
}

void main();
