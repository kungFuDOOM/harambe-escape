import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import font, chars, props, stages1, stages2, stages3, extra
OUT = chars.OUTD
font.build(os.path.join(OUT, 'font.png'))
chars.build()
props.prop_sheet()
for name, fn in (('zoo', stages1.zoo), ('street', stages2.street), ('river', stages2.river), ('night', stages3.night), ('jungle', stages3.jungle)):
    L = fn()
    for k, cv in L.items():
        im = cv.img()
        if name == 'jungle' and k == 'near': im = extra.orchids(extra.add_fronds(im, 5, 9, [90, 190, 300, 420, 520, 640, 740, 840, 460]), 9, 14)
        if name == 'jungle' and k == 'mid': im = extra.add_fronds(im, 6, 7, [40, 130, 230, 330, 420, 520, 600])
        im.save(os.path.join(OUT, f'bg_{name}_{k}.png'))
print('assets built')
