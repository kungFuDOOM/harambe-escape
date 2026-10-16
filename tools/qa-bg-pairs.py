# Mid-slide shots of every adjacent screen pair in all 5 stages (cam half-way between two stops) plus both edge crossings of each AI plate
# (plate edge in the middle of the view = worst case for ghosting). Also measures floor-vs-hero luminance contrast.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
from PIL import Image
OUT = sys.argv[1]; URL = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
FEAT = {0: [0, 1, 2, 3], 1: [0, 1, 2, 4, 5], 2: [0, 1, 6, 7], 3: [0, 1, 2, 6], 4: [0, 1, 7]}  # edge crossings of a sample of plates per stage (pairs cover every hop)
async def main():
    res = {}
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for si in range(5):
            ctx = await b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); await pg.goto(f'{URL}/?skipintro&god&debugstart&nosave&stage={si}'); await pg.wait_for_function('window.__game&&window.__game.mode')
            await pg.evaluate("window.__game.mode='play'")
            stops = await pg.evaluate("(()=>{const st=window.__stages[window.__game.stage];return [0,...st.events.map(e=>e.at),st.length-320]})()")
            async def shot(x, f):
                await pg.evaluate(f"(()=>{{const G=window.__game;G.cam={x};G.lock={x};G.evIdx=99;G.ents=[];G.boss=null;G.bossSpawned=true;G.p.x={x}+110;G.p.y=150}})()")
                await pg.wait_for_timeout(180); await pg.screenshot(path=f)
            pf = []
            for i in range(len(stops) - 1):
                f = f'{OUT}/pair_s{si+1}_{i+1}-{i+2}.png'; await shot((stops[i] + stops[i + 1]) / 2, f); pf.append(f)
            for i in FEAT[si]:
                for k, d in (('in', -160), ('out', 160)):
                    f = f'{OUT}/edge_s{si+1}_{i+1}_{k}.png'; await shot(stops[i] + d, f); pf.append(f)
            ims = [Image.open(f).resize((422, 195)) for f in pf]; cols = 3; rows = (len(ims) + 2) // 3
            sh = Image.new('RGB', (422 * cols, 195 * rows)); [sh.paste(im, ((n % cols) * 422, (n // cols) * 195)) for n, im in enumerate(ims)]
            sh.save(f'{OUT}/seams_stage{si+1}.png')
            res[si] = stops
            await ctx.close()
        await b.close()
    json.dump(res, open(f'{OUT}/stops.json', 'w'))
asyncio.run(main())
