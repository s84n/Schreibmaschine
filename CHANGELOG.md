# Changelog

Alle Versionen folgen [SemVer](https://semver.org/lang/de/) (`MAJOR.MINOR.PATCH`).

## [0.9.0] – 2026-10-29

### Hinzugefügt
- Zimmer statt dunklem Hintergrund: alte Putzwand, weißes Sprossenfenster mit Fensterbank, durch die Tiefenschärfe weich gezeichnet.
- Austauschbare Aussicht (Auswahl in der Werkzeugleiste): Alpen, Bergsee im Winter, Nordischer See, Mittelmeer, Sternennacht am See. Panoramen liegen auf einer Kugel hinter dem Fenster (Parallaxe beim Drehen der Kamera); Fensterlicht und Raumhelligkeit passen sich an.
- Hintergrundmusik (Schalter „♪ Musik“): generativer Lo-Fi-Jazz in Web Audio – E-Piano (FM), Bass, Besen-Schlagzeug mit Swing, sparsame Melodie, Vinyl-Knistern, Tonband-Schwankung. Eigene Musiklautstärke in den Einstellungen.
- Satterer Maschinenklang: EQ (Tiefen-Shelf, weniger Mitten-Mulm, Präsenz), Kompressor, dezenter Raumhall (synthetische Impulsantwort), tiefer Körperschall pro Anschlag, Limiter am Ausgang.
- Zeilenschaltung mit Ratschen-Klick vor dem Wagenrücklauf.

### Geändert
- Schreibtisch mit echter PBR-Holztextur (Farbe, Normal, Rauheit) statt gemalter Maserung.
- Kamera der Gesamtansicht etwas tiefer und weiter (Blick aufs Fenster).
- Lautstärke-Einstellung heißt jetzt „Lautstärke Maschine“.

### Behoben
- Animationen laufen jetzt immer in Echtzeit (keine Zeitbegrenzung pro Bild mehr): bei niedriger Bildrate hinkte die Mechanik sonst hinter dem Ton her.
- Wagenrücklauf war stumm: `return.wav` enthielt durch einen Fehler beim Zuschneiden (Lautheitsfilter) nur Stille. Neu geschnitten und auf Spitzenpegel normalisiert.

## [0.8.1] – 2026-10-29

### Geändert
- `base`-Pfad auf `/Schreibmaschine/` korrigiert (Repo-Name mit großem S, GitHub Pages unterscheidet Groß-/Kleinschreibung).
- Icon-Links in `index.html` relativ statt mit festem Pfad.
- README mit Live-Link.

## [0.8.0] – 2026-10-29

Erster lauffähiger Stand. Umfasst die Roadmap-Punkte v0.1.0 bis v0.8.0 sowie ein PWA-Grundgerüst.

### Hinzugefügt
- Projekt-Setup: Vite + TypeScript + Three.js, `base: /schreibmaschine/` für GitHub Pages, Deploy-Workflow (noch nicht verbunden).
- Prozedurales 3D-Modell einer Reiseschreibmaschine: Gehäuse, runde Glasrand-Tasten mit Beschriftung, Leertaste, Sondertasten, Typenkorb mit Segment und Typenhebeln, Farbband mit Spulen und Gabel, Wagen mit Walze, Drehknöpfen, Papierhalter, Papierauflage und Zeilenschalthebel.
- Mechanik: Taste sinkt, Typenhebel schwingt zum Druckpunkt, Farbband hebt sich, Wagen rückt per Hemmung vor; Umschaltung senkt den Typenkorb; Feststelltaste; Rücktaste; Tabulator (5er-Schritte); Zeitleiste verhindert, dass zwei Typen gleichzeitig anschlagen.
- Papier: A4-Blatt wird um die Walze geführt, Text mit Farbband-Unregelmäßigkeiten (Druckstärke, Versatz, Gewebestruktur), Überschreiben möglich.
- Wagenrücklauf mit Hebelanimation und Zeilenschaltung, Glocke 8 Anschläge vor dem Rand, Tastensperre am Zeilenende, Hinweis am Seitenende.
- Audio: echte Aufnahmen (12 Anschlag-Varianten, Rücklauf, Glocke) über Web Audio mit Tonhöhen-/Lautstärkevariation.
- Shader-Optik (postprocessing): Tiefenschärfe auf den Druckpunkt, Bloom, Vignette, Filmkorn, ACES-Tonemapping; Qualitätsstufe „Niedrig“ ohne Effekte/Schatten.
- Speichern im `localStorage`, Export als PNG, PDF (A4) und Text, „Neues Blatt“ mit Aus-/Einspann-Animation.
- Oberfläche: Werkzeugleiste, Einstellungen (Layout QWERTZ/QWERTY, Sprache DE/EN, Lautstärke, Stumm, Grafik, Gehäusefarbe), Kamera-Ansichten „Maschine“/„Papier“, Versionsanzeige.
- PWA: Manifest, Icons, Service Worker (offline-fähig).
