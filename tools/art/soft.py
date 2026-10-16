"""Supersampled 'soft-body' pixel renderer: parts are drawn as smooth masks at SSx, shaded from a blurred height
field (volumetric light), given shaggy fur tufts + fur-stroke texture + rim light, then reduced to crisp native pixels
with ordered dither and per-part dark outlines. All art original / procedural."""
import numpy as np, math
from PIL import Image, ImageDraw, ImageFilter
SS = 4
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5
LIGHT = np.array([-0.55, -0.65, 0.52]); LIGHT /= np.linalg.norm(LIGHT)

def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def mixc(a, b, t): return tuple(int(round(a[i] + (b[i]-a[i])*t)) for i in range(3))
def ramp(*c): return [hexc(x) for x in c]
def auto_ramp(base, n=6):
    b = hexc(base); dk = (14, 10, 34); lt = (255, 244, 214)
    return [mixc(b, dk, .72), mixc(b, dk, .5), mixc(b, dk, .22), b, mixc(b, lt, .28), mixc(b, lt, .58)][:n]

def sh(m, dy, dx):
    o = np.zeros_like(m)
    ys = slice(max(dy, 0), m.shape[0] + min(dy, 0)); yd = slice(max(-dy, 0), m.shape[0] + min(-dy, 0))
    xs = slice(max(dx, 0), m.shape[1] + min(dx, 0)); xd = slice(max(-dx, 0), m.shape[1] + min(-dx, 0))
    o[ys, xs] = m[yd, xd]; return o

class Scene:
    def __init__(self, W, H, seed=1):
        self.W, self.H = W, H; self.px = np.zeros((H, W, 4), np.uint8); self.rng = np.random.RandomState(seed); self.seed = seed
    # ---- shape builders (native coords) ----
    def mask(self, shapes):
        im = Image.new('L', (self.W*SS, self.H*SS), 0); d = ImageDraw.Draw(im)
        for s in shapes:
            k = s[0]
            if k == 'cap':
                _, p0, p1, r0, r1 = s
                n = int(max(2, math.dist(p0, p1) * SS / 1.2))
                for i in range(n + 1):
                    t = i / n; x = (p0[0]+(p1[0]-p0[0])*t)*SS; y = (p0[1]+(p1[1]-p0[1])*t)*SS; r = (r0+(r1-r0)*t)*SS
                    d.ellipse([x-r, y-r, x+r, y+r], fill=255)
            elif k == 'ell':
                _, c, rx, ry, rot = s
                pts = [(c[0] + rx*math.cos(a)*math.cos(rot) - ry*math.sin(a)*math.sin(rot), c[1] + rx*math.cos(a)*math.sin(rot) + ry*math.sin(a)*math.cos(rot)) for a in np.linspace(0, 2*math.pi, 48)]
                d.polygon([(x*SS, y*SS) for x, y in pts], fill=255)
            elif k == 'poly':
                d.polygon([(x*SS, y*SS) for x, y in s[1]], fill=255)
        return im
    def tufts(self, im, length, density, bias=(0, 0), seed=0):
        """shaggy fur: spikes from boundary along outward normals."""
        a = np.array(im) > 0
        blur = np.array(im.filter(ImageFilter.GaussianBlur(3 * SS / 2))).astype(float) / 255
        gy, gx = np.gradient(blur)
        edge = a & ~(sh(a, 1, 0) & sh(a, -1, 0) & sh(a, 0, 1) & sh(a, 0, -1))
        ys, xs = np.nonzero(edge)
        rng = np.random.RandomState(self.seed * 131 + seed)
        d = ImageDraw.Draw(im)
        step = max(1, int(SS * 1.6 / density))
        for i in range(0, len(ys), step):
            y, x = ys[i], xs[i]
            nx, ny = -gx[y, x], -gy[y, x]; nl = math.hypot(nx, ny)
            if nl < 1e-5: continue
            nx, ny = nx/nl + bias[0], ny/nl + bias[1]; nl = math.hypot(nx, ny); nx /= nl; ny /= nl
            L = length * SS * (0.35 + rng.rand() * 0.9)
            w = 1.1 * SS * (0.8 + rng.rand() * 0.6)
            px_, py_ = -ny, nx
            d.polygon([(x + px_*w, y + py_*w), (x - px_*w, y - py_*w), (x + nx*L + bias[0]*L*0.4, y + ny*L + bias[1]*L*0.4)], fill=255)
        return im
    def texture(self, shape, strength, direction=(0.3, 1.0), seed=0, n=260, length=5):
        """fur strokes: +/- intensity strokes (world fixed)."""
        rng = np.random.RandomState(seed * 977 + 13)
        t = Image.new('F', (self.W*SS, self.H*SS), 0.0); arr = np.zeros((self.H*SS, self.W*SS), np.float32)
        im = Image.new('L', (self.W*SS, self.H*SS), 128); d = ImageDraw.Draw(im)
        dx, dy = direction; dl = math.hypot(dx, dy); dx /= dl; dy /= dl
        for _ in range(n):
            x = rng.rand() * self.W * SS; y = rng.rand() * self.H * SS; L = length * SS * (0.5 + rng.rand())
            ang = rng.randn() * 0.25; c, s_ = math.cos(ang), math.sin(ang); ddx, ddy = dx*c - dy*s_, dx*s_ + dy*c
            d.line([(x, y), (x + ddx*L, y + ddy*L)], fill=int(128 + rng.choice([-1, 1]) * (50 + rng.rand() * 70)), width=int(SS*0.9))
        return (np.array(im.filter(ImageFilter.GaussianBlur(SS*0.35))).astype(np.float32) - 128) / 128 * strength
    # ---- paint ----
    def paint(self, im, rmp, outline=(8, 6, 18), vol=3.0, tex=None, rim=None, bias=0.0, flat=False, dither=0.55, inner_outline=True):
        """im: SS mask. vol: height blur radius (native px). tex: SS float texture added to intensity. rim: (colour index, dir)"""
        a = np.array(im).astype(np.float32) / 255
        h = np.array(im.filter(ImageFilter.GaussianBlur(max(0.5, vol) * SS))).astype(np.float32) / 255
        gy, gx = np.gradient(h); k = SS * vol * 2.0
        nx, ny = -gx * k, -gy * k; nz = np.ones_like(nx); nn = np.sqrt(nx*nx + ny*ny + nz*nz); nx /= nn; ny /= nn; nz /= nn
        inten = nx*LIGHT[0] + ny*LIGHT[1] + nz*LIGHT[2]   # ~ -0.? .. 1
        inten = (inten - 0.38) * 2.0 + bias
        if tex is not None: inten = inten + tex
        r = SS
        def down(x): return x.reshape(self.H, r, self.W, r).mean((1, 3))
        cov = down(a); ni = down(inten); nxx = down(nx); nyy = down(ny)
        m = cov >= 0.5
        if outline is not None:
            from PIL import ImageFilter as F
            mm = Image.fromarray((m * 255).astype(np.uint8))
            dil = np.array(mm.filter(F.MaxFilter(3))) > 0
            edge = dil & ~m
            self.px[edge, :3] = outline; self.px[edge, 3] = 255
        n = len(rmp); ys, xs = np.nonzero(m)
        v = (ni[ys, xs] + 1) / 2 * (n - 1) + 0.5
        if not flat: v = v + B4[ys & 3, xs & 3] * dither
        idx = np.clip(np.floor(v), 0, n - 1).astype(int)
        pal = np.array(rmp, np.uint8)
        self.px[ys, xs, :3] = pal[idx]; self.px[ys, xs, 3] = 255
        if rim is not None:   # bright rim light on the lower/back-right edge
            ci, rd = rim
            up = sh(m, 1, 0) & sh(m, -1, 0) & sh(m, 0, 1) & sh(m, 0, -1)
            e = m & ~up & ((nxx*rd[0] + nyy*rd[1]) > 0.0001)
            self.px[e, :3] = rmp[ci]
        return m
    def put(self, x, y, col, a=255):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.W and 0 <= y < self.H: self.px[y, x, :3] = col; self.px[y, x, 3] = a
    def line(self, p0, p1, col, th=1):
        n = int(max(abs(p1[0]-p0[0]), abs(p1[1]-p0[1]))) + 1
        for i in range(n + 1):
            t = i / max(1, n)
            for ox in range(th):
                for oy in range(th): self.put(p0[0]+(p1[0]-p0[0])*t + ox, p0[1]+(p1[1]-p0[1])*t + oy, col)
    def final_outline(self, col=(8, 6, 18)):
        m = self.px[:, :, 3] > 0
        e = (sh(m, 1, 0) | sh(m, -1, 0) | sh(m, 0, 1) | sh(m, 0, -1)) & ~m
        self.px[e, :3] = col; self.px[e, 3] = 255
    def img(self): return Image.fromarray(self.px, 'RGBA')
