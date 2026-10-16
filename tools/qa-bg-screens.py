# Walk every stage through all its screens at 844x390 (touch layout), screenshot each, write contact sheets, measure frame time.
import asyncio, os, sys, json, subprocess
from playwright.async_api import async_playwright
from PIL import Image
OUT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/shots-harambe-v20'; os.makedirs(OUT, exist_ok=True)
URL = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8115'
NAMES = ['zoo', 'street', 'office', 'base', 'jungle']
async def main():
    res = {}
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for si, nm in enumerate(NAMES):
            ctx = await b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=int(os.environ.get('DPR','1')))
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            await pg.goto(f'{URL}/?skipintro&god&debugstart&nosave&stage={si}'); await pg.wait_for_function('window.__game&&window.__game.mode')
            await pg.evaluate("window.__game.mode='play'"); await pg.wait_for_timeout(300)
            stops = await pg.evaluate("(()=>{const st=window.__stages[window.__game.stage];return [0,...st.events.map(e=>e.at),st.length-320]})()")
            files = []
            for i, x in enumerate(stops):
                await pg.evaluate(f"(()=>{{const G=window.__game;G.cam={x};G.lock={x};G.evIdx=99;G.ents=[];G.boss=null;G.bossSpawned=true;G.p.x={x}+110;G.p.y=150}})()")
                await pg.wait_for_timeout(260)
                f = f'{OUT}/{nm}_{i+1:02d}.png'; await pg.screenshot(path=f); files.append(f)
            # slide: scrub between stop 0 and 1 and measure frame times over the whole stage scroll
            ft = await pg.evaluate("""(async()=>{const G=window.__game;G.lock=null;G.ents=[];const end=G.cam;const st=window.__stages[G.stage];const L=st.length-320;let ts=[],last=performance.now();
              for(let k=0;k<180;k++){G.cam=L*k/180;G.p.x=G.cam+110;await new Promise(r=>requestAnimationFrame(r));const n=performance.now();ts.push(n-last);last=n}
              ts.sort((a,b)=>a-b);return {median:ts[90],p95:ts[171],max:ts[179]}})()""")
            res[nm] = dict(screens=len(stops), stops=stops, frame_ms=ft, errors=errs[:3])
            ims = [Image.open(f) for f in files]; w, h = 422, 195; cols = 3; rows = (len(ims) + cols - 1) // cols
            sh = Image.new('RGB', (w * cols, h * rows), (10, 10, 14))
            for i, im in enumerate(ims): sh.paste(im.resize((w, h)), ((i % cols) * w, (i // cols) * h))
            sh.save(f'{OUT}/contact_{nm}.png')
            await ctx.close()
        await b.close()
    json.dump(res, open(f'{OUT}/qa.json', 'w'), indent=1); print(json.dumps(res))
asyncio.run(main())
