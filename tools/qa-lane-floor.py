# For every screen of every stage at 844x390: player at lane top, then lane bottom, with enemies+banana at both lane edges. Screenshots for review.
import asyncio, os, sys, subprocess, time
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/shots-harambe-v28'; os.makedirs(OUT, exist_ok=True)
URL = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8127'
NAMES = ['zoo', 'street', 'office', 'base', 'jungle']
JS = """async (x)=>{const {ENEMIES}=await import('/js/levels.js');const G=window.__game,st=window.__stages[G.stage];
 G.cam=x;G.lock=x;G.evIdx=99;G.boss=null;G.bossSpawned=true;G.items=[];G.ents=[];
 const keys=Object.keys(ENEMIES);
 const mk=(k,px,py,face)=>{const d=ENEMIES[k];return {type:d.sheet,boss:false,d,x:px,y:py,z:0,vx:0,vy:0,vz:0,face,hp:99,max:99,spd:0,dmg:0,cdm:1,maxAtk:0,state:'idle',t:0,st:0,cd:99,w:16,slot:30,hurtT:0,inv:0,rage:false,hit:false,move:null,dead:0}};
 const T=G.lane.top,B=G.lane.bot;
 G.ents.push(mk(keys[0],x+250,T,-1),mk(keys[1%keys.length],x+210,B,-1),mk(keys[0],x+60,T,1),mk(keys[1%keys.length],x+75,B,1));
 G.items.push({x:x+160,y:T,kind:'banana',heal:25},{x:x+190,y:B,kind:'banana',heal:25});
 window.__setP=(y)=>{G.p.x=x+130;G.p.y=y;G.p.z=0;G.p.vx=0;G.p.state='idle'};
 return [T,B]}"""
async def main():
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8127'], cwd=os.path.join(os.path.dirname(__file__), '..'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for si, nm in enumerate(NAMES):
            ctx = await b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'{URL}/?skipintro&god&debugstart&nosave&stage={si}'); await pg.wait_for_function('window.__game&&window.__game.mode')
            await pg.evaluate("window.__game.mode='play'"); await pg.wait_for_timeout(300)
            stops = await pg.evaluate("(()=>{const st=window.__stages[window.__game.stage];return [0,...st.events.map(e=>e.at),st.length-320]})()")
            pairs = []
            for i, x in enumerate(stops):
                T, B = await pg.evaluate(JS, x); fs = []
                for tag, y in (('top', T), ('bot', B)):
                    await pg.evaluate(f"window.__setP({y})"); await pg.wait_for_timeout(120)
                    await pg.evaluate(f"window.__setP({y})"); await pg.wait_for_timeout(150)
                    f = f'{OUT}/{nm}_{i+1:02d}_{tag}.png'; await pg.screenshot(path=f); fs.append(f)
                pairs.append(fs)
            w, h = 422, 195; cols = 2; rows = len(pairs)
            # two sheets per stage keep them legible
            half = (rows + 1) // 2
            for part, chunk in enumerate((pairs[:half], pairs[half:])):
                if not chunk: continue
                sh = Image.new('RGB', (w * 2, h * len(chunk)))
                for r, fs in enumerate(chunk):
                    for c, f in enumerate(fs): sh.paste(Image.open(f).resize((w, h)), (c * w, r * h))
                sh.save(f'{OUT}/lane_{nm}_{part+1}.png')
            print(nm, len(stops), 'errors', errs[:2]); await ctx.close()
        await b.close()
    srv.terminate()
asyncio.run(main())
