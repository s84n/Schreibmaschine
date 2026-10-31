# Schreibmaschine – Projektplan (`plan.md`)

> Zentrale Quelle für alle Planungsdetails. Jede Planänderung wird hier festgehalten (mit Versionsnummer).

**Aktuelle Planversion:** v0.11.0 (2026-10-30) · **Aktuelle App-Version:** v0.17.0

---

## 1. Context / Ziel

„Schreibmaschine“ ist ein browserbasierter Schreibmaschinen-Simulator. Man tippt auf der echten Tastatur,
die Website zeigt eine realistische 3D-Reiseschreibmaschine, deren Teile sich wie im Original bewegen
(Taste sinkt ein → Typenhebel schwingt hoch → schlägt aufs Papier → Wagen rückt vor). Sounds sind
originalgetreu. Hosting über **GitHub Pages**, installierbar als **PWA**.

## 2. Getroffene Entscheidungen

| Thema | Entscheidung |
|---|---|
| Darstellung | Echtes 3D mit **Three.js** (WebGL), PBR-Materialien, Schatten, Post-Processing |
| Vorbild | Klassische **Reiseschreibmaschine** (Stil 1950er/60er), eigenes generisches Design – keine Markennachbildung |
| 3D-Modell | **Prozedural im Code** aus Three.js-Geometrien (jedes Teil einzeln animierbar) |
| Stack | **Vite + TypeScript + Three.js**, `vite-plugin-pwa`, Deployment per GitHub Actions |
| Shader/Optik | `postprocessing`-Library (pmndrs): Depth of Field (Fokus Druckpunkt), Bloom (dezent), Vignette, Film Grain, ACES-Tonemapping, SSAO (abschaltbar). Papier & Tinte über prozedurale Canvas-Textur (statt eigener GLSL-Shader – einfacher, exportierbar) |
| Sound | Echte Aufnahmen von **Wikimedia Commons** (Anschläge: CC BY 3.0, Rücklauf: CC BY 4.0, Glocke: CC0 – Namensnennung in `public/sounds/LICENSES.md`), als WAV zugeschnitten, Wiedergabe via **Web Audio API** mit Pitch-/Volume-Variation |
| Layout | **QWERTZ/QWERTY umschaltbar**, UI **Deutsch + Englisch** |
| Lizenzen | CC0 bevorzugt; CC BY / CC BY-SA nur mit Namensnennung (README + `LICENSES.md` + Credits in der App). BY-SA gilt nur für die bearbeitete Bilddatei, nicht für den Code |
| Atmosphäre | Geschlossenes Zimmer (weiße Putzwände, Dielenboden, Decke) mit Sprossenfenster knapp über Tischhöhe und Deko (Regale, Efeutute, Bücher, Bild, Tasse); Aussicht wählbar (Poly-Haven-Panoramen CC0, als Horizontband auf Kugel hinter dem Fenster); Tisch/Wand mit Poly-Haven-PBR-Texturen (CC0) |
| Musik | **Eigene KI-Songs** aus `public/music` (Auswahlmenü, Dauerschleife), gestreamt und nicht im PWA-Precache (offline keine Musik), standardmäßig aus, eigener Lautstärkeregler |
| Klangkette | Anschläge → EQ → Kompressor (+ dezenter Faltungshall) → Limiter; Ziel: Tippen ≈ −18 LUFS, Musik ≈ 6–7 dB darunter |
| Schrift | **Special Elite** (Apache 2.0) über `@fontsource/special-elite`, lokal gebündelt (offline-fähig) |
| GitHub | Repo `s84n/Schreibmaschine`, Push per eigenem Deploy-Key (SSH), Autor `s84n` mit noreply-Adresse – keine privaten Daten im Repo. Deploy über GitHub Actions → Pages |
| Smartphone | Echtes Erzwingen des Querformats geht nur per Vollbild + Orientation-Lock (nicht in iOS Safari). Daher: Sperrhinweis im Hochformat überall, Lock-Button wo verfügbar. Kein CSS-Drehen der Seite, weil die Systemtastatur sonst quer zum Bild aufginge |
| Modelle | Eigene Entwürfe nach Epochen (Reise, Kontor, Flach) statt Nachbauten: Markennamen und Logos wie Olympia werden nicht verwendet |
| Katze | Bewusst nicht im Konzept: vom Nutzer als Modell verworfen (v0.14.0) |
| Kaffee-Link | Nur ein externer Link (`DONATE_URL` in `src/config.ts`), kein eingebettetes Widget, kein Tracking, keine Gegenleistung; Wortlaut „Kaffee ausgeben“ statt „Spende“ |
| Versionierung | **SemVer** (`MAJOR.MINOR.PATCH`), `CHANGELOG.md`, Git-Tags `vX.Y.Z`, Version in `package.json` und im UI-Footer |

## 3. Features (Umfang v1.0)

1. **Papier & Text** – Getippter Text erscheint auf dem Papier im Wagen; Tinte mit Unregelmäßigkeiten
   (variierende Deckkraft, leichter Versatz pro Anschlag, Farbband-Textur), Monospace-Schreibmaschinenfont.
2. **Mechanik-Animation** – Taste sinkt, Typenhebel schwingt aus dem Korb zum Druckpunkt, Farbband hebt sich,
   Wagen rückt einen Schritt nach links. Shift hebt den Typenkorb an (Großbuchstaben).
3. **Wagenrücklauf & Glocke** – Glocke ca. 8 Zeichen vor Zeilenende; Enter → Rücklaufhebel-Animation,
   Wagen fährt zurück, Walze dreht eine Zeile weiter. Zeilenende blockiert weiteres Tippen (wie original).
4. **Export / Speichern** – Seite als PNG (Canvas-Render des Papiers) und PDF exportieren; Text automatisch in
   `localStorage` sichern; neues Blatt einspannen.
5. **Einstellungen** – Layout QWERTZ/QWERTY, Sprache DE/EN, Lautstärke/Mute, Grafikqualität (niedrig/hoch).
6. **PWA** – Offline-fähig, installierbar, Manifest + Icons.

Später (nicht v1.0): glTF-Hi-Res-Modell.

## 4. Architektur

```
schreibmaschine/
├── plan.md                  # dieser Plan
├── CHANGELOG.md
├── README.md
├── index.html
├── vite.config.ts           # base: '/Schreibmaschine/', vite-plugin-pwa
├── package.json
├── public/
│   ├── sounds/              # WAV-Samples (+ LICENSES.md mit Quellen/Namensnennung)
│   ├── views/               # Fensterpanoramen (Horizontbänder, CC0)
│   ├── textures/            # Tisch- und Wandtexturen (CC0)
│   └── icons/               # PWA-Icons
├── src/
│   ├── main.ts              # Bootstrap
│   ├── scene/
│   │   ├── Scene.ts         # Renderer, Kamera, Licht, OrbitControls (begrenzt)
│   │   ├── PostFX.ts        # postprocessing-Pipeline
│   │   ├── Environment.ts   # RoomEnvironment-Reflexionen, Lampe, Gegenlicht
│   │   ├── Room.ts          # Tisch, Raumhülle, Fenster, Aussicht (Kugel), Fensterlicht
│   │   ├── Decor.ts         # Regale, Efeutute, Bücher, Bild, Tasse (prozedural)
│   │   └── Cozy.ts          # Kerze, Dampf, Lichterkette, Vorhang, Regen auf der Scheibe, Schreibtisch-Kleinigkeiten
│   ├── typewriter/
│   │   ├── Typewriter.ts    # Zusammenbau, Zustandsmaschine
│   │   ├── dims.ts          # zentrale Maße (cm), Druckpunkt
│   │   ├── parts/           # Body.ts, Keys.ts, Typebars.ts, Carriage.ts (inkl. Walze/Hebel), Ribbon.ts, util.ts
│   │   └── materials.ts     # Lack, Chrom, Gummi, Bakelit-Tasten
│   ├── paper/
│   │   ├── Paper.ts         # Papier-Mesh am Wagen
│   │   └── InkCanvas.ts     # 2D-Canvas als Textur: Papierfasern + Zeichen mit Farbband-Varianz
│   ├── input/
│   │   ├── Keyboard.ts      # KeyboardEvent → Maschinenaktion (über event.code + Layout-Map)
│   │   ├── SoftKeyboard.ts  # Smartphone-Tastatur über verstecktes Eingabefeld
│   │   └── layouts.ts       # QWERTZ / QWERTY
│   ├── audio/
│   │   ├── AudioEngine.ts   # Web Audio, Sample-Pool, Effektkette, Limiter, Unlock bei erster Eingabe
│   │   ├── Music.ts         # Abspielen der eigenen Songs (public/music)
│   │   └── RainSound.ts     # generiertes Regengeräusch
│   ├── animation/
│   │   └── Tweens.ts        # schlanke Tween-/Easing-Utilities, Queue für schnelles Tippen
│   ├── state/
│   │   ├── Document.ts      # Zeilen, Cursor, fertige Blätter, localStorage-Persistenz
│   │   └── Letter.ts        # Brief als Link: komprimiert im #-Teil der Adresse
│   ├── export/
│   │   └── Export.ts        # PNG / PDF (jsPDF, nachgeladen) / TXT
│   ├── ui/
│   │   ├── Overlay.ts       # Werkzeugleiste, Einstellungs-Panel, Startschirm, Toasts
│   │   ├── Settings.ts      # Einstellungen laden/speichern
│   │   └── i18n.ts          # DE/EN Strings
│   ├── config.ts            # DONATE_URL
│   └── version.ts           # Version aus package.json (per Vite-define)
└── .github/workflows/deploy.yml   # Build + Deploy auf GitHub Pages
```

**Kernablauf pro Tastendruck:** `Keyboard` → `Typewriter.type(char)` → (a) Tasten- & Typenhebel-Animation,
(b) `AudioEngine.play('strike')`, (c) beim Aufschlag-Zeitpunkt `InkCanvas.draw(char, pos)`,
(d) `Carriage.advance()`, (e) `Document` aktualisieren. Schnelles Tippen wird gequeued, Animationen
dürfen sich überlappen (wie echte Maschine), aber nicht zwei Typenhebel gleichzeitig am Druckpunkt.

**Abhängigkeiten:** `three`, `postprocessing`, `jspdf`, `vite`, `typescript`, `vite-plugin-pwa`.
Keine schwere Physik-Engine – Bewegungen sind keyframe-/tween-basiert.

## 5. Roadmap (versioniert)

| Version | Inhalt | Status |
|---|---|---|
| **v0.1.0** | Projekt-Setup: Vite+TS, Three.js-Szene, Kamera/Licht, Platzhalter-Maschine, GitHub-Actions-Deploy auf Pages läuft | ✅ in v0.8.0 (Deploy-Workflow vorbereitet, noch nicht verbunden) |
| **v0.2.0** | Prozedurales Modell: Gehäuse, Tastatur (alle Tasten), Typenkorb, Wagen, Walze, Materialien | ✅ in v0.8.0 |
| **v0.3.0** | Input + Animation: Tasten/Typenhebel/Wagen bewegen sich, Shift, Layout-Map QWERTZ/QWERTY | ✅ in v0.8.0 |
| **v0.4.0** | Papier & Tinte: Text auf Papier mit Varianz, Zeilenvorschub, Wagenrücklauf, Glocke (visuell) | ✅ in v0.8.0 |
| **v0.5.0** | Audio: CC0-Samples, Web-Audio-Engine, Variation, Glocke/Rücklauf/Leertaste | ✅ in v0.8.0 |
| **v0.6.0** | Shader-Optik: Post-Processing, Papier-Shader, Qualitätsstufen, Performance-Tuning | ✅ in v0.8.0 |
| **v0.7.0** | Speichern & Export (localStorage, PNG, PDF), neues Blatt | ✅ in v0.8.0 |
| **v0.8.0** | UI: Einstellungen, i18n DE/EN, Versionsanzeige | ✅ in v0.8.0 |
| **v0.9.0** | PWA, Feinschliff · ergänzt: Zimmer mit Fenster + Aussichten, Hintergrundmusik, satterer Klang, Holztisch | ✅ (Browser-Tests auf echten Geräten offen) |
| **v0.10.0** | Geschlossenes Zimmer, Deko, Fenster tiefer, weiße Wände | ✅ |
| **v0.11.0** | Mechanik-Fix Typenhebel, 3 Stadt-Aussichten, README | ✅ |
| **v0.12.0** | Smartphone-Bedienung, Tag/Nacht mit Kerze, Gehäuse, Leertaste, Farbbänder, Modelle, Geräuschkulisse, Tasse, Deko | ✅ (Test auf echten Smartphones offen) |
| **v0.13.0** | Schlafende Katze, Regenwetter (je mit Schalter), Fix für dunkles Zimmer nach Kontextverlust | ✅ |
| **v0.14.0** | Katze und Kaminsound entfernt, Regenklang neu, Kerzenschale ohne Ring, Tasse und Pflanze versetzt | ✅ |
| **v0.15.0** | Fenster ohne Fensterbrett, Manuskript auf dem Papierstapel | ✅ |
| **v0.16.0** | Grafik-Schalter: Staub, Lichtstrahlen, Kontaktschatten | ✅ (Bildrate auf echter GPU offen) |
| **v0.17.0** | Mehrseitige Manuskripte, Brief als Link, Fokus-Modus, Kerze mit Rauch | ✅ |
| **v0.18.0** | „Neues Dokument“, leiserer Regen mit Dachprasseln, realistischerer Tippklang | ✅ |
| **v0.19.0** | Aussichten Chinesisches Dorf und Japanischer Ahornwald, eigene Songs statt generativer Musik | ✅ |
| **v0.19.1** | Song umbenannt: „SchreibMaschine - America“ | ✅ |
| **v0.20.0** | Panoramafenster, 8K-Aussichten, belebte Aussicht | ✅ (Bildrate und 8K-Texturen auf echten Geräten offen) |
| **v0.21.0** | Eigener Lautstärkeregler für den Regen | ✅ |
| **v1.0.0** | Release | offen |

Regeln: Jede Version → Eintrag in `CHANGELOG.md`, Bump in `package.json`, Git-Tag, Aktualisierung des
Status hier in `plan.md` (Abschnitt 7). Bugfixes = PATCH, neue Features = MINOR.

## 6. Verifikation

- `npm run dev` → lokal im Browser testen: Tippen, Animation, Sound, Glocke, Rücklauf.
- `npm run build && npm run preview` → Produktionsbuild mit korrektem `base`-Pfad prüfen.
- Lighthouse: PWA-Installierbarkeit & Performance (Ziel: 60 fps auf Mittelklasse-Laptop bei „hoch“).
- Browser: Chrome, Firefox, Safari (Web-Audio-Unlock, WebGL2).
- Nach Push: GitHub-Actions-Deploy grün, Seite unter `https://s84n.github.io/Schreibmaschine/` erreichbar.

## 7. Status / Changelog der Planung

- **v0.0.1** (2026-10-29) – Initialplanung, Grundsatzentscheidungen getroffen (Abschnitt 2).
- **v0.1.0** (2026-10-29) – Offene Punkte entschieden: Sounds von Wikimedia Commons (CC BY/CC0), Schrift Special Elite, vorerst lokal ohne GitHub. Papier-/Tinten-Optik über Canvas-Textur statt GLSL. App-Stand **v0.8.0** umgesetzt (Roadmap v0.1–v0.8 + PWA-Grundgerüst). Zusätzlich umgesetzt: Rücktaste mit Überschreiben, Tabulator, Feststelltaste, Text-Export, Gehäusefarben.
- **v0.15.0** (2026-11-01) – Nutzerwunsch → App v0.21.0: drei getrennte Regler für Maschine, Musik und Regen, Regen auf eigenem Audio-Bus.
- **v0.14.0** (2026-11-01) – Nutzerwunsch → App v0.20.0: Fenster stark vergrößert, Bewegung per Shader und Partikeln statt Video (kein Download, läuft endlos). Mögliche Ausbaustufe: echte Video-Loops für einzelne Aussichten.
- **v0.13.0** (2026-10-31) – Nutzerwunsch → App v0.19.0: zwei Aussichten, generative Musik durch eigene Songs ersetzt. Neue Songs: Datei in `public/music` legen und in `TRACKS` (`src/audio/Music.ts`) eintragen.
- **v0.12.0** (2026-10-31) – Nutzer-Feedback → App v0.18.0: „Nächstes Blatt“ behält alte Blätter bewusst im Manuskript, deshalb landeten sie im PDF; „Neues Dokument“ im Zahnrad-Menü setzt alles zurück. Regen ohne taktartige Tropfen, dafür Dach im Hintergrund. Tippklang mehrschichtig (Taste, Walze/Gehäuse, Schaltklinke, Hebelrückfall).
- **v0.11.0** (2026-10-30) – Manuskripte, Brief-Link, Fokus-Modus, Kerze → App v0.17.0. Brief-Link bewusst ohne Server: Text steckt komprimiert im #-Teil der Adresse.
- **v0.10.0** (2026-10-30) – Grafikpaket mit Schaltern → App v0.16.0; Konzeptideen in Abschnitt 8.
- **v0.9.0** (2026-10-30) – Nutzer-Feedback: Fensterbrett entfernt, Papierstapel mit getipptem Manuskript → App v0.15.0.
- **v0.8.0** (2026-10-30) – Nutzer-Feedback: Katze als Modell unbrauchbar und aus dem Konzept gestrichen, Kaminsound samt Menüpunkt „Geräuschkulisse“ entfernt, Regenklang neu → App v0.14.0.
- **v0.7.0** (2026-10-30) – Katze und Regenwetter auf Nutzerwunsch → App v0.13.0. Ursache des dunklen Zimmers gefunden: leere Umgebungskarte nach WebGL-Kontextverlust.
- **v0.6.0** (2026-10-30) – Nutzer-Feedback umgesetzt → App v0.12.0 (siehe Roadmap); Entscheidungen zu Querformat, Modellen und Kaffee-Link in Abschnitt 2.
- **v0.5.0** (2026-10-30) – Mechanik nach echtem Vorbild korrigiert (Typenhebel liegen im offenen Korb hinter den Tasten, Maschine 4 cm tiefer), 3 Stadt-Aussichten (Istanbul, New York, Dubai; Wikimedia Commons, CC BY/BY-SA), README für GitHub neu → App v0.11.0.
- **v0.4.0** (2026-10-30) – Feedback: Fenster tiefer, Wände weiß, Zimmer rundum geschlossen (kein Panorama mehr neben der Wand), Deko ergänzt → App v0.10.0.
- **v0.3.0** (2026-10-29) – Nutzer-Feedback umgesetzt → App v0.9.0: Tastenklang satter (EQ/Kompressor/Hall/Körperschall), stummer Wagenrücklauf behoben, Holztisch mit PBR-Textur, Zimmer mit Fenster und 5 wählbaren Aussichten, generative Lo-Fi-Jazz-Musik.
- **v0.2.0** (2026-10-29) – GitHub-Repo `s84n/Schreibmaschine` verbunden (Deploy-Key, noreply-Autor). `base`-Pfad auf `/Schreibmaschine/` (Groß-S) korrigiert → App v0.8.1.

## 8. Offene Punkte

- **Kaffee-Link eintragen** (`src/config.ts`), vorher Anbieter wählen und Steuer-/Impressumsfrage klären.
- **Echte Smartphones testen:** Bildschirmtastatur (Android/Gboard, iOS), Vollbild + Lock, Bildrate nachts.
- Konzeptideen (ungeprüft priorisiert): Schreibziele/Wortzähler, Kurz-Schreibimpulse, Tippen auf den 3D-Tasten, Schnee zum Regen, Papiersorten, Tintenauftrag nach Anschlagstärke, Farbband-Abnutzung.
- Cozy-Ideen: Tag/Nacht nach Uhrzeit, Tippen auf den 3D-Tasten, verblassendes Farbband.
- Test auf echten Geräten (Chrome, Firefox, Safari), Ton-Latenz, Performance auf schwächerer Hardware.
- Ideen: Umgebungsgeräusche passend zur Aussicht (Wellen, Vögel, Grillen), weitere Aussichten, Musik-Varianten (Tonarten/Tempi), sichtbare Schreibtischlampe.
- Bundle-Größe (~720 kB JS, davon Three.js) – optional Code-Splitting.

---

## Nächster Schritt

1. v0.21.0 auf echten Smartphones testen, Feedback sammeln.
2. Nach jedem Release: Versionsnummer erhöhen, taggen, pushen → automatisches Deployment.
