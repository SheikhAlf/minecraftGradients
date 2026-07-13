"""
createJson.py

Reads local Minecraft block textures (listed in texture/_list.json) and
produces blocks2.json with the same shape as blocks.json:

    { "name": ..., "url": ..., "localValue": {r,g,b,a}, "isSolid": bool }

This is a Python port of the logic in main.js (getLocalValue / isSolidByBorder).
It is written to match the JS math exactly, including JS's Math.round()
behaviour on .5 boundaries (which differs from Python's built-in round()).

Folder layout expected (adjust TEXTURES_DIR below if yours differs):

    ./createJson.py
    ./texture/_list.json
    ./texture/acacia_door_bottom.png
    ./texture/acacia_door_top.png
    ...
"""

import json
import math
import os

from PIL import Image
import numpy as np

# ---------------------------------------------------------------------------
# Configuration - tweak these if your folder names differ
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEXTURES_DIR = os.path.join(SCRIPT_DIR, "textures")      # folder with the .png files + _list.json
LIST_JSON = os.path.join(TEXTURES_DIR, "_list.json")
OUTPUT_JSON = os.path.join(SCRIPT_DIR, "blocks2.json")

ALPHA_THRESHOLD = 250          # same threshold used in isSolidByBorder()
URL_PREFIX = "./textures/"      # what you'll actually fetch from on the site
# ---------------------------------------------------------------------------


def js_round(x: float) -> int:
    """Replicates JS Math.round(), which always rounds .5 up (floor(x+0.5)),
    unlike Python's round() which rounds half-to-even (banker's rounding).
    All values here are non-negative so this simple form is safe."""
    return math.floor(x + 0.5)


def get_local_value(img: Image.Image):
    """Port of the JS getLocalValue() function.

    - color.{r,g,b} = alpha-weighted average of that channel
      (sum(channel_i * alpha_i) / sum(alpha_i))
    - color.a = plain average alpha across all pixels
    - isSolid = every border pixel has alpha >= ALPHA_THRESHOLD
    """
    img = img.convert("RGBA")
    arr = np.asarray(img, dtype=np.float64)  # shape (H, W, 4)

    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    a_sum = a.sum()
    pixel_count = a.size  # width * height

    if a_sum == 0:
        color = {"r": 0, "g": 0, "b": 0, "a": js_round(a_sum / pixel_count)}
    else:
        color = {
            "r": js_round((r * a).sum() / a_sum),
            "g": js_round((g * a).sum() / a_sum),
            "b": js_round((b * a).sum() / a_sum),
            "a": js_round(a_sum / pixel_count),
        }

    is_solid = is_solid_by_border(a, ALPHA_THRESHOLD)

    return color, is_solid


def is_solid_by_border(alpha: np.ndarray, alpha_threshold: int = 250) -> bool:
    """Port of isSolidByBorder(): every pixel on the outer edge of the image
    must have alpha >= alpha_threshold, or the block is considered non-solid."""
    top, bottom = alpha[0, :], alpha[-1, :]
    left, right = alpha[:, 0], alpha[:, -1]
    for edge in (top, bottom, left, right):
        if (edge < alpha_threshold).any():
            return False
    return True


def main():
    with open(LIST_JSON, "r", encoding="utf-8") as f:
        listing = json.load(f)

    files = listing.get("files", [])
    # "ignore the meta data ones, take just the png"
    png_files = sorted(f for f in files if f.lower().endswith(".png"))

    print(f"_list.json has {len(files)} entries, {len(png_files)} are .png files.")

    blocks = []
    skipped = []

    for i, name in enumerate(png_files, start=1):
        path = os.path.join(TEXTURES_DIR, name)
        try:
            with Image.open(path) as img:
                color, is_solid = get_local_value(img)
        except Exception as e:
            skipped.append((name, str(e)))
            continue

        blocks.append(
            {
                "name": name,
                "url": f"{URL_PREFIX}{name}",
                "localValue": color,
                "isSolid": is_solid,
            }
        )

        if i % 100 == 0 or i == len(png_files):
            print(f"  processed {i}/{len(png_files)}")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(blocks, f, indent=2)

    print(f"\nDone. Wrote {len(blocks)} blocks to {OUTPUT_JSON}")
    if skipped:
        print(f"\n{len(skipped)} file(s) skipped (couldn't open):")
        for name, err in skipped[:20]:
            print(f"  - {name}: {err}")
        if len(skipped) > 20:
            print(f"  ...and {len(skipped) - 20} more")


if __name__ == "__main__":
    main()