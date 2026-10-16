#!/usr/bin/env python3
"""Slice the AI-generated 16-bit sprite sheets (magenta background) into game atlases.

  python3 tools/ai-art/build_sprites.py [art-src dir]

Writes assets/atlas/<char>.png + assets/atlas.json. Needs pillow, numpy, scipy.
All characters face RIGHT in the exported atlas (enemy sheets are generated facing left and get flipped).
"""
import json, sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from keyer import load, key, to_rgba, components, order

SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/art-src'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets')
os.makedirs(OUT + '/atlas', exist_ok=True)

# (sheet) -> source, expected sprites per row, which way the sheet faces
SHEETS = {
    'hero':    dict(src='hero.jpg', rows=[7, 8, 5, 6], face='R'),
    'keepers': dict(src='enemy-zookeepers.jpg', rows=[6, 6, 6], face='L'),
    'cops':    dict(src='enemy-cops.jpg', rows=[8, 8, 8], face='L'),
    'fbi':     dict(src='enemy-fbi.jpg', rows=[6, 6, 7], face='L', split={2: (.3, .75)}),
    'army':    dict(src='enemy-military.jpg', rows=[8, 8, 8], face='L'),
    'bosses':  dict(src='bosses.jpg', rows=[5, 5, 5, 5, 5], face='L', bands=[151, 291, 425, 559]),
}
H = lambda r, c: (r, c)
# character -> sheet, target standing height in device px (3x logic), anims as lists of (row, col)
# optional: flip = set of (row,col) frames drawn facing the other way in the sheet
CHARS = {
    'harambe': dict(sheet='hero', ref=(0, 0), height=190, anims={
        'idle': [(0, 0), (0, 1), (0, 2), (0, 1)],
        'walk': [(0, 3), (0, 4), (0, 5), (0, 6)],
        'atk1': [(1, 0), (1, 1), (1, 0)], 'atk2': [(1, 3), (1, 2), (1, 3)], 'atk3': [(1, 0), (1, 2), (1, 3)],
        'heavy': [(1, 4), (1, 5), (1, 6), (1, 7)],
        'jump': [(2, 0), (2, 2), (2, 0)], 'jatk': [(2, 1), (2, 1)],
        'hurt': [(2, 3), (2, 3)], 'down': [(2, 3), (2, 4), (2, 4)],
        'special': [(3, 0), (3, 1), (3, 2), (3, 3)],
    }, bbox_anchor=[(1, 6), (1, 7)]),
}
def human(sheet, row, walk, windup, atk, hurt, down, idle=None, **kw):
    return dict(sheet=sheet, ref=(row, walk[0]), anims={'idle': [(row, (idle if idle is not None else walk[0]))], 'walk': [(row, c) for c in walk],
        'windup': [(row, c) for c in windup], 'atk': [(row, c) for c in atk], 'hurt': [(row, c) for c in hurt], 'down': [(row, hurt[0]), (row, down), (row, down)]}, **kw)
H_HUMAN = 156
for name, spec in {
    'keeper_net':  human('keepers', 0, [1, 0], [2], [3], [4], 5, idle=0),
    'keeper_dart': human('keepers', 1, [1, 2], [2], [3], [4], 5, idle=0),
    'keeper_stun': human('keepers', 2, [1, 0], [2], [3], [4], 5, idle=0),
    'cop_baton':   human('cops', 0, [0, 1, 2, 3], [4], [5], [6], 7, idle=0),
    'cop_shield':  human('cops', 1, [0, 1, 2, 3], [4], [5], [6], 7, idle=0),
    'cop_taser':   human('cops', 2, [0, 1, 2, 3], [4], [5], [6], 7, idle=0),
    'agent_kick':  dict(sheet='fbi', ref=(0, 0), anims={'idle': [(0, 0)], 'walk': [(0, 1), (0, 2)], 'windup': [(0, 2)], 'atk': [(0, 3), (0, 4)], 'hurt': [(1, 4)], 'down': [(1, 4), (0, 5), (0, 5)]}),
    'agent_net':   dict(sheet='fbi', ref=(0, 0), anims={'idle': [(1, 0)], 'walk': [(1, 0), (1, 1), (1, 2)], 'windup': [(1, 2)], 'atk': [(1, 3)], 'hurt': [(1, 4)], 'down': [(1, 4), (1, 5), (1, 5)]}),
    'agent_case':  dict(sheet='fbi', ref=(0, 0), anims={'idle': [(2, 0)], 'walk': [(2, 0), (2, 1)], 'windup': [(2, 3)], 'atk': [(2, 4)], 'hurt': [(2, 5)], 'down': [(2, 5), (2, 6), (2, 6)]}),
    'soldier_shield': human('army', 0, [0, 1, 2, 3], [4], [5], [6], 7, idle=0),
    'soldier_net':    human('army', 1, [0, 1, 2, 3], [4], [5], [6], 7, idle=0),
    'soldier_baton':  human('army', 2, [0, 1, 2, 3], [4], [5], [6], 7, idle=0),
}.items():
    spec['height'] = H_HUMAN; CHARS[name] = spec
BOSS = lambda row, h, anims, **kw: dict(sheet='bosses', ref=(row, 0), height=h, anims=anims, **kw)
CHARS.update({
    'boss_head':    BOSS(0, 226, {'idle': [(0, 0)], 'walk': [(0, 0), (0, 1)], 'windup': [(0, 1)], 'atk': [(0, 2)], 'hurt': [(0, 3)], 'down': [(0, 3), (0, 4), (0, 4)]}),
    'boss_captain': BOSS(1, 226, {'idle': [(1, 0)], 'walk': [(1, 0), (1, 1)], 'windup': [(1, 1)], 'atk': [(1, 2)], 'hurt': [(1, 3)], 'down': [(1, 3), (1, 4), (1, 4)]}),
    'boss_agent':   BOSS(2, 222, {'idle': [(2, 0)], 'walk': [(2, 0), (2, 1)], 'windup': [(2, 1)], 'atk': [(2, 2)], 'hurt': [(2, 3)], 'down': [(2, 3), (2, 4), (2, 4)]}),
    'boss_general': BOSS(3, 214, {'idle': [(3, 0)], 'walk': [(3, 0)], 'windup': [(3, 1), (3, 2)], 'atk': [(3, 3)], 'hurt': [(3, 1)], 'down': [(3, 1), (3, 4), (3, 4)]}),
    'boss_baron':   BOSS(4, 226, {'idle': [(4, 0)], 'walk': [(4, 0), (4, 1)], 'windup': [(4, 1)], 'atk': [(4, 2)], 'hurt': [(4, 1)], 'down': [(4, 1), (4, 4), (4, 4)]}, noflip=[(4, 0)]),
})

def split_to_n(row, n, rng=(.3, .7), rgba=None):
    """row = list of (bbox, mask) left->right. Split the widest merged sprite at the emptiest column of its
    dark (suit/outline) pixels; pale pixels (swoosh arcs, sparks) left of the cut go to the right-hand sprite."""
    row = list(row)
    while len(row) < n:
        k = max(range(len(row)), key=lambda i: row[i][0][2] - row[i][0][0])
        (x0, y0, x1, y1), m = row[k]
        luma = rgba[..., :3].astype(float).mean(-1)
        dark = m & (luma < 100)
        prof = dark[:, x0:x1].sum(0).astype(float); w = x1 - x0
        lo, hi = int(w * rng[0]), int(w * rng[1])
        cut = x0 + lo + int(np.argmin(np.convolve(prof, np.ones(5) / 5, 'same')[lo:hi]))
        pale = m & ~dark
        a = m.copy(); a[:, cut:] = False; b = m.copy(); b[:, :cut] = False
        mv = a & pale; a &= ~mv; b |= mv
        parts = []
        for mm in (a, b):
            ys, xs = np.nonzero(mm); parts.append(((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), mm))
        row[k:k + 1] = parts
    return row

def extract(sheet):
    sp = SHEETS[sheet]; a = load(os.path.join(SRC, sp['src'])); fg, _ = key(a); rgba = to_rgba(a, fg)
    comps = []
    bands = [0] + sp.get('bands', []) + [a.shape[0]]
    if len(bands) > 2:
        for b0, b1 in zip(bands[:-1], bands[1:]):
            sub = fg.copy(); sub[:b0] = False; sub[b1:] = False
            comps.append(components(sub))
        rows = [sorted(c, key=lambda t: t[0][0]) for c in comps]
    else:
        rows = order_comps(components(fg))
    out = []
    for r, n in zip(rows, sp['rows']):
        r = split_to_n(r, n, sp.get('split', {}).get(len(out), (.3, .7)), rgba) if len(r) < n else r
        assert len(r) == n, (sheet, [len(x) for x in rows], sp['rows'])
        out.append(r)
    assert len(out) == len(sp['rows'])
    frames = {}
    for ri, r in enumerate(out):
        for ci, (bb, m) in enumerate(r):
            x0, y0, x1, y1 = bb
            crop = rgba[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(m[y0:y1, x0:x1], 255, 0)
            frames[(ri, ci)] = Image.fromarray(crop)
    return frames, sp['face']

def order_comps(comps):
    rows = order([c[0] for c in comps]); byb = {tuple(map(int, c[0])): c for c in comps}
    return [[byb[tuple(map(int, b))] for b in r] for r in rows]

def anchor_of(img, bbox_mode=False):
    a = np.array(img)[..., 3] > 0
    h, w = a.shape
    if bbox_mode or w > h * 1.15:
        return w // 2, h
    lo = int(h * 0.88); ys, xs = np.nonzero(a[lo:])
    return int(np.median(xs)), h

def build():
    cache = {}
    meta = {}
    for name, ch in CHARS.items():
        sh = ch['sheet']
        if sh not in cache: cache[sh] = extract(sh)
        frames, face = cache[sh]
        refimg = frames[ch['ref']]
        # reference height for the scale = standing height of the reference frame
        if 'height' in ch: height = ch['height']
        else: height = None
        scale = (height or H_HUMAN) / refimg.size[1] if sh != 'fbi' else H_HUMAN / frames[(0, 0)].size[1]
        used = []
        for lst in ch['anims'].values():
            for f in lst:
                if f not in used: used.append(f)
        sprites = []
        for f in used:
            im = frames[f]
            if face == 'L' and f not in ch.get('noflip', []): im = im.transpose(Image.FLIP_LEFT_RIGHT)
            nw, nh = max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale))
            im = im.resize((nw, nh), Image.LANCZOS)
            al = np.array(im); al[..., 3] = np.where(al[..., 3] > 120, 255, 0); im = Image.fromarray(al)
            ax, ay = anchor_of(im, f in ch.get('bbox_anchor', []))
            sprites.append((f, im, ax, ay))
        # shelf pack
        maxw = 1400; x = y = rowh = 0; place = {}
        for f, im, ax, ay in sprites:
            w, h = im.size
            if x + w + 2 > maxw: x = 0; y += rowh + 2; rowh = 0
            place[f] = (x, y); x += w + 2; rowh = max(rowh, h)
        atlas = Image.new('RGBA', (maxw, y + rowh), (0, 0, 0, 0))
        fl = []; idx = {}
        for f, im, ax, ay in sprites:
            atlas.paste(im, place[f]); idx[f] = len(fl)
            fl.append(dict(x=place[f][0], y=place[f][1], w=im.size[0], h=im.size[1], ax=ax, ay=ay))
        # trim atlas width
        wmax = max(fr['x'] + fr['w'] for fr in fl); atlas = atlas.crop((0, 0, wmax, atlas.size[1]))
        q = atlas.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        q.save(f'{OUT}/atlas/{name}.png', optimize=True)
        meta[name] = dict(img=f'atlas/{name}.png', frames=fl, anims={k: [idx[f] for f in v] for k, v in ch['anims'].items()},
                          scale=3, height=max(fr['h'] for fr in fl))
        print(name, atlas.size, len(fl), os.path.getsize(f'{OUT}/atlas/{name}.png') // 1024, 'KB')
    json.dump(meta, open(f'{OUT}/atlas.json', 'w'), separators=(',', ':'))
    return meta


def build_icon(meta):
    """HUD portrait: head crop of Harambe's idle frame."""
    m = meta['harambe']; at = Image.open(f'{OUT}/{m["img"]}').convert('RGBA'); f = m['frames'][m['anims']['idle'][0]]
    im = at.crop((f['x'] + int(f['w'] * 0.42), f['y'], f['x'] + f['w'], f['y'] + int(f['h'] * 0.40)))
    sz = max(im.size); c = Image.new('RGBA', (sz, sz), (0, 0, 0, 0)); c.paste(im, ((sz - im.size[0]) // 2, sz - im.size[1]))
    c.resize((66, 66), Image.LANCZOS).save(f'{OUT}/icon.png')

if __name__ == '__main__': build_icon(build())
