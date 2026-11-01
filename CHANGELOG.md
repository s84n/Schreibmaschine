# Changelog

Alle Versionen folgen [SemVer](https://semver.org/lang/de/) (`MAJOR.MINOR.PATCH`).

## [1.8.0] – 2026-11-01

### Geändert
- **Weiße Vorhänge:** Statt des braunen Stoffs hängen jetzt helle Leinenvorhänge in tiefen Falten an einer Eisenstange mit Messingringen. Tagsüber scheint etwas Licht durch den Stoff.
- **Altes Fensterglas:** Die Scheibe hat einen leichten Grauschleier und Grünstich, Dreck an Rändern und Sprossen, Laufspuren, Kalkringe und Wischspuren. Nachts wird der Schmutz mit der Aussicht dunkel.
- **Fensterarten je Aussicht:** Neben dem Panoramafenster gibt es Sprossenfenster, Rundbögen, Spitzbögen und ein Rundfenster. Sie wechseln mit der Aussicht und damit auch mit der Stimmung.
- Die Fensterwand ist heller, weil sie jetzt zwischen den Fenstern zu sehen ist.

## [1.7.0] – 2026-11-01

### Geändert
- **Die Maschine sieht benutzt aus:** Der Lack ist stumpfer und metallischer, trägt feine Kratzer und Anlaufflecken und ist an wenigen Stellen bis aufs Blech abgerieben. Chrom läuft milchig an, Stahl zeigt Rostpunkte, Messing wird fleckig. Das gilt für alle Modelle und Gehäusefarben.

## [1.6.0] – 2026-11-01

### Geändert
- **Smartphone: Die Maschine tippt für dich.** Statt Bildschirmtastatur und Menü gibt es ein großes Feld für einen eingefügten Text. Die Maschine schreibt ihn über beliebig viele Blätter ab, mit freier Kamera, wählbarem Tempo und Überspringen. Danach lässt er sich nachlesen, als PDF speichern und teilen. Kerze, Lampe, Fenster und Radio bleiben in der Szene antippbar.
- Smartphones müssen nicht mehr ins Querformat gedreht werden; Hochformat wird mit weiter entfernter Kamera unterstützt.
- Tablets bleiben unverändert: selbst tippen, volle Oberfläche.

### Hinweis
- Am Smartphone sind eigene gespeicherte Blätter und die Schublade nicht mehr erreichbar. Sie bleiben im Browser gespeichert und werden nicht verändert.

## [1.5.0] – 2026-11-01

### Geändert
- **Weicher Übergang in der Schleife:** Am Songende blendet der Song fünf Sekunden lang in seinen eigenen Anfang über, statt hart neu zu beginnen. Wo der Browser das verweigert, läuft die Schleife wie bisher.

## [1.4.0] – 2026-11-01

### Hinzugefügt
- **Elf neue Songs:** Bossa Nova, Musette, Raga, Kora, Flamenco, Tango, Andes, Ethio Jazz, Koto, Nocturne und Nordic Folk.
- **Zehn neue Stimmungen**, die Song, Aussicht und Licht verbinden, etwa Morgen in Rio, Café in Paris oder Regen in La Boca.

### Geändert
- Die Stimmungen klappen jetzt aus einem Knopf links oben auf, der die aktive Stimmung zeigt: 16 Einträge hätten die Szene sonst dauerhaft verdeckt.
- „Herbst in Kyoto“ spielt jetzt Koto statt Asia.

## [1.3.0] – 2026-11-01

### Hinzugefügt
- **Acht neue Aussichten** für die künftigen Songs aus aller Welt: Rio de Janeiro, Paris, Udaipur, Elmina (Ghana), Granada, Buenos Aires, Machu Picchu und die Serengeti, jeweils mit Bewegung im Himmel, und wo es passt mit Vögeln, Wellen oder Wind im Gras.

## [1.2.0] – 2026-11-01

### Geändert
- **Gedämpftes Tageslicht:** Tisch und Wände sind am Tag deutlich dunkler, am hellsten bleibt die Aussicht. Die Lichtstrahlen vom Fenster sind schwächer.
- **Schreibtischlampe mit sichtbarer Wirkung:** Sie wirft auch am Tag einen warmen Lichtkegel auf den Tisch vor der Maschine, und dieser Kegel ist kräftiger und klarer begrenzt.

## [1.1.0] – 2026-11-01

### Geändert
- **Neues Holz für Tisch, Regal und Bilderrahmen:** poliertes Mahagoni (Poly Haven „Dark Wood“, CC0) in 4K statt der abgenutzten Tischplatte. Die Maserung läuft auf jedem Teil entlang der längeren Kante und ist im echten Maßstab, die Tischplatte zeigt keine Wiederholung mehr. Bei Grafik „niedrig“ wird die 2K-Fassung geladen, die 4K-Datei nicht vorab für den Offline-Betrieb gespeichert.

## [1.0.0] – 2026-11-01

Erste Hauptversion: inhaltlich derselbe Stand wie 0.23.0.

## [0.23.0] – 2026-11-01

### Geändert
- **Schreibtischlampe:** Der moderne Schwingarm ist einer klassischen Bankerlampe gewichen, mit Messingfuß, geschwungenem Stab, grünem, innen weißem Glasschirm und Zugkette. Nachts glüht der Schirm.
- **Kerze** steht jetzt rechts neben der Tasse zum Tischrand hin. Links bleiben Lampe und Stiftebecher.
- **Songs** heißen in Liste und Einblendung nur noch nach ihrem Titel (Asia, Middle East, America).
- **Werkzeugleiste mit Symbolen:** Jeder Knopf, jede Auswahl und jede Stimmung hat ein eigenes Icon. PDF, PNG und Text sitzen als Gruppe hinter einem Speichern-Symbol. Unter 1320 px Breite zeigt die Leiste für die Blatt-Werkzeuge nur noch Symbole, die Namen stehen im Tooltip.

### Performance
- **Rund 90 % weniger Draw-Calls** (Stillstand am Tag: 134 statt 1541 je Bild): Alles Unbewegliche wird je Material zusammengefügt, Tasten und Typenhebel werden instanziert, die Tastenbeschriftungen teilen sich eine Textur.
- Schattenkarten werden nur noch erneuert, wenn sich etwas bewegt; nachts höchstens 8-mal pro Sekunde für das Kerzenflackern.
- Kontaktschatten laufen in halber Auflösung und werden bei stehender Kamera wiederverwendet.
- Ein Anschlag lädt nur noch seinen Ausschnitt des Blatts hoch statt der ganzen 4-Megapixel-Textur.
- Ausgeschaltete oder kaum sichtbare Lichter sind wirklich aus und kosten keine Pixel mehr. Die nötigen Shader werden im Voraus übersetzt, damit der erste Wechsel zur Nacht nicht ruckelt.
- Himmel, Wellen und Laub lesen vorberechnetes Rauschen, statt es je Pixel zu berechnen. Große Flächen werden zuletzt gezeichnet.
- Keine doppelte Kantenglättung mehr, ab 1440p 2x statt 4x. Höchstens 5,8 Megapixel Renderauflösung; 4K wird hochskaliert.
- Unschärfe hinter den Bedienfeldern entfernt: Sie wurde über der bewegten Szene in jedem Bild neu berechnet.
- Die Auflösung passt sich früher an (unter etwa 48 statt 28 Bildern pro Sekunde) und steigt wieder, wenn Luft ist. Die Grafikstufe sinkt erst, wenn auch die kleinste Auflösung nicht reicht.

### Behoben
- Jede Mausbewegung hob die Bildratenbremse auf: Auf Monitoren mit 144 Hz und mehr rechnete die Szene dann mit voller Bildwiederholrate statt mit 60 Bildern pro Sekunde.

## [0.22.0] – 2026-11-01

### Hinzugefügt
- **Stimmungen:** Ein Klick auf Regennacht, Sonntagmorgen, Herbst in Kyoto, Winterabend, Sternennacht oder Am Bosporus stellt Aussicht, Tageszeit, Regen, Lampe, Musik und Anschlag zusammen.
- **Dinge im Zimmer bedienen:** Kerze (Tag/Nacht), Schreibtischlampe, Fenster (nächste Aussicht), Radio (nächster Song/aus) und Papierstapel (Nachlesen). Ein bernsteinfarbener Punkt zeigt jedes Ding, bis es einmal benutzt wurde; unter der Maus leuchtet es auf und nennt seine Funktion. Die Punkte lassen sich im Menü aus- und wieder einschalten.
- **Schreibtischlampe und Radio** als neue Gegenstände. Die Lampe gibt nachts warmes Leselicht aufs Papier, die Radioskala leuchtet, solange Musik läuft.
- **Leseansicht:** Alle Blätter flach und in Ruhe nachlesen, mit Pfeiltasten umblättern.
- **Schublade:** Abgelegte Manuskripte lesen, wieder einspannen oder löschen.
- **Sanfter Umbruch** (Schalter, standardmäßig an): Am Zeilenende rutscht das Wort samt Wagenrücklauf in die nächste Zeile, auf der letzten Zeile aufs nächste Blatt.
- **Korrekturband:** Umschalt + Rücktaste entfernt das Zeichen immer, per Schalter auch die normale Rücktaste. Das Überschreiben bleibt der Standard.
- **Sanfter Anschlag** (gedämpft wie auf Filz) sowie eigene Regler für Glocke und Wagenrücklauf.
- **Akku-Modus:** halbe Bildrate, geringere Auflösung, keine Kontaktschatten.
- **Ruhige Bewegung:** Flamme, Staub, Regen und Dampf werden langsam, die Aussicht steht still, die Kamera wechselt ohne Fahrt. Standardmäßig an, wenn das System weniger Bewegung wünscht.
- **Schriftgröße** für Papieransicht und Leseansicht sowie **warmes Creme-Papier** (auch im Export).

### Geändert
- Die Oberfläche blendet sich nach drei Anschlägen aus, samt Mauszeiger, und kommt bei Mausbewegung, Berührung oder Esc zurück.
- „Neues Dokument“ legt das Manuskript in die Schublade, statt es zu löschen; die Sicherheitsabfrage entfällt.
- Volles Blatt: Enter auf der letzten Zeile spannt selbst das nächste Blatt ein, statt die Zeile zu überschreiben.
- Die Bildrate folgt dem Geschehen (60 aktiv, 30 und 20 im Stillstand, 15 im Hintergrund, 5 unter der Leseansicht), Schattenkarten werden im Stillstand seltener erneuert. Bleibt das Bild dauerhaft zu langsam, sinkt erst die Auflösung, dann die Grafikstufe.
- Einstellungen in Gruppen geordnet, Esc schließt offene Fenster.

### Behoben
- Während des Blattwechsels getippte Zeichen gingen verloren; sie landen jetzt auf dem neuen Blatt. Auch der Rückstau beim schnellen Tippen ist größer.
- Nach dem Verstellen eines Lautstärkereglers lief das Tippen ins Leere.

### Entfernt
- Fokus-Modus (F2): Das automatische Ausblenden ersetzt ihn.

## [0.21.0] – 2026-11-01

### Hinzugefügt
- Eigener Lautstärkeregler für den Regen. Geräusche der Maschine, Musik und Regen lassen sich jetzt einzeln einstellen; der Regen startet so laut wie zuletzt.

## [0.20.0] – 2026-11-01

### Hinzugefügt
- Belebte Aussicht (Schalter im Zahnrad-Menü, standardmäßig an): ziehende Wolken, Wellen und Glitzern auf dem Wasser, Wind im Laub, funkelnde Sterne, dazu je nach Aussicht Vögel, Schnee, fallende Ahornblätter oder Glühwürmchen.

### Geändert
- Panoramafenster: deutlich breiter und höher (140 × 63 cm statt 60 × 51 cm), mittig, drei große Scheiben mit Oberlicht.
- Aussichten schärfer: Poly-Haven-Bilder, Dorf und Ahornwald jetzt mit 8192 px Breite, Tiefenunschärfe halbiert. Ahornwald ohne sichtbare Spiegelung.
- Aussichten werden nicht mehr vorab fürs Offline-Nutzen geladen, sondern beim ersten Ansehen gespeichert.

### Entfernt
- Regal an der Fensterwand samt Pflanze und Büchern: Dort ist jetzt Fenster.

## [0.19.1] – 2026-10-31

### Geändert
- Song „SchreibMaschine - Song 1“ heißt jetzt „SchreibMaschine - America“ (im Menü und als Datei). Eine gespeicherte Auswahl wird übernommen.

## [0.19.0] – 2026-10-31

### Hinzugefügt
- Zwei neue Aussichten: Chinesisches Dorf (Shuzheng, Jiuzhaigou) und Japanischer Ahornwald (Tofuku-ji, Kyoto) mit roten Blättern.
- Eigene Songs im Musik-Menü, benannt wie die Dateien; der gewählte Song läuft in Dauerschleife. Wer bisher Musik an hatte, bekommt den ersten Song.

### Entfernt
- Das generative Lo-Fi-Jazz-Stück.

### Geändert
- Die Werkzeugleiste bricht bei wenig Breite um, statt aus dem Bild zu laufen.

## [0.18.0] – 2026-10-31

### Hinzugefügt
- „Neues Dokument“ im Zahnrad-Menü (immer sichtbar, ersetzt „Manuskript verwerfen“): löscht alle Blätter, das eingespannte eingeschlossen, sofort auch aus dem Browser-Speicher. Enthält das Dokument Text, wird vorher nachgefragt.
- Hinweis nach PDF- und Text-Export, wenn mehrere Blätter enthalten sind.

### Geändert
- Regen: Die regelmäßigen Tropfstellen und das Glucksen der Regenrinne sind weg. Stattdessen ein dichter, leiser und dumpfer Teppich aus Tropfen auf dem Dach im Hintergrund, Prasseln am Fenster deutlich leiser, nur noch selten ein ferner Einzeltropfen.
- Tippklang: Ein Anschlag besteht jetzt aus Tastenanschlag, Aufschlag auf Gummiwalze und Gehäuse, Schaltklinke und zurückfallendem Hebel. Jede Taste hat ihren eigenen Klang, schnelles Tippen klingt weicher und dumpfer, Großbuchstaben satter, und der Klang sitzt im Stereobild an der Taste. Die Samples sitzen nun exakt auf dem Aufschlag (vorher bis zu 30 ms versetzt).

### Behoben
- PDF und PNG werden aus den gespeicherten Anschlägen erzeugt, nicht aus der sichtbaren Papierfläche, die während des Blattwechsels noch alten Text zeigt.

## [0.17.0] – 2026-10-30

### Hinzugefügt
- Mehrseitige Manuskripte: „Nächstes Blatt“ legt das fertige Blatt sichtbar auf den Papierstapel, statt es zu löschen. PDF und Text enthalten alle Blätter. „Manuskript verwerfen“ im Zahnrad-Menü beginnt von vorn.
- Brief als Link: „Als Link teilen“ packt das Manuskript komprimiert in die Adresse (kein Server). Der Empfänger sieht es Anschlag für Anschlag entstehen; sein eigenes Blatt bleibt unangetastet.
- Fokus-Modus (F2, Esc beendet): Oberfläche weg, Kamera am Papier.
- Kerze: Die Flamme wächst beim Anzünden vom Docht aus; beim Wechsel zum Tag steigt ein Rauchfaden auf. Der Tag/Nacht-Wechsel ist weicher.

## [0.16.0] – 2026-10-30

### Hinzugefügt
- Grafik-Schalter im Zahnrad-Menü: Staub im Licht (tagsüber im Lichtband des Fensters, nachts im Kerzenschein), Lichtstrahlen durchs Fenster (nur bei hellem Tag, bei Regen stark abgeschwächt) und Kontaktschatten (SSAO, nur in der Grafikstufe „hoch“). Alle standardmäßig an.

## [0.15.0] – 2026-10-30

### Entfernt
- Fensterbrett: Die Vorhänge hingen hinein, und direkt über der Tischplatte braucht das Fenster keins. Die Laibung schließt unten jetzt sauber ab.

### Hinzugefügt
- Oberstes Blatt des Papierstapels ist ein angefangenes, getipptes Manuskript mit überschriebener erster Zeile (Deutsch oder Englisch je nach Browsersprache). Der Stapel rückt dafür weiter ins Bild.

## [0.14.0] – 2026-10-30

### Entfernt
- Schlafende Katze samt Schalter.
- Metallring (Griff) an der Kerzenschale, er ragte in den Tisch.
- Menüpunkt „Geräuschkulisse“ samt Kaminfeuer; Regen bleibt als eigener Schalter.

### Geändert
- Regenklang neu aufgebaut: gedämpftes Rauschen in drei Bändern mit wechselnder Stärke, Prasseln auf der Scheibe, glucksende Regenrinne und einzelne Tropfstellen vom Dach (Pfütze, Blech der Fensterbank, Holz) mit Raumklang. Die Klänge werden auf der Audio-Uhr vorausgeplant und bleiben so auch im Hintergrund-Tab im Rhythmus.
- Tasse steht weiter vorn auf dem Tisch; die Pflanze rückt nach rechts aufs Regal, damit keine Ranken über dem Kaffee hängen. Bücher auf dem Regal links davon, Papierstapel weiter nach vorn rechts.

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
