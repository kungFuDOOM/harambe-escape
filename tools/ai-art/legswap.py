"""Harambe: swap the shading of his near (lit, drawn in front) and far (shadow) leg to turn a painted near-leg pose into the
opposite-leg pose. Used by build_harambe_walk.py. mode: contact = the front foot belongs to the near leg; pass = the lifted foot does."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def leg_masks(a, hip_frac=0.56, mode='contact'):
    al=a[...,3]>0; rgb=a[...,:3].astype(float); lum=rgb.mean(2); H,W=al.shape; hip=int(H*hip_frac)
    below=al.copy(); below[:hip]=False
    lab,_=ndi.label(below); bottom_ids=set(lab[H-6:].ravel())-{0}
    legarea=np.isin(lab,list(bottom_ids))
    skin=(rgb[...,0]>rgb[...,2]+25)&(lum>70)
    fur=legarea&~skin
    light=fur&(lum>=45); light[:hip]=False
    l2,n=ndi.label(light); sz=ndi.sum(light,l2,range(1,n+1)); near_core=l2==(np.argmax(sz)+1)
    # near leg = core grown through fur pixels by a few px (catches its own shading/outline), far = the rest of the leg fur
    near=near_core.copy()
    for _ in range(3): near=ndi.binary_dilation(near)&fur
    far=fur&~near
    # feet: skin in leg area, split by connectivity; assign each foot to the leg it touches most
    feet=legarea&skin; fl,fn=ndi.label(ndi.binary_opening(feet,iterations=2))
    nearf=np.zeros_like(al); farf=np.zeros_like(al)
    feets=[]
    for i in range(1,fn+1):
        m=fl==i
        if m.sum()>=300: ys,xs=np.nonzero(m); feets.append((m,xs.mean(),ys.max()))
    if len(feets)>=2:
        # contact: the front foot belongs to the near (front-drawn) leg; passing: the lifted foot (highest sole) does
        key=(lambda f: f[1]) if mode=='contact' else (lambda f: -f[2])
        feets.sort(key=key); nearf[feets[-1][0]]=True
        for f in feets[:-1]: farf[f[0]]=True
    return dict(near=near,far=far,nearfoot=nearf&feet,farfoot=farf&feet,hip=hip,fur=fur)

def stats(rgb,m,keep):
    sel=m&keep; return rgb[sel].mean(0), rgb[sel].std(0)+1e-3

def swap(a, hip_frac=0.56, feather=50, mode='contact'):
    M=leg_masks(a,hip_frac,mode); rgb=a[...,:3].astype(float); lum=rgb.mean(2); H=a.shape[0]
    keep=lum>22   # outline pixels stay as they are
    def lstats(m): v=lum[m&keep]; return v.mean(), v.std()+1e-3
    ln,sn=lstats(M['near']); lf,sf=lstats(M['far'])
    out=rgb.copy()
    w=np.clip((np.arange(H)[:,None]-M['hip'])/feather,0,1)[...,None]   # blend in below the hip so the belly/hip line doesn't get a seam
    # luminance-only transfer (keeps the fur's own hue, so the swapped leg doesn't go blue/flat)
    # luminance: mean/std transfer; colour: each pixel keeps its own tint offset, re-centred on the target leg's average tint
    # (scaling RGB alone pushed the lit-up shadow leg lavender, because shadow fur carries a blue cast)
    C=rgb-lum[...,None]
    def tint(m): return C[m&keep].mean(0)
    cn,cf=tint(M['near']),tint(M['far'])
    def relum(Lt, c0, c1): return np.maximum(Lt,0)[...,None] + C - c0 + c1
    to_far=relum((lum-ln)/sn*sf+lf, cn, cf); to_near=relum((lum-lf)/sf*sn+ln, cf, cn)
    nm=(M['near']&keep)[...,None]; fm=(M['far']&keep)[...,None]
    out=np.where(nm, rgb*(1-w)+to_far*w, out); out=np.where(fm, rgb*(1-w)+to_near*w, out)
    # feet: same idea, milder (feet are skin, the depth cue is ~10-15%)
    for src,dst in (('nearfoot','farfoot'),('farfoot','nearfoot')):
        if M[src].sum()>50 and M[dst].sum()>50:
            ls_,ss_=lstats(M[src]); ld,sd=lstats(M[dst])
            out=np.where((M[src]&keep)[...,None], relum((lum-ls_)/ss_*sd+ld, tint(M[src]), tint(M[dst])), out)
    o=a.copy(); o[...,:3]=np.clip(out,0,255).astype(np.uint8); return o, M
