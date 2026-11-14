#!/usr/bin/env python3
"""8-frame walk for Harambe.

The source sheet only has four near-identical strides, so a playback of those frames
ice-skates. This rebuilds the legs from frame 4 (thigh + lower leg cut-outs, nearest-neighbour
rotations — the pixels stay the original art) and picks, for each frame, the pose whose
rendered sole is closest to a linear plant. The torso is then shifted a few pixels so every
frame shares one head-to-ground distance and one chest anchor. Idempotent: frames 0..23 are
left untouched and frames 24+ are rewritten.

  python3 tools/ai-art/build_walk.py
"""
import json, math, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
META = os.path.join(ROOT, 'assets', 'atlas.json')
N_ORIG = 24
N_WALK = 8
# Joints measured on walk source frame 4 (facing right).
FAR = dict(hip=(46.0, 144.0), knee=(26.0, 164.0), ankle=(19.0, 178.0), toe=(34.0, 190.0))
NEAR = dict(hip=(73.0, 144.0), knee=(86.0, 161.0), ankle=(99.0, 176.0), toe=(118.0, 188.0))
LIFT = 8.0          # swing-foot clearance, device px
TARGET_H = 194      # head-top to sole, device px, shared by every frame


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def ang(a, b):
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))


def rotate_about(im, pivot, deg):
    """Nearest-neighbour rotate around pivot. Returns (image, pivot in that image)."""
    if abs(deg) < 0.05:
        return im, pivot
    w, h = im.size
    px, py = pivot
    R = int(math.hypot(w, h)) + 8
    can = Image.new('RGBA', (R * 2, R * 2), (0, 0, 0, 0))
    can.paste(im, (int(round(R - px)), int(round(R - py))), im)
    rot = can.rotate(deg, resample=Image.NEAREST, center=(R, R), fillcolor=(0, 0, 0, 0))
    return rot, (R, R)


def paste_at(base, im, im_pivot, at):
    ox = int(round(at[0] - im_pivot[0]))
    oy = int(round(at[1] - im_pivot[1]))
    bh, bw = base.shape[:2]
    arr = np.asarray(im)
    ih, iw = arr.shape[:2]
    x0, y0 = max(0, ox), max(0, oy)
    x1, y1 = min(bw, ox + iw), min(bh, oy + ih)
    if x1 <= x0 or y1 <= y0:
        return
    patch = arr[y0 - oy:y0 - oy + (y1 - y0), x0 - ox:x0 - ox + (x1 - x0)]
    dst = base[y0:y1, x0:x1]
    dst[patch[:, :, 3] > 30] = patch[patch[:, :, 3] > 30]


def seg_dist(px, py, a, b):
    ax, ay = a
    bx, by = b
    abx, aby = bx - ax, by - ay
    L2 = abx * abx + aby * aby or 1.0
    t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / L2))
    dx, dy = px - (ax + t * abx), py - (ay + t * aby)
    return dx * dx + dy * dy


def cut_pieces(src):
    """Split frame 4 into a legless torso and two legs (thigh overlaps the shin at the knee)."""
    al = src[:, :, 3] > 30
    SH, SW = al.shape

    def mask(side, hip):
        m = np.zeros(al.shape, bool)
        for y in range(132, SH):
            xs = np.where(al[y])[0]
            if len(xs) == 0:
                continue
            cut, best = 60, 0
            for i in range(len(xs) - 1):
                g = int(xs[i + 1] - xs[i])
                if g > best:
                    best, cut = g, int((xs[i] + xs[i + 1]) // 2)
            for x in xs:
                if (side == 'far' and x < cut) or (side == 'near' and x >= cut):
                    m[y, x] = True
        for y in range(128, 146):
            for x in range(SW):
                if not al[y, x] or abs(x - hip[0]) >= 18 or abs(y - hip[1]) >= 18:
                    continue
                if (side == 'far' and x < hip[0] + 6) or (side == 'near' and x > hip[0] - 8):
                    m[y, x] = True
        return m

    def pieces(leg, side):
        m = mask(side, leg['hip'])
        thigh = np.zeros_like(src)
        lower = np.zeros_like(src)
        ys, xs = np.where(m)
        for y, x in zip(ys, xs):
            d_th = seg_dist(x, y, leg['hip'], leg['knee'])
            d_sh = min(seg_dist(x, y, leg['knee'], leg['ankle']), seg_dist(x, y, leg['ankle'], leg['toe']))
            knee = dist((x, y), leg['knee']) < 7
            if d_th <= d_sh or knee:
                thigh[y, x] = src[y, x]
            if d_sh <= d_th + 4 or knee or y > leg['knee'][1] - 2:
                lower[y, x] = src[y, x]
        return Image.fromarray(thigh), Image.fromarray(lower)

    body = src.copy()
    for y in range(150, SH):
        body[y, :, 3] = 0
    for y in range(140, 150):
        xs = np.where(al[y])[0]
        for x in xs:
            if abs(int(x) - 64) > 14:
                body[y, x, 3] = 0
    return body, pieces(FAR, 'far'), pieces(NEAR, 'near')


def sole_of(tmp):
    ys, xs = np.where(tmp[:, :, 3] > 30)
    if len(ys) == 0:
        return None
    yb = int(ys.max())
    return float(xs[ys >= yb - 2].mean()), float(yb)


def measure(th_im, lo_im, joints, d_th, d_sh):
    """Sole position relative to the hip for this angle pair. Images are discarded."""
    l1 = dist(joints['hip'], joints['knee'])
    th_ang = math.radians(ang(joints['hip'], joints['knee']) + d_th)
    knee_off = (math.cos(th_ang) * l1, math.sin(th_ang) * l1)
    lo_r, lo_p = rotate_about(lo_im, joints['knee'], -d_sh)
    tmp = np.zeros((96, 190, 4), np.uint8)
    knee = (95.0, 28.0)
    paste_at(tmp, lo_r, lo_p, knee)
    sole = sole_of(tmp)
    if sole is None:
        return None
    hip = (knee[0] - knee_off[0], knee[1] - knee_off[1])
    return (sole[0] - hip[0], sole[1] - hip[1], knee_off)


def build_grid(th_im, lo_im, joints, step=3, lim=42):
    out = []
    for d_th in range(-lim, lim + 1, step):
        for d_sh in range(-lim, lim + 1, step):
            m = measure(th_im, lo_im, joints, d_th, d_sh)
            if m is None:
                continue
            out.append((d_th, d_sh, m[0], m[1], m[2]))
    return out


def despeck(buf, min_n=28):
    seen = np.zeros(buf.shape[:2], bool)
    m = buf[:, :, 3] > 30
    h, w = m.shape
    ys, xs = np.where(m)
    for y, x in zip(ys, xs):
        if seen[y, x]:
            continue
        stack = [(int(y), int(x))]
        seen[y, x] = True
        comp = []
        while stack:
            cy, cx = stack.pop()
            comp.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if len(comp) < min_n:
            for cy, cx in comp:
                buf[cy, cx, 3] = 0


def fill_holes(buf):
    m = buf[:, :, 3] > 30
    h, w = m.shape
    ys, xs = np.where(~m)
    for y, x in zip(ys.tolist(), xs.tolist()):
        if y < 1 or x < 1 or y >= h - 1 or x >= w - 1:
            continue
        nb = buf[y - 1:y + 2, x - 1:x + 2]
        op = nb[:, :, 3] > 30
        op[1, 1] = False
        if int(op.sum()) >= 5:
            buf[y, x] = np.median(nb[op], axis=0).astype(np.uint8)


def render_cycle(body, far_p, near_p, far_g, near_g):
    def at0(grid):
        return min(grid, key=lambda s: abs(s[0]) + abs(s[1]))

    ny0, fy0 = at0(near_g)[3], at0(far_g)[3]

    def span(grid):
        xs = [s[2] for s in grid]
        lo, hi = min(xs), max(xs)
        pad = (hi - lo) * 0.12
        return lo + pad, hi - pad

    nlo, nhi = span(near_g)
    flo, fhi = span(far_g)

    def pick(samples, x, y):
        return min(samples, key=lambda s: (s[2] - x) ** 2 * 4 + (s[3] - y) ** 2 * 8 + 0.012 * (s[0] ** 2 + s[1] ** 2))

    def path(lo, hi, phase, y0):
        p = phase % 1.0
        if p < 0.5:
            u = p / 0.5
            return hi + (lo - hi) * u, y0, True
        u = (p - 0.5) / 0.5
        return lo + (hi - lo) * u, y0 - math.sin(math.pi * u) * LIFT, False

    frames = []
    soles = []  # (near_rel_x, far_rel_x) of the solved sole, for the plant constant
    for i in range(N_WALK):
        p = i / N_WALK
        nx, ny, _ = path(nlo, nhi, p, ny0)
        fx, fy, _ = path(flo, fhi, p + 0.5, fy0)
        nb, fb = pick(near_g, nx, ny), pick(far_g, fx, fy)
        ox, oy = 60, int(round(150 - 144))
        legs = np.zeros((260, 280, 4), np.uint8)
        torso = np.zeros_like(legs)

        def stamp(best, joints, parts):
            d_th, d_sh, sx, sy, knee_off = best
            th_im, lo_im = parts
            th_r, th_p = rotate_about(th_im, joints['hip'], -d_th)
            lo_r, lo_p = rotate_about(lo_im, joints['knee'], -d_sh)
            hip = (joints['hip'][0] + ox, joints['hip'][1] + oy)
            knee = (hip[0] + knee_off[0], hip[1] + knee_off[1])
            paste_at(legs, lo_r, lo_p, knee)
            paste_at(legs, th_r, th_p, hip)
            return sx  # sole x relative to this leg's hip; chest tracking uses the composed sprite

        stamp(fb, FAR, far_p)
        stamp(nb, NEAR, near_p)
        paste_at(torso, Image.fromarray(body), (0, 0), (ox, oy))
        despeck(legs)
        ground = int(np.where(legs[:, :, 3] > 30)[0].max())
        top = int(np.where(torso[:, :, 3] > 30)[0].min())
        shift = int(round(ground - TARGET_H)) - top
        moved = np.zeros_like(torso)
        if 0 <= shift < torso.shape[0]:
            moved[shift:] = torso[:torso.shape[0] - shift]
        elif -torso.shape[0] < shift < 0:
            moved[:shift] = torso[-shift:]
        else:
            moved = torso
        buf = legs.copy()
        take = moved[:, :, 3] > 30
        buf[take] = moved[take]
        fill_holes(buf)
        despeck(buf)
        frames.append(buf)
        soles.append((nb[2], fb[2]))
    return frames, soles, (nhi - nlo)


def write():
    meta = json.load(open(META))
    H = meta['harambe']
    sheet = Image.open(os.path.join(ROOT, 'assets', H['img'])).convert('RGBA')
    fr = H['frames'][:N_ORIG]
    src_f = fr[4]
    src = np.array(sheet.crop((src_f['x'], src_f['y'], src_f['x'] + src_f['w'], src_f['y'] + src_f['h'])))
    body, far_p, near_p = cut_pieces(src)
    print('solving poses...')
    far_g = build_grid(*far_p, FAR)
    near_g = build_grid(*near_p, NEAR)
    frames, soles, near_span = render_cycle(body, far_p, near_p, far_g, near_g)

    # plant constant: the near (leading) sole travels `near_span` device px over half the cycle
    step_logic = (near_span / 3.0) / (N_WALK / 2)
    print('near sole travel %.1f device px/step -> WALK_PX %.3f logic px/frame' % (near_span, step_logic))
    for i, (nx, fx) in enumerate(soles):
        print('  frame %d near sole %+.1f far sole %+.1f' % (i, nx, fx))

    # crop each frame; anchor x is the upper-body centroid, anchor y the sole
    placed = []
    chest_xs = []
    for buf in frames:
        m = buf[:, :, 3] > 30
        ys, xs = np.where(m)
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
        crop = buf[y0:y1 + 1, x0:x1 + 1]
        # pivot x = mass centre of the upper body, in crop coordinates, so a facing flip stays put
        upper = crop[:int(crop.shape[0] * 0.62), :, 3] > 30
        cx = float(np.where(upper)[1].mean())
        placed.append(crop)
        chest_xs.append(cx)
    hs = [p.shape[0] for p in placed]
    print('frame heights', hs, 'chest anchors', [round(c, 1) for c in chest_xs])
    if max(hs) - min(hs) > 3:
        raise SystemExit('walk frames do not share a ground line (height spread %d)' % (max(hs) - min(hs)))

    y_cut = max(f['y'] + f['h'] for f in fr)
    base = sheet.crop((0, 0, sheet.size[0], y_cut))
    W = base.size[0]
    x, y, rowh = 0, y_cut + 4, 0
    boxes = []
    for crop in placed:
        im = Image.fromarray(crop)
        if x + im.size[0] > W:
            x = 0
            y += rowh + 2
            rowh = 0
        boxes.append((im, x, y))
        x += im.size[0] + 2
        rowh = max(rowh, im.size[1])
    big = Image.new('RGBA', (W, y + rowh + 2), (0, 0, 0, 0))
    big.paste(base, (0, 0))
    new = []
    for (im, px, py), ax in zip(boxes, chest_xs):
        big.paste(im, (px, py))
        new.append(dict(x=px, y=py, w=im.size[0], h=im.size[1], ax=int(round(ax)), ay=im.size[1]))
    H['frames'] = fr + new
    H['anims']['walk'] = list(range(N_ORIG, N_ORIG + N_WALK))
    big.save(os.path.join(ROOT, 'assets', H['img']))
    json.dump(meta, open(META, 'w'), separators=(',', ':'))
    print('wrote', N_WALK, 'walk frames at', N_ORIG, '..', N_ORIG + N_WALK - 1, 'sheet', big.size)


if __name__ == '__main__':
    write()
