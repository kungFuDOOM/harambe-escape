import numpy as np, math, random
from PIL import Image, ImageDraw
from pix import *
import font as F

B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

def C(h): return hexc(h) if isinstance(h, str) else h

def fill(cv, x0, y0, x1, y1, col, a=255):
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    x0 = max(0, x0); y0 = max(0, y0); x1 = min(cv.w, x1); y1 = min(cv.h, y1)
    if x1 <= x0 or y1 <= y0: return
    cv.a[y0:y1, x0:x1, :3] = C(col); cv.a[y0:y1, x0:x1, 3] = a

def fillpoly(cv, pts, col):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0, x1, y1 = int(min(xs)) - 1, int(min(ys)) - 1, int(max(xs)) + 2, int(max(ys)) + 2
    bw, bh = x1 - x0, y1 - y0
    if bw <= 0 or bh <= 0: return None
    im = Image.new('L', (bw, bh), 0); ImageDraw.Draw(im).polygon([(p[0] - x0, p[1] - y0) for p in pts], fill=255)
    m = np.array(im) > 0
    full = np.zeros((cv.h, cv.w), bool)
    sy0, sx0 = max(0, y0), max(0, x0); sy1, sx1 = min(cv.h, y1), min(cv.w, x1)
    if sy1 <= sy0 or sx1 <= sx0: return None
    full[sy0:sy1, sx0:sx1] = m[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0]
    if col is not None:
        cv.a[full, :3] = C(col); cv.a[full, 3] = 255
    return full

def gradient(cv, y0, y1, stops, x0=0, x1=None):
    """vertical dithered gradient through colour stops (list of hex)."""
    x1 = cv.w if x1 is None else x1
    cols = [C(c) for c in stops]
    n = len(cols) - 1
    for y in range(y0, y1):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(n - 1, int(t)); f = t - i
        for x in range(x0, x1):
            cv.a[y, x, :3] = cols[i + 1] if B4[y & 3, x & 3] < f else cols[i]; cv.a[y, x, 3] = 255

def speckle(cv, x0, y0, x1, y1, cols, density, rng, mask=None):
    for _ in range(int((x1 - x0) * (y1 - y0) * density)):
        x = rng.randrange(x0, x1); y = rng.randrange(y0, y1)
        if 0 <= x < cv.w and 0 <= y < cv.h and (mask is None or mask[y, x]):
            if cv.a[y, x, 3] > 0: cv.a[y, x, :3] = C(rng.choice(cols))

def wrap(cv, fn):
    """call fn(ox) for tiling at three offsets so features crossing seam wrap"""
    for ox in (0, -cv.w, cv.w): fn(ox)

def shade_mask(cv, mask, rmp, rng=None, hi=True):
    """apply bevel-ish dither shading to flat region (top-left light) using row/col distance."""
    mask_paint(cv, mask, rmp, None, None, True, False)

def text(cv, s, x, y, col, scale=1, shadow=None):
    if shadow is not None:
        im = F.render_text(s, C(shadow), scale); blit(cv, im, x + scale, y + scale)
    im = F.render_text(s, C(col), scale); blit(cv, im, x, y)

def blit(cv, im, x, y):
    a = np.array(im); h, w = a.shape[:2]
    x, y = int(x), int(y)
    for yy in range(h):
        gy = y + yy
        if not (0 <= gy < cv.h): continue
        for xx in range(w):
            gx = x + xx
            if 0 <= gx < cv.w and a[yy, xx, 3] > 0: cv.a[gy, gx] = a[yy, xx]

def noise_tex(w, h, rng, cols, thresh=0.5, scale=3):
    """blobby texture mask using blurred random field"""
    from PIL import ImageFilter
    base = np.array([[rng.random() for _ in range(w // scale + 2)] for _ in range(h // scale + 2)])
    im = Image.fromarray((base * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.array(im) / 255.0

# --- reusable scenery pieces ---
GREENS = [make_ramp(c) for c in ('#2e8a3a', '#3aa24a', '#1e6a34', '#4cb85a')]

def tree(cv, x, ybase, h, rng, pal, trunk=True):
    tr = make_ramp('#6a4426'); 
    if trunk:
        capsule(cv, (x, ybase), (x + rng.uniform(-1, 1), ybase - h * 0.55), h * 0.07, h * 0.05, tr, (20, 12, 10))
    cx, cy = x, ybase - h * 0.7
    for i in range(7):
        a = rng.uniform(0, 6.28); r = h * rng.uniform(0.05, 0.28)
        ellipse(cv, (cx + math.cos(a) * r, cy + math.sin(a) * r * 0.7), h * rng.uniform(0.2, 0.3), h * rng.uniform(0.16, 0.25), rng.choice(pal), (10, 30, 20))
    ellipse(cv, (cx - h * 0.1, cy - h * 0.12), h * 0.22, h * 0.15, pal[0], None)

def bush(cv, x, y, w, rng, pal):
    for i in range(3):
        ellipse(cv, (x + (i - 1) * w * 0.28, y - w * 0.12 - (i % 2) * 2), w * 0.3, w * 0.22, rng.choice(pal), (10, 30, 20))

def fill_ground_poly(cv, pts, col): return fillpoly(cv, pts, col)
