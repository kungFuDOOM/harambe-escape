"""Key the magenta background out of the AI-generated sprite sheets and find individual sprites."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def load(path):
    return np.array(Image.open(path).convert('RGB')).astype(np.int16)

def bg_color(a):
    c = np.concatenate([a[:16,:16].reshape(-1,3), a[:16,-16:].reshape(-1,3), a[-16:,:16].reshape(-1,3), a[-16:,-16:].reshape(-1,3)])
    return np.median(c, 0)

def magenta_score(a):
    """0 = definitely sprite, 1 = definitely magenta background (hue based, so the darker magenta
    ground shadows are removed as well). Pink nets etc. keep far more green and survive."""
    r, g, b = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float)
    m = np.minimum(r, b); M = np.maximum(np.maximum(r, b), 1)
    ratio = (m - g) / np.maximum(m, 1.0)
    s = np.clip((ratio - 0.5) / 0.3, 0, 1)
    bal = np.clip((m / M - 0.2) / 0.15, 0, 1)
    dark = np.where(m > 25, 1.0, np.clip(m / 25.0, 0, 1))
    return s * bal * dark

def key(a, thr=0.5):
    sc = magenta_score(a)
    fg = sc < thr
    fg = ndi.binary_opening(fg, iterations=1)
    # edge cleanup: tinted dark pixels touching the background (shadow remnants, jpeg fringe)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    tint = ((np.minimum(r, b) - g) > 8) & (np.minimum(r, b) * 1.0 > np.maximum(r, b) * 0.2) & (g < 0.35 * np.minimum(r, b) + 2)
    for _ in range(4):
        near = ndi.binary_dilation(~fg, iterations=1)
        fg = fg & ~(near & tint)
    return fg, sc

def despill(a, fg):
    """Remove magenta tint from edge pixels (JPEG fringe)."""
    out = a.copy().astype(float)
    edge = ndi.binary_dilation(~fg, iterations=2) & fg
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    spill = np.maximum(np.minimum(r, b) - g, 0)
    k = np.where(edge, 1.0, 0.0)
    out[..., 0] = r - spill * k * 0.9
    out[..., 2] = b - spill * k * 0.9
    return np.clip(out, 0, 255).astype(np.uint8), edge

def to_rgba(a, fg, erode_edge=True):
    rgb, edge = despill(a, fg)
    fg2 = fg.copy()
    if erode_edge:
        # shave one pixel of fringe where the tint is still strong
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        tinted = (np.minimum(r, b) - g) > 40
        fg2 &= ~(edge & tinted & ~ndi.binary_erosion(fg, iterations=2))
    alpha = (fg2 * 255).astype(np.uint8)
    return np.dstack([rgb, alpha])

def components(fg, merge=4, min_area=120, frag_frac=0.2, frag_dist=60):
    """Return list of (bbox, mask) per sprite. Small detached fragments (nets, sparks) attach to the nearest sprite."""
    grown = ndi.binary_dilation(fg, structure=np.ones((3,3)), iterations=merge)
    lab, n = ndi.label(grown)
    lab = lab * fg  # only real pixels
    objs = ndi.find_objects(lab)
    areas = ndi.sum(fg, lab, range(1, n + 1))
    keep = [i + 1 for i in range(n) if objs[i] is not None and areas[i] >= min_area]
    if not keep: return []
    med = np.median([areas[i - 1] for i in keep])
    big = [i for i in keep if areas[i - 1] >= med * frag_frac]
    small = [i for i in keep if i not in big]
    group = {i: [i] for i in big}
    def bb(i):
        sl = objs[i - 1]; return (sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)
    for i in small:
        x0, y0, x1, y1 = bb(i); best, bd = None, 1e9
        for j in big:
            a0, b0, a1, b1 = bb(j)
            dx = max(a0 - x1, x0 - a1, 0); dy = max(b0 - y1, y0 - b1, 0); d = (dx * dx + dy * dy) ** .5
            if d < bd: bd, best = d, j
        if best is not None and bd <= frag_dist: group[best].append(i)
    out = []
    for j, ids in group.items():
        mask = np.isin(lab, ids)
        ys, xs = np.nonzero(mask)
        out.append(((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), mask))
    return out

def order(boxes, rowtol=None):
    """Sort into rows (by vertical overlap), then left to right."""
    bs = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    rows = []
    for b in bs:
        cy = (b[1] + b[3]) / 2
        for r in rows:
            ys0 = min(x[1] for x in r); ys1 = max(x[3] for x in r)
            my = np.mean([(x[1] + x[3]) / 2 for x in r])
            h = np.mean([x[3] - x[1] for x in r])
            if abs(cy - my) < h * 0.55: r.append(b); break
        else: rows.append([b])
    rows.sort(key=lambda r: np.mean([(x[1] + x[3]) / 2 for x in r]))
    return [sorted(r, key=lambda b: b[0]) for r in rows]
