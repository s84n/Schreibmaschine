#!/usr/bin/env python3
"""Berechnet Tiefenkarten für die Fensteraussichten. Läuft einmalig beim Entwickeln, nicht in der App.

Aufruf:  python tools/depth_maps.py alps_field.jpg:0.75 newyork.jpg:0.5 [--preview ORDNER]
Hinter dem Doppelpunkt steht `u` der Aussicht aus VIEWS in src/scene/Room.ts.

Ergebnis: public/views/<name>_depth.jpg mit denselben UV wie das Panorama, hell = nah, dunkel = fern,
mit Gamma 0,5 gespeichert (siehe GAMMA).
Berechnet wird nur der Ausschnitt ums Fenster; der Rest bleibt schwarz und verschiebt sich damit nicht.

Modell: Depth Anything V2 Small. Die größeren Varianten stehen unter einer nicht-kommerziellen Lizenz.
"""
import argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
VIEWS = Path(__file__).resolve().parent.parent / "public" / "views"
# Das Fenster zeigt rund 70°; mehr Rand, damit auch die gedrehte Kamera Tiefe sieht
CROP_DEGREES = 150
# Rechengröße; muss durch 14 teilbar sein
PROCESS_WIDTH = 1960
OUT_SIZE = (2048, 342)
FADE = 0.06
# Das Modell löst die Nähe viel feiner auf als die Ferne: Die Wurzel gibt fernen Bergen mehr der 256
# Stufen. Der Shader quadriert für die Verschiebung zurück und kann für Dunst den Wert direkt nutzen.
GAMMA = 0.5


def estimate(crop: Image.Image, processor, model, device) -> np.ndarray:
    height = round(PROCESS_WIDTH * crop.height / crop.width / 14) * 14
    inputs = processor(images=crop, return_tensors="pt", do_resize=True, size={"height": height, "width": PROCESS_WIDTH}, keep_aspect_ratio=False)
    with torch.inference_mode():
        out = model(**{k: v.to(device) for k, v in inputs.items()}).predicted_depth
    out = torch.nn.functional.interpolate(out[None], size=(crop.height, crop.width), mode="bicubic", align_corners=False)
    depth = out[0, 0].cpu().numpy()
    low, high = np.percentile(depth, [1, 99.5])
    return np.clip((depth - low) / max(high - low, 1e-6), 0, 1) ** GAMMA


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("views", nargs="+", help="datei.jpg:u")
    ap.add_argument("--preview", type=Path, help="Ordner für Vergleichsbilder")
    args = ap.parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = AutoImageProcessor.from_pretrained(MODEL)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL, use_safetensors=True).to(device).eval()
    for entry in args.views:
        name, u = entry.rsplit(":", 1)
        pano = Image.open(VIEWS / name).convert("RGB")
        W, H = pano.size
        crop_w = round(W * CROP_DEGREES / 360)
        # Panoramen laufen rundum: Über die Naht hinweg weiterlesen
        roll = np.roll(np.asarray(pano), W // 2 - round(float(u) * W), axis=1)
        x0 = W // 2 - crop_w // 2
        crop = Image.fromarray(roll[:, x0 : x0 + crop_w])
        depth = estimate(crop, processor, model, device)
        # Weich zum Rand auslaufen, sonst springt die Verschiebung an der Ausschnittkante
        ramp = np.clip(np.minimum(np.arange(crop_w), np.arange(crop_w)[::-1]) / (crop_w * FADE), 0, 1)
        full = np.zeros((H, W), dtype=np.float32)
        full[:, x0 : x0 + crop_w] = depth * ramp
        full = np.roll(full, round(float(u) * W) - W // 2, axis=1)
        out = VIEWS / f"{Path(name).stem}_depth.jpg"
        Image.fromarray((full * 255).astype(np.uint8)).resize(OUT_SIZE, Image.LANCZOS).save(out, quality=88)
        print(f"{out.name}: {out.stat().st_size // 1024} kB")
        if args.preview:
            args.preview.mkdir(parents=True, exist_ok=True)
            # Nur die Fenstermitte, Bild oben, Tiefe unten
            c = crop.resize((1400, round(1400 * crop.height / crop.width)))
            d = Image.fromarray((depth * 255).astype(np.uint8)).resize(c.size).convert("RGB")
            sheet = Image.new("RGB", (c.width, c.height * 2 + 6), "white")
            sheet.paste(c, (0, 0))
            sheet.paste(d, (0, c.height + 6))
            sheet.save(args.preview / f"{Path(name).stem}.jpg", quality=88)


if __name__ == "__main__":
    main()
