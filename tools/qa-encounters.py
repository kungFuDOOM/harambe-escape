import sys,json; sys.path.insert(0,'/workspace')
from design_harness import *
BOT='''()=>{ if(window.__bot) return; const G=window.__game, C=window.__input.core; let tog=false;
 window.__bot=setInterval(()=>{ const p=G.p; if(!p||G.mode!=='play') return; const es=G.ents.filter(e=>e.state!=='dead'&&e.state!=='drop');
  let t=null,bd=1e9; for(const e of es){const d=Math.abs(e.x-p.x)+Math.abs(e.y-p.y)*2; if(d<bd){bd=d;t=e}}
  const set=(k,v)=>C.set('bot',k,v);
  if(!t){ set('left',false);set('right',false);set('up',false);set('down',false);set('atk',false); return;}
  const dx=t.x-p.x, dy=t.y-p.y; set('right',dx>26); set('left',dx<-26); set('down',dy>5); set('up',dy<-5);
  tog=!tog; set('atk', Math.abs(dx)<46 && tog); if(Math.abs(dx)<46&&Math.random()<0.1) set('heavy',tog); else set('heavy',false); },40); }'''
async def stage(b,si,port,res,shots):
    pg,errs=await open_game(b,844,390,q=f'debugstart&nosave&nolb&god&stage={si}',port=port)
    S=await pg.evaluate('()=>window.__stages[%d]'%si)
    evs=S['events']; await pg.evaluate(BOT)
    for i,ev in enumerate(evs):
        await pg.evaluate('(a)=>{const G=__game; G.evIdx=a[0]; G.cam=a[1]-3; G.lock=null; G.p.x=a[1]+130; G.p.y=148; G.ents=[]; G.haz=[]; G.proj=[]; G.idleT=0;}',[i,ev['at']])
        t0=await pg.evaluate('()=>__game.t'); shot=0; seen=set(); done=False
        for k in range(900):
            await pg.wait_for_timeout(100)
            st=await pg.evaluate('()=>({l:__game.lock,t:__game.t,h:__game.haz.map(h=>h.k),n:__game.ents.length,q:__game.queue.length,tags:__game.ents.filter(e=>e.tag).length,drops:__game.ents.filter(e=>e.state==="drop").length,lobs:__game.proj.filter(p=>p.lob).length,mode:__game.mode})')
            if st['mode']!='play': break
            if st['l'] is None and k>5: done=True; break
            for key,cond in (('haz',any(h in('car','roll','spot') for h in st['h']) or 'drop' in st['h']),('elite',st['tags']>0),('drop',st['drops']>0),('lob',st['lobs']>0)):
                if cond and key not in seen and shot<3 and len(shots)<40: seen.add(key); shot+=1; await pg.wait_for_timeout(250); await pg.screenshot(path=f'/tmp/shots-design/play2/s{si+1}_e{i+1}_{key}.png'); shots.append(f's{si+1}_e{i+1}_{key}')
        tt=await pg.evaluate('()=>__game.t')
        res.append((si+1,i+1,ev.get('title'),'cleared' if done else 'STUCK', round(tt-t0,1)))
    res.append((si+1,'errors',errs[:5]))
    await pg.close()
async def main():
    srv=serve(8172); res=[]; shots=[]
    try:
      async with async_playwright() as p:
        b=await p.chromium.launch()
        only=[int(x) for x in sys.argv[1:]] or range(5)
        await asyncio.gather(*[stage(b,si,8172,res,shots) for si in only])
        await b.close()
    finally: srv.terminate()
    for r in sorted(res,key=lambda r:(r[0],str(r[1]))): print(r)
    print(shots)
asyncio.run(main())
