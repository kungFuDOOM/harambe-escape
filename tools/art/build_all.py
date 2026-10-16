import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import font, chars, props, stages1, stages2, stages3
OUT = chars.OUTD
font.build(os.path.join(OUT, 'font.png'))
chars.build()
props.prop_sheet()
for name, fn in (('zoo', stages1.zoo), ('street', stages2.street), ('river', stages2.river), ('night', stages3.night), ('jungle', stages3.jungle)):
    L = fn()
    for k, cv in L.items():
        cv.img().save(os.path.join(OUT, f'bg_{name}_{k}.png'))
print('assets built')
