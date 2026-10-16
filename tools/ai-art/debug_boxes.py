import sys, numpy as np
from PIL import Image, ImageDraw
from keyer import *
src='/workspace/art-src/'
for name in ['hero','enemy-zookeepers','enemy-cops','enemy-fbi','enemy-military','bosses']:
    a=load(src+name+'.jpg'); fg,_=key(a)
    comps=components(fg); rows=[[b for b in r] for r in order([c[0] for c in comps])]
    im=Image.fromarray(to_rgba(a,fg)); bgc=Image.new('RGBA',im.size,(70,150,70,255)); bgc.alpha_composite(im)
    d=ImageDraw.Draw(bgc); k=0
    print(name,[len(r) for r in rows])
    for ri,r in enumerate(rows):
        for ci,b in enumerate(r):
            d.rectangle(b,outline=(255,255,0)); d.text((b[0]+2,b[1]+2),f'{ri}.{ci}',fill=(255,255,255))
    bgc.convert('RGB').save(f'/workspace/dbg_{name}.png')
