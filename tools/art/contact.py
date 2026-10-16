import json,sys
from PIL import Image
m=json.load(open('../../assets/sprites.json'))
name=sys.argv[1]; out=sys.argv[2]; z=int(sys.argv[3]) if len(sys.argv)>3 else 3
d=m[name]; sh=Image.open(f'../../assets/{name}.png')
n=sum(len(v) for v in d['anims'].values())
cols=12; rows=(n+cols-1)//cols
bg=Image.new('RGBA',sh.size,(90,120,90,255)); bg.alpha_composite(sh)
bg.resize((bg.width*z//2 if z>1 else bg.width,bg.height*z//2),Image.NEAREST).save(out)
print(d['anims'])
