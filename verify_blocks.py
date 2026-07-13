"""
verify_blocks.py

Compares blocks2.json (produced locally by createJson.py) against the
original blocks.json (fetched from GitHub) for every block name present
in both files, and reports any differences in color or isSolid.

Run this AFTER createJson.py, in the same folder as both json files:

    python3 verify_blocks.py

A small color diff (1, sometimes 2) per channel between the two files is
expected and fine — it comes from PNG re-encoding / decoder differences
between the browser's canvas and Pillow, not from a bug in the port.
Anything bigger, or any isSolid mismatch, is worth a closer look.
"""

import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ORIGINAL_JSON = os.path.join(SCRIPT_DIR, "blocks.json")
NEW_JSON = os.path.join(SCRIPT_DIR, "blocks2.json")

COLOR_DIFF_TOLERANCE = 2  # per-channel, flag anything above this


def load_by_name(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {b["name"]: b for b in data}


def main():
    original = load_by_name(ORIGINAL_JSON)
    new = load_by_name(NEW_JSON)

    common = sorted(set(original) & set(new))

    print(f"blocks.json:  {len(original)} entries")
    print(f"blocks2.json: {len(new)} entries")
    print(f"common names: {len(common)}")
    print(f"only in blocks.json:  {len(set(original) - set(new))}")
    print(f"only in blocks2.json: {len(set(new) - set(original))}")
    print()

    color_mismatches = []
    solid_mismatches = []
    max_diff = 0

    for name in common:
        ca = original[name]["localValue"]
        cb = new[name]["localValue"]
        diff = max(abs(ca[k] - cb[k]) for k in ("r", "g", "b", "a"))
        max_diff = max(max_diff, diff)

        if diff > COLOR_DIFF_TOLERANCE:
            color_mismatches.append((name, ca, cb, diff))

        if original[name]["isSolid"] != new[name]["isSolid"]:
            solid_mismatches.append((name, original[name]["isSolid"], new[name]["isSolid"]))

    print(f"Max per-channel diff seen across all common blocks: {max_diff}")
    print(f"Color mismatches (> {COLOR_DIFF_TOLERANCE} per channel): {len(color_mismatches)}")
    for name, ca, cb, diff in color_mismatches[:30]:
        print(f"  {name}: original={ca} new={cb} (max diff {diff})")
    if len(color_mismatches) > 30:
        print(f"  ...and {len(color_mismatches) - 30} more")

    print(f"\nisSolid mismatches: {len(solid_mismatches)}")
    for name, orig_solid, new_solid in solid_mismatches[:30]:
        print(f"  {name}: original={orig_solid} new={new_solid}")
    if len(solid_mismatches) > 30:
        print(f"  ...and {len(solid_mismatches) - 30} more")


if __name__ == "__main__":
    main()