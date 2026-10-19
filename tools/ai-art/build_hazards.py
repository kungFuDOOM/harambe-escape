"""Key + trim + despill the painted hazard / pickup / zoo prop sources (src_hazards/*.jpg, solid magenta bg) into
assets/props/haz.webp + haz.json (3x game scale like the other painted props). Sizes are game px; js/hazdraw.js + js/bgdraw.js draw them at w/3 x h/3."""
import os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from keyer import load, key, to_rgba
from build_stageprops import finish
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', '..', 'assets', 'props')
# name: (source, ('w'|'h', game px), full_despill)
ITEMS = {
    'boulder': ('boulder', ('w', 34), False), 'coconut': ('coconut', ('w', 18), False), 'cabinet': ('cabinet', ('h', 40), False),
    'searchlight': ('searchlight', ('h', 50), False), 'gem': ('gem', ('h', 18), False), 'rage': ('rage', ('h', 22), True),
    'oneup': ('oneup', ('h', 20), False), 'bus': ('bus', ('w', 112), False), 'lights': ('lights', ('w', 160), True),
}
def build(src, size, full):
    a = load(os.path.join(HERE, 'src_hazards', src + '.jpg'))
    fg, sc = key(a)
    lab, n = ndi.label(fg); sizes = ndi.sum(fg, lab, range(1, n + 1))
    fg = np.isin(lab, [i + 1 for i in range(n) if sizes[i] >= 0.01 * sizes.max()])  # drop specks, keep detached bits (bulbs, legs)
    fg = ndi.binary_fill_holes(fg) & (sc < 0.5)  # never re-add magenta (bus windows stay open)
    if full:  # peel the pastel glow halo (glow x magenta blend) inward from the background, a pixel ring at a time
        M = a.max(-1).astype(float); pastel = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) > 12  # pink / lavender = glow mixed with magenta
        for _ in range(14): fg &= ~(ndi.binary_dilation(~fg) & pastel)
        fg = ndi.binary_opening(fg, iterations=1) | (fg & (M < 110))  # keep the thin dark wire
    rgba = to_rgba(a, fg)
    if full:  # glow halos blended over magenta: strip the magenta spill everywhere, not only at the edge
        f = rgba[..., :3].astype(float); r, g, b = f[..., 0], f[..., 1], f[..., 2]; sp = np.maximum(np.minimum(r, b) - g, 0)
        f[..., 0] -= sp; f[..., 2] -= sp; rgba[..., :3] = np.clip(f, 0, 255).astype(np.uint8)
        # and cut very pink, weak-coverage halo pixels
        hal = (sp > 60) & (g < 90); al = rgba[..., 3].copy(); al[hal] = 0; rgba[..., 3] = al
    return finish(rgba, size)
sprites = {k: build(*v) for k, v in ITEMS.items()}
# shelf-pack, rows up to 1024 px wide
pad, x, y, rowh, meta = 2, 0, 0, 0, {}
for k, s in sprites.items():
    h, w = s.shape[:2]
    if x + w > 1024: x, y, rowh = 0, y + rowh + pad, 0
    meta[k] = [x, y, w, h]; x += w + pad; rowh = max(rowh, h)
atlas = Image.new('RGBA', (1024, y + rowh), (0, 0, 0, 0))
for k, s in sprites.items(): atlas.paste(Image.fromarray(s), tuple(meta[k][:2]))
atlas.save(os.path.join(OUT, 'haz.webp'), quality=85, alpha_quality=90, method=6)
json.dump(meta, open(os.path.join(OUT, 'haz.json'), 'w'), separators=(',', ':'))
print(meta, atlas.size, os.path.getsize(os.path.join(OUT, 'haz.webp')))
