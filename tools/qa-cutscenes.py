import asyncio, subprocess, time, os
from playwright.async_api import async_playwright
OUT='/workspace/shots-harambe-v8'; os.makedirs(OUT,exist_ok=True)
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8099'],cwd='/workspace/harambe-escape',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8099/?god&debugstart'); await pg.wait_for_function('window.__game&&window.__game.mode=="play"')
        # walk strip
        await pg.evaluate("window.__game.stage=0")
        await pg.keyboard.down('d')
        for i in range(8):
            await pg.wait_for_timeout(95); await pg.screenshot(path=f'{OUT}/walk_{i}.png',clip={'x':0,'y':100,'width':844,'height':290})
        await pg.keyboard.up('d')
        # cutscenes
        for idx in range(5):
            await pg.evaluate(f"window.__cutscene({idx})")
            n=await pg.evaluate("window.__game.cs && 0")
            panels=[4,3,3,4,4][idx]; panels=await pg.evaluate("1")
            k=0
            while True:
                st=await pg.evaluate("[window.__game.mode, window.__game.cs.panel]")
                if st[0]!='cutscene': break
                await pg.wait_for_timeout(700)
                await pg.screenshot(path=f'{OUT}/cs{idx}_p{st[1]}_a.png')
                await pg.wait_for_timeout(1500)
                await pg.screenshot(path=f'{OUT}/cs{idx}_p{st[1]}_b.png')
                # tap to finish text, tap to advance (touch tap on canvas centre)
                await pg.touchscreen.tap(400,200); await pg.wait_for_timeout(250)
                await pg.touchscreen.tap(400,200); await pg.wait_for_timeout(250)
                k+=1
                assert k<10
            mode=await pg.evaluate("[window.__game.mode,window.__game.stage]"); print('cs',idx,'->',mode)
        # skip test
        await pg.evaluate("window.__cutscene(1)"); await pg.wait_for_timeout(400)
        await pg.touchscreen.tap(740,20); await pg.wait_for_timeout(300)
        print('after skip tap',await pg.evaluate("[window.__game.mode,window.__game.stage]"))
        print('errors',errs)
        await b.close()
    srv.terminate()
asyncio.run(main())
