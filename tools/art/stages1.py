from bgl import *

SKYH = 120
def new(w, h): return Canvas(w, h)

def clouds(cv, rng, n, ymin, ymax, base='#ffffff', shade='#b8c8f0'):
    pal = [C(shade), mix(C(shade), C(base), 0.5), C(base), C(base), C(base)]
    def one(ox):
        pass
    for i in range(n):
        x = (i + rng.random() * 0.6) * cv.w / n; y = rng.uniform(ymin, ymax); sc = rng.uniform(0.7, 1.3)
        for ox in (0, -cv.w, cv.w):
            for k in range(5):
                ellipse(cv, (x + ox + (k - 2) * 9 * sc, y + (abs(k - 2) * 2) * sc), 11 * sc, 6.5 * sc - abs(k - 2) * 0.8, pal, None)
            fill(cv, x + ox - 28 * sc, y + 4 * sc, x + ox + 28 * sc, y + 5 * sc, mix(C(shade), C(base), 0.2))

def hills(cv, rng, ybase, amp, cols, period=2, jag=0):
    pts = [(-4, cv.h)]
    for x in range(-4, cv.w + 5, 2):
        y = ybase + math.sin(x / cv.w * 2 * math.pi * period + 1.3) * amp + math.sin(x / cv.w * 2 * math.pi * period * 2.3) * amp * 0.4
        pts.append((x, y))
    pts.append((cv.w + 4, cv.h))
    m = fillpoly(cv, pts, cols[0])
    # dithered highlight band on top
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        top = ybase - amp * 1.5
    # shading: lighten the upper few pixels
    up = np.zeros_like(m)
    for k in range(1, 5):
        sh = np.zeros_like(m); sh[k:] = m[:-k]
        up |= m & ~sh & False
    mm = m.copy()
    for k in range(1, 6):
        sh = np.zeros_like(m); sh[k:] = m[:-k]
        band = m & ~sh
        cols_k = cols[1] if k <= 2 else cols[0]
        if k <= 3: cv.a[band, :3] = C(cols[1]) if k <= 2 else mix(C(cols[0]), C(cols[1]), 0.5)
    return m

# ----------------------------------------------------------------- ZOO
def zoo():
    rng = random.Random(11)
    L = {}
    # sky (static-ish): 640x120
    sky = new(640, SKYH)
    gradient(sky, 0, SKYH, ['#3f86e6', '#5aa4f2', '#86c6fa', '#b6e2fe', '#e0f4ff'])
    clouds(sky, rng, 6, 12, 46)
    L['sky'] = sky
    # far: hills + Cincinnati skyline haze
    far = new(640, SKYH)
    def sk(ox):
        # skyline silhouette in pale blue haze
        r = random.Random(5)
        x = 0
        while x < 640:
            w = r.randint(10, 22); h = r.randint(14, 40)
            col = '#9cb8e8' if r.random() < 0.6 else '#a8c2ee'
            fill(far, x + ox, 82 - h, x + ox + w, 90, col)
            fill(far, x + ox, 82 - h, x + ox + 1, 90, '#b8d0f4')
            for yy in range(86 - h, 88, 3):
                pass
            if r.random() < 0.25:  # spire
                fill(far, x + ox + w // 2, 82 - h - 8, x + ox + w // 2 + 1, 82 - h, '#9cb8e8')
            x += w + r.randint(0, 6)
    sk(0)
    # Carew-tower-ish art deco
    for ox in (0, 320):
        x0 = 150 + ox
        fill(far, x0, 38, x0 + 14, 90, '#a4bcea'); fill(far, x0 + 3, 28, x0 + 11, 38, '#a4bcea'); fill(far, x0 + 5, 20, x0 + 9, 28, '#a4bcea'); fill(far, x0 + 6, 12, x0 + 8, 20, '#a4bcea')
        fill(far, x0, 38, x0 + 1, 90, '#c0d6f6'); fill(far, x0 + 3, 28, x0 + 4, 38, '#c0d6f6')
        for yy in range(42, 88, 4): fill(far, x0 + 4, yy, x0 + 10, yy + 1, '#8aa6dc')
    hills(far, rng, 92, 7, [C('#4fa05a'), C('#7acb7a')], 2)
    hills(far, rng, 100, 6, [C('#2f8a46'), C('#58b868')], 3)
    L['far'] = far
    # mid: lush tree line 640x120, parallax .4
    mid = new(640, SKYH)
    pal = [make_ramp(c) for c in ('#1f7a3a', '#2a9448', '#175e30', '#37a856')]
    for ox in (0, -640, 640):
        for i in range(14):
            x = i * 46 + rng.randint(-6, 6) + ox; tree(mid, x, 112, rng.randint(46, 70), random.Random(i * 7 + 1), [rng.choice(pal) for _ in range(5)])
    for ox in (0, -640, 640):
        for i in range(10):
            bush(mid, i * 64 + 20 + ox, 114, 30, rng, [make_ramp('#2f9a48'), make_ramp('#43b45a')])
    L['mid'] = mid
    # near: zoo fence + habitat wall + sign, 960x120 scroll 1.0
    NW = 960
    near = new(NW, SKYH)
    brick = make_ramp('#b8654a'); stone = make_ramp('#b8b2a2', dk=0.5)
    # hedge behind fence
    hp = [make_ramp('#1d6a34'), make_ramp('#278a44'), make_ramp('#33a456')]
    for ox in (0, -NW, NW):
        for i in range(NW // 14):
            ellipse(near, (i * 14 + 6 + ox, 96 + (i * 5) % 7), 10, 12, hp[i % 3], (10, 40, 24))
    # fence: pillars every 120 + iron bars
    def fence(x0, x1):
        for x in range(x0 + 4, x1 - 4, 6):
            fill(near, x, 74, x + 2, 114, '#14141c'); fill(near, x, 74, x + 1, 114, '#3a3a4c')
            fillpoly(near, [(x - 1, 74), (x + 1, 69), (x + 3, 74)], '#14141c'); px(near, x, 72, (190, 190, 210))
        fill(near, x0, 80, x1, 83, '#14141c'); fill(near, x0, 80, x1, 81, '#4a4a60')
        fill(near, x0, 102, x1, 105, '#14141c'); fill(near, x0, 102, x1, 103, '#4a4a60')
    def pillar(x):
        mask = Canvas(NW, SKYH)
        rect(near, x - 9, 60, 18, 54, brick, (30, 14, 12))
        for yy in range(63, 112, 5):
            fill(near, x - 9, yy, x + 9, yy + 1, (112, 52, 40))
            for xx in range(x - 8 + (yy % 10) // 5 * 4, x + 9, 8): fill(near, xx, yy, xx + 1, yy + 5, (112, 52, 40))
        rect(near, x - 11, 54, 22, 7, stone, (24, 24, 30)); rect(near, x - 7, 49, 14, 5, stone, (24, 24, 30))
        ellipse(near, (x, 46), 4, 4, stone, (24, 24, 30))
        rect(near, x - 11, 108, 22, 6, stone, (24, 24, 30))
    def rockwall(x0, x1):
        rp = [make_ramp(c, dk=0.55) for c in ('#8a8a96', '#9a96a0', '#7a7a88', '#a8a4a6')]
        for i in range((x1 - x0) // 9 + 2):
            for j in range(6):
                ellipse(near, (x0 + i * 9 + (j % 2) * 4, 112 - j * 9), 8 + (i + j) % 3, 6, rp[(i * 3 + j) % 4], (30, 28, 40))
        # mossy patches
        for i in range(22):
            ellipse(near, (x0 + rng.randint(0, x1 - x0), 112 - rng.randint(0, 50)), 5, 3, make_ramp('#3a8a46'), None)
    # layout
    fence(0, 240); pillar(120)
    rockwall(260, 560)
    # sign on rock wall
    sx = 330
    rect(near, sx, 40, 160, 28, make_ramp('#4a2c18'), (14, 8, 6)); rect(near, sx + 3, 43, 154, 22, make_ramp('#e8d8a0'), (80, 56, 30))
    text(near, 'GORILLA WORLD', sx + 14, 49, '#5a2c14', 1)
    text(near, 'CINCINNATI ZOO', sx + 14, 58, '#2c6a3a', 1)
    fill(near, sx + 20, 68, sx + 24, 100, '#3a2412'); fill(near, sx + 136, 68, sx + 140, 100, '#3a2412')
    fence(560, 960); pillar(600); pillar(900)
    # banners
    for bx, c in ((60, '#e8c038'), (180, '#d8383c'), (700, '#38a8e8'), (800, '#e8c038')):
        fill(near, bx, 40, bx + 14, 41, '#222'); fillpoly(near, [(bx + 1, 41), (bx + 13, 41), (bx + 13, 62), (bx + 7, 57), (bx + 1, 62)], c)
        fill(near, bx + 6, 46, bx + 8, 53, '#2a1a10'); fill(near, bx + 4, 48, bx + 10, 50, '#2a1a10')
    # flowers
    for i in range(36):
        x = rng.randint(0, NW - 1); y = rng.randint(106, 113)
        col = rng.choice(['#ff5a8a', '#ffd23a', '#fff', '#ff8a3a']); px(near, x, y, C(col)); px(near, x, y + 1, (30, 90, 40))
    L['near'] = near
    # ground 320x68: brick pavers
    gr = new(320, 68)
    gradient(gr, 0, 68, ['#a48a64', '#b8a078', '#c8b088', '#b8a078'])
    paver = [(160, 134, 100), (176, 150, 112), (146, 120, 88)]
    # perspective brick rows (rows get taller toward viewer)
    y = 0; rh = 5
    while y < 68:
        for x in range(-30, 340, 1):
            pass
        fill(gr, 0, y, 320, y + 1, (110, 88, 62))
        off = (y // rh % 2) * (8 if y < 14 else 10 if y < 30 else 16 if y < 50 else 20)
        bwid = 16 if y < 14 else 20 if y < 30 else 32 if y < 50 else 40
        for x in range(-off, 320, bwid):
            fill(gr, x, y, x + 1, y + rh, (110, 88, 62))
        # tint some bricks
        for x in range(-off, 320, bwid):
            if rng.random() < 0.35: 
                c = rng.choice(paver); fill(gr, x + 1, y + 1, x + bwid, y + rh, c)
        y += rh; rh = min(10, rh + 1) if rng.random() < 0.5 else rh
    # top shadow & grass strip
    fill(gr, 0, 0, 320, 2, (70, 110, 60)); fill(gr, 0, 2, 320, 4, (96, 80, 58))
    for x in range(0, 320, 3):
        if rng.random() < .7: px(gr, x, 0, (90, 150, 70)); px(gr, x, 1, (60, 110, 50))
    L['ground'] = gr
    return L
