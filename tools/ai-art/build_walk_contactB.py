#!/usr/bin/env python3
"""Opposite-leg contact frame (anims.contactB) for the enemies/bosses.

Every painted stride has the NEAR leg forward (the image generator would not paint the other leg forward, even when asked), so a
stride-pass-stride-pass cycle showed the same leg leading every step. legswap_human.swap_contact() swaps the trouser shading of the
near (lit) and far (shadow) leg of the stride frame, which in side view is exactly what the other contact pose looks like. The walk
then alternates stride (A), passing, contactB, passing (js/sprites.js enemyWalkPose).

Characters whose legs are covered by a prop (shields, the briefcase) or whose trousers carry no depth shading to swap (armour,
long coats) are skipped and keep the A-only cycle: see SKIP.

  python3 tools/ai-art/build_walk_contactB.py      (run after build_walk_pass.py; idempotent)
"""
import json, os, re, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from legswap_human import swap_contact
ROOT = os.path.join(HERE, '..', '..'); META = os.path.join(ROOT, 'assets', 'atlas.json')
SKIP = {
    'cop_shield': 'riot shield covers the near leg',
    'soldier_shield': 'riot shield covers the near leg',
    'boss_captain': 'riot shield covers the near leg; almost no leg shading (3.7)',
    'agent_case': 'briefcase hangs over the thighs and gets caught in the leg mask',
    'boss_general': 'armour plates: the swap recolours the knee pads into noise',
    'boss_baron': 'trench coat over the legs: the swap leaves a seam in the coat',
    'boss_agent': 'navy trousers carry almost no near/far shading (gap 4): the swap would not show',
}

def drop_last(m, sheet, key):
    """Remove the generated frame `key` (always the last frame, at the sheet's right edge)."""
    if key not in m['anims']: return sheet
    i = m['anims'][key][0]; f = m['frames'][i]
    assert i == len(m['frames']) - 1 and f['x'] + f['w'] == sheet.width, key
    sheet = sheet.crop((0, 0, max(1, f['x'] - 2), sheet.height)); m['frames'].pop(); del m['anims'][key]
    return sheet.crop((0, 0, sheet.width, max(ff['y'] + ff['h'] for ff in m['frames'])))

def stride_frames():
    src = open(os.path.join(ROOT, 'js', 'sprites.js')).read()
    return {k: int(v.split(',')[-1]) for k, v in re.findall(r"(\w+): \{ poses: \[([\d, ]+)\]", src)}

def main():
    meta = json.load(open(META)); stride = stride_frames()
    for name, m in meta.items():
        if name == 'harambe': continue
        path = os.path.join(ROOT, 'assets', m['img']); sheet = Image.open(path).convert('RGBA')
        sheet = drop_last(m, sheet, 'contactB')
        if name in SKIP: sheet.save(path, optimize=True); print(f'{name}: skipped ({SKIP[name]})'); continue
        f = m['frames'][stride[name]]
        a = np.array(sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])))
        b, M = swap_contact(a); assert b is not None, name
        x = sheet.width + 2; ns = Image.new('RGBA', (x + f['w'], max(sheet.height, f['h'])), (0, 0, 0, 0))
        ns.paste(sheet, (0, 0)); ns.paste(Image.fromarray(b), (x, 0))
        m['frames'].append({'x': x, 'y': 0, 'w': f['w'], 'h': f['h'], 'ax': f['ax'], 'ay': f['ay']}); m['anims']['contactB'] = [len(m['frames']) - 1]
        ns.save(path, optimize=True); print(f"{name}: contactB from frame {stride[name]} (leg shading gap {M['cue']:.1f})")
    with open(META, 'w') as fh: json.dump(meta, fh, separators=(',', ':'))

if __name__ == '__main__':
    main()
