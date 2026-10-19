#!/usr/bin/env python3
"""Add one AI-generated "passing" walk pose per character (tools/ai-art/src_walk/<sheet>.jpg, magenta background) to the atlas.

The original sheets only had a standing pose plus one stride (same leg forward), so walking read as sliding. Each new frame:
  * is keyed with keyer.py (hue-based magenta key, fringe shave, edge despill) at full res,
  * is scaled so its height matches the character's reference frame (enemies: stand frame 0; Harambe: median walk height),
  * is resized premultiplied, alpha thresholded to hard pixel edges, then despilled again on the final 1-px rim (no pink halo),
  * is anchored on the feet baseline (ay = h) and pivots on the upper-body mass centre, offset like the stride frame it alternates
    with, so the torso doesn't jump sideways between stride and passing.
It is appended to the right of the character's sheet and exposed as anims.pass = [index].

  python3 tools/ai-art/build_walk_pass.py [names...]     (idempotent: an existing pass frame at the sheet's right edge is replaced)
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from keyer import load, key, to_rgba, components

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
META = os.path.join(ROOT, 'assets', 'atlas.json')
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src_walk')
SCALE_FIX = {}   # per-sheet height multiplier tweaks, if a pose needs it (filled after review)

def chest_x(al):
    h = al.shape[0]; ys, xs = np.nonzero(al[:int(h * .72)]); return float(xs.mean())

def crop(sheet, f):
    return sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))

def rim_despill(rgba):
    a = np.array(rgba).astype(float); al = a[..., 3] > 0
    rim = al & ndi.binary_dilation(~al, iterations=2)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = np.maximum(np.minimum(r, b) - g, 0)
    a[..., 0] = np.where(rim, r - spill, r); a[..., 2] = np.where(rim, b - spill, b)
    # rim pixels that are still clearly magenta-pink after despill are fringe: drop them
    pink = rim & ((np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) > 30)
    a[..., 3] = np.where(pink, 0, a[..., 3])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def build_frame(name, m, sheet):
    src = load(os.path.join(SRC, name + '.jpg'))
    fg, _ = key(src)
    comps = components(fg)
    if not comps: raise SystemExit('nothing keyed in ' + name)
    (x0, y0, x1, y1), mask = max(comps, key=lambda c: c[1].sum())
    rgba = to_rgba(src, mask)[y0:y1, x0:x1]
    im = Image.fromarray(rgba, 'RGBA')
    if name == 'harambe': th = int(np.median([m['frames'][i]['h'] for i in range(24, 36)]))
    else: th = m['frames'][0]['h']
    # The generated poses have slightly longer legs than the sheet art, so a pure height match leaves the head/shoulders ~7% small.
    # Split the difference: grow by half the head-width shortfall (capped at 5%), which also gives the passing pose its natural lift.
    ref_i = 24 if name == 'harambe' else 0
    def head_w(al): h = al.shape[0]; return float(np.median([al[y].sum() for y in range(int(h * .04), int(h * .14))]))
    t0 = im.resize((max(1, int(round(im.width * th / im.height))), th), Image.LANCZOS)
    ratio = head_w(np.array(t0)[..., 3] > 128) / head_w(np.array(crop(sheet, m['frames'][ref_i]))[..., 3] > 40)
    th = int(round(th * min(1.05, max(1.0, 1 + (1 / ratio - 1) * 0.5)) * SCALE_FIX.get(name, 1.0)))
    tw = max(1, int(round(im.width * th / im.height)))
    # premultiplied resize so transparent magenta never bleeds into the edge colours
    a = np.array(im).astype(float); a[..., :3] *= a[..., 3:4] / 255
    pm = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').resize((tw, th), Image.LANCZOS)
    b = np.array(pm).astype(float); al = b[..., 3]
    keep = al >= 128
    rgb = np.where(keep[..., None], b[..., :3] * 255 / np.maximum(al[..., None], 1), 0)
    out = np.dstack([np.clip(rgb, 0, 255), keep * 255]).astype(np.uint8)
    fr = rim_despill(Image.fromarray(out, 'RGBA'))
    # trim to content (keeps ay == h on the feet)
    bb = fr.getbbox(); fr = fr.crop(bb)
    # pivot: same upper-body offset as the stride frame this pose alternates with
    stride_i = m['anims']['walk'][0] if name == 'harambe' else max(m['anims']['walk'])
    sf = m['frames'][stride_i]; sal = np.array(crop(sheet, sf))[..., 3] > 40
    off = sf['ax'] - chest_x(sal)
    nal = np.array(fr)[..., 3] > 40
    ax = chest_x(nal) + off
    # fine-tune: line up the head/shoulders with the stride frame (median over three bands so a prop in one band can't drag it)
    def band_dx(frac):
        sh, nh = sal.shape[0], nal.shape[0]
        return (np.median(np.nonzero(nal[:int(nh * frac)])[1]) - ax) - (np.median(np.nonzero(sal[:int(sh * frac)])[1]) - sf['ax'])
    ax += float(np.median([band_dx(f) for f in (0.08, 0.2, 0.45)]))
    ax = int(round(ax)); ax = max(1, min(fr.width - 1, ax))
    return fr, ax

def main(names):
    meta = json.load(open(META))
    for name in names or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.jpg')):
        m = meta[name]; path = os.path.join(ROOT, 'assets', m['img'])
        sheet = Image.open(path).convert('RGBA')
        if 'pass' in m['anims']:  # idempotent: drop the previous pass frame (always the last frame, at the right edge)
            i = m['anims']['pass'][0]; f = m['frames'][i]
            assert i == len(m['frames']) - 1 and f['x'] + f['w'] == sheet.width, name
            sheet = sheet.crop((0, 0, max(1, f['x'] - 2), sheet.height)); m['frames'].pop(); del m['anims']['pass']
            # sheet height may have grown for it; shrink back to the tallest remaining frame
            sheet = sheet.crop((0, 0, sheet.width, max(ff['y'] + ff['h'] for ff in m['frames'])))
        fr, ax = build_frame(name, m, sheet)
        W, H = sheet.width + 2 + fr.width, max(sheet.height, fr.height)
        ns = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ns.paste(sheet, (0, 0)); ns.paste(fr, (sheet.width + 2, 0))
        m['frames'].append({'x': sheet.width + 2, 'y': 0, 'w': fr.width, 'h': fr.height, 'ax': ax, 'ay': fr.height})
        m['anims']['pass'] = [len(m['frames']) - 1]
        if name == 'harambe':  # contact, down, PASSING, up for each leg: the new pose replaces the blobby rebuilt passing frames 27/28 and 32/33
            P = m['anims']['pass'][0]; base = list(range(24, 36))
            m['anims']['walk'] = [P if j in (3, 4, 8, 9) else base[j] for j in range(12)]
        ns.save(path, optimize=True)
        print(f"{name}: pass frame {fr.width}x{fr.height} ax {ax} -> index {m['anims']['pass'][0]}")
    with open(META, 'w') as fh: json.dump(meta, fh, separators=(',', ':'))

if __name__ == '__main__':
    main(sys.argv[1:])
