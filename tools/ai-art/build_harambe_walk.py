#!/usr/bin/env python3
"""Harambe's walk, rebuilt from ONE generation session (tools/ai-art/src_walk/harambe__contactA.jpg, harambe__mid.jpg, harambe.jpg)
so every frame shares the same style, proportions and lighting (the old cycle mixed 2024 sheet frames, procedurally rebuilt legs and a
newer passing pose, and that mix is what looked off).

The generator only ever paints the NEAR leg forward. Side-view contact silhouettes for either leg are nearly the same; depth is carried by
shading (near leg lit, far leg in shadow). legswap.py swaps the two legs' shading (luminance transfer, hue kept, outlines kept, blended in
below the hips) to make the opposite-leg B frames:

  cA  contact, near leg forward          (painted)
  mA  down, both feet planted            (painted)
  pB  passing, far leg swinging          (swap of the painted passing pose, whose NEAR leg swings)
  cB  contact, far leg forward           (swap of cA)
  mB  down                               (swap of mA)
  pA  passing, near leg swinging         (painted) -> back to cA

Frame timing follows the stance foot, not equal slices: each frame owns the stretch of ground over which its planted foot is
closest to where the real (ground-locked) foot is, so feet don't skate. Thresholds go into atlas harambe.walkAt (logic px, one cycle =
two steps = 2 * walkStep).

  python3 tools/ai-art/build_harambe_walk.py     (idempotent: generated frames sit after harambe.base[0] and are rebuilt)
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from keyer import load, key, to_rgba, components
from legswap import swap
from build_walk_pass import rim_despill, chest_x, crop

ROOT = os.path.join(HERE, '..', '..'); META = os.path.join(ROOT, 'assets', 'atlas.json'); SRC = os.path.join(HERE, 'src_walk')
S = 3

def keyed(name):
    src = load(os.path.join(SRC, name + '.jpg')); fg, _ = key(src)
    (x0, y0, x1, y1), mask = max(components(fg), key=lambda c: c[1].sum())
    return to_rgba(src, mask)[y0:y1, x0:x1]

def small(a, scale):
    x = a.astype(float); x[..., :3] *= x[..., 3:4] / 255
    im = Image.fromarray(np.clip(x, 0, 255).astype(np.uint8), 'RGBA')
    pm = np.asarray(im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)).astype(float)
    al = pm[..., 3]; k = al >= 128; rgb = np.where(k[..., None], pm[..., :3] * 255 / np.maximum(al[..., None], 1), 0)
    o = rim_despill(Image.fromarray(np.dstack([np.clip(rgb, 0, 255), k * 255]).astype(np.uint8), 'RGBA')); return o.crop(o.getbbox())

def feet_x(im):
    """Logic-px x of each foot (skin blobs in the bottom 20%), left to right, plus each sole's y."""
    a = np.asarray(im).astype(int); al = a[..., 3] > 0; h = al.shape[0]
    skin = al & (a[..., 0] > a[..., 2] + 25) & (a[..., :3].mean(2) > 70); skin[:int(h * .8)] = False
    lab, n = ndi.label(skin); out = []
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() > 40: ys, xs = np.nonzero(m); out.append((xs.mean() / S, ys.max() / S))
    return sorted(out)

def main():
    meta = json.load(open(META)); m = meta['harambe']; path = os.path.join(ROOT, 'assets', m['img'])
    sheet = Image.open(path).convert('RGBA')
    m.setdefault('base', [36, 1369, 1005])
    n0, bw, bh = m['base']; m['frames'] = m['frames'][:n0]; sheet = sheet.crop((0, 0, bw, bh))
    m['anims'].pop('pass', None)
    full = {'cA': keyed('harambe__contactA'), 'mA': keyed('harambe__mid'), 'pA': keyed('harambe')}
    # one scale for the whole set (same session, same framing): contact pose = the hero's usual walk height
    target = int(np.median([f['h'] for f in m['frames'][24:36]]))
    scale = target / full['cA'].shape[0]
    frames = {}
    for k, a in full.items():
        frames[k] = small(a, scale)
        b, _ = swap(a.copy(), mode='pass' if k == 'pA' else 'contact')
        frames[k.replace('A', 'B')] = small(b, scale)
    order = ['cA', 'mA', 'pB', 'cB', 'mB', 'pA']
    # palette match: the punch/jump/idle frames are the original sheet; grade the new set's fur onto the idle frame's fur (tint and
    # brightness), so going from walk to idle/attack doesn't change his colour. Skin, the red wristbands and outlines are left alone.
    def fur(a):
        rgb = a[..., :3].astype(float); lum = rgb.mean(2)
        m = (a[..., 3] > 0) & (lum > 22) & ~((rgb[..., 0] > rgb[..., 2] + 25) & (lum > 70)) & ~(rgb[..., 0] > rgb[..., 1] + 60)
        return rgb, lum, m
    f0 = m['frames'][m['anims']['idle'][0]]; ra, la, ma = fur(np.asarray(crop(sheet, f0)))
    ref = (la[ma].mean(), la[ma].std(), (ra - la[..., None])[ma].mean(0))
    rb, lb, mb = fur(np.asarray(frames['cA'])); src_ = (lb[mb].mean(), lb[mb].std(), (rb - lb[..., None])[mb].mean(0))
    for k in order:
        a = np.array(frames[k]); rgb, lum, mm = fur(a); C = rgb - lum[..., None]
        L = (lum - src_[0]) / src_[1] * ref[1] + ref[0]; new = np.maximum(L, 0)[..., None] + C - src_[2] + ref[2]
        a[..., :3] = np.where(mm[..., None], np.clip(new, 0, 255), rgb).astype(np.uint8); frames[k] = Image.fromarray(a, 'RGBA')
    # pivot = upper-body mass centre (same convention as every other Harambe frame), so idle/punch/jump switches don't jump sideways
    x = bw + 2; col = []
    for k in order:
        fr = frames[k]; ax = int(round(chest_x(np.asarray(fr)[..., 3] > 40)))
        col.append((k, fr, ax))
    W = x + sum(fr.width + 2 for _, fr, _ in col); H = max(bh, max(fr.height for _, fr, _ in col))
    ns = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ns.paste(sheet, (0, 0)); idx = {}
    for k, fr, ax in col:
        ns.paste(fr, (x, 0)); m['frames'].append({'x': x, 'y': 0, 'w': fr.width, 'h': fr.height, 'ax': ax, 'ay': fr.height}); idx[k] = len(m['frames']) - 1; x += fr.width + 2
    m['anims']['walk'] = [idx[k] for k in order]
    # stance-foot timing. Contact: front foot plants at d=0; it is the planted foot through the down pose and the passing pose,
    # and is the BACK foot at the next contact. Its x relative to the pivot in each frame tells how far the body has travelled.
    def rel(k, which):
        f = m['frames'][idx[k]]; fx = feet_x(frames[k]); ax = f['ax'] / S
        if which == 'front': return fx[-1][0] - ax
        if which == 'back': return fx[0][0] - ax
        return max(fx, key=lambda p: p[1])[0] - ax          # planted = the lowest sole
    plant = [rel('cA', 'front'), rel('mA', 'front'), rel('pB', 'planted'), rel('cB', 'back')]
    d = [plant[0] - p for p in plant]                       # ground travelled when each pose is exact
    step = d[3]
    ideal = [d[0], d[1], d[2], step, step + d[1], step + d[2], 2 * step]
    at = [(ideal[i] + ideal[i + 1]) / 2 for i in range(6)]  # frame i shows from at[i-1] to at[i]
    m['walkStep'] = round(step, 2); m['walkAt'] = [round(v, 2) for v in at]
    ns.save(path, optimize=True)
    with open(META, 'w') as fh: json.dump(meta, fh, separators=(',', ':'))
    print('walk frames', m['anims']['walk'], 'heights', [m['frames'][i]['h'] for i in m['anims']['walk']], 'step', m['walkStep'], 'walkAt', m['walkAt'])

if __name__ == '__main__':
    main()
