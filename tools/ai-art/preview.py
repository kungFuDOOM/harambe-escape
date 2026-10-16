import json, sys
from PIL import Image, ImageDraw
A='/workspace/harambe-escape/assets/'
meta=json.load(open(A+'atlas.json'))
names=sys.argv[2:] or list(meta)
out=sys.argv[1]
rows=[]
for n in names:
    m=meta[n]; at=Image.open(A+m['img']).convert('RGBA')
    seq=[]
    for an,l in m['anims'].items():
        for i in l: seq.append((an,i))
    cw=max(f['w'] for f in m['frames'])+10; ch=max(f['h'] for f in m['frames'])+24
    row=Image.new('RGBA',(cw*len(seq),ch),(60,110,70,255)); d=ImageDraw.Draw(row)
    for k,(an,i) in enumerate(seq):
        f=m['frames'][i]; crop=at.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
        ox=k*cw+cw//2-f['ax']; oy=ch-14-f['ay']
        row.alpha_composite(crop,(ox,oy))
        d.line((k*cw+cw//2,0,k*cw+cw//2,ch),fill=(255,255,0,120)); d.text((k*cw+2,ch-12),an,fill=(255,255,255))
    d.line((0,ch-14,row.size[0],ch-14),fill=(255,0,0))
    # wrap into chunks of 9 frames
    per=9
    for c in range(0,len(seq),per):
        rows.append((n,row.crop((c*cw,0,min(len(seq),c+per)*cw,ch))))
W=max(r.size[0] for _,r in rows); Hh=sum(r.size[1] for _,r in rows)
sheet=Image.new('RGBA',(W,Hh),(0,0,0,255)); y=0
for n,r in rows: sheet.paste(r,(0,y)); y+=r.size[1]
sheet.convert('RGB').save(out)
