import sys, importlib
from PIL import Image
def composite(L, cam, parallax=dict(sky=0.05, far=0.15, mid=0.4, near=1.0, ground=1.0), gy=112, W=320, H=180):
    out = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    for k in ('sky', 'far', 'mid', 'near', 'ground'):
        if k not in L: continue
        im = L[k].img(); w = im.width
        y = gy if k == 'ground' else 0
        off = int(cam * parallax[k]) % w
        for i in (-1, 0, 1, 2):
            out.alpha_composite(im, (-off + i * w, y)) if True else None
    return out.crop((0, 0, W, H))
if __name__ == '__main__':
    mod = importlib.import_module(sys.argv[1]); fn = getattr(mod, sys.argv[2]); L = fn()
    cam = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    im = composite(L, cam)
    im.resize((960, 540), Image.NEAREST).save(sys.argv[4] if len(sys.argv) > 4 else '/tmp/bgprev.png')
