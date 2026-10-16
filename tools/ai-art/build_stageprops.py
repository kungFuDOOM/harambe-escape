#!/usr/bin/env python3
"""Key + slice the painted stage-prop sheets (art-src/props/P*.jpg) into per-group webp atlases + json.

  python3 tools/ai-art/build_stageprops.py [sheet dir]

Each sprite is found as a connected component, tightly cropped, resized to 3x its logic size (LANCZOS, premultiplied
alpha) and packed into assets/props/<group>.webp with assets/props/<group>.json = {name: [x, y, w, h, fx, fy, fw, fh]}
(face rect in sprite px, only for signs/plaques where the game draws crisp text). Needs pillow, numpy, scipy.
"""
import json, sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from keyer import load, key as mkey, to_rgba as mrgba, components, order

SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/art-src/props'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'props')
Q = int(os.environ.get('PQ', '80'))
# sheet -> (key colour, [(name, group, ('w'|'h', logic px), face)]) in reading order (rows top->bottom, left->right)
# face: None | 'cream' (auto: biggest pale blob) | (fx,fy,fw,fh) fractions of the sprite
L = {
 'P01': ('g', [('sign_s','common',('w',34),'cream'), ('sign_m','common',('w',62),'cream'), ('sign_l','common',('w',108),'cream')]),
 'P02': ('g', [('hsign','zoo',('w',58),'cream')]),
 'P03': ('g', [('stand_a','zoo',('w',46),None), ('stand_b','zoo',('w',46),None)]),
 'P04_06': ('g', [('bench','common',('w',28),None), ('lamp','common',('h',58),None)]),
 'P05': ('m', [('bush_a','zoo',('w',30),None), ('bush_b','zoo',('w',30),None), ('bush_c','zoo',('w',30),None), ('tree','zoo',('h',76),None)]),
 'P07': ('g', [('cone','common',('h',11),None), ('barrier','common',('w',48),None)]),
 'P08': ('m', [('dumpster','street',('w',36),None), ('hydrant','street',('h',16),None), ('pipe','street',('h',100),None), ('planter','street',('w',24),None)]),
 'P09': ('g', [('diner','street',('w',124),(0.13,0.03,0.72,0.2))]),
 'P10': ('g', [('girders','street',('w',320),None)]),
 'P11': ('g', [('plant','common',('h',32),None), ('cooler','office',('h',46),None), ('flag','common',('h',74),None), ('seal','common',('w',46),None)]),
 'P12_13': ('g', [('cubicle_a','office',('w',78),None), ('cubicle_b','office',('w',78),None), ('door_a','office',('h',56),'cream'), ('door_b','office',('h',56),'cream')]),
 'P14_15': ('g', [('glass','office',('w',152),None), ('table','office',('w',112),None)]),
 'P16_17_18': ('g', [('cart','office',('w',26),None), ('elevator','office',('h',76),None), ('curtain','office',('h',92),None)]),
 'P19': ('g', [('gatepost','base',('h',50),None), ('sandbags4','common',('w',60),None), ('sandbags3','common',('w',46),None)]),
 'P20': ('m', [('jeep','base',('w',58),None)]),
 'P21': ('m', [('drum_a','base',('h',19),None), ('drum_b','base',('h',19),None), ('tank','base',('w',72),None)]),
 'P22': ('m', [('tent','base',('w',76),None)]),
 'P23': ('g', [('wire','base',('w',100),None)]),
 'P24_25': ('g', [('bunker','base',('w',126),None), ('hq','base',('w',152),None)]),
 'P26': ('m', [('fern_a','jungle',('w',56),None), ('fern_b','jungle',('w',56),None), ('fern_c','jungle',('w',56),None), ('rock_a','jungle',('w',44),None), ('rock_b','jungle',('w',44),None)]),
 'P27': ('m', [('vine_s','jungle',('h',30),None), ('vine_m','jungle',('h',50),None), ('vine_l','jungle',('h',70),None)]),
 'P28': ('m', [('pillar_t','jungle',('h',100),None), ('pillar_s','jungle',('h',70),None), ('totem','jungle',('h',54),None)]),
 'P29': ('d', [('flower_a','jungle',('h',30),None), ('flower_b','jungle',('h',30),None)]),
}

def dist_fg(a):
    c = np.concatenate([a[:20,:20].reshape(-1,3), a[:20,-20:].reshape(-1,3), a[-20:,:20].reshape(-1,3), a[-20:,-20:].reshape(-1,3)])
    bg = np.median(c, 0); r, g, b = [a[..., i].astype(float) for i in range(3)]
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    isbg = (d < 90) | ((r > b + 8) & (g < 0.3 * r) & (r > 30))
    fg = ndi.binary_opening(~isbg, iterations=1)
    return fg

def green_fg(a):
    r, g, b = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float)
    c = np.concatenate([a[:20,:20].reshape(-1,3), a[:20,-20:].reshape(-1,3), a[-20:,:20].reshape(-1,3), a[-20:,-20:].reshape(-1,3)])
    bg = np.median(c, 0); bd = bg[1] - max(bg[0], bg[2])
    d = g - np.maximum(r, b)
    fg = ~((d > 0.55 * bd) & (g > 0.5 * bg[1]))
    fg = ndi.binary_opening(fg, iterations=1)
    return fg

def green_rgba(a, fg):
    out = a.astype(float); edge = ndi.binary_dilation(~fg, iterations=3) & fg
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    mx = np.maximum(r, b); out[..., 1] = np.where(edge, np.minimum(g, mx * 1.0 + 6), g)
    # shave one more px of fringe
    fg2 = fg & ~(ndi.binary_dilation(~fg, iterations=1) & ((g - mx) > 25))
    return np.dstack([np.clip(out, 0, 255).astype(np.uint8), (fg2 * 255).astype(np.uint8)])

def finish(rgba, tw):
    """crop alpha bbox, erode 1px fringe, resize premultiplied"""
    al = rgba[..., 3] > 0
    al = ndi.binary_erosion(al, iterations=1) | False
    rgba = rgba.copy(); rgba[..., 3] = (al * 255).astype(np.uint8)
    ys, xs = np.nonzero(al); rgba = rgba[ys.min():ys.max()+1, xs.min():xs.max()+1]
    h, w = rgba.shape[:2]
    kind, n = tw
    s = (n * 3) / (w if kind == 'w' else h); nw, nh = max(1, round(w * s)), max(1, round(h * s))
    f = rgba.astype(float); a = f[..., 3:4] / 255
    pm = np.dstack([f[..., :3] * a, f[..., 3:4]]).astype(np.float32)
    ch = [np.array(Image.fromarray(pm[..., i]).resize((nw, nh), Image.LANCZOS)) for i in range(4)]
    pm = np.stack(ch, -1); al2 = np.clip(pm[..., 3:4], 0, 255) / 255
    rgb = np.where(al2 > 0.02, pm[..., :3] / np.maximum(al2, 0.02), 0)
    alpha = np.where(al2[..., 0] < 0.5, al2[..., 0] * 0.0 + al2[..., 0] * 0, al2[..., 0])  # soften: drop <0.5 coverage (clean edge)
    alpha = np.clip((al2[..., 0] - 0.5) * 2.2 + 0.5, 0, 1)
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)

def find_face(sp, how):
    h, w = sp.shape[:2]
    if isinstance(how, tuple): return [round(how[0]*w), round(how[1]*h), round(how[2]*w), round(how[3]*h)]
    rgb = sp[..., :3].astype(int); al = sp[..., 3] > 200
    pale = al & (rgb[..., 0] > 190) & (rgb[..., 1] > 165) & (rgb[..., 2] > 110) & (rgb[..., 0] - rgb[..., 2] < 90)
    pale = ndi.binary_opening(pale, iterations=1)
    lab, n = ndi.label(pale)
    if n == 0: return None
    sizes = ndi.sum(pale, lab, range(1, n + 1)); k = int(np.argmax(sizes)) + 1
    ys, xs = np.nonzero(lab == k)
    # inset 2px so the painted border stays
    x0, x1, y0, y1 = xs.min()+2, xs.max()-1, ys.min()+2, ys.max()-1
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]

CUT = {'sign_s': 0.72, 'sign_m': 0.62, 'sign_l': 0.6}  # keep this top fraction (stilts shortened)

def main():
    groups = {}
    for sheet, (kc, items) in L.items():
        a = load(os.path.join(SRC, sheet + '.jpg'))
        if kc == 'd': fg = dist_fg(a); rgba = np.dstack([a.astype(np.uint8), (fg*255).astype(np.uint8)])
        elif kc == 'g': fg = green_fg(a); rgba = green_rgba(a, fg)
        else: fg, _ = mkey(a); rgba = mrgba(a, fg)
        comps = components(fg, merge=3, min_area=400)
        rows = order([c[0] for c in comps]); flat = [b for r in rows for b in r]
        byb = {tuple(map(int, c[0])): c for c in comps}
        if len(flat) != len(items):
            print('!!', sheet, 'found', len(flat), 'expected', len(items), [tuple(map(int, b)) for b in flat])
        for b, (name, grp, tw, face) in zip(flat, items):
            x0, y0, x1, y1 = map(int, b); m = byb[tuple(map(int, b))][1][y0:y1, x0:x1]
            crop = rgba[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(m, crop[..., 3], 0)
            if name in CUT: crop = crop[:int(crop.shape[0] * CUT[name])]
            sp = finish(crop, tw)
            fr = find_face(sp, face) if face else None
            groups.setdefault(grp, []).append((name, sp, fr))
    os.makedirs(OUT, exist_ok=True); total = 0
    for grp, sps in groups.items():
        AW = 1024; x = y = rowh = 0; pos = []; PADP = 2
        for name, sp, fr in sorted(sps, key=lambda t: -t[1].shape[0]):
            h, w = sp.shape[:2]
            if x + w > AW: x = 0; y += rowh + PADP; rowh = 0
            pos.append((name, x, y, sp, fr)); x += w + PADP; rowh = max(rowh, h)
        H = y + rowh; atlas = Image.new('RGBA', (AW, H), (0, 0, 0, 0)); meta = {}
        for name, x, y, sp, fr in pos:
            atlas.paste(Image.fromarray(sp, 'RGBA'), (x, y)); h, w = sp.shape[:2]
            meta[name] = [x, y, w, h] + (fr or [])
        atlas.save(f'{OUT}/{grp}.webp', quality=Q, alpha_quality=90, method=6)
        json.dump(meta, open(f'{OUT}/{grp}.json', 'w'), separators=(',', ':'))
        sz = os.path.getsize(f'{OUT}/{grp}.webp'); total += sz
        print(grp, atlas.size, len(meta), sz // 1024, 'KB')
    print('total', total // 1024, 'KB')

if __name__ == '__main__': main()
