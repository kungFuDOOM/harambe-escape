#!/usr/bin/env python3
"""Procedural walk cycle for Harambe (the AI sheet only has 4 near-identical walk poses whose feet never move relative to the body, so
the hero skated). We rebuild the legs as two rigid pieces (thigh+shin, foot) swinging about the hip, keep the stance foot planted on the
ground line, and use the sheet's 4 upper-body poses for the arm swing. All frames share one pivot: upper-body mass-centre x, feet baseline y.

  python3 tools/ai-art/build_walk.py          (idempotent: re-slices from the original frames 0..23 and rewrites frames 24+)

Pivot convention (also applied to idle/special by normalise_pivots): ax = upper-body mass centre x, so the sprite flips about the body, not about a shoe.
"""
import json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
META = os.path.join(ROOT, 'assets', 'atlas.json')
S = 3                                # atlas device px per logic px
NORM_FRAMES = list(range(0, 7)) + list(range(20, 24))   # idle, walk(source), special: re-pivoted on the upper-body mass centre
N_ORIG = 24
AX4 = 69                             # walk frame 4's original anchor x (the leg geometry below is measured against it)
HIP = (-6, 140)                      # hip pivot in frame-4 coords relative to its ax (x), absolute row (y)
CUT = 146                            # leg pieces start here (pelvis above stays in the body); the slide is 0 at this row
ANKLE_ROW = 180                      # rows below this (the foot) slide as one flat piece
LIFT = 9                             # swing-foot lift, device px
STEPS = 12                           # frames per full 2-step cycle
BASE = 200                           # canvas row of the ground line
CW, CH, PX = 260, 230, 130           # canvas size, pivot x

def chest_x(img):
    """Pivot x = mass centre of the upper body (head, shoulders, arms, torso: rows above the hip). Flipping about it keeps the silhouette in place."""
    al = np.array(img)[:, :, 3] > 40; h = al.shape[0]; return float(np.where(al[:int(h * .72)])[1].mean())

def shift(img, dx, dy):
    o = Image.new('RGBA', img.size, (0, 0, 0, 0)); o.paste(img, (int(round(dx)), int(round(dy))), img); return o

def lowest(img, x0=0, x1=None):
    al = np.array(img)[:, :, 3] > 40
    if x1 is None: x1 = al.shape[1]
    ys = np.where(al[:, x0:x1].any(1))[0]; return int(ys.max()) if len(ys) else 0

def shear_leg(layer, disp, lift, y0, ank):
    """Slide a leg sideways row by row (0 at the hip row y0, full `disp` from the ankle row down) so the pelvis seam never opens and the foot
    stays flat; `lift` raises the foot (swing leg). No rotation -> no flat corners poking out, and the feet stay on the ground line."""
    a = np.array(layer); h, w = a.shape[:2]; out = np.zeros_like(a)
    e = lambda y: min(max((y - y0) / float(ank - y0), 0.0), 1.0)
    ys = np.arange(h); yo = ys - lift * np.array([e(y) for y in ys])      # output row of each source row (monotonic)
    for yy in range(h):
        # source row for output row yy: invert yo(y)=yy
        src = float(np.interp(yy, yo, ys)); y = int(round(src))
        if y < 0 or y >= h or not a[y, :, 3].any(): continue
        if yy < yo[0] or yy > yo[-1]: continue
        dx = disp * e(src); sx = int(round(dx))
        row = a[y]
        if sx >= 0: out[yy, sx:] = row[:w - sx] if sx else row
        else: out[yy, :w + sx] = row[-sx:]
    return Image.fromarray(out, 'RGBA')

def build():
    meta = json.load(open(META)); H = meta['harambe']; sheet = Image.open(os.path.join(ROOT, 'assets', H['img'])).convert('RGBA')
    fr = H['frames'][:N_ORIG]; f4 = fr[4]
    im4 = sheet.crop((f4['x'], f4['y'], f4['x'] + f4['w'], f4['y'] + f4['h'])); cx4 = chest_x(im4)
    ox, oy = PX - cx4, BASE - f4['h']
    full4 = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); full4.paste(im4, (int(round(ox)), int(round(oy))), im4)
    xd = int(round(ox + AX4 + HIP[0]))
    def flatten_foot(layer, front):
        """The sheet's feet are drawn tilted (front toe up, rear toe down). Search the rotation that makes each sole's bottom edge horizontal and apply it
        to the foot, easing it in over the ankle rows so the trouser leg above is untouched. Pivot = sole centre at the lowest row (stays on the ground line)."""
        a = np.array(layer); H_, W_ = a.shape[:2]; yy, xx = np.mgrid[0:H_, 0:W_]
        def sole(arr):
            al = arr[:, :, 3] > 40; ys, xs = np.where(al[int(oy) + 150:]); ys = ys + int(oy) + 150
            cols = np.unique(xs); bot = np.array([ys[xs == c].max() for c in cols]); sel = bot >= bot.max() - 14
            return cols[sel], bot[sel], bot.max()
        c0, b0, bm = sole(a); px, py = float(c0.mean()), float(bm); ya, yb = oy + 148, oy + 172
        w = np.clip((yy - ya) / (yb - ya), 0, 1); w = w * w * (3 - 2 * w)
        def rot(th):
            ang = th * w; c, sn = np.cos(ang), np.sin(ang); dx, dy = xx - px, yy - py
            sx = np.rint(px + c * dx - sn * dy).astype(int); sy = np.rint(py + sn * dx + c * dy).astype(int)
            ok = (sx >= 0) & (sx < W_) & (sy >= 0) & (sy < H_); o = np.zeros_like(a); o[ok] = a[sy[ok], sx[ok]]; return o
        def axis():
            """Foot orientation = principal axis of its tan (skin) pixels."""
            rgb = a[:, :, :3].astype(int); tan = (a[:, :, 3] > 40) & (rgb[:, :, 0] > 140) & (rgb[:, :, 0] - rgb[:, :, 2] > 40) & (yy > oy + 158)
            X = np.stack([xx[tan], yy[tan]], 1).astype(float); X -= X.mean(0); ev, evec = np.linalg.eigh(np.cov(X.T)); v = evec[:, 1]
            if v[0] < 0: v = -v
            return math.atan2(v[1], v[0])
        best = max(-28, min(28, math.degrees(axis())))
        return Image.fromarray(rot(math.radians(best)), 'RGBA'), best
    def leg_piece(front):
        a = np.array(full4); cols = np.arange(CW)[None, :]; rows = np.arange(CH)[:, None]
        m = (rows >= oy + CUT) & ((cols >= xd) if front else (cols < xd)); a[:, :, 3] = np.where(m, a[:, :, 3], 0); return flatten_foot(Image.fromarray(a, 'RGBA'), front)[0]
    rear, front = leg_piece(False), leg_piece(True)
    y0, ank = int(oy + CUT), int(oy + ANKLE_ROW)
    TRAVEL = 60.0                       # native rear foot (-49) to native front foot (+30), device px
    out = []
    for k in range(STEPS):
        half, t = k // 6, (k % 6) / 6.0
        u = t if half == 0 else 1 - t; pre = (79.0 - TRAVEL) / 2                    # contact stance is symmetric about the hip: feet at +-TRAVEL/2
        d_f, d_r, stance_f = -(pre + TRAVEL * u), pre + TRAVEL * u, half == 0       # half 0: the front-image leg is on the ground sliding back; roles swap at the pass
        lift = LIFT * math.sin(math.pi * t)
        out.append(dict(rear=(shear_leg(rear, d_r, 0 if not stance_f else lift, y0, ank),), front=(shear_leg(front, d_f, lift if not stance_f else 0, y0, ank),), stance_front=stance_f))
    return out, dict(cx4=cx4, xd=xd, y0=y0, ank=ank)


UPPER = [3, 3, 4, 4, 5, 5, 6, 6, 5, 5, 4, 4]   # arm-swing poses from the sheet, one full period per 2 steps


def _apply(ang, p, pt):
    a = math.radians(ang); c, s = math.cos(a), math.sin(a); dx, dy = pt[0] - p[0], pt[1] - p[1]
    return (p[0] + c * dx - s * dy, p[1] + s * dx + c * dy)


def compose():
    legs, info = build(); meta = json.load(open(META)); H = meta['harambe']
    sheet = Image.open(os.path.join(ROOT, 'assets', H['img'])).convert('RGBA'); fr = H['frames'][:N_ORIG]
    crop = lambda i: sheet.crop((fr[i]['x'], fr[i]['y'], fr[i]['x'] + fr[i]['w'], fr[i]['y'] + fr[i]['h']))
    built = []
    for k, L in enumerate(legs):
        im = crop(UPPER[k]); f = fr[UPPER[k]]; cx = chest_x(im)
        body = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); top = im.crop((0, 0, im.size[0], CUT + 1)); body.paste(top, (int(round(PX - cx)), BASE - f['h']))
        c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        order = [L['rear'], L['front']] if L['stance_front'] else [L['front'], L['rear']]   # swing leg behind? keep the near leg (front image) on top
        for lay in (L['rear'][0], L['front'][0]): c.alpha_composite(lay)
        c.alpha_composite(body)
        low = int(np.where((np.array(c)[:, :, 3] > 40).any(1))[0].max()); dy = BASE - low - 1   # lowest pixel of either foot sits exactly on the ground line
        c = shift(c, 0, dy)
        built.append((c, low))
    return built, meta

def write():
    built, meta = compose(); H = meta['harambe']; img = Image.open(os.path.join(ROOT, 'assets', H['img'])).convert('RGBA')
    fr = H['frames'][:N_ORIG]
    # 1) re-pivot idle / source-walk / special on the upper-body mass centre
    for i in NORM_FRAMES:
        f = fr[i]; c = img.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])); f['ax'] = int(round(chest_x(c)))
    # 2) append the procedural walk frames below the original sheet
    y0 = max(f['y'] + f['h'] for f in fr) + 4; x = 0; rowh = 0; placed = []
    boxes = []
    for c, low in built:
        bb = c.getbbox(); t = c.crop(bb); boxes.append((t, bb))
    W = img.size[0]; pos = []
    for t, bb in boxes:
        if x + t.size[0] > W: x = 0; y0 += rowh + 2; rowh = 0
        pos.append((x, y0)); x += t.size[0] + 2; rowh = max(rowh, t.size[1])
    H2 = y0 + rowh + 2; big = Image.new('RGBA', (W, max(H2, img.size[1])), (0, 0, 0, 0)); big.paste(img, (0, 0))
    new = []
    for (t, bb), (px_, py_) in zip(boxes, pos):
        big.paste(t, (px_, py_)); new.append(dict(x=px_, y=py_, w=t.size[0], h=t.size[1], ax=PX - bb[0], ay=BASE - bb[1]))
    H['frames'] = fr + new; H['anims']['walk'] = list(range(N_ORIG, N_ORIG + STEPS))
    big.save(os.path.join(ROOT, 'assets', H['img']), optimize=True)
    json.dump(meta, open(META, 'w'), separators=(',', ':'))
    print('walk frames', N_ORIG, '..', N_ORIG + STEPS - 1, 'sheet', big.size)

if __name__ == '__main__':
    write()
