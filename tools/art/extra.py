"""Extra hand-placed foliage for the jungle stage rendered with the soft-body shader (palm fronds with leaflets, orchids)."""
import math, random, numpy as np
from PIL import Image
from soft import *
GR = ramp('#06241c', '#0b3e2a', '#14603a', '#23864a', '#4cae5a', '#9ad46c')
GR2 = ramp('#082a1e', '#0f4a30', '#1b7040', '#2e9a50', '#66c466', '#b8ec84')
def frond(sc, base, ang, length, droop, seed, rmp):
    rng = random.Random(seed)
    pts = []
    for i in range(0, 25):
        t = i / 24; a = ang + droop * t * t
        x = base[0] + math.cos(a) * length * t - 0 ; y = base[1] + math.sin(a) * length * t
        pts.append((x, y))
    shapes = []
    for i in range(len(pts) - 1): shapes.append(('cap', pts[i], pts[i+1], 0.9 * (1 - i / 30), 0.9 * (1 - (i+1) / 30)))
    for i in range(3, len(pts) - 1, 2):
        t = i / 24; p = pts[i]; tx, ty = pts[i+1][0] - pts[i-1][0], pts[i+1][1] - pts[i-1][1]; tl = math.hypot(tx, ty) or 1; tx /= tl; ty /= tl
        ll = (length * 0.42) * math.sin(math.pi * min(1, t * 1.1)) + 5
        for sgn in (-1, 1):
            nx, ny = -ty * sgn, tx * sgn
            dx, dy = nx * 0.8 + tx * 0.55, ny * 0.8 + ty * 0.55 + 0.35   # leaflets sweep forward + droop
            n = math.hypot(dx, dy); dx /= n; dy /= n
            q = (p[0] + dx * ll, p[1] + dy * ll)
            shapes.append(('cap', p, q, 1.05, 0.3))
    m = sc.mask(shapes); sc.paint(m, rmp, (3, 22, 14), vol=0.9, flat=False, rim=(5, (-0.5, -0.6)))
def add_fronds(img, seed, n, xs, y0=0, bottom=False):
    W, H = img.size; sc = Scene(W, H, seed)
    rng = random.Random(seed)
    for k in range(n):
        x = xs[k % len(xs)] + rng.randint(-14, 14)
        base = (x, y0 - 4); ang = math.pi / 2 + rng.uniform(-0.7, 0.7)
        frond(sc, base, ang, rng.randint(46, 72), rng.choice([-1, 1]) * rng.uniform(0.5, 1.1), seed * 31 + k, GR if k % 2 else GR2)
    out = img.convert('RGBA'); out.alpha_composite(sc.img()); return out
def orchids(img, seed, n):
    W, H = img.size; rng = random.Random(seed); out = img.convert('RGBA'); px = out.load()
    for _ in range(n):
        x, y = rng.randint(10, W - 10), rng.randint(30, 100)
        c = rng.choice([(255, 120, 190), (255, 210, 90), (255, 255, 255)])
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
            px[x + dx, y + dy] = c + (255,)
        px[x, y] = (255, 240, 120, 255)
    return out
