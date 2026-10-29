# Schreibmaschine – Projektplan (`plan.md`)

> Zentrale Quelle für alle Planungsdetails. Jede Planänderung wird hier festgehalten (mit Versionsnummer).

**Aktuelle Planversion:** v0.1.0 (2026-10-29) · **Aktuelle App-Version:** v0.8.0

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
| Shader/Optik | `postprocessing`-Library (pmndrs): Depth of Field (Fokus Druckpunkt), Bloom (dezent), Vignette, Film Grain, ACES-Tonemapping. Papier & Tinte über prozedurale Canvas-Textur (statt eigener GLSL-Shader – einfacher, exportierbar). SSAO offen |
| Sound | Echte Aufnahmen von **Wikimedia Commons** (Anschläge: CC BY 3.0, Rücklauf: CC BY 4.0, Glocke: CC0 – Namensnennung in `public/sounds/LICENSES.md`), als WAV zugeschnitten, Wiedergabe via **Web Audio API** mit Pitch-/Volume-Variation |
| Layout | **QWERTZ/QWERTY umschaltbar**, UI **Deutsch + Englisch** |
| Schrift | **Special Elite** (Apache 2.0) über `@fontsource/special-elite`, lokal gebündelt (offline-fähig) |
| GitHub | Vorerst **nur lokal**, kein Remote. Deploy-Workflow liegt bereit (`.github/workflows/deploy.yml`) |
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

Später (nicht v1.0): Touch-Bildschirmtastatur, mehrere Maschinenmodelle/Skins, Farbband rot/schwarz,
Backspace mit Überschreiben (echtes „Übertippen“), glTF-Hi-Res-Modell.

## 4. Architektur

```
schreibmaschine/
├── plan.md                  # dieser Plan
├── CHANGELOG.md
├── README.md
├── index.html
├── vite.config.ts           # base: '/schreibmaschine/', vite-plugin-pwa
├── package.json
├── public/
│   ├── sounds/              # WAV-Samples (+ LICENSES.md mit Quellen/Namensnennung)
│   └── icons/               # PWA-Icons
├── src/
│   ├── main.ts              # Bootstrap
│   ├── scene/
│   │   ├── Scene.ts         # Renderer, Kamera, Licht, OrbitControls (begrenzt)
│   │   ├── PostFX.ts        # postprocessing-Pipeline
│   │   └── Environment.ts   # Holztisch, RoomEnvironment-Reflexionen, Lampe
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
│   │   └── layouts.ts       # QWERTZ / QWERTY
│   ├── audio/
│   │   └── AudioEngine.ts   # Web Audio, Sample-Pool, Randomisierung, Unlock bei erster Eingabe
│   ├── animation/
│   │   └── Tweens.ts        # schlanke Tween-/Easing-Utilities, Queue für schnelles Tippen
│   ├── state/
│   │   └── Document.ts      # Zeilen, Cursor, localStorage-Persistenz
│   ├── export/
│   │   └── Export.ts        # PNG / PDF (jsPDF, nachgeladen) / TXT
│   ├── ui/
│   │   ├── Overlay.ts       # Werkzeugleiste, Einstellungs-Panel, Startschirm, Toasts
│   │   ├── Settings.ts      # Einstellungen laden/speichern
│   │   └── i18n.ts          # DE/EN Strings
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
| **v0.9.0** | PWA (Manifest, Service Worker, Offline), Feinschliff, Browser-Tests | 🟡 PWA erledigt, Tests/Feinschliff offen |
| **v1.0.0** | Release | offen |

Regeln: Jede Version → Eintrag in `CHANGELOG.md`, Bump in `package.json`, Git-Tag, Aktualisierung des
Status hier in `plan.md` (Abschnitt 7). Bugfixes = PATCH, neue Features = MINOR.

## 6. Verifikation

- `npm run dev` → lokal im Browser testen: Tippen, Animation, Sound, Glocke, Rücklauf.
- `npm run build && npm run preview` → Produktionsbuild mit korrektem `base`-Pfad prüfen.
- Lighthouse: PWA-Installierbarkeit & Performance (Ziel: 60 fps auf Mittelklasse-Laptop bei „hoch“).
- Browser: Chrome, Firefox, Safari (Web-Audio-Unlock, WebGL2).
- Nach Push: GitHub-Actions-Deploy grün, Seite unter `https://<user>.github.io/schreibmaschine/` erreichbar.

## 7. Status / Changelog der Planung

- **v0.0.1** (2026-10-29) – Initialplanung, Grundsatzentscheidungen getroffen (Abschnitt 2).
- **v0.1.0** (2026-10-29) – Offene Punkte entschieden: Sounds von Wikimedia Commons (CC BY/CC0), Schrift Special Elite, vorerst lokal ohne GitHub. Papier-/Tinten-Optik über Canvas-Textur statt GLSL. App-Stand **v0.8.0** umgesetzt (Roadmap v0.1–v0.8 + PWA-Grundgerüst). Zusätzlich umgesetzt: Rücktaste mit Überschreiben, Tabulator, Feststelltaste, Text-Export, Gehäusefarben.

## 8. Offene Punkte

- GitHub-Repo anlegen (Name `schreibmaschine` passt zum `base`-Pfad; sonst `vite.config.ts` anpassen), Remote verbinden, Pages auf „GitHub Actions“ stellen.
- v0.9.0: Test auf echten Geräten (Chrome, Firefox, Safari), Ton-Latenz/Lautstärken abstimmen, Performance auf schwächerer Hardware, ggf. SSAO.
- Bundle-Größe (~720 kB JS, davon Three.js) – optional Code-Splitting.

---

## Nächster Schritt

1. Lokal testen (`npm run dev`), Feedback zu Optik/Sound/Mechanik sammeln → v0.9.0.
2. GitHub-Repo verbinden, sobald angelegt.
