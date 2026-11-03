#!/usr/bin/env python3
"""Vorschaubilder der Aussichten für die Ortswahl. Läuft einmalig beim Entwickeln, nicht in der App.

Aufruf:  python tools/view_thumbs.py alps:alps_field.jpg:0.75:0.55 ...
Je Aussicht: id:datei:u:v, wobei v die senkrechte Bildmitte ist (0 oben, 1 unten).
Ergebnis: public/views/thumbs/<id>.jpg, 240 × 150 px, der Ausschnitt, den das Fenster etwa zeigt.
"""
import sys
from pathlib import Path

import cv2

VIEWS = Path(__file__).resolve().parent.parent / "public" / "views"
SIZE = (240, 150)
# Das Fenster zeigt rund 70°
DEGREES = 70

out_dir = VIEWS / "thumbs"
out_dir.mkdir(exist_ok=True)
for spec in sys.argv[1:]:
    vid, file, u, v = spec.split(":")
    img = cv2.imread(str(VIEWS / file))
    h, w = img.shape[:2]
    cw = int(w * DEGREES / 360)
    ch = min(int(cw * SIZE[1] / SIZE[0]), h)
    x0 = int(float(u) * w) - cw // 2
    y0 = min(max(int(float(v) * h) - ch // 2, 0), h - ch)
    # Über die Naht des Bands hinweg
    crop = cv2.hconcat([img, img])[y0 : y0 + ch, x0 % w : x0 % w + cw]
    small = cv2.resize(crop, SIZE, interpolation=cv2.INTER_AREA)
    dest = out_dir / f"{vid}.jpg"
    cv2.imwrite(str(dest), small, [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(dest.name, f"{dest.stat().st_size // 1024} KB")
