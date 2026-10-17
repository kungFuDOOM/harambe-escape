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
    # one plate per screen (14 plates; floor tops measured on the 1280x720 sources, ledges use the ground/carpet band top edge)
    'zoo-plaza':        ('zoo',    0.685),  'zoo-foodcourt':    ('zoo',    0.62),
    'city-alley':       ('street', 0.735),  'city-plaza':       ('street', 0.70), 'city-underbridge': ('street', 0.715),
    'fbi-lobby':        ('office', 0.64),  'fbi-cubicles':     ('office', 0.66),
    'fbi-elevators':    ('office', 0.67),  'fbi-director':     ('office', 0.67),
    'base-gate':        ('base',   0.65),  'base-motorpool':   ('base',   0.66), 'base-bunkers':     ('base',   0.735),
    'jungle-treeline':  ('jungle', 0.73),  'jungle-thicket':   ('jungle', 0.76),
    # repeat-fix plates (15)
    'zoo-primate': ('zoo', 0.68),
    'zoo-exit': ('zoo', 0.735),
    'city-diner': ('street', 0.7),
    'city-barricade': ('street', 0.7),
    'fbi-records': ('office', 0.66),
    'fbi-conference': ('office', 0.66),
    'base-barracks': ('base', 0.67),
    'base-fuel': ('base', 0.745),
    'base-wire': ('base', 0.715),
    'base-hq': ('base', 0.72),
    'jungle-ford': ('jungle', 0.78),
    'jungle-ruins': ('jungle', 0.7),
    'jungle-cave': ('jungle', 0.68),
    'jungle-temple': ('jungle', 0.72),
    'jungle-clearing': ('jungle', 0.61),
}
# Lane-on-floor corrections (feet must land on painted floor, never on a wall/ledge face). name -> (floor-top F, floor-bottom Fb or None).
# Fb: the painted floor ends there (ledge/wall face below), so src[F:Fb] fills the whole walk band (mirror-tiled when it would stretch >1.8x).
FIX = {
    'city-stores': (0.75, None),     # shop-front wall base sat ~17 logic px below the assumed floor top
    'fbi-server': (0.705, None),     # plinth base
    'zoo-lion': (0.785, 0.935),      # terrace front face below the paving
    'fbi-director': (0.67, 0.83),    # carpet ends at a dais ledge + brick face
    'base-airfield': (0.697, None),  # tarmac strip above a hangar-apron wall (floor comes from DONOR)
    'jungle-waterfall': (0.765, None),  # dirt path above a cliff wall
    'jungle-canopy': (0.728, None),   # grass lip above an earth cut face
    'jungle-thicket': (0.735, None),  # grass lip above a bush/stone wall
}
# The painted floor of these plates is only a thin lip above a wall/cliff face, so the walk band below the lip is taken from a plate with
# a real ground (already built, colour-matched to the lip, 10 row blend) instead of stretching a few pixels.
DONOR = {'base-airfield': 'base-hq', 'jungle-waterfall': 'jungle-treeline', 'jungle-canopy': 'jungle-cave', 'jungle-thicket': 'jungle-clearing'}
FLOOR_LIFT = 10   # logic px the plate floor top sits above lane top
ZONE = 1          # device px: plates keep their real edge pixels; runtime crossfades neighbours (bg.js)
HAZE_ROWS = 45    # per-row haze colour samples stored in bg.json (runtime fades the neighbouring plate into the same haze)
# Mean floor luminance (0-255) each plate's walk band is lifted to, so heroes/enemies read against it (stage floors sit at ~25-110).
FLOOR_LUM = {'zoo-lion': 66, 'zoo-reptile': 72, 'city-stores': 30, 'city-bridge': 34, 'fbi-server': 96, 'fbi-archive': 114,
             'base-airfield': 84, 'jungle-waterfall': 66, 'jungle-canopy': 78,
             'zoo-plaza': 70, 'zoo-foodcourt': 70, 'city-alley': 30, 'city-plaza': 34, 'city-underbridge': 58,
             'fbi-lobby': 100, 'fbi-cubicles': 100, 'fbi-elevators': 90, 'fbi-director': 80,
             'base-gate': 84, 'base-motorpool': 84, 'base-bunkers': 92, 'jungle-treeline': 70, 'jungle-thicket': 60,
             # repeat-fix plates
             'zoo-primate': 70, 'zoo-exit': 92, 'city-diner': 34, 'city-barricade': 34, 'fbi-records': 100, 'fbi-conference': 100, 'base-barracks': 84, 'base-fuel': 72, 'base-wire': 92, 'base-hq': 92, 'jungle-ford': 66, 'jungle-ruins': 66, 'jungle-cave': 64, 'jungle-temple': 66, 'jungle-clearing': 66}
LUMW = np.array([0.2126, 0.7152, 0.0722])
def lift_floor(a, y0, y1, target):
    """Raise shadows of rows y0.. with a power curve (keeps hue) until the band's mean luminance reaches target; soft ramp at the top."""
    f = a.astype(np.float32) / 255; band = slice(y0, y1)
    if (f[band] @ LUMW).mean() * 255 >= target: return a
    lo, hi = 0.3, 1.0
    for _ in range(24):
        g = (lo + hi) / 2
        if ((f[band] ** g) @ LUMW).mean() * 255 > target: lo = g
        else: hi = g
    out = f ** hi; ramp = np.clip((np.arange(a.shape[0]) - (y0 - 24)) / 24, 0, 1)[:, None, None]
    return (np.clip(f * (1 - ramp) + out * ramp, 0, 1) * 255).astype(np.uint8)
total = 0
for name, (stage, F) in EXTRA.items():
    src = Image.open(f'{SRC}/bgx/{name}.jpg').convert('RGB')
    sh = src.height; lane_top, lane_bot = meta[stage]['lane']
    T = (lane_top - FLOOR_LIFT) * 3  # target floor-top row in the 540px output
    Fb = None
    if name in FIX: F, Fb = FIX[name]
    fy = int(round(F * sh)); top = src.crop((0, 0, src.width, fy)).resize((W, T), Image.LANCZOS)
    if Fb is None:
        bot = src.crop((0, fy, src.width, sh)).resize((W, H - T), Image.LANCZOS)
    else:
        fb = int(round(Fb * sh)); band = src.crop((0, fy, src.width, fb)); need = H - T
        nat = band.height * W / src.width; n = max(1, int(np.ceil(need / nat / 1.8)))
        hs = [need * (i + 1) // n - need * i // n for i in range(n)]; parts = []
        for i, hh in enumerate(hs):
            b = band if i % 2 == 0 else band.transpose(Image.FLIP_TOP_BOTTOM)
            parts.append(np.array(b.resize((W, hh), Image.LANCZOS)))
        bot = np.concatenate(parts, 0)
    if name in DONOR:
        dn = np.array(Image.open(f'{OUT}/x_{DONOR[name]}.webp').convert('RGB')).astype(np.float32)[T:]
        tp = np.array(top).astype(np.float32)
        dn = dn + (tp[-14:].mean((0, 1)) - dn[:14].mean((0, 1)))[None, None, :] * np.clip(1 - np.arange(dn.shape[0]) / 120, 0.4, 1)[:, None, None]
        r = np.clip(np.arange(dn.shape[0]) / 10, 0, 1)[:, None, None]
        dn[:10] = dn[:10] * r[:10] + tp[-10:] * (1 - r[:10]); bot = np.clip(dn, 0, 255).astype(np.uint8)
    a = np.concatenate([np.array(top), np.array(bot)], 0)
    a = lift_floor(a, lane_top * 3, min(H, lane_bot * 3 + 10), FLOOR_LUM[name])
    # per-row haze colour of each side (edge columns, vertically blurred), then ramp the plate edge out of it (tone-matched fade)
    KB = 81; k = np.ones(KB) / KB; hz = {}; meta_stage = stage
    for side, cols in (('l', a[:, :12]), ('r', a[:, -12:])):
        c = cols.astype(np.float32).mean(1); c = np.stack([np.convolve(np.pad(c[:, j], KB // 2, mode="edge"), k, 'valid') for j in range(3)], 1)
        # tonal match: pull toward the stage's own plate row colours (what the neighbouring screens actually show), so no dark patch over sky
        st = np.array(Image.open(f'{OUT}/{meta_stage}.webp').convert('RGB').resize((W, H)), dtype=np.float32).mean(1)
        st = np.stack([np.convolve(np.pad(st[:, j], KB // 2, mode='edge'), k, 'valid') for j in range(3)], 1)
        hz[side] = 0.3 * c + 0.7 * st
    t = np.clip(np.arange(W) / ZONE, 0, 1); t = np.minimum(t, t[::-1]); sm = (t * t * (3 - 2 * t))[None, :, None]
    left = hz['l'][:, None, :]; right = hz['r'][:, None, :]; sidew = (np.arange(W) < W / 2)[None, :, None]
    haze = np.where(sidew, left, right)
    out = a.copy() if ZONE <= 1 else np.clip(a.astype(np.float32) * sm + haze * (1 - sm), 0, 255).astype(np.uint8)
    f = f'{OUT}/x_{name}.webp'; Image.fromarray(out).save(f, quality=72, method=6)
    meta[stage].setdefault('extra', []).append(name); total += os.path.getsize(f)
    meta[stage].setdefault('haze', {})[name] = {s: [[int(v) for v in hz[s][r]] for r in np.linspace(0, H - 1, HAZE_ROWS).astype(int)] for s in 'lr'}
    print(name, os.path.getsize(f) // 1024, 'KB')
print('extras total', total // 1024, 'KB')
json.dump(meta, open(f'{OUT}/bg.json', 'w'))
