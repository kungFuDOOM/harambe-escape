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
json.dump(meta, open(f'{OUT}/bg.json', 'w'))
