#!/usr/bin/env python3
"""Slice the AI-generated props sheet (magenta background) into assets/props_ai.png + props_ai.json.

  python3 tools/ai-art/build_props.py [art-src dir]

Entries are [x, y, w, h, ax, ay] in device pixels (the game draws them at 1/3 scale on its 320x180 logic grid),
anchored at bottom-centre. Needs pillow, numpy, scipy.
"""
import json, sys, os
import numpy as np
from PIL import Image
from keyer import load, key, to_rgba, components, order

SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/art-src'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets')
# sheet layout, left->right per row: (name, device-px scale factor). Related sprites share a factor so they stay in proportion.
KID, CR, BAN = 0.50, 0.47, 0.33
LAYOUT = [
    [('kid_idle', KID), ('kid_fly', KID), ('kid_hay', KID)],
    [('crate', CR), ('crate_broken', CR), ('barrel', CR), ('barrel_broken', CR)],
    [('banana', BAN), ('banana_big', BAN), ('heart', 0.30), ('haybale', 0.62)],
]

def main():
    a = load(os.path.join(SRC, 'props.jpg')); fg, _ = key(a); rgba = to_rgba(a, fg)
    comps = components(fg); byb = {tuple(map(int, c[0])): c for c in comps}
    rows = [[byb[tuple(map(int, b))] for b in r] for r in order([c[0] for c in comps])]
    assert [len(r) for r in rows] == [len(r) for r in LAYOUT], [len(r) for r in rows]
    sprites = []
    for r, lay in zip(rows, LAYOUT):
        for (bb, m), (name, k) in zip(r, lay):
            x0, y0, x1, y1 = bb
            crop = rgba[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(m[y0:y1, x0:x1], 255, 0)
            im = Image.fromarray(crop); im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
            al = np.array(im); al[..., 3] = np.where(al[..., 3] > 120, 255, 0); sprites.append((name, Image.fromarray(al)))
    maxw = 900; x = y = rowh = 0; place = {}
    for name, im in sprites:
        w, h = im.size
        if x + w + 2 > maxw: x = 0; y += rowh + 2; rowh = 0
        place[name] = (x, y); x += w + 2; rowh = max(rowh, h)
    atlas = Image.new('RGBA', (maxw, y + rowh), (0, 0, 0, 0)); meta = {}
    for name, im in sprites:
        atlas.paste(im, place[name]); meta[name] = [place[name][0], place[name][1], im.size[0], im.size[1], im.size[0] // 2, im.size[1]]
    atlas = atlas.crop((0, 0, max(m[0] + m[2] for m in meta.values()), atlas.size[1]))
    atlas.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(f'{OUT}/props_ai.png', optimize=True)
    json.dump(meta, open(f'{OUT}/props_ai.json', 'w'), separators=(',', ':'))
    print({k: v[2:4] for k, v in meta.items()}, atlas.size)

if __name__ == '__main__': main()
