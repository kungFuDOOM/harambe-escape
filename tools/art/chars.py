import math, json, os, sys
from rig import *
import harambe3

OUTD = os.path.join(os.path.dirname(__file__), '..', '..', 'assets')
os.makedirs(OUTD, exist_ok=True)

def sw(ph, a): return a * math.sin(ph)

# ------------------------------------------------------------------ Harambe
def harambe_anims():
    A = {}
    base = dict(hip=(0, -19), lean=18)
    A['idle'] = []
    for i in range(4):
        b = [0, -0.5, -1, -0.5][i]; sway = [0, 3, 5, 3][i]
        A['idle'].append(P(hip=(0, -19 + b), lean=18 + b, nearArm=(8 + sway, 20 + sway), farArm=(-6 - sway, 10), nearLeg=(14, -2), farLeg=(-12, 2), head=(0, -b), flap=i % 2))
    A['walk'] = []
    for i in range(6):
        ph = i / 6 * 2 * math.pi
        def leg(p):
            th = 34 * math.sin(p); sh_ = th * 0.2 - 30 * max(0, math.cos(p)) ; return (th, sh_)
        A['walk'].append(P(hip=(0, -19 + 1.6 * abs(math.sin(ph * 1.0))), lean=22, nearLeg=leg(ph), farLeg=leg(ph + math.pi),
                           nearArm=(-30 * math.sin(ph) + 12, 18 + 14 * max(0, math.sin(ph))), farArm=(30 * math.sin(ph) - 6, 14 + 14 * max(0, -math.sin(ph))), flap=i % 3, fist=1))
    # attack 1: right jab
    A['atk1'] = [
        P(hip=(-3, -19), lean=30, nearArm=(-55, -85), farArm=(25, 40), nearLeg=(20, -10), farLeg=(-20, 10), mouth=1, eyes=2),
        P(hip=(4, -18), lean=12, nearArm=(86, 90), farArm=(-20, -10), nearLeg=(32, -2), farLeg=(-26, 12), mouth=2, eyes=2, head=(1, 0)),
        P(hip=(3, -19), lean=16, nearArm=(60, 70), farArm=(-14, 0), nearLeg=(24, -4), farLeg=(-20, 6), mouth=1)]
    # attack 2: uppercut
    A['atk2'] = [
        P(hip=(-2, -17), lean=35, nearArm=(-15, -45), farArm=(30, 45), nearLeg=(24, -20), farLeg=(-22, 8), mouth=1, eyes=2, crouch=1),
        P(hip=(4, -20), lean=0, nearArm=(130, 165), farArm=(-30, -10), nearLeg=(20, 0), farLeg=(-20, 5), mouth=2, eyes=2, head=(1, -1)),
        P(hip=(3, -20), lean=6, nearArm=(115, 140), farArm=(-25, 0), nearLeg=(18, 0), farLeg=(-18, 5), mouth=1)]
    # attack 3: double fist smash + lunge
    A['atk3'] = [
        P(hip=(-4, -19), lean=-5, nearArm=(150, 170), farArm=(140, 165), nearLeg=(20, -8), farLeg=(-22, 10), mouth=1, eyes=2),
        P(hip=(7, -17), lean=34, nearArm=(88, 80), farArm=(82, 76), nearLeg=(40, -4), farLeg=(-34, 14), mouth=2, eyes=2, head=(1, 1)),
        P(hip=(6, -18), lean=26, nearArm=(70, 60), farArm=(65, 55), nearLeg=(34, -2), farLeg=(-28, 10), mouth=1)]
    A['atk1'][1]['trail'] = (-20, 85, 17); A['atk2'][1]['trail'] = (-10, 150, 17); A['atk3'][1]['trail'] = (20, 95, 18)
    A['heavy'] = [
        P(hip=(-2, -20), lean=-8, nearArm=(160, 175), farArm=(150, 170), nearLeg=(14, -4), farLeg=(-14, 4), mouth=1, eyes=2),
        P(hip=(-3, -21), lean=-16, nearArm=(172, 185), farArm=(165, 180), nearLeg=(14, -4), farLeg=(-14, 4), mouth=2, eyes=2, head=(-1, 1)),
        P(hip=(6, -16), lean=42, nearArm=(60, 38), farArm=(52, 30), nearLeg=(42, 4), farLeg=(-30, 14), mouth=2, eyes=2, head=(1, 1), crouch=1),
        P(hip=(5, -17), lean=30, nearArm=(35, 25), farArm=(28, 20), nearLeg=(34, 4), farLeg=(-26, 10), mouth=0)]
    A['heavy'][2]['trail'] = (-170, 70, 20)
    A['jump'] = [
        P(hip=(0, -21), lean=8, nearArm=(150, 165), farArm=(130, 150), nearLeg=(55, -60), farLeg=(35, -50), mouth=1),
        P(hip=(0, -22), lean=0, nearArm=(120, 140), farArm=(100, 120), nearLeg=(70, -75), farLeg=(45, -60), mouth=1, eyes=2),
        P(hip=(0, -21), lean=14, nearArm=(100, 115), farArm=(-10, 40), nearLeg=(22, 5), farLeg=(-8, 8), mouth=0)]
    A['jatk'] = [
        P(hip=(-3, -22), lean=-32, nearArm=(-70, -50), farArm=(-90, -60), nearLeg=(98, 88), farLeg=(84, 74), mouth=2, eyes=2, head=(-1, 1)),
        P(hip=(-3, -22), lean=-36, nearArm=(-80, -55), farArm=(-100, -70), nearLeg=(102, 92), farLeg=(88, 78), mouth=2, eyes=2)]
    A['hurt'] = [
        P(hip=(-3, -18), lean=-14, nearArm=(-50, -40), farArm=(-70, -50), nearLeg=(10, 0), farLeg=(-16, 6), eyes=1, mouth=2, head=(-2, 1)),
        P(hip=(-2, -19), lean=-5, nearArm=(-30, -20), farArm=(-40, -20), nearLeg=(12, 0), farLeg=(-14, 4), eyes=1, mouth=1)]
    A['down'] = [
        P(hip=(-4, -22), lean=-45, nearArm=(-80, -60), farArm=(-100, -70), nearLeg=(75, 60), farLeg=(65, 50), eyes=1, mouth=2),
        P(hip=(-1, -9), lean=-84, nearArm=(-110, -100), farArm=(-90, -80), nearLeg=(100, 98), farLeg=(88, 86), eyes=1, mouth=1),
        P(hip=(-1, -9), lean=-86, nearArm=(-115, -100), farArm=(-100, -90), nearLeg=(100, 100), farLeg=(88, 88), eyes=1, mouth=0)]
    A['special'] = [
        P(hip=(0, -20), lean=-6, nearArm=(120, 150), farArm=(-120, -150), nearLeg=(16, 0), farLeg=(-16, 0), mouth=2, eyes=2),
        P(hip=(0, -19), lean=4, nearArm=(48, -100), farArm=(110, 140), nearLeg=(16, 0), farLeg=(-16, 0), mouth=2, eyes=2),
        P(hip=(0, -19), lean=4, nearArm=(110, 140), farArm=(10, -100), nearLeg=(16, 0), farLeg=(-16, 0), mouth=2, eyes=2),
        P(hip=(0, -21), lean=-14, nearArm=(120, 130), farArm=(-120, -130), nearLeg=(16, 0), farLeg=(-16, 0), mouth=2, eyes=2, head=(-1, 2))]
    return A

# ------------------------------------------------------------------ humans
def human_anims(prop=None, kind='melee'):
    A = {}
    H0 = (0, -17)
    A['idle'] = [P(hip=(0, -17 + b), lean=6, nearArm=(8 + o, 18), farArm=(-8 - o, 10), nearLeg=(6, 0), farLeg=(-6, 0), prop=prop) for b, o in ((0, 0), (-0.5, 2))]
    A['walk'] = []
    for i in range(6):
        ph = i / 6 * 2 * math.pi
        def leg(p): th = 28 * math.sin(p); return (th, th * 0.3 - 28 * max(0, math.cos(p)))
        A['walk'].append(P(hip=(0, -17 + 1.2 * abs(math.sin(ph))), lean=7, nearLeg=leg(ph), farLeg=leg(ph + math.pi), nearArm=(-22 * math.sin(ph) + 8, 22), farArm=(22 * math.sin(ph) - 8, 18), prop=prop))
    A['run'] = []
    for i in range(6):
        ph = i / 6 * 2 * math.pi
        def leg(p): th = 52 * math.sin(p); return (th, th * 0.2 - 55 * max(0, math.cos(p)))
        A['run'].append(P(hip=(2, -16 + 2 * abs(math.sin(ph))), lean=24, nearLeg=leg(ph), farLeg=leg(ph + math.pi), nearArm=(-50 * math.sin(ph) + 10, 70), farArm=(50 * math.sin(ph) - 10, 60), mouth=1, eyes=2, prop=prop))
    if kind == 'net':
        A['windup'] = [P(hip=(-2, -17), lean=-4, nearArm=(60, 80), farArm=(40, 60), prop=prop, eyes=2)]
        A['atk'] = [P(hip=(-3, -17), lean=-10, nearArm=(40, 70), farArm=(30, 50), prop=prop, eyes=2),
                    P(hip=(-7, -17), lean=-18, nearArm=(76, 90), farArm=(56, 76), prop=prop, mouth=1, eyes=2),
                    P(hip=(-3, -17), lean=-4, nearArm=(62, 82), farArm=(40, 60), prop=prop)]
    else:
        raised = prop in ('baton', 'anchor', 'hook', 'bucket')
        A['windup'] = [P(hip=(-4, -17), lean=-16, nearArm=(-70, -175) if raised else (-60, -90), farArm=(40, 60), nearLeg=(18, -8), farLeg=(-18, 6), prop=prop, eyes=2, mouth=1, head=(-1, 1))]
        A['atk'] = [P(hip=(-5, -17), lean=-20, nearArm=(-80, -180) if raised else (-70, -95), farArm=(50, 70), nearLeg=(20, -10), farLeg=(-20, 8), prop=prop, eyes=2, mouth=1, head=(-1, 1)),
                    P(hip=(6, -15), lean=34, nearArm=(96, 100) if not raised else (70, 62), farArm=(-34, -20), nearLeg=(40, 6), farLeg=(-32, 14), prop=prop, eyes=2, mouth=2, head=(2, 0), trail=(-150, 90, 14) if raised else (20, 100, 14)),
                    P(hip=(4, -16), lean=18, nearArm=(70, 76), farArm=(-18, -4), nearLeg=(26, 0), farLeg=(-20, 8), prop=prop, mouth=1)]
    A['hurt'] = [P(hip=(-3, -17), lean=-14, nearArm=(-60, -50), farArm=(-80, -60), nearLeg=(8, 0), farLeg=(-12, 4), eyes=1, mouth=1, head=(-1, 1), prop=None),
                 P(hip=(-2, -17), lean=-6, nearArm=(-30, -20), farArm=(-40, -20), eyes=1, mouth=0, prop=None)]
    A['down'] = [P(hip=(-4, -20), lean=-48, nearArm=(-90, -70), farArm=(-100, -80), nearLeg=(72, 60), farLeg=(60, 50), eyes=1, mouth=2, prop=None),
                 P(hip=(-1, -8), lean=-84, nearArm=(-110, -100), farArm=(-95, -85), nearLeg=(98, 96), farLeg=(85, 84), eyes=1, mouth=1, prop=None),
                 P(hip=(-1, -8), lean=-86, nearArm=(-115, -100), farArm=(-100, -90), nearLeg=(100, 100), farLeg=(88, 88), eyes=1, mouth=0, prop=None)]
    return A

STYLES = {
    'keeper':  dict(skin='light', shirt='#c9a24a', pants='#6b5a2a', hat='#8a6a22', hat_kind='cap', feature='vest', vest='#7a6a30', hair='#5a3a1a', trim='#e8d070', shoes='#3a2a1a'),
    'guard':   dict(skin='tan', shirt='#3a63c8', pants='#1f2f66', hat='#1b2550', hat_kind='peak', feature='badge', hair='#1a1410', trim='#ffe060', shoes='#10101a'),
    'catcher': dict(skin='light', shirt='#3da35a', pants='#2a5a35', hat='#2a8a4a', hat_kind='helmet', feature='apron', hair='#4a2a14', trim='#e0e060', shoes='#2a2a20', gloves='#e0b040'),
    'cop':     dict(skin='brown', shirt='#27315f', pants='#161c3a', hat='#10142b', hat_kind='peak', feature='badge', hair='#10101a', trim='#d8d8e8', shoes='#080810', stache='#2a1a10', gloves='#1a1a24'),
    'tourist': dict(skin='pale', shirt='#ff7ac8', pants='#3a8ad8', hat='#ffd23a', hat_kind='sunhat', feature='hawaii', shades=True, hair='#8a5a24', shoes='#e8e8e8'),
    'sailor':  dict(skin='brown', shirt='#e8e8e8', pants='#2a3b66', hat='#e8e8f0', hat_kind='sailor', feature='stripes', beard=True, hair='#2a1a10', trim='#3a5ab8', shoes='#1a1a20'),
    'hunter':  dict(skin='tan', shirt='#8a6a3a', pants='#4a3a1e', hat='#6a5a2c', hat_kind='slouch', feature='ammo', hair='#2a1a10', trim='#d0b060', shoes='#2a1c10', stache='#2a1a10'),
}
ENEMY_PROPS = {'keeper': ('bucket', 'melee'), 'guard': ('baton', 'melee'), 'catcher': ('netgun', 'net'), 'cop': ('baton', 'melee'), 'tourist': ('handbag', 'melee'), 'sailor': ('hook', 'melee'), 'hunter': ('netgun', 'net')}
BOSS_STYLES = {
    'headkeeper': (dict(skin='light', shirt='#e0b84a', pants='#5a4a1e', hat='#b02a2a', hat_kind='bighat', feature='sash', trim='#ffe060', hair='#5a3a1a', shoes='#3a1a10', longsleeve=False, stache='#6a3a1a', scale=1.5), 'tranq', 'melee'),
    'chiefcatcher': (dict(skin='light', shirt='#2f9a54', pants='#1b5a31', hat='#e0d23a', hat_kind='helmet', feature='apron', trim='#e0e060', hair='#4a2a14', shoes='#1a2a1a', gloves='#e0b040', scale=1.5), 'netgun', 'net'),
    'riotcaptain': (dict(skin='tan', shirt='#1e2447', pants='#10142b', hat='#0a0d1e', hat_kind='riot', feature='plate', trim='#d8d8e8', shoes='#06060c', gloves='#1a1a24', longsleeve=True, scale=1.55), 'shield', 'melee'),
    'bargeboss': (dict(skin='brown', shirt='#c84a2a', pants='#2a3b66', hat='#e8e8f0', hat_kind='sailor', feature='stripes', trim='#3a5ab8', beard=True, hair='#2a1a10', shoes='#1a1a20', gloves='#7a5a3a', scale=1.7), 'anchor', 'melee'),
    'safarihunter': (dict(skin='tan', shirt='#a98a4a', pants='#3a2a14', hat='#d8c07a', hat_kind='pith', feature='ammo', trim='#f0d890', hair='#6a4a2a', shoes='#1a1008', stache='#8a8a8a', scale=1.65, longsleeve=True), 'rifle', 'net'),
}

def pack(name, anims, renderer, cw, ch, ax, ay):
    order = list(anims.keys())
    frames = []; idx = {}
    for k in order:
        idx[k] = []
        for p in anims[k]:
            idx[k].append(len(frames)); frames.append(p)
    cols = 12
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0))
    flash = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0))
    for i, p in enumerate(frames):
        im = renderer(p, False); fl = renderer(p, True)
        sheet.alpha_composite(im, ((i % cols) * cw, (i // cols) * ch)); flash.alpha_composite(fl, ((i % cols) * cw, (i // cols) * ch))
    sheet.save(os.path.join(OUTD, name + '.png')); flash.save(os.path.join(OUTD, name + '_f.png'))
    return dict(cw=cw, ch=ch, ax=ax, ay=ay, cols=cols, anims=idx)

def build():
    meta = {}
    A = harambe_anims()
    meta['harambe'] = pack('harambe', A, lambda p, f: harambe3.harambe3(p, W=128, H=124, ax=58, ay=116, flash=f), 128, 124, 58, 116)
    for k, st in STYLES.items():
        prop, kind = ENEMY_PROPS[k]
        A = human_anims(prop, kind)
        meta[k] = pack(k, A, lambda p, f, st=st: human(p, dict(st, scale=1.2), W=92, H=92, ax=46, ay=86, flash=f), 92, 92, 46, 86)
    for k, (st, prop, kind) in BOSS_STYLES.items():
        A = human_anims(prop, kind)
        s = st['scale']
        cw, ch = 128, 124
        meta[k] = pack(k, A, lambda p, f, st=st: human(p, dict(st, scale=st['scale'] * 1.12), W=150, H=142, ax=70, ay=134, flash=f), 150, 142, 70, 134)
    json.dump(meta, open(os.path.join(OUTD, 'sprites.json'), 'w'))
    return meta

if __name__ == '__main__':
    build(); print('built')
