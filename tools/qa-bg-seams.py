# For every AI-plate screen: screenshot the camera sliding INTO it (-300..0 px before its stop, steps of 60) so the soft edge blend is visible.
import asyncio, sys, os
from playwright.async_api import async_playwright
from PIL import Image
OUT = sys.argv[1]; URL = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
FEAT = {0: [2, 4], 1: [2, 4], 2: [4, 5], 3: [4], 4: [4, 6]}
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for si, idxs in FEAT.items():
            ctx = await b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); await pg.goto(f'{URL}/?skipintro&god&debugstart&nosave&stage={si}'); await pg.wait_for_function('window.__game&&window.__game.mode')
            await pg.evaluate("window.__game.mode='play'")
            stops = await pg.evaluate("(()=>{const st=window.__stages[window.__game.stage];return [0,...st.events.map(e=>e.at),st.length-320]})()")
            for i in idxs:
                fs = []
                for d in (-300, -240, -180, -120, -60, 0):
                    x = stops[i] + d
                    await pg.evaluate(f"(()=>{{const G=window.__game;G.cam={x};G.lock={x};G.evIdx=99;G.ents=[];G.boss=null;G.bossSpawned=true;G.p.x={x}+110;G.p.y=150}})()")
                    await pg.wait_for_timeout(200); f = f'/tmp/s_{si}_{i}_{d}.png'; await pg.screenshot(path=f); fs.append(f)
                ims = [Image.open(f).crop((0, 0, 700, 390)).resize((350, 195)) for f in fs]
                sh = Image.new('RGB', (350 * 3, 195 * 2)); [sh.paste(im, ((k % 3) * 350, (k // 3) * 195)) for k, im in enumerate(ims)]
                sh.save(f'{OUT}/seam_stage{si+1}_screen{i+1}.png')
            await ctx.close()
        await b.close()
asyncio.run(main())
