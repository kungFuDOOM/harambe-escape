# Pause-freeze QA: pause in several hero states, sample the canvas every 50ms for 2s, diff vs first paused frame.
import subprocess, time, os, sys, json
from playwright.async_api import async_playwright
import asyncio
OUT=sys.argv[1] if len(sys.argv)>1 else '/workspace/shots-harambe-v11'; os.makedirs(OUT,exist_ok=True)
SNAP="""(()=>{const c=document.getElementById('c'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<d.length;i+=4){h=(h*31+d[i]+d[i+1]*3+d[i+2]*7)|0}
const G=window.__game,p=G.p;return {h,gt:+G.t.toFixed(3),px:p.x,py:p.y,pz:p.z,pt:+p.t.toFixed(3),pst:+p.st.toFixed(3),wd:p.wd,state:p.state,inv:+p.inv.toFixed(3),cam:G.cam,ents:G.ents.map(e=>[e.x,e.y,e.t].join()).join('|')}})()"""
SETUP={
 'idle':"", 'walking':"", 'attacking':"", 'jumping':"",
 'hitstun':"G.p.state='hurt';G.p.st=0;G.p.inv=2.5;G.p.hp=60",
 'invuln_idle':"G.p.inv=2.5",
}
async def run(vp,touch,mode,name):
    async with async_playwright() as pw:
        b=await pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(viewport={'width':vp[0],'height':vp[1]},has_touch=touch,is_mobile=touch)
        pg=await ctx.new_page(); await pg.goto('http://localhost:8099/?skipintro&god&debugstart&nosave'); await pg.wait_for_function('window.__game&&window.__game.mode=="play"')
        await pg.wait_for_timeout(1500)
        await pg.evaluate("(()=>{const G=window.__game;G.hitstop=0;})()")
        if name in('hitstun','invuln_idle'): await pg.evaluate("(()=>{const G=window.__game;"+SETUP[name]+"})()")
        if name=='walking': await pg.keyboard.down('d')
        if name=='attacking': await pg.keyboard.press('j')
        if name=='jumping': await pg.keyboard.press(' ')
        await pg.wait_for_timeout(180)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(120)
        paused=await pg.evaluate("window.__game.paused")
        snaps=[]
        for i in range(40):
            snaps.append(await pg.evaluate(SNAP)); await pg.wait_for_timeout(50)
            if i==20: await pg.screenshot(path=f'{OUT}/{mode}_{name}.png')
        await b.close()
    base=snaps[0]; frames=len({s['h'] for s in snaps})
    drift={k for s in snaps for k in s if k!='h' and s[k]!=base[k]}
    return dict(scenario=name,paused=paused,distinct_canvas_frames=frames,changing_fields=sorted(drift))
async def hidden():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
        pg=await ctx.new_page(); await pg.goto('http://localhost:8099/?skipintro&god&debugstart&nosave'); await pg.wait_for_function('window.__game&&window.__game.mode=="play"')
        await pg.wait_for_timeout(1200)
        await pg.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(300); a=await pg.evaluate(SNAP); pz=await pg.evaluate("window.__game.paused")
        await pg.wait_for_timeout(1500); c=await pg.evaluate(SNAP)
        await pg.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(300); d=await pg.evaluate(SNAP)
        await b.close()
    return dict(scenario='tab_hidden',paused=pz,distinct_canvas_frames=1 if a['h']==c['h']==d['h'] else 2,changing_fields=[k for k in a if k!='h' and a[k]!=d[k]])
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8099'],cwd='/workspace/harambe-escape',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    res=[]
    try:
        for name in SETUP: res.append(await run((844,390),True,'touch',name))
        res.append(await hidden())
    finally: srv.kill()
    json.dump(res,open(f'{OUT}/result.json','w'),indent=1)
    for r in res: print(r)
    bad=[r for r in res if not r['paused'] or r['distinct_canvas_frames']!=1]
    sys.exit(1 if bad else 0)
asyncio.run(main())
