import math, numpy as np
from PIL import Image, ImageDraw, ImageChops
from soft import *
D = math.radians
def vec(a, l): return (math.sin(D(a)) * l, math.cos(D(a)) * l)
def add(p, v): return (p[0] + v[0], p[1] + v[1])

FUR = ramp('#120e18', '#271f2e', '#43384a', '#625463', '#8c7a82', '#c4b0aa')
FURD = ramp('#09070d', '#17111c', '#2a2133', '#40344a', '#5d4d62', '#7f6c76')
SKIN = ramp('#15101a', '#2a2027', '#46343a', '#664b4b', '#8a6c64', '#b69486')
MUZ = ramp('#1e1418', '#3a2a2e', '#5a4145', '#7c5d5a', '#a07f74', '#c8a596')
ARM = ramp('#0e0a13', '#1d1624', '#31283a', '#4a3d52', '#6c5a6c', '#9a8490')
SADDLE = ramp('#2e2a38', '#4a4456', '#6e6676', '#948c98', '#bbb2b8', '#e4dcdc')
RED = ramp('#4a0a14', '#86111f', '#cf2a35', '#f2575a', '#ff9a8c', '#ffd4c0')
OUT = (10, 6, 14)
RIM = (1, 1)   # rim light from lower-right? (direction of surface normal that gets rim)

def harambe3(pose, W=128, H=112, ax=58, ay=104, s=1.4, flash=False, fid=0):
    sc = Scene(W, H, seed=7)
    hip = (ax + pose['hip'][0] * s, ay + (pose['hip'][1] + 19) * s - 19 * s + 0)
    hip = (ax + pose['hip'][0] * s, ay + pose['hip'][1] * s)
    lean = pose['lean']
    TL = 15 * s
    chest = add(hip, (math.sin(D(lean)) * TL, -math.cos(D(lean)) * TL))
    sh = add(chest, (1.5 * s, 2.0 * s))
    hx_, hy_ = (10.0 + pose['head'][0]) * s, -(6.2 - pose['head'][1]) * s
    cl, sl_ = math.cos(D(lean - 15)), math.sin(D(lean - 15))
    hd = (sh[0] + hx_ * cl - hy_ * sl_, sh[1] + hx_ * sl_ + hy_ * cl)
    tex_seed = 3
    TEX = sc.texture(None, 0.34, (0.25, 1), seed=tex_seed, n=420, length=5)
    TEXD = TEX * 0.8

    def fur_part(shapes, rmp, vol, tuft=2.2, dens=1.0, bias=(0, 0.3), seed=0, outline=OUT, tex=TEX, rim=True):
        m = sc.mask(shapes)
        if tuft: sc.tufts(m, tuft * s * 0.8, dens, bias, seed)
        return sc.paint(m, rmp, outline, vol=vol * s, tex=tex, rim=(4, (0.5, 0.7)) if rim else None)

    def limb(p0, p1, rr, far, seed, kind):
        """muscular limb: blobs with radius profile rr list along p0->p1"""
        shapes = []
        for i in range(len(rr) - 1):
            a = (p0[0] + (p1[0]-p0[0]) * i/(len(rr)-1), p0[1] + (p1[1]-p0[1]) * i/(len(rr)-1))
            b = (p0[0] + (p1[0]-p0[0]) * (i+1)/(len(rr)-1), p0[1] + (p1[1]-p0[1]) * (i+1)/(len(rr)-1))
            shapes.append(('cap', a, b, rr[i] * s, rr[i+1] * s))
        return shapes

    def leg(a, far):
        th, sk = a
        top = (hip[0] + (-3.5 if far else 3.0) * s, hip[1] - 1 * s)
        knee = add(top, vec(th, 9.5 * s)); ankle = add(knee, vec(sk, 9.5 * s))
        rmp = FURD if far else FUR
        fur_part(limb(top, knee, [6.8, 7.0, 5.6], far, 1, 'thigh') + limb(knee, ankle, [5.6, 6.0, 4.6], far, 2, 'calf'), rmp, 3.2, 1.8, seed=11 + far)
        fx, fy = ankle[0] + 4.2 * s, ankle[1] + 1.0 * s
        fm = sc.mask([('ell', (fx, fy), 7.2 * s, 3.4 * s, 0.0), ('cap', (ankle[0], ankle[1]-1), (fx, fy), 4.2*s, 3.2*s)])
        sc.paint(fm, SKIN if not far else ramp('#0e0808','#1d1214','#3c2625','#5e3f38','#7a5648','#85604f'), OUT, vol=1.6 * s, flat=False)
        for k in range(3): sc.put(fx + (2.5 + k * 2.2) * s * 0.9, fy - 0.5, SKIN[1]) if False else None
    def arm(a, far, fist=1):
        a1, a2 = a
        sp = (sh[0] + (-6.0 if far else -3.0) * s, sh[1] + 1.0 * s)
        el = add(sp, vec(a1, 13.5 * s)); wr = add(el, vec(a2, 13.0 * s))
        rmp = FURD if far else ARM
        fur_part(limb(sp, el, [8.6, 8.0, 5.8], far, 3, 'upper') + limb(el, wr, [5.8, 7.0, 4.9], far, 4, 'fore'), rmp, 3.2, 1.8, seed=21 + far)
        # red wrist wrap
        wcol = RED
        mid = add(el, vec(a2, 9.5 * s))
        wm = sc.mask([('cap', add(el, vec(a2, 8.4 * s)), add(el, vec(a2, 11.0 * s)), 5.4 * s, 5.2 * s)])
        sc.paint(wm, wcol if not far else [tuple(int(c * 0.7) for c in x) for x in wcol], OUT, vol=1.2 * s)
        # fist: big leathery knuckles
        fc = add(wr, vec(a2, 3.4 * s)); fr = (6.0 if fist else 4.6) * s
        fm = sc.mask([('ell', fc, fr, fr * 0.92, 0)])
        sc.paint(fm, SKIN if not far else ramp('#0e0808','#1d1214','#3c2625','#5e3f38','#7a5648','#85604f'), OUT, vol=2.0 * s)
        for k in (-1.0, 0.0, 1.0):  # knuckle ridges
            kx = fc[0] + math.sin(D(a2)) * fr * 0.55 + math.cos(D(a2)) * k * 2.4 * s
            ky = fc[1] + math.cos(D(a2)) * fr * 0.55 - math.sin(D(a2)) * k * 2.4 * s
            sc.put(kx, ky, SKIN[4 if not far else 3]); sc.put(kx, ky + 1, SKIN[1])
        return wr, fc

    # ---------- draw order ----------
    arm(pose['farArm'], True, pose['farFist'])
    leg(pose['farLeg'], True)
    leg(pose['nearLeg'], False)
    # torso: big barrel with trapezius hump + belly
    mid = ((hip[0] + chest[0]) / 2 + 1 * s, (hip[1] + chest[1]) / 2 + 1)
    rot = D(lean) * 0.7
    torso = [('ell', mid, 12.5 * s, 14.5 * s, rot),
             ('ell', (hip[0] + 1.0 * s, hip[1] - 3 * s), 10.0 * s, 7.5 * s, 0.0),
             ('ell', (sh[0] - 1.0 * s, sh[1] - 2.5 * s), 11.5 * s, 8.5 * s, D(lean) * 0.4)]   # trapezius/shoulder hump
    fur_part(torso, FUR, 5.2, 2.8, 1.0, seed=31)
    # silver saddle: lighter grey fur across the back/shoulders (reads clearly against dark backgrounds)
    sad = sc.mask([('ell', (mid[0] - 6.5 * s, mid[1] - 5 * s), 7.5 * s, 13 * s, D(lean) * 0.7), ('ell', (sh[0] - 4 * s, sh[1] - 2.5 * s), 8 * s, 6 * s, 0)])
    sad = ImageChops.multiply(sad, sc.mask(torso)); sc.tufts(sad, 1.6 * s, 1.0, (0, 0.3), 77)
    sc.paint(sad, SADDLE, None, vol=3.0 * s, tex=TEX * 1.1)
    # chest/belly plate: bare skin with pec definition and abs
    cx, cy = mid[0] + 5.2 * s, mid[1] - 0.5 * s
    pm = sc.mask([('ell', (cx, cy - 1.5 * s), 6.8 * s, 9.5 * s, D(lean) * 0.7), ('ell', (cx - 0.5 * s, cy + 5 * s), 6.2 * s, 6.5 * s, 0)])
    sc.paint(pm, SKIN, OUT, vol=3.6 * s, tex=TEX * 0.25)
    # pec split & muscle lines (hand-inked)
    sc.line((cx - 1 * s, cy - 6 * s), (cx + 0.5 * s, cy + 2 * s), SKIN[1])
    sc.line((cx - 3.5 * s, cy + 1.5 * s), (cx + 6 * s, cy + 2.5 * s), SKIN[1])
    for i in range(3): sc.put(cx - 1 * s + 0.4 * i, cy + (5 + 3 * i) * s * 0.9, SKIN[1]); sc.put(cx + 1.8 * s, cy + (5 + 3 * i) * s * 0.9, SKIN[1])
    for dx in (-3, 0, 3): sc.put(cx + dx * s * .6, cy - 4 * s, SKIN[5]); sc.put(cx + dx * s * .6 + 1, cy - 3 * s, SKIN[5])   # highlights on pecs
    # head
    sx = hd[0]; sy = hd[1]
    head = [('ell', (sx - 1.5 * s, sy - 1.0 * s), 10.2 * s, 9.4 * s, 0.0),
            ('ell', (sx - 3.0 * s, sy - 8.0 * s), 6.8 * s, 6.0 * s, -0.25)]   # sagittal crest (tall gorilla skull)
    fur_part(head, FUR, 3.4, 2.4, 1.1, seed=41)
    # face mask
    fx, fy = sx + 4.6 * s, sy + 2.4 * s
    fm = sc.mask([('ell', (fx, fy), 7.0 * s, 6.8 * s, 0), ('ell', (fx + 3.8 * s, fy + 2.4 * s), 5.0 * s, 4.4 * s, 0)])
    sc.paint(fm, SKIN, OUT, vol=2.4 * s, tex=TEX * 0.15)
    mz = sc.mask([('ell', (fx + 4.2 * s, fy + 2.8 * s), 4.0 * s, 3.4 * s, 0)])
    sc.paint(mz, MUZ, None, vol=1.6 * s, flat=False)
    # brow ridge (heavy, shaded)
    bm = sc.mask([('cap', (fx - 1.0 * s, fy - 3.6 * s), (fx + 5.2 * s, fy - 3.0 * s), 1.6 * s, 1.3 * s)])
    sc.paint(bm, ramp('#1a1014','#2a1a1c','#42282a','#5e3c38','#7a544a','#9a6e5c'), OUT, vol=0.8 * s)
    ex, ey = fx + 2.2 * s, fy - 0.6 * s
    es = pose['eyes']
    if es == 1:
        sc.line((ex - 1.5, ey), (ex + 2, ey + 0.3), (14, 8, 12), 1); sc.put(ex + 2.5, ey + 1, (14, 8, 12))
    else:
        [sc.put(ex + i, ey + j, (255, 250, 232)) for i in (-1, 0, 1, 2) for j in (0, 1)]
        [sc.put(ex + 1 + i, ey + j, (28, 10, 8)) for i in (0, 1) for j in (0, 1)]
        if es == 2:
            sc.line((ex - 2.5, ey - 2.2), (ex + 2.5, ey - 0.8), FURD[0], 1); sc.line((ex - 2.5, ey - 1.2), (ex + 2.5, ey), FURD[1], 1)
        else:
            sc.put(ex - 1, ey - 1, FURD[1]); sc.put(ex, ey - 1, FURD[1]); sc.put(ex + 1, ey - 1, FURD[1])
    # nostrils
    nx_, ny_ = fx + 7.4 * s, fy + 1.6 * s
    sc.put(nx_, ny_, (16, 6, 8)); sc.put(nx_ - 2, ny_ + 0.5, (16, 6, 8)); sc.put(nx_ - 1, ny_ - 1, MUZ[5])
    # mouth
    my = fy + 5.4 * s
    if pose['mouth'] == 0:
        sc.line((fx + 2.4 * s, my), (fx + 8 * s, my - 0.5), (26, 8, 10), 1)
    else:
        h = 3 if pose['mouth'] == 1 else 6
        for yy in range(h):
            for xx in range(int(7 * s)):
                sc.put(fx + 2 * s + xx, my - 1 + yy, [(70, 6, 22), (130, 14, 36), (178, 36, 54), (206, 70, 80), (230, 100, 100), (240, 130, 120)][min(5, yy + (1 if yy == h - 1 else 0))])
        for xx in range(0, int(7 * s), 2): sc.put(fx + 2 * s + xx, my - 1, (255, 255, 240)); sc.put(fx + 2 * s + xx + 1, my - 1, (225, 225, 205))
        for xx in range(1, int(7 * s), 3): sc.put(fx + 2 * s + xx, my - 2 + h, (255, 255, 240))
        sc.line((fx + 1.5 * s, my - 1.5), (fx + 8.5 * s, my - 1.5), (20, 5, 8), 1)
    # ear
    em = sc.mask([('ell', (sx - 5.5 * s, sy + 1.2 * s), 2.2 * s, 3.0 * s, 0)])
    sc.paint(em, SKIN, OUT, vol=1.2 * s)
    # red bandana
    by = sy - 6.6 * s
    band = [(sx - 10 * s, by - 1.2 * s), (sx + 4 * s, by - 2.2 * s), (sx + 11.0 * s, by + 0.2 * s), (sx + 11.4 * s, by + 2.4 * s), (sx - 10 * s, by + 2.4 * s)]
    bm = sc.mask([('poly', band)])
    sc.paint(bm, RED, OUT, vol=1.6 * s, tex=None)
    # knot + flowing tails (flap)
    fl = pose.get('flap', 0)
    kx, ky = sx - 10 * s, by + 0.6 * s
    kn = sc.mask([('ell', (kx, ky), 2.4 * s, 2.4 * s, 0)]); sc.paint(kn, RED, OUT, vol=0.8 * s)
    for i, (dx, dy) in enumerate([(-11, -2 + fl * 1.2), (-14, 3 + fl * 2.0)]):
        tm = sc.mask([('poly', [(kx, ky - 1.2), (kx + dx * s, ky + dy * s - 1), (kx + (dx - 1.5) * s, ky + (dy + 2.2) * s), (kx, ky + 1.2)])])
        sc.paint(tm, RED, OUT, vol=0.9 * s, tex=None)
    # near arm last
    wr, fc = arm(pose['nearArm'], False, pose['fist'])
    # strike trail
    tr = pose.get('trail')
    if tr:
        _draw_trail(sc, tr, sh, s)
    sc.final_outline(OUT)
    img = sc.img()
    if flash:
        a = np.array(img); a[a[..., 3] > 0, :3] = 255; img = Image.fromarray(a)
    return img

def _draw_trail(sc, tr, sh, s):
    """comic swoosh: crescent around the shoulder from angle a0 to a1 (0=down, 90=fwd)."""
    a0, a1, r = tr
    im = Image.new('L', (sc.W * SS, sc.H * SS), 0); d = ImageDraw.Draw(im)
    outer, inner = [], []
    n = 14
    for i in range(n + 1):
        t = i / n; a = a0 + (a1 - a0) * t; th = (0.25 + 1.0 * t) * s * 2.2
        ox, oy = vec(a, (r + th) * s); ix, iy = vec(a, (r - th * 0.4) * s)
        outer.append(((sh[0] + ox) * SS, (sh[1] + oy) * SS)); inner.append(((sh[0] + ix) * SS, (sh[1] + iy) * SS))
    d.polygon(outer + inner[::-1], fill=255)
    m = np.array(im.resize((sc.W, sc.H), Image.BILINEAR)) > 110
    sc.px[m & (sc.px[:, :, 3] == 0), :3] = (255, 244, 200); sc.px[m & (sc.px[:, :, 3] == 0), 3] = 255
