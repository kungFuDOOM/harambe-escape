#!/usr/bin/env python3
"""Turn the 16:9 background plates into stage layers (960x540 = 320x180 logic at 3x).
Plate (main) tiles mirrored along the stage; an optional sky strip scrolls slower and an optional foreground strip faster."""
import json, os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/art-src'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'bg')
os.makedirs(OUT, exist_ok=True)
W, H = 960, 540
FEATHER = 18
# name -> plate, sky cut (fraction of height, 0 = none), foreground strip start (fraction, 0 = none), lane [top, bot] in logic px (feet y)
PLATES = {
    'zoo':      dict(src='bg-zoo.jpg',      sky=0.17, fg=0.0,  lane=[124, 172]),
    'street':   dict(src='bg-city.jpg',     sky=0.0,  fg=0.0,  lane=[116, 166]),
    'office':   dict(src='bg-fbi.jpg',      sky=0.0,  fg=0.0,  lane=[122, 174]),
    'base':     dict(src='bg-military.jpg', sky=0.19, fg=0.0,  lane=[118, 176]),
    'jungle':   dict(src='bg-jungle.jpg',   sky=0.0,  fg=0.93, lane=[130, 176]),
}
meta = {}
for name, p in PLATES.items():
    im = Image.open(f'{SRC}/{p["src"]}').convert('RGB').resize((W, H), Image.LANCZOS)
    a = np.array(im)
    info = dict(w=W, h=H, lane=p['lane'])
    main = np.dstack([a, np.full((H, W), 255, np.uint8)])
    if p['sky']:
        cut = int(H * p['sky'])
        Image.fromarray(a[:cut + FEATHER]).save(f'{OUT}/{name}_sky.webp', quality=90)
        ramp = np.clip((np.arange(H) - cut) / FEATHER, 0, 1)
        main[..., 3] = (ramp[:, None] * 255).astype(np.uint8)
        info['sky'] = dict(h=cut + FEATHER, speed=0.55)
    if p['fg']:
        y0 = int(H * p['fg'])
        fg = np.dstack([a[y0 - FEATHER:], np.full((H - y0 + FEATHER, W), 255, np.uint8)])
        fg[:FEATHER, :, 3] = (np.linspace(0, 1, FEATHER)[:, None] * 255).astype(np.uint8)
        Image.fromarray(fg).save(f'{OUT}/{name}_fg.webp', quality=90)
        info['fg'] = dict(y=y0 - FEATHER, speed=1.25)
    Image.fromarray(main).save(f'{OUT}/{name}.webp', quality=90, alpha_quality=100)
    meta[name] = info
    print(name, os.path.getsize(f'{OUT}/{name}.webp') // 1024, 'KB')

# ---- extra per-screen plates (AI-painted landmark screens, js/bgscreens.js `plate:`) ----
# name -> (stage layer, src file in SRC/bgx, floor-top fraction of the source plate).
# The source is remapped vertically (piecewise-linear) so its floor top lands just above the stage's lane top, which keeps the
# walk band identical to the stage plate; the left/right FEATHER_X columns fade to transparent so it blends into the neighbouring screen.
EXTRA = {
    'zoo-lion':         ('zoo',    0.785), 'zoo-reptile':      ('zoo',    0.765),
    'city-stores':      ('street', 0.675), 'city-bridge':      ('street', 0.62),
    'fbi-server':       ('office', 0.625), 'fbi-archive':      ('office', 0.685),
    'base-airfield':    ('base',   0.765),
    'jungle-waterfall': ('jungle', 0.82),  'jungle-canopy':    ('jungle', 0.78),
}
FEATHER_X = 168   # device px (56 logic px) soft edge each side
FLOOR_LIFT = 10   # logic px the plate floor top sits above lane top
total = 0
for name, (stage, F) in EXTRA.items():
    src = Image.open(f'{SRC}/bgx/{name}.jpg').convert('RGB')
    sh = src.height; lane_top = meta[stage]['lane'][0]
    T = (lane_top - FLOOR_LIFT) * 3  # target floor-top row in the 540px output
    fy = int(round(F * sh)); top = src.crop((0, 0, src.width, fy)).resize((W, T), Image.LANCZOS)
    bot = src.crop((0, fy, src.width, sh)).resize((W, H - T), Image.LANCZOS)
    a = np.concatenate([np.array(top), np.array(bot)], 0)
    t = np.clip(np.arange(W) / FEATHER_X, 0, 1); t = np.minimum(t, t[::-1]); al = (t * t * (3 - 2 * t) * 255).astype(np.uint8)
    rgba = np.dstack([a, np.tile(al, (H, 1))])
    f = f'{OUT}/x_{name}.webp'; Image.fromarray(rgba).save(f, quality=72, alpha_quality=80, method=6)
    meta[stage].setdefault('extra', []).append(name); total += os.path.getsize(f)
    print(name, os.path.getsize(f) // 1024, 'KB')
print('extras total', total // 1024, 'KB')
json.dump(meta, open(f'{OUT}/bg.json', 'w'))
