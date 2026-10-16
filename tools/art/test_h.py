from rig import *
import sys
poses = [P(), P(nearArm=(60,80), farArm=(-30,-60), lean=20, mouth=2, eyes=2)]
W=84;H=76
sheet = Image.new('RGBA',(W*len(poses),H),(90,140,90,255))
for i,p in enumerate(poses):
    sheet.alpha_composite(harambe(p), (i*W,0))
sheet.resize((sheet.width*5, sheet.height*5), Image.NEAREST).save('/tmp/h_test2.png')
