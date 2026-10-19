"""Key + trim the painted Stage 2 car hazards (src_cars/car_*.jpg, magenta bg, facing right) into assets/props/cars.webp + cars.json.
Stored at 3x game scale like the other painted props; js/hazdraw.js draws them at w/3 x h/3 and mirrors for dir < 0."""
import os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from keyer import load, key, to_rgba
from build_stageprops import finish
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', '..', 'assets', 'props')
CARS = {'car_a': 60, 'car_b': 68, 'car_c': 66}  # width in game px (hitbox stays +-28 around the centre)
sprites = {}
for name, w in CARS.items():
    a = load(os.path.join(HERE, 'src_cars', name + '.jpg'))
    fg, sc = key(a)
    lab, n = ndi.label(fg); sizes = ndi.sum(fg, lab, range(1, n + 1)); fg = lab == (np.argmax(sizes) + 1)  # biggest blob = the car
    fg = ndi.binary_fill_holes(fg) & (sc < 0.5)  # fill specks inside the body, but never re-add magenta (gap under the sills)
    lab, n = ndi.label(fg); sizes = ndi.sum(fg, lab, range(1, n + 1)); fg = lab == (np.argmax(sizes) + 1)
    sprites[name] = finish(to_rgba(a, fg), ('w', w))
pad = 2; W = sum(s.shape[1] + pad for s in sprites.values()); H = max(s.shape[0] for s in sprites.values())
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); meta = {}; x = 0
for name, s in sprites.items():
    atlas.paste(Image.fromarray(s), (x, 0)); meta[name] = [x, 0, s.shape[1], s.shape[0]]; x += s.shape[1] + pad
atlas.save(os.path.join(OUT, 'cars.webp'), quality=85, alpha_quality=90, method=6)
json.dump(meta, open(os.path.join(OUT, 'cars.json'), 'w'), separators=(',', ':'))
print(meta, os.path.getsize(os.path.join(OUT, 'cars.webp')))
