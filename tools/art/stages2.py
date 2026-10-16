from bgl import *
from stages1 import new, clouds, hills, SKYH

def brickwall(cv, x0, y0, x1, y1, base, mort, rng, var=14):
    fill(cv, x0, y0, x1, y1, base)
    b = C(base)
    for y in range(y0, y1, 4):
        fill(cv, x0, y, x1, y + 1, mort)
        off = ((y - y0) // 4 % 2) * 4
        for x in range(x0 + off, x1, 8): fill(cv, x, y, x + 1, y + 4, mort)
    for _ in range((x1 - x0) * (y1 - y0) // 14):
        x = rng.randrange(x0, x1); y = rng.randrange(y0, y1)
        d = rng.randint(-var, var); cv.a[y, x, :3] = [max(0, min(255, c + d)) for c in b]

def window(cv, x, y, w, h, lit, frame='#2a1a1a', glow='#ffd470', dark='#2a3a5a', rng=None):
    fill(cv, x - 1, y - 1, x + w + 1, y + h + 1, frame)
    if lit:
        gradient(cv, y, y + h, ['#ffe9a0', '#ffc860', '#e89a40'], x, x + w)
        fill(cv, x + w // 2, y, x + w // 2 + 1, y + h, frame)
        fill(cv, x, y + h // 2, x + w, y + h // 2 + 1, frame)
        if rng and rng.random() < 0.5: fill(cv, x + 1, y + 1, x + w // 2, y + 3, '#fff2c0')
    else:
        gradient(cv, y, y + h, ['#5a7aa8', '#3a527a', '#2a3a5a'], x, x + w)
        fill(cv, x + w // 2, y, x + w // 2 + 1, y + h, frame); fill(cv, x, y + h // 2, x + w, y + h // 2 + 1, frame)
        fill(cv, x + 1, y + 1, x + 3, y + 2, '#8aa6d0')
    fill(cv, x - 2, y + h + 1, x + w + 2, y + h + 2, '#b8a890'); fill(cv, x - 2, y - 2, x + w + 2, y - 1, '#b8a890')

# ----------------------------------------------------------------- STREET (Vine St at sunset)
def street():
    rng = random.Random(21); L = {}
    sky = new(640, SKYH)
    gradient(sky, 0, SKYH, ['#4a3a8a', '#8a4a9a', '#d8607a', '#ff8a5a', '#ffc070', '#ffe0a0'])
    # sun
    for ox in (0,):
        ellipse(sky, (420, 96), 24, 24, [C('#ff7a40'), C('#ff9a50'), C('#ffc060'), C('#ffe090'), C('#fff4c0')], None, dither=False)
    clouds(sky, rng, 5, 14, 50, base='#ffb090', shade='#9a508a')
    L['sky'] = sky
    far = new(640, SKYH)
    r = random.Random(3)
    for ox in (0, -640, 640):
        x = 0
        while x < 640:
            w = r.randint(14, 28); h = r.randint(30, 70)
            fill(far, x + ox, 112 - h, x + ox + w, 114, '#5a3a7a')
            fill(far, x + ox, 112 - h, x + ox + 1, 114, '#7a4a8a')
            for yy in range(112 - h + 4, 108, 6):
                for xx in range(x + 3, x + w - 2, 5):
                    if r.random() < 0.4: fill(far, xx + ox, yy, xx + ox + 2, yy + 3, '#ffcc66')
            if r.random() < 0.3: fill(far, x + ox + w // 2, 112 - h - 8, x + ox + w // 2 + 1, 112 - h, '#5a3a7a')
            x += w + r.randint(-2, 3)
        # art-deco tower
        tx = 200 + ox
        fill(far, tx, 28, tx + 18, 114, '#6a4a8a'); fill(far, tx + 3, 18, tx + 15, 28, '#6a4a8a'); fill(far, tx + 6, 8, tx + 12, 18, '#6a4a8a'); fill(far, tx + 8, 0, tx + 10, 8, '#6a4a8a')
        fill(far, tx, 28, tx + 2, 114, '#8a5a9a')
        for yy in range(34, 108, 5):
            for xx in range(tx + 3, tx + 16, 4): 
                if r.random() < 0.55: fill(far, xx, yy, xx + 2, yy + 2, '#ffcc66')
    L['far'] = far
    # mid: row houses, 640 wide
    mid = new(640, SKYH)
    cols = [('#8a3a30', '#5a2420'), ('#a85a3a', '#6a3424'), ('#7a4a5a', '#4a2a38'), ('#9a6a44', '#5e3c26'), ('#7a3030', '#4c1c1c')]
    x = 0
    r = random.Random(8)
    while x < 640 - 20:
        w = r.choice([44, 52, 60]); h = r.randint(58, 86); base, mort = r.choice(cols)
        wd = min(w, 640 - x)
        brickwall(mid, x, 112 - h, x + wd, 114, base, mort, r, 10)
        # cornice
        fill(mid, x - 1, 112 - h - 3, x + wd + 1, 112 - h + 1, '#d8c8a8'); fill(mid, x - 1, 112 - h - 3, x + wd + 1, 112 - h - 2, '#f4e8c8')
        for yy in range(112 - h + 8, 100, 17):
            for xx in range(x + 6, x + wd - 8, 15): window(mid, xx, yy, 8, 11, r.random() < 0.45, rng=r)
        # fire escape
        if r.random() < 0.5:
            fx = x + wd - 12
            for yy in range(112 - h + 14, 96, 17): fill(mid, fx - 2, yy + 12, fx + 10, yy + 13, '#101018'); 
            fill(mid, fx + 9, 112 - h + 14, fx + 10, 100, '#101018')
        x += wd + 1
    L['mid'] = mid
    # near: shop fronts 960
    NW = 960
    near = new(NW, SKYH)
    shops = [('DINER', '#d8383c', '#fff'), ('PIZZA', '#38a85a', '#fff'), ('RECORDS', '#3a5ac8', '#ffe060'), ('ZOO TOURS', '#e8a030', '#2a1a10'), ('CHILI', '#a83ac8', '#fff'), ('BOOKS', '#3a9aa8', '#fff')]
    x = 0; i = 0; r = random.Random(4)
    while x < NW:
        w = 160
        base = r.choice(['#7a3a30', '#8a5a3a', '#5a4a6a', '#6a3a3a'])
        brickwall(near, x, 64, x + w, 114, base, '#3a1a18', r, 12)
        nm, ac, tc = shops[i % len(shops)]
        # awning with stripes
        for k in range(0, w - 12, 8):
            fillpoly(near, [(x + 6 + k, 78), (x + 14 + k, 78), (x + 16 + k, 90), (x + 4 + k, 90)], ac if (k // 8) % 2 == 0 else '#f4f4f4')
        fill(near, x + 4, 76, x + w - 4, 78, '#201010')
        # shopfront window
        gradient(near, 92, 112, ['#ffe9a0', '#ffc860', '#d89040'], x + 12, x + w - 60)
        for k in range(x + 12, x + w - 60, 20): fill(near, k, 92, k + 1, 112, '#2a1a10')
        fill(near, x + 12, 92, x + w - 60, 93, '#2a1a10'); fill(near, x + 12, 111, x + w - 60, 114, '#2a1a10')
        # silhouettes in window
        for k in range(2):
            ellipse(near, (x + 28 + k * 36, 102), 4, 5, [C('#3a2a20')] * 5, None, dither=False); fill(near, x + 24 + k * 36, 106, x + 32 + k * 36, 112, '#3a2a20')
        # door
        fill(near, x + w - 48, 90, x + w - 20, 114, '#2a1a10'); gradient(near, 93, 112, ['#6a4a3a', '#4a2a1a'], x + w - 46, x + w - 22)
        fill(near, x + w - 30, 104, x + w - 28, 106, '#ffd23a')
        # sign
        fill(near, x + 14, 64, x + w - 14, 76, '#14141c'); fill(near, x + 16, 66, x + w - 16, 74, ac)
        text(near, nm, x + w // 2 - len(nm) * 3, 67, tc, 1, None)
        # neon glow dots
        i += 1; x += w
    # lamp posts
    for lx in (60, 380, 700, 900):
        fill(near, lx, 40, lx + 3, 114, '#14141c'); fill(near, lx, 40, lx + 1, 114, '#3a3a50')
        fill(near, lx - 8, 36, lx + 12, 39, '#14141c'); ellipse(near, (lx - 6, 42), 4, 4, [C('#ffe9a0')] * 5, (20, 16, 10), dither=False)
        fill(near, lx - 6, 43, lx - 5, 44, '#fff')
    # hydrant
    for hx in (250, 620): 
        capsule(near, (hx, 113), (hx, 104), 3.2, 3, make_ramp('#d83a2a'), (20, 8, 8)); ellipse(near, (hx, 103), 3.4, 2.4, make_ramp('#d83a2a'), (20, 8, 8)); fill(near, hx - 5, 107, hx + 5, 109, '#b02a20')
    L['near'] = near
    # ground: sidewalk strip + asphalt
    gr = new(320, 68)
    gradient(gr, 0, 68, ['#4a4a60', '#444458', '#3c3c50', '#383848'])
    # sidewalk
    fill(gr, 0, 0, 320, 14, '#a8a0b0'); 
    for x in range(0, 320, 20): fill(gr, x, 0, x + 1, 14, '#706878')
    fill(gr, 0, 7, 320, 8, '#8a8298'); fill(gr, 0, 14, 320, 17, '#e0d8e8'); fill(gr, 0, 17, 320, 19, '#2a2a3a')
    # asphalt specks & cracks
    for _ in range(500):
        x = rng.randrange(320); y = rng.randrange(20, 68); px(gr, x, y, rng.choice([(86, 86, 104), (52, 52, 66), (64, 64, 80)]))
    pts = [(40, 30), (52, 36), (60, 34), (72, 44)]
    for a, b in zip(pts, pts[1:]): line(gr, a, b, (26, 26, 36))
    # lane dashes
    for x in range(0, 320, 64): fill(gr, x + 8, 50, x + 40, 53, '#e8d84a'); fill(gr, x + 8, 50, x + 40, 51, '#fff09a'); fill(gr, x + 8, 53, x + 40, 54, '#a89a2a')
    L['ground'] = gr
    return L

# ----------------------------------------------------------------- RIVER (Ohio, Roebling Bridge)
def river():
    rng = random.Random(31); L = {}
    sky = new(640, SKYH)
    gradient(sky, 0, SKYH, ['#4c92ec', '#6cb0f4', '#98d0fa', '#c8eafe', '#f0fbff'])
    clouds(sky, rng, 7, 8, 52)
    L['sky'] = sky
    far = new(640, SKYH)
    hills(far, rng, 76, 8, [C('#3a7a8a'), C('#6aaab0')], 2)
    hills(far, rng, 84, 6, [C('#2c7a5a'), C('#58aa7a')], 3)
    # distant Kentucky bank with houses
    for ox in (0, -640, 640):
        for i in range(16):
            x = i * 40 + 10 + ox; h = 8 + (i * 5) % 8
            fill(far, x, 86 - h, x + 12, 90, '#d8c8a8'); fillpoly(far, [(x - 1, 86 - h), (x + 6, 80 - h), (x + 13, 86 - h)], '#a85040'); fill(far, x + 3, 86 - h + 3, x + 5, 86 - h + 6, '#5a7aa8')
    # water
    gradient(far, 90, 120, ['#3a8ac8', '#4a9ad8', '#2c78b8', '#2468a8'])
    for _ in range(300):
        x = rng.randrange(640); y = rng.randrange(92, 118)
        fill(far, x, y, x + rng.randint(2, 6), y + 1, rng.choice(['#8ad0f4', '#5aaae8', '#c8f0ff']))
    L['far'] = far
    mid = new(640, SKYH)
    # Roebling suspension bridge tile (period 640): one span w/ two stone towers
    stone = make_ramp('#a8987a', dk=0.55); st2 = make_ramp('#c0b090', dk=0.5)
    def tower(x):
        rect(mid, x - 9, 14, 7, 98, stone, (30, 24, 20)); rect(mid, x + 3, 14, 7, 98, stone, (30, 24, 20))
        rect(mid, x - 11, 8, 23, 7, st2, (30, 24, 20))
        fillpoly(mid, [(x - 2, 40), (x + 4, 40), (x + 4, 98), (x - 2, 98)], None)
        # gothic arch opening
        for yy in range(30, 70, 1):
            pass
        fill(mid, x - 2, 60, x + 4, 98, '#2c3c58'); ellipse(mid, (x + 1, 60), 3.2, 4, [C('#2c3c58')] * 5, None, dither=False)
        for yy in range(22, 98, 6): fill(mid, x - 9, yy, x - 2, yy + 1, '#7a6a52'); fill(mid, x + 3, yy, x + 10, yy + 1, '#7a6a52')
    towers = [100, 420]
    for t in towers: tower(t)
    # deck
    fill(mid, 0, 82, 640, 87, '#30343e'); fill(mid, 0, 82, 640, 83, '#6a707e'); fill(mid, 0, 87, 640, 89, '#1a1c26')
    for x in range(0, 640, 4): fill(mid, x, 83, x + 1, 87, '#4a4e5a')
    # truss under deck
    for x in range(0, 640, 12): line(mid, (x, 89), (x + 6, 96), (30, 34, 44)); line(mid, (x + 6, 96), (x + 12, 89), (30, 34, 44))
    fill(mid, 0, 96, 640, 97, '#30343e')
    # cables: catenary between towers (including wrap)
    spans = [(100, 420), (420, 740)]
    for (a, b) in spans:
        for x in range(a, b + 1):
            t = (x - a) / (b - a); y = 14 + 62 * (1 - 4 * t * (1 - t)) * 0.0 + (1 - 4 * (t - 0.5) ** 2) * 0 + (4 * (t - 0.5) ** 2) * 0
            # sag parabola: high at towers (y=12) low at middle (y=70)
            y = 70 - 58 * (2 * t - 1) ** 2
            xx = x % 640
            px(mid, xx, y, (30, 30, 40)); px(mid, xx, y - 1, (110, 110, 130))
            if x % 8 == 0: line(mid, (xx, y), (xx, 82), (60, 60, 76))
    # side spans (outer cables to bank) skip
    # moored barge
    L['mid'] = mid
    near = new(960, SKYH)
    NW = 960
    # stone river wall w/ railing + pilings + crates
    wall_y = 96
    brickwall(near, 0, wall_y, NW, 114, '#9a8c78', '#5a4e40', rng, 10)
    fill(near, 0, wall_y - 3, NW, wall_y + 1, '#d0c4a8'); fill(near, 0, wall_y - 3, NW, wall_y - 2, '#f0e8d0')
    for x in range(0, NW, 40):
        for yy in range(wall_y + 4, 114, 9): fill(near, x + (yy // 9 % 2) * 10, yy, x + 20 + (yy // 9 % 2) * 10, yy + 1, '#5a4e40')
    # railing & lamps
    for x in range(0, NW, 10):
        fill(near, x, wall_y - 12, x + 2, wall_y - 3, '#14141c')
    fill(near, 0, wall_y - 14, NW, wall_y - 12, '#14141c'); fill(near, 0, wall_y - 14, NW, wall_y - 13, '#5a5a70')
    for lx in (50, 290, 530, 770):
        fill(near, lx, wall_y - 38, lx + 3, wall_y - 3, '#14141c'); ellipse(near, (lx + 1, wall_y - 42), 4, 4, [C('#fff6c0')] * 5, (20, 16, 10), dither=False)
        fill(near, lx - 2, wall_y - 4, lx + 5, wall_y - 2, '#14141c')
    # ship moored (silhouette beyond wall at water): funnel boat
    def boat(x):
        fillpoly(near, [(x, 84), (x + 90, 84), (x + 80, 98), (x + 8, 98)], '#8a2a2a'); fill(near, x, 84, x + 90, 86, '#d8d0c0')
        fill(near, x + 20, 70, x + 70, 84, '#e8e0d0'); fill(near, x + 20, 70, x + 70, 72, '#a8a090')
        for k in range(5): fill(near, x + 24 + k * 9, 75, x + 29 + k * 9, 80, '#3a5a88')
        fill(near, x + 40, 56, x + 52, 70, '#d82a2a'); fill(near, x + 40, 56, x + 52, 59, '#14141c'); fill(near, x + 40, 56, x + 42, 70, '#f05a5a')
        for k in range(3): ellipse(near, (x + 48 + k * 5, 50 - k * 3), 5, 4, [C('#ccc'), C('#ddd'), C('#eee'), C('#f4f4f4'), C('#fff')], None, dither=True)
    boat(300)
    # crates & barrels stacks on the promenade
    def crate(x, y, w=18):
        wood = make_ramp('#a8743a', dk=0.6)
        rect(near, x, y - w, w, w, wood, (30, 18, 8)); line(near, (x + 1, y - w + 1), (x + w - 2, y - 2), (74, 44, 20)); line(near, (x + w - 2, y - w + 1), (x + 1, y - 2), (74, 44, 20))
    for cx in (130, 640):
        crate(cx, 114); crate(cx + 18, 114); crate(cx + 9, 96)
    for bx in (200, 860):
        for k in range(2):
            capsule(near, (bx + k * 13, 113), (bx + k * 13, 94), 6, 6, make_ramp('#4a6a8a'), (10, 16, 24)); fill(near, bx + k * 13 - 6, 98, bx + k * 13 + 6, 100, '#1a2430'); fill(near, bx + k * 13 - 6, 108, bx + k * 13 + 6, 110, '#1a2430')
    L['near'] = near
    gr = new(320, 68)
    gradient(gr, 0, 68, ['#8a7a6a', '#9a8a78', '#aa9a86', '#9a8a78'])
    # stone slabs
    y = 0; rh = 6
    while y < 68:
        fill(gr, 0, y, 320, y + 1, (84, 72, 62))
        bw = 20 if y < 20 else 32 if y < 44 else 40; off = ((y // 6) % 2) * (bw // 2)
        for x in range(-off, 320, bw): fill(gr, x, y, x + 1, y + rh, (84, 72, 62))
        for x in range(-off, 320, bw):
            if rng.random() < 0.3: fill(gr, x + 1, y + 1, x + bw, y + rh, rng.choice([(150, 134, 116), (166, 150, 130)]))
        y += rh; rh = min(10, rh + (1 if rng.random() < 0.4 else 0))
    for _ in range(200): px(gr, rng.randrange(320), rng.randrange(68), rng.choice([(70, 60, 54), (180, 164, 144)]))
    fill(gr, 0, 0, 320, 3, (60, 52, 46))
    L['ground'] = gr
    return L
