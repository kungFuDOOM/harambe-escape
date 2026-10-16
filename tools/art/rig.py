import math, numpy as np
from PIL import Image
from pix import *

D = math.radians
def vec(a, l):  # angle 0 = down, +90 = forward(right)
    return (math.sin(D(a)) * l, math.cos(D(a)) * l)
def add(p, v): return (p[0] + v[0], p[1] + v[1])

def P(**k):
    base = dict(hip=(0, -20), lean=10, head=(0, 0), tilt=0, nearArm=(10, 20), farArm=(-10, 10), nearLeg=(8, 0), farLeg=(-8, 0),
                mouth=0, eyes=0, prop=None, propAngle=0, crouch=0, kick=None, trail=None, fist=1, farFist=1)
    base.update(k); return base

# ---------------- Harambe ----------------
FUR = ramp('#05060b', '#0d0f1c', '#1a1f36', '#2e3658', '#4a5688')
FUR_D = ramp('#030307', '#07080f', '#0e1020', '#181c32', '#272e50')
SKIN = ramp('#1c0e0a', '#3a2016', '#5e3623', '#86523a', '#a97652')
SKIN_L = ramp('#2a1710', '#52311f', '#7a4b30', '#a26b48', '#c48d64')
RED = ramp('#4a0810', '#8a1020', '#d02634', '#f0505a', '#ff8a86')
OUT = (6, 5, 16)

def harambe(pose, W=84, H=76, ax=42, ay=70, scale=1.0, flash=False):
    cv = Canvas(W, H)
    s = scale
    hip = (ax + pose['hip'][0] * s, ay + pose['hip'][1] * s)
    lean = pose['lean']
    torso_len = 15 * s
    tv = vec(180 - lean, torso_len)       # up and forward
    tv = (math.sin(D(lean)) * torso_len, -math.cos(D(lean)) * torso_len)
    chest = add(hip, tv)
    # shoulders sit high on the chest, gorilla hunch
    sh = add(chest, (1.5 * s, 1.5 * s))
    # head
    hx_, hy_ = (6.5 + pose['head'][0]) * s, -(8 - pose['head'][1]) * s
    cl, sl_ = math.cos(D(lean - 15)), math.sin(D(lean - 15))
    hd = (sh[0] + hx_ * cl - hy_ * sl_, sh[1] + hx_ * sl_ + hy_ * cl)
    outl = OUT
    def leg(a, col_ramp, far):
        th, sk = a
        top = (hip[0] + (-2.5 if far else 2.5) * s, hip[1] + 1)
        knee = add(top, vec(th, 9 * s)); ankle = add(knee, vec(sk, 9 * s))
        capsule(cv, top, knee, 6.0 * s, 4.8 * s, col_ramp, outl)
        capsule(cv, knee, ankle, 4.8 * s, 4.0 * s, col_ramp, outl)
        # foot: big flat ape foot pointing forward
        fx = ankle[0] + 3.5 * s; fy = ankle[1] + 0.5 * s
        ellipse(cv, (fx, fy), 6 * s, 3 * s, FUR_D if far else FUR, outl)
        # toes highlight
        px(cv, fx + 4 * s, fy - 1, SKIN[3]); px(cv, fx + 3 * s, fy, SKIN[3])
    def arm(a, rmp, far, fist=1):
        a1, a2 = a
        sp = (sh[0] + (-3.5 if far else 3.5) * s, sh[1] + 1 * s)
        el = add(sp, vec(a1, 12 * s)); wr = add(el, vec(a2, 12 * s))
        capsule(cv, sp, el, 6.0 * s, 5.0 * s, rmp, outl)
        capsule(cv, el, wr, 5.0 * s, 4.4 * s, rmp, outl)
        # fist
        fr = (5.2 if fist else 4.0) * s
        ellipse(cv, add(wr, vec(a2, 2.5 * s)), fr, fr * 0.9, rmp, outl)
        fc = add(wr, vec(a2, 4 * s))
        # knuckle/skin highlights
        for k in (-1.5, 0, 1.5):
            px(cv, fc[0] + k * math.cos(D(a2)) , fc[1] - k * math.sin(D(a2)) , SKIN[3])
        return wr
    # draw order: far arm, far leg, near leg, torso, head, near arm
    arm(pose['farArm'], FUR_D, True, pose['farFist'])
    leg(pose['farLeg'], FUR_D, True)
    leg(pose['nearLeg'], FUR, False)
    # torso: big barrel with shoulder mound
    mid = ((hip[0] + chest[0]) / 2 + 1 * s, (hip[1] + chest[1]) / 2 + 1)
    ellipse(cv, mid, 12.5 * s, 12.5 * s, FUR, outl, rot=D(lean) * 0.6)
    # belly / chest plate (lighter grey-brown skin tone showing through)
    ellipse(cv, (mid[0] + 3.5 * s, mid[1] - 1 * s), 7 * s, 8.5 * s, SKIN, outl, rot=D(lean) * 0.6)
    ellipse(cv, (mid[0] + 4.5 * s, mid[1] - 3 * s), 4.5 * s, 4.5 * s, SKIN_L, None)
    # pec line
    line(cv, (mid[0] - 1 * s, mid[1] + 1), (mid[0] + 8 * s, mid[1] + 1.5), SKIN[1])
    # shoulder mound
    ellipse(cv, (sh[0], sh[1] - 1 * s), 9.5 * s, 7 * s, FUR, outl)
    # fur tufts on mound
    for dx in (-5, -2, 1, 4):
        px(cv, sh[0] + dx * s, sh[1] - 6 * s, FUR[3]); px(cv, sh[0] + dx * s + 1, sh[1] - 7 * s, FUR[4])
    # silverback-ish lighter back fur patch
    for i in range(7):
        px(cv, mid[0] - 9 * s + (i % 3), mid[1] - 4 * s + i * 2, FUR[3])
    # head
    t = pose['tilt']
    ellipse(cv, (hd[0] - 1 * s, hd[1] - 1 * s), 8 * s, 7.5 * s, FUR, outl)
    # sagittal crest
    ellipse(cv, (hd[0] - 2 * s, hd[1] - 7 * s), 4.5 * s, 4 * s, FUR, outl)
    ellipse(cv, (hd[0] - 3 * s, hd[1] - 8 * s), 2 * s, 1.5 * s, FUR[:5][::1], None)
    # face (brown skin, forward and low)
    fx, fy = hd[0] + 3.2 * s, hd[1] + 1.8 * s
    ellipse(cv, (fx, fy), 5.8 * s, 5.8 * s, SKIN, outl)
    # muzzle bulge
    ellipse(cv, (fx + 3 * s, fy + 2 * s), 3.6 * s, 3.2 * s, SKIN_L, None)
    # brow ridge
    rect(cv, fx - 2 * s, fy - 4.5 * s, 8 * s, 2.5 * s, FUR_D, None, bevel=False)
    # eye
    ex, ey = fx + 2 * s, fy - 1.5 * s
    if pose['eyes'] == 1:  # shut
        line(cv, (ex - 1, ey), (ex + 1.5, ey), (10, 6, 12))
    elif pose['eyes'] == 2:  # angry
        px(cv, ex, ey, (255, 255, 255)); px(cv, ex + 1, ey, (255, 255, 255)); px(cv, ex + 1, ey, (20, 10, 10)); px(cv, ex + 2, ey - 1, FUR_D[0]); px(cv, ex - 1, ey - 1, FUR_D[0])
    else:
        px(cv, ex, ey, (255, 250, 235)); px(cv, ex + 1, ey, (30, 12, 8)); px(cv, ex, ey - 1, FUR_D[1]); px(cv, ex + 1, ey - 1, FUR_D[1])
    # nostrils
    px(cv, fx + 6 * s, fy + 1.2 * s, (14, 6, 8)); px(cv, fx + 5 * s, fy + 1.4 * s, (14, 6, 8))
    # mouth
    my = fy + 4 * s
    if pose['mouth'] == 0:
        line(cv, (fx + 2 * s, my), (fx + 7 * s, my - 0.3), (22, 8, 10))
    else:
        h = 3 if pose['mouth'] == 1 else 5
        rect(cv, fx + 1.5 * s, my - 1, 6 * s, h, [(60, 5, 20), (110, 10, 30), (170, 30, 50), (200, 60, 70), (240, 120, 120)], (14, 4, 8), bevel=False)
        for k in range(0, int(6 * s), 2): px(cv, fx + 2 * s + k, my, (255, 255, 240))  # teeth
        for k in range(1, int(6 * s), 3): px(cv, fx + 2 * s + k, my - 1 + h - 1, (255, 255, 240))
    # ear
    ellipse(cv, (hd[0] - 4 * s, hd[1] + 0.5 * s), 1.8 * s, 2.3 * s, SKIN, outl)
    # red bandana (TMNT nod)
    by = hd[1] - 6.2 * s
    cols = RED
    band = [(hd[0] - 8 * s, by - 1.5), (hd[0] + 6.5 * s, by - 2.5), (hd[0] + 7.5 * s, by + 1.5), (hd[0] - 8 * s, by + 2.5)]
    poly(cv, band, cols, outl, bevel=True)
    px(cv, hd[0] - 3, by - 1, RED[4]); px(cv, hd[0] - 2, by - 1, RED[4]); px(cv, hd[0] + 2, by - 2, RED[4])
    # tails flap
    fl = pose.get('flap', 0)
    for i, (dx, dy) in enumerate([(-9, 0), (-12, 1 + fl), (-15, 2 + fl * 2)]):
        capsule(cv, (hd[0] - 8 * s + (-3) * i, by), (hd[0] + dx * s - 3, by + dy + 1), 1.6, 1.3, RED, outl)
    arm(pose['nearArm'], FUR, False, pose['fist'])
    final_outline(cv, OUT)
    img = cv.img()
    if flash:
        a = np.array(img); a[a[..., 3] > 0, :3] = 255; img = Image.fromarray(a)
    return img


# ---------------- Humans ----------------
SKINS = {
    'light': ramp('#3a1a18', '#7a3e30', '#c27a5a', '#e8a884', '#ffd0b0'),
    'tan': ramp('#2e1612', '#6a3524', '#a9643e', '#d28d62', '#f0b488'),
    'brown': ramp('#1f0f0c', '#4a2518', '#7a4228', '#a56a46', '#c88f66'),
    'pale': ramp('#3e2024', '#8a4a44', '#d89a80', '#f4c6a6', '#ffe4cc'),
}
METAL = ramp('#1a1e2a', '#3a4254', '#6a7388', '#a0aac0', '#e0e8f8')
WOOD = ramp('#1e1008', '#442814', '#7a4a22', '#a8703a', '#d09a56')
BLACK = ramp('#05050a', '#10101a', '#1c1c2a', '#30303f', '#4c4c60')

def human(pose, st, W=76, H=76, ax=38, ay=70, flash=False):
    cv = Canvas(W, H)
    s = st.get('scale', 1.0)
    sk = SKINS[st['skin']]
    shirt = make_ramp(st['shirt']); pants = make_ramp(st['pants']); shoes = make_ramp(st.get('shoes', '#2a2a34'))
    hair = make_ramp(st.get('hair', '#3a2616')); hatc = make_ramp(st.get('hat', '#555555')); trim = make_ramp(st.get('trim', '#e8d070'))
    sleeve = make_ramp(st.get('sleeve', st['shirt']))
    hip = (ax + pose['hip'][0] * s, ay + pose['hip'][1] * s)
    lean = pose['lean']
    TL = 13 * s
    tv = (math.sin(D(lean)) * TL, -math.cos(D(lean)) * TL)
    chest = add(hip, tv)
    sh = add(chest, (0, 1.5 * s))
    nk = add(hip, (tv[0] * 1.05, tv[1] * 1.05))
    hx_, hy_ = (1.5 + pose['head'][0]) * s, -(5.5 - pose['head'][1]) * s
    cl, sl_ = math.cos(D(lean - 6)), math.sin(D(lean - 6))
    hd = (nk[0] + hx_ * cl - hy_ * sl_, nk[1] + hx_ * sl_ + hy_ * cl)
    outl = (8, 6, 18)
    def leg(a, far):
        th, shn = a
        top = (hip[0] + (-1.5 if far else 1.5) * s, hip[1] - 1)
        knee = add(top, vec(th, 7.5 * s)); ankle = add(knee, vec(shn, 7.5 * s))
        pr = make_ramp(tuple(int(c * 0.78) for c in hexc(st['pants']))) if far else pants
        capsule(cv, top, knee, 3.8 * s, 3.2 * s, pr, outl)
        capsule(cv, knee, ankle, 3.2 * s, 2.7 * s, pr, outl)
        sr = shoes
        fx = ankle[0] + 2.5 * s; fy = ankle[1] + 0.3 * s
        ellipse(cv, (fx, fy), 4.6 * s, 2.4 * s, sr, outl)
        px(cv, fx + 3 * s, fy - 0.5, sr[4])
    def arm(a, far):
        a1, a2 = a
        sp = (sh[0] + (-2 if far else 2) * s, sh[1] + 0.5 * s)
        el = add(sp, vec(a1, 6.5 * s)); wr = add(el, vec(a2, 6 * s))
        sl = make_ramp(tuple(int(c * 0.8) for c in hexc(st.get('sleeve', st['shirt'])))) if far else sleeve
        capsule(cv, sp, el, 3.0 * s, 2.6 * s, sl, outl)
        if st.get('longsleeve'):
            capsule(cv, el, wr, 2.6 * s, 2.3 * s, sl, outl)
        else:
            capsule(cv, el, wr, 2.5 * s, 2.2 * s, sk, outl)
        gl = st.get('gloves')
        hand = add(wr, vec(a2, 1.8 * s))
        ellipse(cv, hand, 2.6 * s, 2.5 * s, make_ramp(gl) if gl else sk, outl)
        return wr, hand
    far_wr, far_hand = arm(pose['farArm'], True)
    leg(pose['farLeg'], True); leg(pose['nearLeg'], False)
    # torso
    base = add(hip, (0, -1))
    capsule(cv, base, add(chest, (0, 1)), 6.2 * s, 7.0 * s, shirt, outl)
    # belly/pelvis
    ellipse(cv, (hip[0], hip[1] - 1), 5.6 * s, 3.8 * s, pants, outl)
    # belt
    bx = hip[0] + math.sin(D(lean)) * 3 * s; by_ = hip[1] - 3.5 * s
    capsule(cv, (hip[0] - 5 * s, hip[1] - 3 * s), (hip[0] + 5 * s, hip[1] - 3 * s), 1.1, 1.1, BLACK, None)
    px(cv, hip[0] + 1, hip[1] - 3 * s, trim[3])
    # shirt features
    mid = ((hip[0] + chest[0]) / 2, (hip[1] + chest[1]) / 2)
    f = st.get('feature')
    if f == 'vest':
        capsule(cv, (mid[0] + 1, mid[1] - 4 * s), (mid[0] + 1, mid[1] + 3 * s), 2.2 * s, 2.2 * s, make_ramp(st.get('vest', '#a07830')), None)
    elif f == 'stripes':
        for i in range(-3, 4, 2): line(cv, (mid[0] - 5 * s, mid[1] + i * s), (mid[0] + 5 * s, mid[1] + i * s), shirt[0])
    elif f == 'hawaii':
        for i in range(9):
            px(cv, mid[0] - 5 * s + (i * 7) % 11, mid[1] - 5 * s + (i * 5) % 11, (255, 240, 120)); px(cv, mid[0] - 4 * s + (i * 3) % 9, mid[1] - 4 * s + (i * 7) % 9, (30, 160, 120))
    elif f == 'badge':
        px(cv, mid[0] + 2 * s, mid[1] - 3 * s, trim[4]); px(cv, mid[0] + 3 * s, mid[1] - 3 * s, trim[3]); px(cv, mid[0] + 2 * s, mid[1] - 2 * s, trim[3])
    elif f == 'plate':  # riot armour
        capsule(cv, (mid[0] + 1, mid[1] - 3 * s), (mid[0] + 1, mid[1] + 3 * s), 4 * s, 4 * s, BLACK, outl)
        line(cv, (mid[0] - 2, mid[1] - 2), (mid[0] + 4, mid[1] - 2), BLACK[4])
    elif f == 'apron':
        capsule(cv, (mid[0] + 2 * s, mid[1] - 2 * s), (mid[0] + 2 * s, mid[1] + 4 * s), 3.5 * s, 3.5 * s, make_ramp('#d8d0b0'), None)
    elif f == 'coat':
        capsule(cv, (hip[0] - 4 * s, hip[1] + 2), (hip[0] + 0, hip[1] + 4 * s), 1.5 * s, 1.5 * s, shirt, None)
    elif f == 'tie':
        px(cv, mid[0] + 2 * s, mid[1] - 4 * s, (200, 30, 40)); px(cv, mid[0] + 2 * s, mid[1] - 3 * s, (170, 20, 30)); px(cv, mid[0] + 2 * s, mid[1] - 2 * s, (170, 20, 30))
    elif f == 'sash':
        line(cv, (mid[0] - 4 * s, mid[1] - 5 * s), (mid[0] + 5 * s, mid[1] + 3 * s), trim[2], 2)
    elif f == 'ammo':
        for i in range(5): px(cv, mid[0] - 3 * s + i * 2, mid[1] + 1 + i * 0.5, trim[4]); px(cv, mid[0] - 3 * s + i * 2, mid[1] + 2 + i * 0.5, trim[2])
    # head
    ellipse(cv, (hd[0] - 0.5 * s, hd[1]), 6.4 * s, 6.6 * s, sk, outl)
    ellipse(cv, (hd[0] + 1.5 * s, hd[1] + 1 * s), 3.2 * s, 3.5 * s, sk, None)
    # ear
    ellipse(cv, (hd[0] - 3.2 * s, hd[1] + 0.5 * s), 1.5 * s, 2 * s, sk, outl)
    ex, ey = hd[0] + 2.6 * s, hd[1] - 0.5 * s
    if pose['eyes'] == 1:
        line(cv, (ex - 1, ey), (ex + 1, ey), (20, 10, 10))
    elif st.get('shades'):
        rect(cv, ex - 2 * s, ey - 1, 5 * s, 2.2, BLACK, None, bevel=False); px(cv, ex - 1, ey - 1, (140, 200, 255))
        line(cv, (hd[0] - 3 * s, ey - 1), (ex - 2 * s, ey - 1), BLACK[1])
    else:
        px(cv, ex, ey, (255, 255, 255)); px(cv, ex + 1, ey, (20, 14, 30)); px(cv, ex - 1, ey - 2 if pose['eyes'] == 2 else ey - 1.5, hair[0]); px(cv, ex, ey - 2 if pose['eyes'] == 2 else ey - 1.5, hair[0]); px(cv, ex + 1, ey - 2 if pose['eyes'] == 2 else ey - 1.5, hair[1])
    # nose
    px(cv, hd[0] + 5 * s, hd[1] + 1 * s, sk[3]); px(cv, hd[0] + 5.5 * s, hd[1] + 1.5 * s, sk[2]); px(cv, hd[0] + 5 * s, hd[1] + 2 * s, sk[1])
    # mouth
    my = hd[1] + 3.6 * s
    if pose['mouth']:
        rect(cv, hd[0] + 2.5 * s, my - 0.5, 3 * s, 2.5, [(60, 5, 20), (110, 10, 30), (150, 20, 40), (180, 40, 60), (200, 70, 80)], (20, 4, 8), bevel=False)
    else:
        line(cv, (hd[0] + 2.5 * s, my), (hd[0] + 5 * s, my), sk[0])
    if st.get('beard'):
        ellipse(cv, (hd[0] + 1 * s, hd[1] + 4.5 * s), 4.5 * s, 3.2 * s, hair, outl)
        line(cv, (hd[0] + 2.5 * s, hd[1] + 3.2 * s), (hd[0] + 5 * s, hd[1] + 3.2 * s), sk[0])
    if st.get('stache'):
        capsule(cv, (hd[0] + 2 * s, hd[1] + 2.8 * s), (hd[0] + 7 * s, hd[1] + 3.6 * s), 1.4 * s, 1.0 * s, make_ramp(st.get('stache')), outl)
    # hair / hats
    hat = st.get('hat_kind')
    hh = (hd[0], hd[1] - 2.6 * s)
    top = (hh[0] - 0.5 * s, hh[1] - 5 * s)
    if hat in (None, 'hair'):
        ellipse(cv, (hh[0] - 1.5 * s, hh[1] - 2.5 * s), 6.2 * s, 4.8 * s, hair, outl)
        ellipse(cv, (hh[0] - 1.5 * s, hh[1] + 0.5 * s), 4 * s, 4 * s, hair, None, cut=None) if False else None
    elif hat == 'cap':  # keeper cap
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 3 * s), 6.6 * s, 4.6 * s, hatc, outl)
        capsule(cv, (hh[0] + 2 * s, hh[1] - 2 * s), (hh[0] + 8 * s, hh[1] - 1.4 * s), 1.6 * s, 1.1 * s, hatc, outl)
        px(cv, hh[0] + 0.5, hh[1] - 5 * s, trim[4]); px(cv, hh[0] + 1.5, hh[1] - 5 * s, trim[3])
    elif hat == 'peak':  # security/cop peaked cap
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 3.5 * s), 6.8 * s, 3.8 * s, hatc, outl)
        rect(cv, hh[0] - 5.5 * s, hh[1] - 3 * s, 12 * s, 2.2, BLACK, outl, bevel=False)
        capsule(cv, (hh[0] + 3 * s, hh[1] - 2 * s), (hh[0] + 8.5 * s, hh[1] - 1.5 * s), 1.3 * s, 1.0 * s, BLACK, outl)
        px(cv, hh[0] + 1, hh[1] - 5 * s, trim[4]); px(cv, hh[0] + 2, hh[1] - 5 * s, trim[3])
    elif hat == 'helmet':  # animal control green hard hat with goggles
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 3 * s), 6.8 * s, 5 * s, hatc, outl)
        rect(cv, hh[0] - 6 * s, hh[1] - 1.5 * s, 12 * s, 2.2, hatc, outl, bevel=False)
        rect(cv, hh[0] + 1.5 * s, hh[1] - 2 * s, 5 * s, 3, ramp('#0a1a2a', '#1a3a5a', '#3a7aaa', '#8ad0f0', '#e0ffff'), outl, bevel=False)
    elif hat == 'sunhat':  # tourist bucket hat
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 4 * s), 5.5 * s, 3.5 * s, hatc, outl)
        ellipse(cv, (hh[0] - 0.5 * s, hh[1] - 2 * s), 8.2 * s, 2.2 * s, hatc, outl)
    elif hat == 'sailor':
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 3.5 * s), 6.4 * s, 3.8 * s, hatc, outl)
        rect(cv, hh[0] - 6 * s, hh[1] - 2.5 * s, 12 * s, 2.5, make_ramp('#1a2a5a'), outl, bevel=False)
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 6.5 * s), 3 * s, 1.2 * s, hatc, None)
    elif hat == 'slouch':  # safari/hunter hat
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 4 * s), 5.5 * s, 4 * s, hatc, outl)
        ellipse(cv, (hh[0] + 0.5 * s, hh[1] - 2 * s), 9 * s, 2.0 * s, hatc, outl)
        line(cv, (hh[0] - 5 * s, hh[1] - 3 * s), (hh[0] + 4 * s, hh[1] - 3 * s), trim[2])
    elif hat == 'bighat':  # head keeper
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 4.5 * s), 6.2 * s, 5 * s, hatc, outl)
        ellipse(cv, (hh[0] + 0.5 * s, hh[1] - 2 * s), 9.5 * s, 2.2 * s, hatc, outl)
        px(cv, hh[0], hh[1] - 6 * s, trim[4]); px(cv, hh[0] + 1, hh[1] - 6 * s, trim[3]); px(cv, hh[0], hh[1] - 5 * s, trim[3])
    elif hat == 'riot':
        ellipse(cv, (hh[0] - 0.5 * s, hh[1] - 1.5 * s), 7 * s, 6.6 * s, BLACK, outl)
        rect(cv, hh[0] + 1 * s, hh[1] - 2.2 * s, 6.5 * s, 4, ramp('#10304a', '#2a6a90', '#5ab0d8', '#a8e8ff', '#ffffff'), outl, bevel=True)
        line(cv, (hh[0] - 4 * s, hh[1] - 6 * s), (hh[0] + 2 * s, hh[1] - 7 * s), BLACK[4])
    elif hat == 'captain':
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 3.5 * s), 6.8 * s, 4 * s, hatc, outl)
        rect(cv, hh[0] - 6 * s, hh[1] - 2.8 * s, 12 * s, 2.4, BLACK, outl, bevel=False)
        capsule(cv, (hh[0] + 3 * s, hh[1] - 2 * s), (hh[0] + 8 * s, hh[1] - 1.5 * s), 1.3 * s, 1.0 * s, BLACK, outl)
        px(cv, hh[0] + 1, hh[1] - 5 * s, trim[4]); px(cv, hh[0], hh[1] - 5 * s, trim[3])
    elif hat == 'pith':  # explorer pith helmet
        ellipse(cv, (hh[0] - 1 * s, hh[1] - 4.2 * s), 6.8 * s, 5.4 * s, hatc, outl)
        ellipse(cv, (hh[0] + 0.5 * s, hh[1] - 1.8 * s), 8.4 * s, 2.0 * s, hatc, outl)
        line(cv, (hh[0] - 5 * s, hh[1] - 3.2 * s), (hh[0] + 5 * s, hh[1] - 3.2 * s), (110, 50, 30))
        px(cv, hh[0] - 1, hh[1] - 8.5 * s, hatc[4]); px(cv, hh[0], hh[1] - 8.5 * s, hatc[4])
        # monocle
        px(cv, ex + 1, ey + 1, (255, 255, 120)); px(cv, ex + 2, ey + 1, (255, 255, 120))
    # prop & trail
    prop = pose.get('prop')
    nw, nh = None, None
    nearArm_wr, nearArm_hand = arm(pose['nearArm'], False)
    wa = pose['nearArm'][1] + pose.get('propAngle', 0)
    hx, hy = nearArm_hand
    if prop:
        draw_prop(cv, prop, hx, hy, wa, s, st, pose, outl, hip)
    final_outline(cv, outl)
    tr = pose.get('trail')
    if tr:
        from PIL import ImageDraw
        a0, a1, rr = tr; SSn = 4
        im = Image.new('L', (cv.w * SSn, cv.h * SSn), 0); dr = ImageDraw.Draw(im)
        o_, i_ = [], []
        for k in range(15):
            t = k / 14; an = a0 + (a1 - a0) * t; th = (0.2 + 0.9 * t) * s * 2.0
            ox, oy = vec(an, (rr + th) * s); ix, iy = vec(an, (rr - th * 0.4) * s)
            o_.append(((sh[0] + ox) * SSn, (sh[1] + oy) * SSn)); i_.append(((sh[0] + ix) * SSn, (sh[1] + iy) * SSn))
        dr.polygon(o_ + i_[::-1], fill=255)
        mk = np.array(im.resize((cv.w, cv.h), Image.BILINEAR)) > 110
        free = mk & (cv.a[:, :, 3] == 0); cv.a[free, :3] = (255, 244, 205); cv.a[free, 3] = 255
    img = cv.img()
    if flash:
        a = np.array(img); a[a[..., 3] > 0, :3] = 255; img = Image.fromarray(a)
    return img

def draw_prop(cv, prop, x, y, ang, s, st, pose, outl, hip):
    # direction of the prop: forward along forearm angle (angle 0=down, 90 = fwd)
    d = lambda L, a=ang: (x + math.sin(D(a)) * L, y + math.cos(D(a)) * L)
    if prop == 'baton':
        capsule(cv, d(-2 * s, ang + 180), d(13 * s, ang + 180 + 180), 1.4 * s, 1.4 * s, BLACK, outl)
        a2 = d(13 * s, ang)  # unused
    elif prop == 'tranq':
        a1 = (x - 3 * s, y - 1); a2 = (x + 12 * s, y - 2 * s)
        capsule(cv, a1, a2, 1.8 * s, 1.5 * s, METAL, outl)
        capsule(cv, (x + 8 * s, y - 2 * s), (x + 14 * s, y - 2.2 * s), 1.2, 1.0, ramp('#4a0810', '#8a1020', '#d02634', '#f0505a', '#ff8a86'), outl)
        rect(cv, x - 4 * s, y - 1, 4, 5, BLACK, outl)
    elif prop == 'rifle':
        a = pose['nearArm'][1]
        c, sn = math.sin(D(a)), math.cos(D(a))
        p0 = (x - c * 8 * s - 0, y - sn * 8 * s); p1 = (x + c * 16 * s, y + sn * 16 * s)
        capsule(cv, p0, (x, y), 2.2 * s, 1.8 * s, WOOD, outl)
        capsule(cv, (x, y), p1, 1.2 * s, 1.0 * s, METAL, outl)
        capsule(cv, (x + c * 2 * s, y - 1.5 * s + sn * 2 * s), (x + c * 9 * s, y - 1.5 * s + sn * 9 * s), 0.9, 0.9, BLACK, None)
    elif prop == 'netgun':
        c, sn = math.sin(D(pose['nearArm'][1])), math.cos(D(pose['nearArm'][1]))
        p0 = (x - c * 4 * s, y - sn * 4 * s); p1 = (x + c * 11 * s, y + sn * 11 * s)
        capsule(cv, p0, p1, 3.0 * s, 3.6 * s, ramp('#10301a', '#206a3a', '#40a860', '#80e098', '#d0ffd8'), outl)
        ellipse(cv, p1, 2.2 * s, 3.8 * s, BLACK, outl)
        ellipse(cv, (p1[0] + 1, p1[1]), 1.0 * s, 2.6 * s, ramp('#444', '#666', '#bba', '#ddc', '#fff'), None)
    elif prop == 'handbag':
        by = y + 7 * s
        line(cv, (x, y), (x, by - 3 * s), (80, 40, 20))
        rect(cv, x - 4 * s, by - 3 * s, 8 * s, 6 * s, ramp('#50102a', '#901a50', '#d83a8a', '#ff7ac0', '#ffd0ea'), outl)
        px(cv, x, by - 1 * s, (255, 220, 80))
    elif prop == 'hook':
        c, sn = math.sin(D(pose['nearArm'][1])), math.cos(D(pose['nearArm'][1]))
        capsule(cv, (x, y), (x + c * 7 * s, y + sn * 7 * s), 1.4 * s, 1.4 * s, METAL, outl)
        tip = (x + c * 7 * s, y + sn * 7 * s)
        capsule(cv, tip, (tip[0] + 3 * s, tip[1] + 2 * s), 1.1, 1.0, METAL, outl)
        capsule(cv, (tip[0] + 3 * s, tip[1] + 2 * s), (tip[0] + 1 * s, tip[1] + 4.5 * s), 1.0, 0.9, METAL, outl)
    elif prop == 'anchor':
        c, sn = math.sin(D(pose['nearArm'][1])), math.cos(D(pose['nearArm'][1]))
        cx_, cy_ = x + c * 3 * s, y + sn * 3 * s
        capsule(cv, (cx_, cy_ - 12 * s), (cx_, cy_ + 12 * s), 1.8 * s, 1.8 * s, METAL, outl)
        capsule(cv, (cx_ - 6 * s, cy_ - 11 * s), (cx_ + 6 * s, cy_ - 11 * s), 1.5 * s, 1.5 * s, METAL, outl)
        capsule(cv, (cx_ - 8 * s, cy_ + 8 * s), (cx_, cy_ + 13 * s), 1.6 * s, 1.8 * s, METAL, outl)
        capsule(cv, (cx_ + 8 * s, cy_ + 8 * s), (cx_, cy_ + 13 * s), 1.6 * s, 1.8 * s, METAL, outl)
        ellipse(cv, (cx_, cy_ - 15 * s), 2.2 * s, 2.2 * s, METAL, outl)
    elif prop == 'shield':
        sx = x + 4 * s; sy = y - 4 * s
        rect(cv, sx - 3 * s, sy - 13 * s, 7 * s, 26 * s, ramp('#10304a', '#2a6a90', '#5ab0d8', '#a8e8ff', '#e8ffff'), outl)
        rect(cv, sx - 1 * s, sy - 10 * s, 2 * s, 20 * s, ramp('#2a6a90', '#5ab0d8', '#a8e8ff', '#e8ffff', '#ffffff'), None, bevel=False)
        for i in range(3): px(cv, sx - 2 * s, sy - 9 * s + i * 7 * s, (255, 255, 255))
        px(cv, sx + 1, sy - 11 * s, (255, 255, 255))
    elif prop == 'bucket':
        by = y + 4 * s
        capsule(cv, (x - 3 * s, by), (x + 3 * s, by), 4 * s, 3.4 * s, METAL, outl)
        line(cv, (x - 3 * s, by - 3 * s), (x + 3 * s, by - 3 * s), METAL[4])
