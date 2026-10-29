import '@fontsource/special-elite/400.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { AudioEngine } from './audio/AudioEngine';
import { Music } from './audio/Music';
import { exportPdf, exportPng, exportText } from './export/Export';
import { bindKeyboard } from './input/Keyboard';
import { LAYOUTS } from './input/layouts';
import { TYPE_FONT } from './paper/InkCanvas';
import { Stage } from './scene/Scene';
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
  let unlocked = false;
  const syncMusic = () => {
    if (!unlocked) return;
    if (settings.music) (music ??= new Music(audio.music.ctx, audio.music.out)).start();
    else music?.stop();
  };

  const doc = new TypedDocument();
  doc.load();

  const tw = new Typewriter(LAYOUTS[settings.layout], audio, doc);
  tw.setBodyColor(settings.color);

  const stage = new Stage(document.getElementById('app')!, () => tw.update());
  stage.scene.add(tw.group);
  stage.setQuality(settings.quality);
  void stage.room.setView(settings.view);

  const overlay = new Overlay(document.getElementById('ui')!, settings, {
    onView: (v) => stage.flyTo(v),
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
      audio.setVolume(next.volume);
      audio.setMuted(next.muted);
      audio.setMusicVolume(next.musicVolume);
      if (next.view !== settings.view) void stage.room.setView(next.view);
      const musicChanged = next.music !== settings.music;
      settings = { ...next };
      saveSettings(settings);
      if (musicChanged) {
        audio.unlock();
        unlocked = true;
        syncMusic();
      }
    },
  });

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
