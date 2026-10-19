"""Opposite-leg frames for the human enemies/bosses: swap the trouser shading of the near (lit, drawn in front) and far (shadow) leg.
Contact pose: the two legs are split where they separate below the crotch (front/back components), pixels above are given to the nearer
of the two. Passing pose: split by a 2-cluster luminance threshold inside the trousers. Shoes, props and outlines are left untouched;
the swap fades in below the hip so the waistline never gets a seam. Returns (rgba, info) where info['cue'] is the near/far luminance
gap (a tiny gap means the art has no depth shading to swap, so there is no B frame to make)."""
import numpy as np
from scipy import ndimage as ndi

def _otsu(v):
    h, e = np.histogram(v, 64); c = (e[:-1] + e[1:]) / 2; best, t = -1, c[0]
    for i in range(1, 64):
        w0, w1 = h[:i].sum(), h[i:].sum()
        if not w0 or not w1: continue
        m0, m1 = (h[:i] * c[:i]).sum() / w0, (h[i:] * c[i:]).sum() / w1; s = w0 * w1 * (m0 - m1) ** 2
        if s > best: best, t = s, c[i]
    return t

def masks(a, mode='contact', hip_frac=0.56):
    al = a[..., 3] > 0; rgb = a[..., :3].astype(float); lum = rgb.mean(2); H, W = al.shape; hip = int(H * hip_frac)
    below = al.copy(); below[:hip] = False
    lab, _ = ndi.label(below); ids = set(lab[H - 4:].ravel()) - {0}; legarea = np.isin(lab, list(ids))
    C = rgb - lum[..., None]; skin = (rgb[..., 0] > rgb[..., 2] + 25) & (lum > 70)
    band = legarea.copy(); band[:int(H * .62)] = False; band[int(H * .82):] = False; band &= (lum > 22) & ~skin
    med_c = np.median(C[band], 0); med_l = np.median(lum[band])
    pants = legarea & ~skin & (np.abs(C - med_c).max(2) < 22) & (lum > 18) & (lum < med_l * 1.9 + 10)
    pants = ndi.binary_opening(pants, iterations=1) | (pants & ndi.binary_erosion(legarea, iterations=2))
    if mode == 'contact':
        # crotch: lowest row (going up from the shoes) where the trousers are one run
        runs = []
        for y in range(H):
            r = pants[y]; runs.append(int(((r[1:] & ~r[:-1]).sum()) + r[0]))
        crotch = None
        for y in range(H - 6, hip, -1):
            if runs[y] >= 2: crotch = y
            elif crotch is not None and runs[y] == 1: break
        if crotch is None: return None
        lower = pants.copy(); lower[:crotch] = False
        l2, n = ndi.label(lower); sz = ndi.sum(lower, l2, range(1, n + 1))
        if n < 2: return None
        big = np.argsort(sz)[::-1][:2] + 1
        dists = [ndi.distance_transform_edt(l2 != b) for b in big]
        own = np.where(dists[0] <= dists[1], 0, 1)
        legs = [pants & (own == k) for k in (0, 1)]
    else:
        v = lum[pants & (lum > 22)]
        if v.size < 50: return None
        t = _otsu(v); light = pants & (lum >= t); l2, n = ndi.label(light)
        if not n: return None
        core = l2 == (np.argmax(ndi.sum(light, l2, range(1, n + 1))) + 1)
        near = core.copy()
        for _ in range(2): near = ndi.binary_dilation(near) & pants
        legs = [near, pants & ~near]
    keep = lum > 22
    m = [lum[l & keep].mean() if (l & keep).sum() > 20 else None for l in legs]
    if None in m: return None
    if m[0] < m[1]: legs = legs[::-1]; m = m[::-1]
    return dict(near=legs[0], far=legs[1], hip=hip, cue=m[0] - m[1], pants=pants)

def swap(a, mode='contact', feather_frac=0.08):
    M = masks(a, mode)
    if M is None: return None, None
    rgb = a[..., :3].astype(float); lum = rgb.mean(2); keep = lum > 22; H = a.shape[0]; C = rgb - lum[..., None]
    def st(mm): v = lum[mm & keep]; return v.mean(), v.std() + 1e-3, C[mm & keep].mean(0)
    ln, sn, cn = st(M['near']); lf, sf, cf = st(M['far'])
    w = np.clip((np.arange(H)[:, None] - M['hip']) / max(2, H * feather_frac), 0, 1)[..., None]
    to_far = np.maximum((lum - ln) / sn * sf + lf, 0)[..., None] + C - cn + cf
    to_near = np.maximum((lum - lf) / sf * sn + ln, 0)[..., None] + C - cf + cn
    out = rgb.copy()
    out = np.where((M['near'] & keep)[..., None], rgb * (1 - w) + to_far * w, out)
    out = np.where((M['far'] & keep)[..., None], rgb * (1 - w) + to_near * w, out)
    o = a.copy(); o[..., :3] = np.clip(out, 0, 255).astype(np.uint8); return o, M

def contact_masks(a, up_frac=0.10):
    """Contact pose: the legs are the two silhouette pieces that reach the ground once the figure is cut just below the crotch.
    Pixels up to `up_frac` of the height above the crotch go to whichever leg is nearer (thighs/hips), fading out at the top."""
    al = a[..., 3] > 0; H, W = al.shape; lum = a[..., :3].astype(float).mean(2)
    def legs_from(y):
        m = al.copy(); m[:y] = False; lab, n = ndi.label(m); ids = [i for i in set(lab[H - 5:].ravel()) - {0}]
        return lab, ids
    crotch = None
    for y in range(H - 8, int(H * .45), -1):
        lab, ids = legs_from(y)
        if len(ids) >= 2: crotch = y
        elif crotch is not None: break
    if crotch is None: return None
    lab, ids = legs_from(crotch); sz = sorted(ids, key=lambda i: -(lab == i).sum())[:2]
    legs = [lab == i for i in sz]
    if min(l.sum() for l in legs) < 0.25 * max(l.sum() for l in legs): return None  # a prop, not a leg
    top = max(int(H * .45), crotch - int(H * up_frac))
    d = [ndi.distance_transform_edt(~l) for l in legs]; band = al.copy(); band[:top] = False; band[crotch:] = False
    # thighs only: close to a leg and inside the legs' own x-span (keeps nets, batons, cases and shields out)
    top_rows = (legs[0] | legs[1]).copy(); top_rows[crotch + int(H * .08):] = False
    xs = np.nonzero(top_rows)[1]; pad = int(W * .03); band[:, :max(0, xs.min() - pad)] = False; band[:, xs.max() + 1 + pad:] = False
    near_leg = np.minimum(d[0], d[1]) <= H * 0.06
    for k in (0, 1): legs[k] = legs[k] | (band & near_leg & (d[k] <= d[1 - k]))
    keep = lum > 22; m = [lum[l & keep].mean() for l in legs]
    if m[0] < m[1]: legs = legs[::-1]; m = m[::-1]
    w = np.clip((np.arange(H)[:, None] - top) / max(1, crotch - top), 0, 1)
    return dict(near=legs[0], far=legs[1], w=w, cue=m[0] - m[1], crotch=crotch, top=top)

def swap_contact(a):
    M = contact_masks(a)
    if M is None: return None, None
    rgb = a[..., :3].astype(float); lum = rgb.mean(2); keep = lum > 22; C = rgb - lum[..., None]
    def st(mm): v = lum[mm & keep]; return v.mean(), v.std() + 1e-3, C[mm & keep].mean(0)
    # only the trouser cloth: pixels whose tint is close to the trouser tint (shoes, belts, skin and props keep their colours)
    for k in ('near', 'far'):
        mm = M[k] & keep; med = np.median(C[mm], 0); M[k] = M[k] & (np.abs(C - med).max(2) < 18) & (lum > 28)
    ln, sn, cn = st(M['near']); lf, sf, cf = st(M['far']); w = M['w'][..., None]
    to_far = np.maximum((lum - ln) / sn * sf + lf, 0)[..., None] + C - cn + cf
    to_near = np.maximum((lum - lf) / sf * sn + ln, 0)[..., None] + C - cf + cn
    out = rgb.copy()
    out = np.where((M['near'] & keep)[..., None], rgb * (1 - w) + to_far * w, out)
    out = np.where((M['far'] & keep)[..., None], rgb * (1 - w) + to_near * w, out)
    o = a.copy(); o[..., :3] = np.clip(out, 0, 255).astype(np.uint8); return o, M
