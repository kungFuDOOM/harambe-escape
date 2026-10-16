import sys; sys.path.insert(0,'.')
from harambe3 import *
import chars
A=chars.harambe_anims()
names=sys.argv[2:] or ['idle:0','atk1:1','special:1']
sheet=Image.new('RGBA',(128*len(names),112),(70,120,70,255))
for i,n in enumerate(names):
    k,j=n.split(':'); sheet.alpha_composite(harambe3(A[k][int(j)]),(i*128,0))
sheet.resize((sheet.width*3,sheet.height*3),Image.NEAREST).save(sys.argv[1])
