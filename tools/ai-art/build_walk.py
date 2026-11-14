#!/usr/bin/env python3
"""12-frame walk cycle for Harambe, posed from the idle contact drawing.

The painted sheet never moves its feet, and a per-pixel bend shreds the thick legs.
Each leg is three solid pieces (thigh, shin, foot) rotated rigidly about the hip,
knee and ankle, so the shading stays intact. The stance sole is kept on the ground
line by dropping the hips a few pixels as the foot slides back; the swing foot arcs
over it. Phase 0 is the idle pose itself (zero rotation, zero crouch), so standing
up and starting to walk don't pop.

  python3 tools/ai-art/build_walk.py            # /tmp preview + before/after gifs
  python3 tools/ai-art/build_walk.py --write    # atlas frames 24+ and harambe.walkPx

walkPx (logic px of body travel per frame) = stride_device / 6 / 3. js/sprites.js
reads that same number.
"""
import json, math, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
META = os.path.join(ROOT, 'assets', 'atlas.json')
N_ORIG, STEPS, S = 24, 12, 3
LIFT = 15          # swing-foot clearance, device px
TOE_UP = 18        # degrees the swing foot pitches up
MAX_CROUCH = 9     # how far the hips may drop to keep a straight leg on the ground
HIP_Y = 136        # leg pieces start here; the belly overlaps them and hides the socket
KNEE_OFF = 11      # rest-pose knee sits this far forward of the hip-ankle line, so the leg can bend
OVERLAP = 9


def load_idle():
    meta = json.load(open(META))
    H = meta['harambe']
    sheet = Image.open(os.path.join(ROOT, 'assets', H['img'])).convert('RGBA')
    f = H['frames'][0]
    im = np.array(sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])))
    return im


def _tan(im):
    rgb = im[:, :, :3].astype(int)
    return (im[:, :, 3] > 40) & (rgb[:, :, 0] > 145) & (rgb[:, :, 0] - rgb[:, :, 2] > 36)


def segment_legs(im):
    al = im[:, :, 3] > 40
    h, w = al.shape
    def lowest(x0, x1):
        ys, xs = np.where(al[:, x0:x1])
        i = int(ys.argmax())
        return int(xs[i] + x0), int(ys[i])
    seeds = [lowest(0, w // 2), lowest(w // 2, w)]
    INF = 10 ** 9
    dist = np.full((h, w, 2), INF, np.int32)
    q = deque()
    for si, (x, y) in enumerate(seeds):
        dist[y, x, si] = 0
        q.append((x, y, si))
    while q:
        x, y, si = q.popleft()
        base = int(dist[y, x, si])
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < HIP_Y or nx >= w or ny >= h or not al[ny, nx]:
                continue
            nd = base + 1
            if nd < dist[ny, nx, si]:
                dist[ny, nx, si] = nd
                q.append((nx, ny, si))
    far = np.zeros_like(al)
    near = np.zeros_like(al)
    yy, xx = np.where(al)
    for y, x in zip(yy.tolist(), xx.tolist()):
        if y < HIP_Y:
            continue
        d0, d1 = int(dist[y, x, 0]), int(dist[y, x, 1])
        if d0 == INF and d1 == INF:
            continue
        (far if d0 <= d1 else near)[y, x] = True
    return far, near


def _leg_points(mask, im, knee_sign):
    """Hip at the top of the thigh, ankle at the top of the foot, knee offset forward of that line."""
    ys, xs = np.where(mask)
    top = int(ys.min())
    band = np.where(mask[top:top + 8].any(0))[0]
    hip = (float(band.mean()), float(HIP_Y + 2))
    tan = _tan(im) & mask
    ty, tx = np.where(tan)
    ankle_y = float(np.percentile(ty, 15))
    ax = tx[ty <= ankle_y + 2]
    ankle = (float(ax.mean()), ankle_y)
    # toe = far end of the sole along the foot's long axis; heel is the other end
    foot = np.stack([tx, ty], 1).astype(float)
    foot -= foot.mean(0)
    _, evec = np.linalg.eigh(np.cov(foot.T))
    axis = evec[:, 1]
    proj = (tx - ax.mean()) * axis[0] + (ty - ankle_y) * axis[1]
    tip_i = int(np.argmax(proj))
    toe = (float(tx[tip_i]), float(ty[tip_i]))
    mid = ((hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2)
    dx, dy = ankle[0] - hip[0], ankle[1] - hip[1]
    L = math.hypot(dx, dy) or 1
    # perpendicular, flipped so the knee bulges forward (image +x for both legs facing right)
    px, py = -dy / L, dx / L
    if px < 0:
        px, py = -px, -py
    knee = (mid[0] + px * KNEE_OFF * knee_sign, mid[1] + py * KNEE_OFF * knee_sign)
    return hip, knee, ankle, toe


def _dist_point_seg(px, py, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy or 1
    t = max(0.0, min(1.0, ((px - a[0]) * dx + (py - a[1]) * dy) / L2))
    qx, qy = a[0] + dx * t, a[1] + dy * t
    return math.hypot(px - qx, py - qy), t


def split_pieces(mask, hip, knee, ankle, toe):
    """Thigh and shin+foot. The foot stays glued to the shin; splitting it off shears the long toes."""
    ys, xs = np.where(mask)
    thigh = np.zeros_like(mask)
    shin = np.zeros_like(mask)
    foot = np.zeros_like(mask)  # unused; kept so the stamp call is a no-op
    for y, x in zip(ys.tolist(), xs.tolist()):
        d_th, _ = _dist_point_seg(x, y, hip, knee)
        d_sh, _ = _dist_point_seg(x, y, knee, ankle)
        # the sole hangs past the ankle, so anything below the ankle belongs to the shin piece
        if y > ankle[1]:
            d_sh = min(d_sh, math.hypot(x - ankle[0], y - ankle[1]))
        d_knee = math.hypot(x - knee[0], y - knee[1])
        if d_th <= d_sh or d_knee < OVERLAP:
            thigh[y, x] = True
        if d_sh < d_th or d_knee < OVERLAP:
            shin[y, x] = True
    return thigh, shin, foot


def _ang(a, b):
    return math.atan2(b[1] - a[1], b[0] - a[0])


def _stamp(canvas, src, mask, pivot, delta, dest):
    """Rotate `mask` of `src` by `delta` radians about `pivot` and plant it on `dest`. Rigid, nearest, no holes."""
    if not mask.any():
        return
    if abs(delta) < 1e-7 and abs(dest[0] - pivot[0]) < 1e-7 and abs(dest[1] - pivot[1]) < 1e-7:
        canvas[mask] = src[mask]
        return
    c, s = math.cos(delta), math.sin(delta)
    ys, xs = np.where(mask)
    vx, vy = xs - pivot[0], ys - pivot[1]
    dx = dest[0] + c * vx - s * vy
    dy = dest[1] + s * vx + c * vy
    x0, x1 = int(math.floor(dx.min())) - 1, int(math.ceil(dx.max())) + 1
    y0, y1 = int(math.floor(dy.min())) - 1, int(math.ceil(dy.max())) + 1
    h, w = canvas.shape[:2]
    x0, x1 = max(0, x0), min(w - 1, x1)
    y0, y1 = max(0, y0), min(h - 1, y1)
    # inverse: source = pivot + R(-d) * (dest - dest_pivot)
    gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    rx, ry = gx - dest[0], gy - dest[1]
    sx = np.rint(pivot[0] + c * rx + s * ry).astype(int)
    sy = np.rint(pivot[1] - s * rx + c * ry).astype(int)
    sh, sw = mask.shape
    ok = (sx >= 0) & (sx < sw) & (sy >= 0) & (sy < sh)
    hit = np.zeros(ok.shape, bool)
    hit[ok] = mask[sy[ok], sx[ok]]
    if not hit.any():
        return
    canvas[y0:y1 + 1, x0:x1 + 1][hit] = src[sy[hit], sx[hit]]


def _ik(hip, ankle, L1, L2, bend):
    dx, dy = ankle[0] - hip[0], ankle[1] - hip[1]
    dist = math.hypot(dx, dy)
    maxd = max(abs(L1 - L2) + 0.5, min(dist, L1 + L2 - 0.5))
    if dist > 1e-6 and abs(dist - maxd) > 1e-3:
        dx, dy = dx * maxd / dist, dy * maxd / dist
        ankle = (hip[0] + dx, hip[1] + dy)
        dist = maxd
    dist = max(dist, abs(L1 - L2) + 0.5)
    base = math.atan2(dy, dx)
    cos_a = max(-1.0, min(1.0, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)))
    knee_ang = base + bend * math.acos(cos_a)
    knee = (hip[0] + math.cos(knee_ang) * L1, hip[1] + math.sin(knee_ang) * L1)
    return knee, ankle


def build_spec(im):
    far_m, near_m = segment_legs(im)
    legs = []
    for mask in (far_m, near_m):
        hip, knee, ankle, toe = _leg_points(mask, im, 1)
        thigh, shin, foot = split_pieces(mask, hip, knee, ankle, toe)
        L1 = math.hypot(knee[0] - hip[0], knee[1] - hip[1])
        L2 = math.hypot(ankle[0] - knee[0], ankle[1] - knee[1])
        cross = (ankle[0] - hip[0]) * (knee[1] - hip[1]) - (ankle[1] - hip[1]) * (knee[0] - hip[0])
        straight = math.hypot(ankle[0] - hip[0], ankle[1] - hip[1])
        legs.append(dict(
            hip=hip, knee=knee, ankle=ankle, toe=toe, mask=mask,
            thigh=thigh, shin=shin, foot=foot, L1=L1, L2=L2, reach=L1 + L2 - 0.75,
            bend=1.0 if cross > 0 else -1.0, straight=straight,
            src=(hip, knee, ankle, toe),
        ))
    # how far each ankle can slide toward the other foot before the crouch budget runs out
    travels = []
    for i, leg in enumerate(legs):
        other_x = legs[1 - i]['ankle'][0]
        direction = 1 if other_x > leg['ankle'][0] else -1
        H0 = leg['ankle'][1] - leg['hip'][1]
        best = 0
        for step in range(1, 90):
            x = leg['ankle'][0] + direction * step
            dx = abs(x - leg['hip'][0])
            dy = H0 - MAX_CROUCH
            if dy > 4 and math.hypot(dx, dy) <= leg['reach']:
                best = step
            else:
                break
        travels.append(best)
    # Bigger steps than this bend the knee hard enough to tear the thick painted legs.
    # Past this the knee bend tears the painted leg. 26 device px is one solid step.
    stride = float(min(min(travels), 26))
    body = (im[:, :, 3] > 40) & ~far_m & ~near_m
    # overlap the belly onto the top of the thighs so the socket never opens
    belly = (im[:, :, 3] > 40) & (np.arange(im.shape[0])[:, None] < HIP_Y + 14)
    body = body | belly
    return dict(im=im, legs=legs, stride=stride, body=body, travels=travels)


def _foot_x(rest, travel, phase, swing_first):
    """Ankle x and whether this foot is in the air. Stance x is linear in phase so it locks to the ground."""
    t = phase % 1.0
    if swing_first:
        if t < 0.5:
            u = t / 0.5
            s = 0.5 - 0.5 * math.cos(math.pi * u)
            return rest + travel * s, True, u
        u = (t - 0.5) / 0.5
        return rest + travel * (1.0 - u), False, u
    if t < 0.5:
        u = t / 0.5
        return rest + travel * u, False, u
    u = (t - 0.5) / 0.5
    s = 0.5 - 0.5 * math.cos(math.pi * u)
    return rest + travel * (1.0 - s), True, u


def _crouch(leg, ankle_x):
    """Hip drop that lets a full-length leg keep this ankle on the ground. 0 at the idle stance."""
    dx = abs(ankle_x - leg['hip'][0])
    R = leg['reach']
    if dx >= R:
        return float(MAX_CROUCH)
    dy = math.sqrt(R * R - dx * dx)
    return max(0.0, min(float(MAX_CROUCH), (leg['ankle'][1] - dy) - leg['hip'][1]))


def pose(spec, phase):
    """Per leg: hip, knee, ankle, toe, swinging?. Hips share the stance leg's crouch."""
    stride = spec['stride']
    xs, swings, us = [], [], []
    for i, leg in enumerate(spec['legs']):
        travel = stride if i == 0 else -stride
        x, swinging, u = _foot_x(leg['ankle'][0], travel, phase, i == 0)
        xs.append(x); swings.append(swinging); us.append(u)
    # the foot that is planted decides how deep the hips sit
    crouch = 0.0
    for i, leg in enumerate(spec['legs']):
        if not swings[i]:
            crouch = max(crouch, _crouch(leg, xs[i]))
    out = []
    for i, leg in enumerate(spec['legs']):
        hip = (leg['hip'][0], leg['hip'][1] + crouch)
        ay = leg['ankle'][1] - (LIFT * math.sin(math.pi * us[i]) if swings[i] else 0.0)
        knee, ankle = _ik(hip, (xs[i], ay), leg['L1'], leg['L2'], leg['bend'])
        # keep the foot's rest angle on the ground; pitch the toes up only while swinging
        src_foot = _ang(leg['ankle'], leg['toe'])
        extra = (-math.radians(TOE_UP) * math.sin(math.pi * us[i])) if swings[i] else 0.0
        # trail foot's toes point back-ish; pitch them up, which is the opposite rotation of the lead foot
        if i == 0:
            extra = -extra
        fv = leg['toe'][0] - leg['ankle'][0], leg['toe'][1] - leg['ankle'][1]
        c, s = math.cos(extra), math.sin(extra)
        toe = (ankle[0] + c * fv[0] - s * fv[1], ankle[1] + s * fv[0] + c * fv[1])
        out.append(dict(hip=hip, knee=knee, ankle=ankle, toe=toe, swing=swings[i], crouch=crouch))
    return out, crouch


def _joint_cap(canvas, src, mask, joint, dest, delta, radius):
    """Disc of the original limb around a joint, rotated with the bend, so the outside of the knee can't open."""
    yy, xx = np.mgrid[0:mask.shape[0], 0:mask.shape[1]]
    disc = mask & ((xx - joint[0]) ** 2 + (yy - joint[1]) ** 2 <= radius * radius)
    _stamp(canvas, src, disc, joint, delta, dest)


def _draw_leg(canvas, src, leg, pose_l):
    hip0, knee0, ankle0 = leg['src'][0], leg['src'][1], leg['src'][2]
    d_thigh = _ang(pose_l['hip'], pose_l['knee']) - _ang(hip0, knee0)
    d_shin = _ang(pose_l['knee'], pose_l['ankle']) - _ang(knee0, ankle0)
    _stamp(canvas, src, leg['thigh'], hip0, d_thigh, pose_l['hip'])
    _stamp(canvas, src, leg['shin'], knee0, d_shin, pose_l['knee'])
    # the outside of a bent knee opens; a disc of the original joint closes it
    _joint_cap(canvas, src, leg['mask'], knee0, pose_l['knee'], (d_thigh + d_shin) / 2, 15)


def _plant_sole(buf, limit):
    """Compress any column that hangs below the idle sole back up onto that row."""
    al = buf[:, :, 3] > 20
    h, w = al.shape
    for x in range(w):
        ys = np.where(al[:, x])[0]
        if len(ys) == 0 or ys[-1] <= limit:
            continue
        low = int(ys[-1])
        excess = low - limit
        src_start = max(0, limit - excess)
        span = low - src_start
        if span <= 0:
            continue
        col = buf[:, x].copy()
        buf[src_start:low + 1, x] = 0
        for y in range(src_start, low + 1):
            if col[y, 3] <= 20:
                continue
            ny = src_start + int(round((y - src_start) * (limit - src_start) / span))
            buf[min(limit, ny), x] = col[y]


def render_frame(spec, phase, pw, ph, origin):
    canvas = np.zeros((ph, pw, 4), np.uint8)
    ox, oy = origin
    posed, crouch = pose(spec, phase)
    src = spec['im']
    # pad so a foot that swings past the idle silhouette isn't clipped
    pad = 40
    bh, bw = src.shape[0] + pad * 2, src.shape[1] + pad * 2
    buf = np.zeros((bh, bw, 4), np.uint8)
    def shift(p):
        return (p[0] + pad, p[1] + pad)
    for leg, pl in zip(spec['legs'], posed):
        moved = dict(pl)
        moved['hip'], moved['knee'], moved['ankle'], moved['toe'] = shift(pl['hip']), shift(pl['knee']), shift(pl['ankle']), shift(pl['toe'])
        _draw_leg(buf, src, leg, moved)
    by = int(round(crouch))
    ys, xs = np.where(spec['body'])
    for y, x in zip(ys.tolist(), xs.tolist()):
        dy, dx = y + by + pad, x + pad
        if 0 <= dy < bh and 0 <= dx < bw:
            buf[dy, dx] = src[y, x]
    # a rotated sole can poke a few pixels through the ground line; squash just that tip back onto it
    _plant_sole(buf, pad + int(np.where(src[:, :, 3] > 40)[0].max()))
    # source (0,0) lands at (ox, oy); the pad cancels
    y0, x0 = oy - pad, ox - pad
    canvas[y0:y0 + bh, x0:x0 + bw] = buf
    return canvas, crouch


def compose(spec):
    im = spec['im']
    h, w = im.shape[:2]
    pad = 40
    PW, PH = w + pad * 2 + 24, h + pad * 2 + 24
    OX, OY = pad + 12, pad + 10
    bot = int(np.where(im[:, :, 3] > 40)[0].max())
    ground = OY + bot + 1
    chest = float(np.where((im[:, :, 3] > 40)[:int(h * 0.6)])[1].mean())
    frames = []
    crouches = []
    for k in range(STEPS):
        canvas, crouch = render_frame(spec, k / STEPS, PW, PH, (OX, OY))
        frames.append(canvas)
        crouches.append(crouch)
    return frames, dict(ox=OX, oy=OY, ground=ground, anchor_x=OX + chest, chest=chest), crouches


def to_boxes(frames, info):
    boxes = []
    for canvas in frames:
        al = canvas[:, :, 3] > 20
        ys, xs = np.where(al)
        y0, y1 = int(ys.min()), int(ys.max())
        x0, x1 = int(xs.min()), int(xs.max())
        crop = canvas[y0:y1 + 1, x0:x1 + 1]
        boxes.append((Image.fromarray(crop, 'RGBA'), info['anchor_x'] - x0, info['ground'] - y0))
    return boxes


def stance_drift(spec, info):
    """World x of each posed stance ankle while the body advances one stride over the half-cycle."""
    step = spec['stride'] / 6.0
    drifts = []
    for leg_i, half in ((1, 0), (0, 1)):
        xs = []
        for k in range(half * 6, half * 6 + 6):
            posed, _ = pose(spec, k / STEPS)
            pl = posed[leg_i]
            if pl['swing']:
                continue
            body = k * step
            # ankle canvas x relative to the chest anchor; body motion cancels a linear stance
            xs.append(body + (pl['ankle'][0] + info['ox'] - info['anchor_x']))
        if xs:
            drifts.append(max(xs) - min(xs))
    return max(drifts) if drifts else 0.0, drifts


def write_atlas(boxes, spec):
    meta = json.load(open(META))
    H = meta['harambe']
    img = Image.open(os.path.join(ROOT, 'assets', H['img'])).convert('RGBA')
    fr = H['frames'][:N_ORIG]
    top = max(f['y'] + f['h'] for f in fr) + 2
    W = img.size[0]
    y, x, rowh = top + 2, 0, 0
    pos = []
    for im, ax, ay in boxes:
        if x and x + im.size[0] > W:
            x = 0
            y += rowh + 2
            rowh = 0
        pos.append((x, y))
        x += im.size[0] + 2
        rowh = max(rowh, im.size[1])
    base = Image.new('RGBA', (W, y + rowh + 2), (0, 0, 0, 0))
    base.paste(img.crop((0, 0, W, min(top, img.size[1]))), (0, 0))
    new = []
    for (im, ax, ay), (px, py) in zip(boxes, pos):
        base.paste(im, (px, py))
        new.append(dict(x=px, y=py, w=im.size[0], h=im.size[1], ax=int(round(ax)), ay=int(round(ay))))
    H['frames'] = fr + new
    H['anims']['walk'] = list(range(N_ORIG, N_ORIG + STEPS))
    H['walkPx'] = spec['stride'] / 6.0 / S
    base.save(os.path.join(ROOT, 'assets', H['img']), optimize=True)
    json.dump(meta, open(META, 'w'), separators=(',', ':'))
    return H['walkPx']


def _gif(boxes, walk_px, path, seconds=2.4, fps=20):
    dev = walk_px * S
    speed = 82 * S
    n = int(seconds * fps)
    gw, gh = 300, 240
    ground_y, anchor_x = 208, 140
    out = []
    spacing = max(6, int(round(dev)))
    for i in range(n):
        dist = speed * (i / fps)
        idx = int(dist / dev) % STEPS
        im, ax, ay = boxes[idx]
        canvas = Image.new('RGBA', (gw, gh), (30, 34, 40, 255))
        dr = ImageDraw.Draw(canvas)
        x = -(dist % spacing)
        while x < gw:
            dr.line([(x, ground_y - 36), (x, ground_y + 8)], fill=(50, 56, 64, 255))
            x += spacing
        dr.line([(0, ground_y), (gw, ground_y)], fill=(86, 196, 108, 255))
        canvas.alpha_composite(im, (int(round(anchor_x - ax)), int(round(ground_y - ay))))
        out.append(canvas.convert('P', palette=Image.ADAPTIVE, colors=64))
    out[0].save(path, save_all=True, append_images=out[1:], duration=int(1000 / fps), loop=0, disposal=2)


def render_before():
    meta = json.load(open(META))
    H = meta['harambe']
    sheet = Image.open(os.path.join(ROOT, 'assets', H['img'])).convert('RGBA')
    boxes = []
    for i in H['anims']['walk']:
        f = H['frames'][i]
        boxes.append((sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])), f['ax'], f['ay']))
    if len(boxes) == STEPS:
        _gif(boxes, 20 / 6, '/tmp/walk_before.gif')


def preview(spec, boxes, crouches, drift):
    cell_w, cell_h = 190, 240
    sheet = Image.new('RGB', (cell_w * 6, cell_h * 2), (26, 28, 34))
    dr = ImageDraw.Draw(sheet)
    for k, (im, ax, ay) in enumerate(boxes):
        c, r = k % 6, k // 6
        bg = Image.new('RGBA', (cell_w, cell_h), (26, 28, 34, 255))
        bg.alpha_composite(im, (int(95 - ax), int(214 - ay)))
        sheet.paste(bg.convert('RGB'), (c * cell_w, r * cell_h))
        dr.line([(c * cell_w + 6, r * cell_h + 214), (c * cell_w + cell_w - 6, r * cell_h + 214)], fill=(80, 210, 90))
        dr.line([(c * cell_w + 95, r * cell_h + 204), (c * cell_w + 95, r * cell_h + 222)], fill=(220, 64, 64))
        dr.text((c * cell_w + 4, r * cell_h + 4), f'k={k} c={crouches[k]:.0f}', fill=(235, 235, 235))
    sheet.save('/tmp/walk_after_contact.png')
    walk_px = spec['stride'] / 6.0 / S
    _gif(boxes, walk_px, '/tmp/walk_after.gif')
    # source joints
    dbg = Image.fromarray(spec['im']).convert('RGB')
    d = ImageDraw.Draw(dbg)
    for leg, col in zip(spec['legs'], ((70, 170, 255), (255, 170, 50))):
        pts = [leg['hip'], leg['knee'], leg['ankle'], leg['toe']]
        d.line(pts, fill=col, width=1)
        for p in pts:
            d.ellipse((p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2), fill=col)
    dbg.resize((dbg.size[0] * 2, dbg.size[1] * 2), Image.NEAREST).save('/tmp/walk_joints.png')
    print(f'stride {spec["stride"]:.0f}px  walkPx {walk_px:.4f}  drift {drift:.2f}px  travels {spec["travels"]}')
    for i, leg in enumerate(spec['legs']):
        print(f'  leg{i} hip=({leg["hip"][0]:.0f},{leg["hip"][1]:.0f}) knee=({leg["knee"][0]:.0f},{leg["knee"][1]:.0f}) '
              f'ankle=({leg["ankle"][0]:.0f},{leg["ankle"][1]:.0f}) reach={leg["reach"]:.1f} straight={leg["straight"]:.1f} bend={leg["bend"]}')
    axs = [a for _, a, _ in boxes]
    ays = [a for _, _, a in boxes]
    hs = [im.size[1] for im, _, _ in boxes]
    print(f'  ax {min(axs):.0f}..{max(axs):.0f}  ay {min(ays):.0f}..{max(ays):.0f}  h {min(hs)}..{max(hs)}  crouch {min(crouches):.1f}..{max(crouches):.1f}')


def frame0_diff(spec, frames, info):
    """How many pixels frame 0 disagrees with the idle drawing. Should be ~0."""
    im = spec['im']
    canvas = frames[0]
    ox, oy = info['ox'], info['oy']
    h, w = im.shape[:2]
    got = canvas[oy:oy + h, ox:ox + w]
    src_a = im[:, :, 3] > 40
    got_a = got[:, :, 3] > 40
    xor = np.logical_xor(src_a, got_a).sum()
    both = src_a & got_a
    col = (np.abs(im[:, :, :3].astype(int) - got[:, :, :3].astype(int)).sum(2)[both] > 24).sum()
    return int(xor + col)


def main():
    render_before()
    im = load_idle()
    spec = build_spec(im)
    frames, info, crouches = compose(spec)
    boxes = to_boxes(frames, info)
    drift, parts = stance_drift(spec, info)
    diff = frame0_diff(spec, frames, info)
    preview(spec, boxes, crouches, drift)
    print(f'frame0 diff {diff}px  stance drifts { [round(d, 2) for d in parts] }')
    if '--write' in sys.argv:
        if drift > 3:
            raise SystemExit(f'stance foot drifts {drift:.1f}px')
        if diff > 400:
            raise SystemExit(f'contact pose disagrees with idle by {diff}px')
        print('wrote walkPx', round(write_atlas(boxes, spec), 4))


if __name__ == '__main__':
    main()
