from PIL import Image, ImageDraw, ImageFont
import numpy as np, sys
SRC='/cursor/stores/store-0083e5c2-6aa2-4ae8-ad03-786ae6a42dd9/grok-bot/agents/35716b97-4be4-4651-94d6-dbdcff908a77/attachments/a7cfb470e36ceb5908df70aeb36d63349f64eb393c04014acfba90bab9a6ea94.jpg'
src=Image.open(SRC).convert('RGB')
a=np.array(src).max(2)>60
ys,xs=np.where(a); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
cx,cy=(x0+x1)/2,(y0+y1)/2; D=max(x1-x0,y1-y0)
print('ring bbox',x0,x1,y0,y1,'center',cx,cy,'D',D)
def badge(size,frac):
    # square canvas; ring diameter = frac*size, centered exactly
    side=D/frac  # source px covered by canvas
    l,t=cx-side/2,cy-side/2
    return src.transform((size,size),Image.AFFINE,(side/size,0,l,0,side/size,t),Image.BICUBIC)
def out(img,name): img.save('icons/'+name,optimize=True)
out(badge(180,.94),'apple-touch-icon-v14.png')
out(badge(512,.94),'apple-touch-icon-512-v14.png')
out(badge(512,.94),'favicon-512-v14.png')
out(badge(192,.94),'favicon-192-v14.png')
out(badge(32,.96),'favicon-32-v14.png')
out(badge(512,.74),'maskable-512-v14.png')
# og
W,H=1200,630
og=Image.new('RGB',(W,H),(5,16,10))
bs=560; b=badge(bs,.96); bx,by=40,(H-bs)//2
og.paste(b,(bx,by))
d=ImageDraw.Draw(og)
import glob
fs=glob.glob('/usr/share/fonts/**/*Bold*.ttf',recursive=True)+glob.glob('/usr/share/fonts/**/*.ttf',recursive=True)
f=lambda s:ImageFont.truetype(fs[0],s)
d.text((640,190),'HARAMBE',font=f(78),fill=(255,200,40))
d.text((640,285),'ESCAPE',font=f(78),fill=(255,200,40))
d.text((640,410),'JUNGLE BRAWL',font=f(48),fill=(110,220,70))
d.text((640,480),'Single-player beat-em-up',font=f(32),fill=(230,230,230))
out(og,'og-image-v14.png')
