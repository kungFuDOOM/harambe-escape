import sys,json,base64,struct,wave; sys.path.insert(0,'/workspace')
from design_harness import *
import numpy as np
JS='''async ([name,intense,loops])=>{
 const M=await import('/js/music.js'); let tr=M.TRACKS[name]; if(!tr&&name.endsWith('_boss')) tr=M.bossOf(M.TRACKS[name.replace('_boss','')]);
 const sr=44100; const secs=M.loopSeconds(tr)*loops+2.5; const oc=new OfflineAudioContext(1,Math.ceil(secs*sr),sr);
 const bus=oc.createGain(); bus.gain.value=0.3; bus.connect(oc.destination);
 const nb=oc.createBuffer(1,sr/2,sr); const d=nb.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
 const V=M.voices(oc,bus,nb); const spb=60/tr.tempo/4; for(let s=0;s<128*loops;s++) M.playStep(V,tr,s,0.05+s*spb,{intense});
 const buf=await oc.startRendering(); const a=buf.getChannelData(0); const out=new Int16Array(a.length); let pk=0,nan=0;
 for(let i=0;i<a.length;i++){let v=a[i]; if(!isFinite(v)){nan++;v=0} pk=Math.max(pk,Math.abs(v)); out[i]=Math.max(-1,Math.min(1,v))*32767;}
 return {sr,loop:M.loopSeconds(tr),pk,nan,pcm:Array.from(out)}; }'''
JSJ='''async (name)=>{ const M=await import('/js/music.js'); const sr=44100, oc=new OfflineAudioContext(1,sr*5,sr); const bus=oc.createGain(); bus.gain.value=0.3; bus.connect(oc.destination);
 const nb=oc.createBuffer(1,sr/2,sr); const d=nb.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; M.playJingle(M.voices(oc,bus,nb),name,0.05);
 const buf=await oc.startRendering(); const a=buf.getChannelData(0); let pk=0; const out=new Int16Array(a.length); for(let i=0;i<a.length;i++){pk=Math.max(pk,Math.abs(a[i])); out[i]=Math.max(-1,Math.min(1,a[i]))*32767;} return {sr,pk,pcm:Array.from(out)};}'''
JSC='''async (i)=>{ const M=await import('/js/music.js'); const sr=44100, cfg={root:[50,48,46,45,52][i],tempo:[84,80,78,76,70][i],mode:i%2?'dorian':'minor'}; const oc=new OfflineAudioContext(1,sr*16,sr); const bus=oc.createGain(); bus.gain.value=0.3; bus.connect(oc.destination);
 const nb=oc.createBuffer(1,sr/2,sr); const d=nb.getChannelData(0); for(let k=0;k<d.length;k++) d[k]=Math.random()*2-1; const V=M.voices(oc,bus,nb); const spb=60/cfg.tempo/2; for(let s=0;s<64;s++) M.playCue(V,cfg,s,0.05+s*spb,i+3);
 const buf=await oc.startRendering(); const a=buf.getChannelData(0); let pk=0; const out=new Int16Array(a.length); for(let k=0;k<a.length;k++){pk=Math.max(pk,Math.abs(a[k])); out[k]=Math.max(-1,Math.min(1,a[k]))*32767;} return {sr,pk,pcm:Array.from(out)};}'''
def wav(path,r):
    pcm=np.array(r['pcm'],dtype=np.int16); w=wave.open(path,'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(r['sr']); w.writeframes(pcm.tobytes()); w.close(); return pcm.astype(float)/32767
async def main():
    srv=serve(8171)
    try:
      async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(bypass_csp=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8171/index.html?nosave'); await pg.wait_for_timeout(800)
        jobs=[(n,False) for n in ['title','stage0','stage1','stage2','stage3','stage4']]+[(n+'_boss',True) for n in ['stage0','stage1','stage2','stage3','stage4']]+[('stage0',True),('stage4',True)]
        for n,it in jobs:
            r=await pg.evaluate(JS,[n,it,2 if n=='title' else 1]); x=wav(f'/tmp/shots-design/music/{n}{"_fight" if (it and not n.endswith("_boss")) else ""}.wav',r)
            rms=np.sqrt((x**2).mean()); loopn=int(r['loop']*r['sr'])
            print(f'{n:14s}{"+fight" if it and not n.endswith("_boss") else "":7s} loop {r["loop"]:.1f}s peak {r["pk"]:.2f} rms {20*np.log10(rms+1e-9):.1f}dBFS nan {r["nan"]}')
        for n in ['clear','over']:
            r=await pg.evaluate(JSJ,n); x=wav(f'/tmp/shots-design/music/jingle_{n}.wav',r); print('jingle',n,'peak %.2f'%r['pk'])
        for i in range(5):
            r=await pg.evaluate(JSC,i); x=wav(f'/tmp/shots-design/music/cutscene{i}.wav',r); print('cutscene',i,'peak %.2f'%r['pk'],'rms %.1fdB'%(20*np.log10(np.sqrt((x**2).mean())+1e-9)))
        print('errors',errs)
        await b.close()
    finally: srv.terminate()
asyncio.run(main())
