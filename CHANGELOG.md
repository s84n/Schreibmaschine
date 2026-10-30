# Changelog

Alle Versionen folgen [SemVer](https://semver.org/lang/de/) (`MAJOR.MINOR.PATCH`).

## [0.13.0] – 2026-10-30

### Hinzugefügt
- Schlafende Katze auf dem Schreibtisch: atmet langsam und zuckt ab und zu mit dem Ohr. Im Menü abschaltbar (standardmäßig an).
- Regenwetter als eigener Schalter (standardmäßig aus): Tropfen und Spuren laufen die Scheibe hinab, der Himmel wird grau, es fällt weniger Licht herein, dazu ein leises generiertes Regengeräusch.

### Geändert
- Regen ist keine Option der Geräuschkulisse mehr; eine alte Einstellung „Regen“ wird automatisch auf den neuen Schalter übernommen. Kaminfeuer und Regen können jetzt gleichzeitig laufen.

### Behoben
- Zimmer manchmal viel zu dunkel: Nach einem verlorenen WebGL-Kontext (z. B. App-Wechsel am Smartphone, GPU-Neustart) blieb die Umgebungsbeleuchtung leer. Sie wird jetzt nach jeder Wiederherstellung neu erzeugt.

## [0.12.0] – 2026-10-30

### Hinzugefügt
- Smartphone: Querformat-Pflicht (Hinweis im Hochformat; wo der Browser es erlaubt, Button „Querformat erzwingen“ über Vollbild + Orientation-Lock), Tastatur-Button ⌨ für die Bildschirmtastatur inkl. Eingabe über ein verstecktes Feld (auch mit Android-Composition). Bei offener Tastatur fährt die Kamera aufs Papier und der Bildausschnitt passt sich dem freien Bereich an.
- Tag/Nacht-Schalter: nachts brennende Kerze links neben der Maschine mit Flackerlicht und wandernden Schatten, Lichterkette über dem Fenster, abgedunkelte Aussicht.
- Kaffeetasse mit Aufdruck „made with coffee“ und Dampf. Klick auf die Tasse öffnet den Kaffee-Dialog, sobald in `src/config.ts` ein Link eingetragen ist.
- Farbband-Wechsel (Schwarz, Rot, Königsblau, Tannengrün, Violett, Sepia); gilt ab dem nächsten Anschlag, Geschriebenes behält seine Farbe.
- Drei Modelle mit eigenem Gehäuse und gleicher Mechanik: Reise (1950er), Kontor (1930er, Messing), Flach (1960er).
- Geräuschkulisse: generierter Regen und Kaminfeuer.
- Deko: Vorhänge, Bücherstapel, Bleistiftbecher, Papierstapel. Vollbild-Button im Menü.

### Geändert
- Gehäuse überarbeitet: geschwungene Seitenwangen, Zierleisten, Schrauben, Krispellack auf der Tastaturplatte, Modellplakette, Deckplatte, Spulenschalen, Farbband-Wahlhebel, Randsteller.
- Auf kleinen Displays liegen alle Werkzeuge im Zahnrad-Menü; sichtbar bleiben nur Tag/Nacht, Tastatur und Zahnrad. Das Menü ist scrollbar.
- Grafikstufe „Niedrig“ rendert mit bis zu 1,5-facher Pixeldichte statt 1, damit es auf Smartphones schärfer ist.

### Behoben
- Die Arme der Leertaste liefen durch die Stößel der untersten Tastenreihe; sie führen jetzt senkrecht in eigene Schlitze der Tastaturplatte.

## [0.11.0] – 2026-10-30

### Behoben
- Typenhebel schlugen beim Anschlag durch Tastaturplatte und hintere Tastenreihe: In Ruhe lagen die Hebelspitzen unter der Platte. Die Mechanik ist jetzt wie bei einer echten Reiseschreibmaschine aufgebaut – kleiner Segmentbogen tief vor der Walze, längere Hebel, die fast waagerecht im offenen Typenkorb hinter den Tasten liegen und ~120° zum Druckpunkt schwingen. Dafür ist die Maschine vorne 4 cm tiefer geworden; Hinterdeck und Farbbandspulen sind nach hinten gerückt, damit auch die äußeren Hebel freie Bahn haben.

### Hinzugefügt
- Drei neue Aussichten: Istanbul (Goldenes Horn), New York (Büro hoch über Manhattan), Dubai (Skyline in der Dämmerung) – Fotos von Wikimedia Commons, als Panoramaband aufbereitet.
- Neue README für die GitHub-Seite mit Screenshots, Beschreibung, Technik-Überblick und vollständigen Quellenangaben.

### Geändert
- Quellenangabe in den Einstellungen um Wikimedia Commons ergänzt.

## [0.10.0] – 2026-10-30

### Hinzugefügt
- Geschlossenes Zimmer: Seitenwände, Vorderwand, Decke, Dielenboden (Poly Haven, CC0) und weiße Fußleisten – beim Schwenken der Kamera ist das Panorama nur noch durchs Fenster zu sehen.
- Schreibtisch mit Zarge und Beinen.
- Deko: Wandregal mit Efeutute (herabhängende Ranken) und Büchern neben dem Fenster, gerahmtes Landschaftsbild an der linken Wand, Bücherregal mit zweiter Pflanze an der rechten Wand, Kaffeetasse auf dem Tisch.

### Geändert
- Fenster sitzt jetzt knapp über der Tischplatte; Horizonte aller Aussichten neu ausgerichtet.
- Wände in gebrochenem Weiß statt Beige – mehr Kontrast zum dunklen Tisch.
- Maximaler Kameraabstand verringert (bleibt im Zimmer).

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
