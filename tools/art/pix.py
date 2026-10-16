"""Tiny pixel-art toolkit: shaded primitives with ramp quantisation + ordered dither, per-part outlines.
All art is original and generated procedurally. Everything is drawn aliased (no AA) at native res."""
import numpy as np
from PIL import Image
import math

def hexc(h):
    h = h.lstrip('#'); h = ''.join(c*2 for c in h) if len(h)==3 else h; return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def ramp(*cols):
    return [hexc(c) if isinstance(c, str) else c for c in cols]

def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i]-a[i])*t)) for i in range(3))

def make_ramp(base, n=5, dark='#0a0a18', light='#ffffff', dk=0.62, lt=0.42, hue=True):
    """5-step ramp from a base colour: shadow shifts toward dark purple-blue, highlights toward warm light."""
    b = hexc(base) if isinstance(base, str) else base
    d = hexc(dark); l = hexc(light)
    s0 = mix(b, d, dk); s1 = mix(b, d, dk*0.5); s2 = b; s3 = mix(b, l, lt*0.5); s4 = mix(b, l, lt)
    return [s0, s1, s2, s3, s4]

BAYER = np.array([[0, 2], [3, 1]]) / 4.0 - 0.375

class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)
    def img(self):
        return Image.fromarray(self.a, 'RGBA')
    def copy(self):
        c = Canvas(self.w, self.h); c.a = self.a.copy(); return c

LIGHT = np.array([-0.5, -0.62, 0.6]); LIGHT = LIGHT / np.linalg.norm(LIGHT)

def _apply(cv, mask, inten, rmp, outline=None, dither=True, x0=0, y0=0):
    n = len(rmp)
    ys, xs = np.nonzero(mask)
    if len(ys) == 0: return
    v = (inten[ys, xs] + 1) / 2 * (n - 0.01)
    if dither: v = v + BAYER[ys & 1, xs & 1] * 0.55
    idx = np.clip(np.floor(v), 0, n - 1).astype(int)
    pal = np.array(rmp, np.uint8)
    cv.a[ys, xs, :3] = pal[idx]; cv.a[ys, xs, 3] = 255

def outline_mask(cv, mask_full, color, inner=None):
    """draw 1px outline around boolean mask (full-canvas) on cv where cv is transparent or (inner) always."""
    m = mask_full
    up = np.zeros_like(m); up[1:] = m[:-1]; dn = np.zeros_like(m); dn[:-1] = m[1:]
    lf = np.zeros_like(m); lf[:, 1:] = m[:, :-1]; rt = np.zeros_like(m); rt[:, :-1] = m[:, 1:]
    edge = (up | dn | lf | rt) & ~m
    cv.a[edge, :3] = color; cv.a[edge, 3] = 255

def blank_mask(cv): return np.zeros((cv.h, cv.w), bool)

def shape(cv, mask, inten, rmp, outline=None, dither=True):
    """mask/inten are full-canvas arrays. paint then optionally outline (part contour)."""
    # outline first so fill overwrites inside; outline draws over existing art but under fill
    if outline is not None:
        outline_mask(cv, mask, outline)
    _apply(cv, mask, inten, rmp, dither=dither)

def grid(cv):
    ys, xs = np.mgrid[0:cv.h, 0:cv.w]
    return xs + 0.5, ys + 0.5

def capsule(cv, p0, p1, r0, r1, rmp, outline=None, dither=True, rough=0.0):
    X, Y = grid(cv)
    p0 = np.array(p0, float); p1 = np.array(p1, float)
    d = p1 - p0; L2 = max(1e-6, d @ d)
    t = np.clip(((X - p0[0]) * d[0] + (Y - p0[1]) * d[1]) / L2, 0, 1)
    cx = p0[0] + t * d[0]; cy = p0[1] + t * d[1]
    r = r0 + (r1 - r0) * t
    dx = X - cx; dy = Y - cy
    dist = np.sqrt(dx*dx + dy*dy)
    mask = dist <= r
    nx = dx / np.maximum(r, 1e-3); ny = dy / np.maximum(r, 1e-3)
    nz = np.sqrt(np.clip(1 - nx*nx - ny*ny, 0, 1))
    inten = nx*LIGHT[0] + ny*LIGHT[1] + nz*LIGHT[2]
    inten = np.clip(inten * 1.2 - 0.22, -1, 1)
    shape(cv, mask, inten, rmp, outline, dither)
    return mask

def ellipse(cv, c, rx, ry, rmp, outline=None, dither=True, rot=0.0, cut=None):
    X, Y = grid(cv)
    dx = X - c[0]; dy = Y - c[1]
    if rot:
        cs, sn = math.cos(rot), math.sin(rot)
        dx, dy = dx*cs + dy*sn, -dx*sn + dy*cs
    nx = dx / rx; ny = dy / ry
    mask = nx*nx + ny*ny <= 1
    if cut is not None: mask &= cut
    nz = np.sqrt(np.clip(1 - nx*nx - ny*ny, 0, 1))
    inten = nx*LIGHT[0] + ny*LIGHT[1] + nz*LIGHT[2]
    inten = np.clip(inten * 1.2 - 0.22, -1, 1)
    shape(cv, mask, inten, rmp, outline, dither)
    return mask

def poly(cv, pts, rmp, outline=None, flat=None, bevel=True, dither=False):
    """polygon with bevel shading (top-left light)."""
    from PIL import ImageDraw
    im = Image.new('L', (cv.w, cv.h), 0); ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
    mask = np.array(im) > 0
    return mask_paint(cv, mask, rmp, outline, flat, bevel, dither)

def rect(cv, x, y, w, h, rmp, outline=None, bevel=True, dither=False):
    mask = blank_mask(cv)
    x0, y0, x1, y1 = int(round(x)), int(round(y)), int(round(x + w)), int(round(y + h))
    mask[max(0,y0):max(0,y1), max(0,x0):max(0,x1)] = True
    return mask_paint(cv, mask, rmp, outline, None, bevel, dither)

def mask_paint(cv, mask, rmp, outline=None, flat=None, bevel=True, dither=False):
    n = len(rmp)
    inten = np.zeros(mask.shape)
    if bevel:
        # distance from top-left/bottom-right edges
        up = np.zeros_like(mask); up[1:] = mask[:-1]
        lf = np.zeros_like(mask); lf[:, 1:] = mask[:, :-1]
        dn = np.zeros_like(mask); dn[:-1] = mask[1:]
        rt = np.zeros_like(mask); rt[:, :-1] = mask[:, 1:]
        hi = mask & (~up | ~lf)
        lo = mask & (~dn | ~rt)
        inten[:] = 0.0
        inten[hi] = 0.65
        inten[lo & ~hi] = -0.6
    shape(cv, mask, inten, rmp, outline, dither=False)
    return mask

def px(cv, x, y, col, a=255):
    x = int(x); y = int(y)
    if 0 <= x < cv.w and 0 <= y < cv.h:
        cv.a[y, x, :3] = col; cv.a[y, x, 3] = a

def line(cv, p0, p1, col, th=1):
    n = int(max(abs(p1[0]-p0[0]), abs(p1[1]-p0[1]))) + 1
    for i in range(n + 1):
        t = i / max(1, n)
        x = p0[0] + (p1[0]-p0[0])*t; y = p0[1] + (p1[1]-p0[1])*t
        for dx in range(th):
            for dy in range(th): px(cv, int(round(x)) + dx, int(round(y)) + dy, col)

def final_outline(cv, col=(10, 8, 20), tint=True):
    """Outer silhouette outline: darkened version of neighbouring colour (selective outlining)."""
    m = cv.a[:, :, 3] > 0
    up = np.zeros_like(m); up[1:] = m[:-1]; dn = np.zeros_like(m); dn[:-1] = m[1:]
    lf = np.zeros_like(m); lf[:, 1:] = m[:, :-1]; rt = np.zeros_like(m); rt[:, :-1] = m[:, 1:]
    edge = (up | dn | lf | rt) & ~m
    cv.a[edge, :3] = col; cv.a[edge, 3] = 255

def flip(img): return img.transpose(Image.FLIP_LEFT_RIGHT)

def dither_fill(cv, x0, y0, x1, y1, ca, cb, t):
    """fill rect with ordered dither blend (t 0..1) between colours ca,cb"""
    B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    for y in range(max(0, y0), min(cv.h, y1)):
        for x in range(max(0, x0), min(cv.w, x1)):
            cv.a[y, x, :3] = cb if B4[y & 3, x & 3] < t else ca; cv.a[y, x, 3] = 255
