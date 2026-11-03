#!/usr/bin/env python3
"""Weg B (Versuch): Lichtmaske für die Nacht. Läuft einmalig beim Entwickeln, nicht in der App.

Aufruf:  python tools/night_lights.py paris.jpg:0.5 [--seed 7] [--preview ORDNER]

Ergebnis: public/views/<name>_lights.jpg, halb so groß wie das Panorama, mit denselben UV.
Schwarz = dunkel, Farbe = Licht, das nachts über das abgedunkelte Tagbild gelegt wird.

Vorgehen: Fenster sind im Tagbild kleine dunkle Flecken auf hellerer Fassade. Davon geht ein Teil
an, warm oder selten kühl, fern kleiner und dichter. Dazu ein weicher Schein über den Straßen und
die Lichtglocke über dem Horizont. Himmel und Ferne kommen aus der Tiefenkarte, Bäume bleiben dunkel.
"""
import argparse
from pathlib import Path

import cv2
import numpy as np

VIEWS = Path(__file__).resolve().parent.parent / "public" / "views"
CROP_DEGREES = 150
# Anteil der Fenster, in denen Licht brennt
LIT = 0.32
# Farben der Lampen: meist warmes Glühlicht, selten kühle LED
PALETTE = np.array([[1.0, 0.66, 0.34], [1.0, 0.76, 0.48], [1.0, 0.86, 0.66], [0.82, 0.9, 1.0]], np.float32)
PALETTE_P = [0.42, 0.33, 0.15, 0.10]
# Einstellungen je Aussicht; Koordinaten (x, y) im Vollbild. Alles ist optional:
#   lit       Anteil der Fenster mit Licht
#   depth     (von, bis): nur in diesem Tiefenbereich gibt es Fenster (hell = nah)
#   rows      (von, bis): nur in diesen Bildzeilen
#   scatter   Dichte zufälliger Lichtpunkte, wo das Tagbild keine Fenster zeigt (Silhouetten)
#   flood     [(x0, y0, x1, y1, Stärke)]: angestrahlte Bauwerke, helle Mauern leuchten warm
#   landmarks [(x, y, Halbachse x, Halbachse y, Farbe)]: schmale dunkle Bauwerke vor hellem Grund
#   exclude   [(x0, y0, x1, y1)]: hier keine Fenster (Strand, Wiese)
#   core      Mindestabstand zum Himmel in Pixeln (schmale Silhouetten brauchen weniger)
#   dome      Stärke der Lichtglocke über dem Horizont
# Landschaften ohne Häuser (Bergsee, nordischer See, Ahornwald, Machu Picchu, Serengeti) bekommen keine
# Maske: Dort machte das Verfahren aus Schnee, Laub und Gras falsche Lichter.
CONFIG: dict[str, dict] = {
    "paris": {"landmarks": [(4751, 780, 13, 27, (0.65, 0.44, 0.18))]},
    "istanbul": {"lit": 0.45},
    # Silhouette vor dem Abendhimmel: Fenster sind im Bild nicht zu erkennen
    "dubai": {"rows": (370, 505), "scatter": 0.035, "core": 1, "lit": 0.5},
    # Seepalast angestrahlt, darunter seine Spiegelung im See
    "udaipur": {"rows": (560, 800), "lit": 0.5, "flood": [(3330, 560, 4820, 800, 0.15), (3330, 960, 4820, 1240, 0.07)]},
    "granada": {"rows": (740, 930), "flood": [(3560, 730, 4800, 920, 0.3), (3560, 1190, 4800, 1340, 0.1)]},
    "elmina": {"rows": (720, 960), "exclude": [(4100, 860, 5200, 1250)], "lit": 0.4},
    # Nur die Häuserzeile, nicht das Herbstlaub am Hang
    "china_village": {"rows": (690, 900), "lit": 0.22, "flood": [(2400, 700, 5800, 900, 0.08)]},
    "spiaggia_di_mondello": {"depth": (0.0, 0.3)},
    # Nur das Dorf im Tal, nicht die Blumenwiese davor
    "alps_field": {"rows": (690, 830), "lit": 0.5},
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("views", nargs="+", help="datei.jpg:u")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--preview", type=Path)
    args = ap.parse_args()
    for spec in args.views:
        file, u = spec.split(":")
        build(file, float(u), args.seed, args.preview)


def build(file: str, u: float, seed: int, preview: Path | None) -> None:
    stem = Path(file).stem
    cfg = CONFIG.get(stem, {})
    rng = np.random.default_rng(seed)
    img = cv2.imread(str(VIEWS / file), cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.float32) / 255
    h, w = img.shape[:2]
    depth = cv2.imread(str(VIEWS / file.replace(".jpg", "_depth.jpg")), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    depth = cv2.resize(depth, (w, h), interpolation=cv2.INTER_LINEAR)

    # Ausschnitt in die Bildmitte schieben, damit er nicht über die Naht des Bands läuft
    shift = w // 2 - int(u * w)
    img, depth = np.roll(img, shift, axis=1), np.roll(depth, shift, axis=1)
    half = int(w * CROP_DEGREES / 360 / 2)
    x0, x1 = w // 2 - half, w // 2 + half
    crop = img[:, x0:x1]
    d = depth[:, x0:x1]
    cxs = lambda x: (x + shift) % w - x0  # Vollbild-x → Ausschnitt-x

    lum = crop @ np.array([0.3, 0.55, 0.15], np.float32)
    r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
    # Himmel ist in der Tiefenkarte tiefste Ferne; Bäume sind grün und bleiben nachts dunkel
    sky = (d <= 0.035).astype(np.uint8)
    land = cv2.GaussianBlur(1 - sky.astype(np.float32), (0, 0), 1.5)
    # Abstand zum Himmel: An Bergkämmen und Dachkanten entstünden sonst Lichterketten
    core = cv2.distanceTransform(1 - sky, cv2.DIST_L2, 3) > cfg.get("core", 6)
    green = np.clip((g - np.maximum(r, b)) * 12, 0, 1)
    dmin, dmax = cfg.get("depth", (0.0, 0.8))
    # Ganz Nahes (Säulen, Kuppeln am Aussichtspunkt) hat keine Fenster
    city = land * core * (1 - green) * np.clip((dmax - d) * 8, 0, 1) * np.clip((d - dmin) * 8 + 1, 0, 1)
    if "rows" in cfg:
        ry0, ry1 = cfg["rows"]
        yy = np.arange(h)[:, None]
        city = city * ((yy >= ry0) & (yy <= ry1))
    for ex0, ey0, ex1, ey1 in cfg.get("exclude", []):
        city[ey0:ey1, max(cxs(ex0), 0) : max(cxs(ex1), 0)] = 0
    city = city.astype(np.float32)

    # Fenster: dunkler als die Fassade drumherum, auf heller Fläche
    local = cv2.GaussianBlur(lum, (0, 0), 3.5)
    dark = np.clip((local - lum) / np.maximum(local, 0.05) * 3.2 - 0.35, 0, 1) * np.clip(local * 3 - 0.6, 0, 1)
    cand = (dark > 0.25).astype(np.uint8) * (city > 0.5)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8), connectivity=8)
    area = stats[:, cv2.CC_STAT_AREA]
    bw, bh = stats[:, cv2.CC_STAT_WIDTH], stats[:, cv2.CC_STAT_HEIGHT]
    # Lange dünne Flecken sind Dachkanten und Schatten, keine Fenster
    thin = (np.maximum(bw, bh) > 4 * np.minimum(bw, bh)) & (area > 4)
    ok = (area >= 2) & (area <= 160) & ~thin
    ok[0] = False
    on = ok & (rng.random(n) < cfg.get("lit", LIT))
    color = PALETTE[rng.choice(len(PALETTE), n, p=PALETTE_P)] * rng.uniform(0.45, 1.0, (n, 1)).astype(np.float32)
    color[~on] = 0
    lights = color[labels] * np.clip(dark * 1.4, 0, 1)[..., None]
    # Fern liegen die Fenster dichter: etwas mehr Grundschimmer, damit die Stadt dort nicht zerfällt
    far = np.clip(1 - d * 2.2, 0, 1) * city
    lights += far[..., None] * dark[..., None] * 0.18 * PALETTE[1]

    if cfg.get("scatter"):
        # Zufällige Lichtpunkte, fern einzelne Pixel, nah kleine Gruppen
        pts = (rng.random(city.shape) < cfg["scatter"] * city).astype(np.float32)
        pts = np.maximum(pts, cv2.dilate(pts, np.ones((2, 2))) * (d > 0.3))
        tint = PALETTE[rng.choice(len(PALETTE), city.shape, p=PALETTE_P)] * rng.uniform(0.4, 1.0, city.shape + (1,)).astype(np.float32)
        lights += pts[..., None] * tint

    # Schein über Straßen und Plätzen: weichgezeichnetes Fensterlicht
    glow = cv2.GaussianBlur(lights, (0, 0), 14) * 1.6 + cv2.GaussianBlur(lights, (0, 0), 50) * 1.2
    lights = lights + glow * land[..., None]

    for fx0, fy0, fx1, fy1, k in cfg.get("flood", []):
        # Angestrahlt: helle Mauern bekommen warmes Licht von unten, weich ausgeblendet
        m = np.zeros_like(lum)
        a, bb = cxs(fx0), cxs(fx1)
        m[fy0:fy1, a:bb] = 1
        m = cv2.GaussianBlur(m, (0, 0), 12) * land
        ramp = np.clip((np.arange(h)[:, None] - fy0) / max(fy1 - fy0, 1), 0, 1) * 0.6 + 0.4
        lit = m * ramp * np.clip(lum * 1.6 - 0.25, 0, 1) * k
        # Nach dem Schein der Fenster: Sonst überstrahlte die große helle Fläche alles
        lit = lit + cv2.GaussianBlur(lit, (0, 0), 10) * 0.3
        lights += lit[..., None] * np.array([1.0, 0.56, 0.22], np.float32)


    # Lichtglocke: oranger Schimmer am Horizont, nach oben schnell schwächer
    rows = np.where(land.mean(axis=1) > 0.5)[0]
    horizon = rows.min() if len(rows) else h // 2
    yy = np.arange(h, dtype=np.float32)[:, None]
    dome = np.exp(-np.maximum(horizon - yy, 0) / 70) * (1 - land)
    lights += dome[..., None] * np.array([0.42, 0.24, 0.12], np.float32) * 0.55 * cfg.get("dome", 1.0)

    for lx, ly, rx, ry, c in cfg.get("landmarks", []):
        y0, y1, xa, xb = ly - ry, ly + ry, cxs(lx) - rx, cxs(lx) + rx
        patch = lum[y0:y1, xa:xb]
        # Zeilenweise gegen den Hintergrund: oben Himmel, unten die ferne Stadt
        bg = np.percentile(patch, 70, axis=1, keepdims=True)
        mask = np.clip((bg - patch) * 9 - 0.15, 0, 1)
        mask *= np.clip(1 - np.abs(np.arange(xb - xa) - rx) / rx, 0, 1)[None, :] ** 0.5
        lights[y0:y1, xa:xb] = np.maximum(lights[y0:y1, xa:xb], mask[..., None] * np.array(c, np.float32))
        lights[y0:y1, xa:xb] += cv2.GaussianBlur(mask, (0, 0), 3)[..., None] * np.array(c, np.float32) * 0.6

    full = np.zeros((h, w, 3), np.float32)
    # Am Rand des Ausschnitts weich ausblenden
    fade = np.clip(np.minimum(np.arange(x1 - x0), np.arange(x1 - x0)[::-1]) / 200, 0, 1)[None, :, None]
    full[:, x0:x1] = lights * fade
    full = np.roll(full, -shift, axis=1)
    # Halbe Größe, aber über den hellsten Punkt: Einzelne Fenster sollen nicht verschwimmen
    he, we = h - h % 2, w - w % 2
    small = full[:he, :we].reshape(he // 2, 2, we // 2, 2, 3).max(axis=(1, 3))
    out = VIEWS / file.replace(".jpg", "_lights.jpg")
    cv2.imwrite(str(out), (np.clip(small, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 88])
    print(out, f"{out.stat().st_size // 1024} KB")

    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        night = crop * np.array([0.075, 0.1, 0.2], np.float32) + lights * 1.6
        sl = slice(half - 900, half + 900)
        pv = (np.clip(night[:, sl], 0, 1) * 255).astype(np.uint8)[:, :, ::-1].copy()
        # Raster mit Vollbild-Koordinaten zum Einstellen
        for gx in range(0, pv.shape[1], 200):
            fx = (gx + half - 900 + x0 - shift) % w
            cv2.line(pv, (gx, 0), (gx, 12), (90, 90, 90), 1)
            cv2.putText(pv, str(fx), (gx + 2, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (140, 140, 140), 1)
        for gy in range(0, h, 100):
            cv2.putText(pv, str(gy), (2, gy), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (140, 140, 140), 1)
        cv2.imwrite(str(preview / f"{stem}_lights_preview.jpg"), pv)


if __name__ == "__main__":
    main()
