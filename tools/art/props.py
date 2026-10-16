import json, os, math, random
from rig import *
from bgl import *
OUTD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets')

def prop_sheet():
    items = {}
    big = Canvas(512, 256); cur = [0, 0, 0]  # x,y,rowh
    def place(name, w, h, fn):
        if cur[0] + w > 512: cur[0] = 0; cur[1] += cur[2] + 2; cur[2] = 0
        c = Canvas(w, h); fn(c)
        im = c.img(); big_img.alpha_composite(im, (cur[0], cur[1]))
        items[name] = [cur[0], cur[1], w, h]
        cur[0] += w + 2; cur[2] = max(cur[2], h)
    global big_img
    big_img = Image.new('RGBA', (512, 256), (0, 0, 0, 0))
    ol = (14, 8, 10)
    def crate(c):
        wood = make_ramp('#b57a3c', dk=0.62)
        rect(c, 2, 2, 24, 24, wood, ol)
        for k in range(3): fill(c, 4, 6 + k * 7, 24, 7 + k * 7, (110, 66, 28))
        rect(c, 2, 2, 24, 4, make_ramp('#d09450', dk=0.5), None)
        line(c, (4, 4), (23, 24), (92, 52, 22), 2); line(c, (23, 4), (4, 24), (92, 52, 22), 2)
        for x, y in ((4, 4), (22, 4), (4, 22), (22, 22)): px(c, x, y, (240, 220, 160))
    place('crate', 28, 28, crate)
    def barrel(c):
        r = make_ramp('#b8402e', dk=0.6)
        capsule(c, (11, 6), (11, 24), 9, 9, r, ol)
        ellipse(c, (11, 6), 9, 3.2, make_ramp('#e0705a'), ol)
        for yy in (11, 20): fill(c, 2, yy, 20, yy + 2, '#3a3a48'); fill(c, 2, yy, 20, yy + 1, '#8a8aa0')
        px(c, 6, 15, (255, 190, 170)); px(c, 6, 16, (255, 190, 170))
        # hazard sticker
        fillpoly(c, [(11, 12), (14, 17), (8, 17)], '#ffd23a')
    place('barrel', 22, 30, barrel)
    def banana(c):
        y = make_ramp('#ffd830', dk=0.55)
        capsule(c, (3, 8), (8, 11), 2.2, 2.8, y, ol); capsule(c, (8, 11), (14, 6), 2.8, 1.8, y, ol)
        px(c, 14, 4, (90, 60, 20)); px(c, 14, 5, (90, 60, 20)); px(c, 4, 7, (255, 250, 190)); px(c, 9, 10, (255, 250, 190))
    place('banana', 18, 16, banana)
    def banana_big(c):
        y = make_ramp('#ffd830', dk=0.55)
        for k in range(3):
            capsule(c, (3 + k * 2, 14 - k * 2), (10 + k * 2, 17 - k * 2), 2.4, 3.0, y, ol); capsule(c, (10 + k * 2, 17 - k * 2), (17 + k * 2, 11 - k * 2), 3.0, 2.0, y, ol)
        fill(c, 20, 3, 23, 7, '#5a3c14')
    place('banana_big', 28, 24, banana_big)
    def net(c):
        for r_ in (9, 6, 3): 
            for a in range(0, 360, 4): px(c, 10 + math.cos(math.radians(a)) * r_, 10 + math.sin(math.radians(a)) * r_, (224, 224, 176) if r_ != 6 else (190, 190, 140))
        for a in range(0, 180, 30): line(c, (10 - math.cos(math.radians(a)) * 9, 10 - math.sin(math.radians(a)) * 9), (10 + math.cos(math.radians(a)) * 9, 10 + math.sin(math.radians(a)) * 9), (200, 200, 150))
        final_outline(c, (30, 30, 14))
    place('net', 22, 22, net)
    def hay(c):
        for i in range(160):
            y = 4 + (i * 7) % 48
            pass
        # mound
        pts = [(4, 52), (14, 24), (34, 8), (62, 8), (82, 24), (92, 52)]
        m = fillpoly(c, pts, None)
        ys, xs = np.nonzero(m)
        for y, x in zip(ys, xs):
            t = (y - 8) / 44.0; d = (x - 48) / 46.0
            v = 0.5 - d * 0.45 - t * 0.2 + math.sin(x * 0.9 + y * 0.35) * 0.12
            pal = [(150, 108, 30), (186, 140, 40), (216, 170, 58), (238, 198, 84), (252, 224, 128)]
            c.a[y, x, :3] = pal[max(0, min(4, int(v * 5 + (B4[y & 3, x & 3] - 0.5))))]; c.a[y, x, 3] = 255
        rng = random.Random(2)
        for _ in range(130):
            x = rng.randint(10, 86); y = rng.randint(10, 50)
            if c.a[y, x, 3]: line(c, (x, y), (x + rng.randint(-4, 4), y + rng.randint(-1, 3)), rng.choice([(130, 92, 24), (255, 232, 140)]))
        final_outline(c, (60, 34, 8))
    place('haystack', 96, 56, hay)
    def bus(c):
        y = make_ramp('#f0c030', dk=0.55)
        rect(c, 2, 8, 120, 36, y, (28, 20, 8))
        fill(c, 2, 24, 122, 26, '#c08a10'); fill(c, 2, 36, 122, 40, '#2a2a30')
        for k in range(8):
            gradient(c, 12, 22, ['#bfe8ff', '#6aaee0'], 8 + k * 14, 18 + k * 14); fill(c, 8 + k * 14, 11, 18 + k * 14, 12, '#1a1a22')
        fill(c, 4, 12, 4, 12, 0)
        fill(c, 104, 11, 120, 30, '#2a2a30'); gradient(c, 12, 28, ['#bfe8ff', '#6aaee0'], 105, 119)
        text(c, 'ZOO BUS', 40, 29, '#ffffff', 1, '#10101a')
        for wx in (22, 98):
            ellipse(c, (wx, 44), 8, 8, make_ramp('#1a1a22', dk=0.7), (6, 6, 10)); ellipse(c, (wx, 44), 3.5, 3.5, make_ramp('#a0a0b0'), None)
        fill(c, 118, 36, 122, 38, '#ffffa0')
        fill(c, 2, 8, 122, 10, '#fff0a0'); 
    place('zoobus', 126, 54, bus)
    def gate(c):
        stone = make_ramp('#9a9a86', dk=0.55); green = make_ramp('#2a9a4a')
        rect(c, 6, 20, 22, 72, stone, (14, 18, 12)); rect(c, 92, 20, 22, 72, stone, (14, 18, 12))
        for k in range(6): line(c, (10, 28 + k * 11), (24, 34 + k * 11), (60, 70, 50)); line(c, (96, 28 + k * 11), (110, 34 + k * 11), (60, 70, 50))
        # arch of vines & leaves
        for i in range(0, 121, 4):
            t = i / 120; yy = 18 + 30 * (2 * t - 1) ** 2
            ellipse(c, (i, yy), 8, 6, rng_choice(i, [make_ramp('#2a9a4a'), make_ramp('#1e7a3a'), make_ramp('#43b45a')]), (6, 40, 22))
        rect(c, 30, 4, 60, 14, make_ramp('#6a4426', dk=0.6), (14, 8, 6)); text(c, 'HOME', 46, 8, '#ffe060', 1, '#2a1408')
        for i in range(10): ellipse(c, (14 + i * 11, 20 + (i % 3) * 3), 5, 4, make_ramp(['#ff5a8a', '#ffd23a', '#ff8a3a'][i % 3]), None)
    def rng_choice(i, lst): return lst[i % len(lst)]
    place('homegate', 120, 94, gate)
    # shadows
    for nm, w, h in (('shadow_s', 20, 6), ('shadow_m', 28, 8), ('shadow_l', 44, 12)):
        def sh(c, w=w, h=h):
            for y in range(h):
                for x in range(w):
                    dx = (x + .5 - w / 2) / (w / 2); dy = (y + .5 - h / 2) / (h / 2); d = dx * dx + dy * dy
                    if d <= 1 and (d < 0.55 or (x + y) % 2 == 0): px(c, x, y, (0, 0, 8), 150 if d < 0.55 else 110)
        place(nm, w, h, sh)
    # hit sparks (6 frames), big (6 frames)
    def spark(c, k, big):
        cx = c.w / 2; cy = c.h / 2
        R = (6 + k * 1.9) * (1.5 if big else 1.0); n = 8 if big else 7
        r_in = R * 0.45
        outer = []
        for i in range(n * 2):
            ang = i * math.pi / n + 0.3; rr = R * (1.0 if i % 4 == 0 else 0.8) if i % 2 == 0 else r_in
            outer.append((cx + math.cos(ang) * rr, cy + math.sin(ang) * rr))
        cols = [('#ffffff', '#ffe860'), ('#ffffff', '#ffe040'), ('#fff6a0', '#ffb830'), ('#ffe060', '#ff8a20'), ('#ffb840', '#d85a18'), ('#e8782a', '#a8381a')][k]
        fillpoly(c, outer, cols[1])
        inner = [(cx + (p[0] - cx) * 0.55, cy + (p[1] - cy) * 0.55) for p in outer]
        fillpoly(c, inner, cols[0])
        final_outline(c, (150, 40, 10) if k < 4 else (110, 30, 10))
    for k in range(6): place(f'spark{k}', 32, 32, lambda c, k=k: spark(c, k, False))
    for k in range(6): place(f'bspark{k}', 48, 48, lambda c, k=k: spark(c, k, True))
    def dust(c, k):
        r = random.Random(k)
        for i in range(5):
            ellipse(c, (6 + i * 5 + k * 1.2, 10 - k * 0.8 - (i % 2) * 2), 3 + k * 0.7, 2.6 + k * 0.6, [C('#b8a890'), C('#d0c4aa'), C('#e4dac4'), C('#f4ecdc'), C('#fff')], None, dither=False)
    for k in range(4): place(f'dust{k}', 36, 18, lambda c, k=k: dust(c, k))
    def star(c):
        for cx, cy in ((4, 4),):
            fillpoly(c, [(5, 0), (6.5, 3.5), (10, 4), (7, 6.5), (8, 10), (5, 8), (2, 10), (3, 6.5), (0, 4), (3.5, 3.5)], '#ffe040')
        final_outline(c, (120, 80, 0))
    place('star', 12, 12, star)
    # kid
    kst = dict(skin='light', shirt='#ff8a2a', pants='#3a6ad8', hat='#5a3a1a', hat_kind='hair', hair='#6a4020', shoes='#e8e8e8', scale=0.62)
    kposes = {'kid_idle': P(hip=(0, -17), lean=4, nearArm=(10, 20), farArm=(-10, 10), mouth=1), 'kid_walk0': P(hip=(0, -17), lean=6, nearLeg=(24, -10), farLeg=(-24, 6), nearArm=(-20, 10), farArm=(24, 22)),
              'kid_walk1': P(hip=(0, -17), lean=6, nearLeg=(-24, 6), farLeg=(24, -10), nearArm=(24, 22), farArm=(-20, 10)),
              'kid_fly': P(hip=(0, -17), lean=-20, nearArm=(160, 170), farArm=(150, 160), nearLeg=(50, 20), farLeg=(-30, -10), mouth=2, eyes=0),
              'kid_flop': P(hip=(0, -7), lean=-84, nearArm=(-120, -110), farArm=(-70, -60), nearLeg=(110, 100), farLeg=(70, 60), mouth=1),
              'kid_cheer': P(hip=(0, -17), lean=-4, nearArm=(150, 170), farArm=(-150, -170), mouth=2)}
    for nm, p in kposes.items():
        img = human(p, kst, W=44, H=44, ax=22, ay=40)
        big_img.alpha_composite(img, (cur[0] if cur[0] + 44 <= 512 else 0, cur[1] if cur[0] + 44 <= 512 else cur[1] + cur[2] + 2))
        if cur[0] + 44 > 512: cur[0] = 0; cur[1] += cur[2] + 2; cur[2] = 0
        items[nm] = [cur[0], cur[1], 44, 44]; cur[0] += 46; cur[2] = max(cur[2], 44)
    # HUD icon: crop Harambe head from idle frame
    import harambe3
    hi = harambe3.harambe3(P(hip=(0, -19), lean=18, nearArm=(8, 20), farArm=(-6, 10), nearLeg=(14, -2), farLeg=(-12, 2)), W=128, H=112, ax=58, ay=104)
    bb = hi.getbbox(); head = hi.crop((bb[2] - 34, bb[1], bb[2] + 2, bb[1] + 34)); head = head.resize((24, 23), Image.NEAREST)
    if cur[0] + 28 > 512: cur[0] = 0; cur[1] += cur[2] + 2; cur[2] = 0
    big_img.alpha_composite(head, (cur[0], cur[1])); items['icon_harambe'] = [cur[0], cur[1], head.width, head.height]; cur[0] += 30; cur[2] = max(cur[2], head.height)
    # enemy portrait icons (for boss bar)
    big_img = big_img.crop((0, 0, 512, cur[1] + cur[2] + 2))
    big_img.save(os.path.join(OUTD, 'props.png'))
    json.dump(items, open(os.path.join(OUTD, 'props.json'), 'w'))
    return items

if __name__ == '__main__':
    print(prop_sheet().keys())
