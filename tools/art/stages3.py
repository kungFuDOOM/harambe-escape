from bgl import *
from stages1 import new, clouds, hills, SKYH, tree
from stages2 import brickwall

def pine(cv, x, yb, h, pal):
    for k in range(5):
        w = h * (0.14 + 0.1 * k / 4) * 1.6; y = yb - h * (0.15 + k * 0.17)
        fillpoly(cv, [(x - w, y), (x + w, y), (x, y - h * 0.3)], pal[min(len(pal) - 1, k % 2)])
    fill(cv, x - 1, yb - 3, x + 1, yb, pal[0])

# ----------------------------------------------------------------- NIGHT (Kentucky backroads)
def night():
    rng = random.Random(41); L = {}
    sky = new(640, SKYH)
    gradient(sky, 0, SKYH, ['#06081c', '#0c1236', '#141c4e', '#1e2a66', '#2e3c82'])
    for _ in range(190):
        x = rng.randrange(640); y = rng.randrange(0, 80) ; c = rng.choice([(255, 255, 255), (200, 220, 255), (255, 240, 200), (140, 160, 220)])
        px(sky, x, y, c)
        if rng.random() < 0.08: px(sky, x + 1, y, c); px(sky, x - 1, y, c); px(sky, x, y + 1, c); px(sky, x, y - 1, c)
    # moon with glow (single, in the first 320)
    for r_, a in ((34, 18), (28, 28), (22, 44)):
        for yy in range(-r_, r_ + 1):
            for xx in range(-r_, r_ + 1):
                if xx * xx + yy * yy <= r_ * r_ and (xx + yy) % 2 == 0:
                    X, Y = 220 + xx, 34 + yy
                    c = sky.a[Y, X, :3].astype(int); sky.a[Y, X, :3] = np.clip(c + a, 0, 255)
    ellipse(sky, (220, 34), 13, 13, [C('#c8c8b8'), C('#e8e4c8'), C('#f6f2d8'), C('#fffbe8'), C('#ffffff')], None, dither=True)
    for cx, cy, r in ((216, 30, 3), (224, 38, 2), (222, 28, 1.5)): ellipse(sky, (cx, cy), r, r, [C('#b0ae98')] * 5, None, dither=False)
    clouds(sky, rng, 3, 12, 40, base='#4a5a9a', shade='#1a2250')
    L['sky'] = sky
    far = new(640, SKYH)
    hills(far, rng, 78, 8, [C('#141c4a'), C('#222e6a')], 2)
    hills(far, rng, 90, 7, [C('#0e1638'), C('#18255a')], 3)
    pal = [C('#0a1230'), C('#14204a')]
    for ox in (0, -640, 640):
        for i in range(30): pine(far, i * 22 + ox + rng.randint(-4, 4), 108, rng.randint(18, 34), pal)
    L['far'] = far
    mid = new(640, SKYH)
    # barn + silo + windmill on rolling hills
    hills(mid, rng, 96, 4, [C('#0e2a3a'), C('#1c4a56')], 2)
    def barn(x, y):
        red = make_ramp('#8a2a28', dk=0.7)
        rect(mid, x, y - 28, 42, 28, red, (14, 6, 8))
        fillpoly(mid, [(x - 3, y - 28), (x + 21, y - 46), (x + 45, y - 28)], '#4a1414'); fillpoly(mid, [(x - 3, y - 28), (x + 21, y - 46), (x + 21, y - 28)], '#5e1a1a')
        for xx in range(x + 3, x + 42, 4): fill(mid, xx, y - 27, xx + 1, y, (60, 14, 14))
        fill(mid, x + 14, y - 18, x + 28, y, '#2a0a0a'); line(mid, (x + 14, y - 18), (x + 28, y), (200, 180, 140)); line(mid, (x + 28, y - 18), (x + 14, y), (200, 180, 140)); 
        fill(mid, x + 14, y - 18, x + 28, y - 17, (200, 180, 140)); fill(mid, x + 14, y - 1, x + 28, y, (200, 180, 140))
        fill(mid, x + 17, y - 38, x + 25, y - 32, '#ffd470'); fill(mid, x + 20, y - 38, x + 21, y - 32, '#3a1010')
        capsule(mid, (x + 52, y), (x + 52, y - 44), 8, 8, make_ramp('#9aa0a8', dk=0.7), (10, 10, 20)); ellipse(mid, (x + 52, y - 46), 8, 5, make_ramp('#a8b0b8', dk=0.7), (10, 10, 20))
    barn(210, 110)
    # windmill
    mx = 480
    fillpoly(mid, [(mx - 5, 112), (mx + 5, 112), (mx + 2, 66), (mx - 2, 66)], '#10162a')
    for a in (0.4, 1.5, 2.6, 3.7, 4.8, 5.9):
        line(mid, (mx, 66), (mx + math.cos(a) * 16, 66 + math.sin(a) * 16), (30, 40, 70))
    # fence + glowing farmhouse windows
    L['mid'] = mid
    NW = 960
    near = new(NW, SKYH)
    # corn field / bushes row
    cp = [make_ramp('#1c4a3a', dk=0.7), make_ramp('#245a44', dk=0.7), make_ramp('#1a3e30', dk=0.7)]
    for ox in (0, -NW, NW):
        for i in range(NW // 12):
            ellipse(near, (i * 12 + 6 + ox, 98 + (i * 7) % 5), 9, 11, cp[i % 3], (6, 14, 14))
    # tall corn stalks with highlights
    for i in range(70):
        x = rng.randrange(NW); h = rng.randint(34, 52)
        fill(near, x, 112 - h, x + 1, 114, '#2a6a4a'); 
        for k in range(4):
            line(near, (x, 112 - h + 8 + k * 8), (x + (6 if k % 2 else -6), 112 - h + 3 + k * 8), (60, 130, 90))
        fill(near, x - 1, 112 - h - 2, x + 2, 112 - h + 1, '#c8b04a')
    # wooden fence
    wood = make_ramp('#7a5a3a', dk=0.6)
    for x in range(0, NW, 40):
        rect(near, x, 78, 6, 36, wood, (14, 8, 4))
    for yy in (86, 100): rect(near, 0, yy, NW, 5, wood, (14, 8, 4))
    # telephone poles with wires
    for px_ in (100, 420, 740):
        rect(near, px_, 20, 5, 94, make_ramp('#5a3a22', dk=0.6), (10, 6, 4)); rect(near, px_ - 8, 26, 21, 4, make_ramp('#5a3a22', dk=0.6), (10, 6, 4))
        for dx in (-7, 11): fill(near, px_ + dx, 22, px_ + dx + 2, 26, '#9a9aa8')
    for a, b in ((100, 420), (420, 740), (740, 1060)):
        for x in range(a, b):
            t = (x - a) / (b - a); y = 25 + 12 * 4 * t * (1 - t)
            for dx in (-7, 11): px(near, (x + dx) % NW, y, (14, 14, 22))
    # road sign
    sx = 560
    fill(near, sx + 20, 70, sx + 23, 114, '#2a2a34'); rect(near, sx, 52, 46, 20, make_ramp('#1a6a3a', dk=0.6), (240, 240, 240))
    text(near, 'KENTUCKY', sx + 4, 56, '#ffffff', 1); text(near, 'HOME >>', sx + 8, 64, '#ffe060', 1)
    # fireflies baked dots
    for _ in range(24): px(near, rng.randrange(NW), rng.randrange(70, 108), (200, 255, 120))
    L['near'] = near
    gr = new(320, 68)
    gradient(gr, 0, 68, ['#3a3040', '#4a3c46', '#5a4a50', '#4e4048'])
    # grass strip & road
    for x in range(320):
        h = 2 + (x * 7 % 5)
        fill(gr, x, 0, x + 1, h, '#1a4a30')
    fill(gr, 0, 0, 320, 2, '#10301e')
    for _ in range(700): px(gr, rng.randrange(320), rng.randrange(6, 68), rng.choice([(110, 96, 100), (36, 30, 38), (130, 116, 118), (70, 60, 66)]))
    # tire ruts
    for yy in (22, 50):
        fill(gr, 0, yy, 320, yy + 3, (58, 48, 54)); fill(gr, 0, yy, 320, yy + 1, (40, 32, 38))
    # puddle with moon
    ellipse(gr, (200, 36), 22, 6, [C('#14204a'), C('#1e2e66'), C('#2c3e86'), C('#5a6ab0'), C('#c8d0f0')], (10, 14, 40), dither=True)
    # stones
    for _ in range(30):
        x = rng.randrange(320); y = rng.randrange(8, 66)
        for ox in (0, -320, 320): ellipse(gr, (x + ox, y), 2, 1.3, make_ramp('#8a8088'), None)
    L['ground'] = gr
    return L

# ----------------------------------------------------------------- JUNGLE
def leaf(cv, x, y, ang, ln, w, pal):
    ex, ey = x + math.cos(ang) * ln, y + math.sin(ang) * ln
    capsule(cv, (x, y), (ex, ey), w, 0.6, pal, (8, 30, 22))

def fern(cv, x, y, n, ln, rng, pal):
    for i in range(n):
        a = -math.pi / 2 + (i - (n - 1) / 2) * 0.42 + rng.uniform(-0.05, 0.05)
        leaf(cv, x, y, a, ln * rng.uniform(0.8, 1.1), ln * 0.14, pal[i % len(pal)])

def jungle():
    rng = random.Random(51); L = {}
    sky = new(640, SKYH)
    gradient(sky, 0, SKYH, ['#0e4a46', '#1a6a52', '#2a8a5a', '#58aa6a', '#9ad088'])
    L['sky'] = sky
    far = new(640, SKYH)
    # misty canopy layers
    for (yb, col, am) in ((70, '#2a7a62', 9), (84, '#1e6a52', 8), (98, '#17594a', 7)):
        pts = [(-4, 120)]
        for x in range(-4, 645, 3):
            pts.append((x, yb + math.sin(x / 640 * 6.283 * 4) * am + math.sin(x / 640 * 6.283 * 9 + 1) * 3))
        pts.append((644, 120)); m = fillpoly(far, pts, col)
        # leafy dither top
        for k in range(1, 4):
            sh = np.zeros_like(m); sh[k:] = m[:-k]; band = m & ~sh
            ys, xs = np.nonzero(band)
            for y, x in zip(ys, xs):
                if B4[y & 3, x & 3] < 0.6: far.a[y, x, :3] = mix(C(col), (200, 240, 190), 0.25)
    # mist
    for y in range(80, 118):
        for x in range(640):
            if B4[y & 3, x & 3] < (y - 80) / 70 * 0.45 and far.a[y, x, 3]: far.a[y, x, :3] = mix(far.a[y, x, :3].astype(int).tolist(), (190, 230, 200), 0.35)
    # distant mountain with waterfall (home)
    L['far'] = far
    mid = new(640, SKYH)
    pal = [make_ramp(c) for c in ('#1f7a3a', '#2a9448', '#175e30', '#37a856', '#2a8a5a')]
    for ox in (0, -640, 640):
        for i in range(8):
            x = i * 82 + 20 + ox + rng.randint(-8, 8); h = rng.randint(70, 100)
            # trunk
            tr = make_ramp('#5a3e22', dk=0.65)
            capsule(mid, (x, 114), (x + rng.uniform(-3, 3), 18), 7, 4.5, tr, (14, 8, 6))
            for yy in range(30, 112, 7):
                line(mid, (x - 3, yy), (x - 1, yy + 4), tr[1])
            # canopy blobs
            for k in range(6):
                ellipse(mid, (x + rng.randint(-26, 26), 14 + rng.randint(-8, 14)), rng.randint(18, 28), rng.randint(10, 16), rng.choice(pal), (6, 36, 22))
            # vines
            for k in range(3):
                vx = x + rng.randint(-20, 20); vl = rng.randint(30, 60)
                for yy in range(22, 22 + vl):
                    px(mid, vx + math.sin(yy * 0.2 + k) * 1.5, yy, (30, 110, 50)); 
                    if yy % 9 == 0: ellipse(mid, (vx + math.sin(yy * 0.2 + k) * 1.5, yy), 2.2, 1.6, make_ramp('#3aa25a'), None)
    # ferns at base
    for ox in (0, -640, 640):
        for i in range(12):
            fern(mid, i * 53 + 10 + ox, 114, 7, rng.randint(18, 28), rng, [make_ramp('#2f9a4a'), make_ramp('#43b45a')])
    L['mid'] = mid
    NW = 960
    near = new(NW, SKYH)
    # big foreground roots / rocks / foliage / flowers
    for ox in (0, -NW, NW):
        for i in range(10):
            x = i * 96 + 40 + ox
            fern(near, x, 114, 9, rng.randint(26, 40), rng, [make_ramp('#1f7a3a'), make_ramp('#2f9a4a'), make_ramp('#3aac56')])
        for i in range(6):
            x = i * 150 + 80 + ox; 
            # big leaf plant (monstera style)
            for k in range(5):
                a = -math.pi / 2 + (k - 2) * 0.55
                lx, ly = x + math.cos(a) * 16, 114 + math.sin(a) * 26
                capsule(near, (x, 114), (lx, ly), 1.0, 1.0, make_ramp('#1e6a30'), None)
                ellipse(near, (lx, ly), 9, 6, make_ramp('#2a9a46'), (6, 40, 24), rot=a + math.pi / 2)
    # mossy rocks
    for i in range(7):
        x = i * 140 + 30; 
        ellipse(near, (x, 108), 16, 10, make_ramp('#7a7a72', dk=0.55), (14, 18, 20)); ellipse(near, (x - 2, 102), 12, 6, make_ramp('#3a8a4a'), None)
    # fallen log
    capsule(near, (500, 108), (580, 110), 7, 7, make_ramp('#6a4426', dk=0.65), (14, 8, 6)); ellipse(near, (500, 108), 4, 7, make_ramp('#c89a60'), (14, 8, 6))
    # flowers
    for _ in range(46):
        x = rng.randrange(NW); y = rng.randint(100, 113); col = rng.choice([(255, 90, 140), (255, 210, 60), (255, 140, 40), (255, 255, 255)])
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): px(near, x + dx, y + dy, col)
        px(near, x, y, (255, 240, 120))
    # totem pole at the very right (home marker lives in set piece), skipped
    L['near'] = near
    gr = new(320, 68)
    gradient(gr, 0, 68, ['#3a5a26', '#4a6c2e', '#5a7c36', '#4a6a2c'])
    # moss/dirt patches
    for _ in range(26):
        x = rng.randrange(320); y = rng.randrange(0, 68); rx_, ry_ = rng.randint(8, 20), rng.randint(3, 6)
        for ox in (0, -320, 320): ellipse(gr, (x + ox, y), rx_, ry_, make_ramp('#6a4a2a', dk=0.5), None)
    for _ in range(900): px(gr, rng.randrange(320), rng.randrange(68), rng.choice([(30, 60, 24), (110, 150, 60), (74, 52, 30), (150, 190, 80)]))
    # leaves litter
    for _ in range(60):
        x = rng.randrange(320); y = rng.randrange(68); c = rng.choice([(200, 150, 40), (180, 90, 30), (120, 170, 50)])
        px(gr, x, y, c); px(gr, x + 1, y, c); px(gr, x, y + 1, tuple(int(v * .7) for v in c))
    # roots
    for _ in range(5):
        x = rng.randrange(320); y = rng.randrange(5, 60)
        dx_, dy_ = rng.randint(-30, 30), rng.randint(-4, 4)
        for ox in (0, -320, 320): capsule(gr, (x + ox, y), (x + ox + dx_, y + dy_), 2.2, 1.4, make_ramp('#6a4426', dk=0.6), (24, 14, 8))
    fill(gr, 0, 0, 320, 2, (30, 60, 24))
    L['ground'] = gr
    return L
