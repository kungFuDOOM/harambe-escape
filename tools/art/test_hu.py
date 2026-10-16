from rig import *
import sys
st=dict(skin='light',shirt='#c9a24a',pants='#6b5a2a',hat='#8a6a22',hat_kind='cap',feature='vest',trim='#e8d070')
poses=[P(hip=(0,-17),lean=6),P(hip=(0,-17),lean=6,nearArm=(60,80),prop='tranq',mouth=1,eyes=2)]
sts=[st, dict(st,hat_kind='peak',shirt='#3a63c8',pants='#1f2f66',hat='#1b2550',feature='badge'), dict(st,hat_kind='sunhat',shades=True,feature='hawaii',shirt='#ff7ac8',pants='#3a8ad8',hat='#ffd23a'),
 dict(st,hat_kind='pith',hat='#d8c07a',stache='#6a4a2a',skin='tan'), dict(st,hat_kind='riot',shirt='#1e2447',feature='plate'), dict(st,hat_kind='sailor',hat='#e8e8e8',shirt='#e8e8e8',feature='stripes',skin='brown',beard=True,hair='#2a1a10')]
W=76;H=76
sheet=Image.new('RGBA',(W*len(sts),H*2),(90,140,90,255))
for j,t in enumerate(sts):
  for i,p in enumerate(poses):
    sheet.alpha_composite(human(p,t),(j*W,i*H))
sheet.resize((sheet.width*3,sheet.height*3),Image.NEAREST).save(sys.argv[1])
