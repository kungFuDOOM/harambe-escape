import asyncio, subprocess, time, os, json
from playwright.async_api import async_playwright
OUT='/workspace/shots-harambe-v9'; os.makedirs(OUT,exist_ok=True)
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8099'],cwd='/workspace/harambe-escape',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        G=lambda e: pg.evaluate("(()=>{const G=window.__game;return "+e+"})()")
        async def tap(item):  # tap centre of menu item i in canvas coords
            r=await pg.evaluate("(()=>{const G=window.__game,it=G.menu.items[%d].r,c=document.getElementById('c').getBoundingClientRect();return [c.left+(it.x+it.w/2)/320*c.width,c.top+(it.y+it.h/2)/180*c.height,it.h/180*c.height]})()"%item)
            assert r[2]>=34, 'tap target too small %s'%r[2]
            await pg.touchscreen.tap(r[0],r[1]); await pg.wait_for_timeout(250)
        async def shot(n): await pg.screenshot(path=f'{OUT}/{n}.png')
        await pg.goto('http://localhost:8099/?skipintro'); await pg.wait_for_function('window.__game')
        await pg.wait_for_timeout(1500)
        assert await G("G.mode")=='title' and await G("G.menu.items.length")==1, 'no save: only New Game'
        await shot('01_title_no_save')
        await tap(0)
        assert await G("G.mode")=='stageintro'; assert await pg.evaluate("localStorage.getItem('harambe-save')")
        await pg.wait_for_function('window.__game.mode=="play"',timeout=8000)
        await shot('02_play')
        # simulate progress, pause
        await pg.evaluate("window.__game.score=1234;window.__game.p.lives=2")
        await pg.touchscreen.tap(844-14-19,10+19)  # pause button
        await pg.wait_for_timeout(300)
        assert await G("G.paused") and await G("G.menu.kind")=='pause'; await shot('03_pause')
        sv=json.loads(await pg.evaluate("localStorage.getItem('harambe-save')")); assert sv['score']==1234 and sv['lives']==2 and sv['stage']==0, sv
        # resume via tap
        await tap(0); assert not await G("G.paused"); assert await G("G.mode")=='play'
        # pause by keyboard, navigate with keys, Main Menu
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200); assert await G("G.paused")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200); assert not await G("G.paused"), 'esc resumes'
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('s'); await pg.wait_for_timeout(100); await pg.keyboard.press('j'); await pg.wait_for_timeout(300)
        assert await G("G.mode")=='title' and not await G("G.paused"), 'main menu'
        assert await G("G.menu.items.length")==2; await shot('04_title_with_continue')
        # continue
        await tap(0); await pg.wait_for_function('window.__game.mode=="play"',timeout=8000)
        assert await G("G.score")==1234 and await G("G.p.lives")==2 and await G("G.stage")==0
        await shot('05_continued')
        # advance to stage 3 via clear: set stage & trigger save by pausing
        await pg.evaluate("window.__game.stage=2"); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('s'); await pg.wait_for_timeout(100); await pg.keyboard.press('j'); await pg.wait_for_timeout(300)
        await shot('06_title_continue_stage3')
        assert 'STAGE 3' in await G("G.menu.items[0].sub")
        # reload keeps save
        await pg.reload(); await pg.wait_for_timeout(1500); assert await G("G.menu.items.length")==2
        # start over: tap New Game -> confirm, cancel first
        await tap(1); assert await G("G.menu.kind")=='confirm'; await shot('07_confirm')
        await tap(0); assert await G("G.menu.kind")=='title' and await pg.evaluate("!!localStorage.getItem('harambe-save')"), 'cancel keeps save'
        await tap(1); await tap(1)
        assert await pg.evaluate("localStorage.getItem('harambe-save')") is None or await G("G.mode")!='title', 'wiped'
        await pg.wait_for_function('window.__game.mode=="play"',timeout=8000)
        assert await G("G.stage")==0 and await G("G.score")==0 and await G("G.p.lives")==3
        # pause -> start over with confirm
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('s'); await pg.wait_for_timeout(100); await pg.keyboard.press('s'); await pg.wait_for_timeout(100); await pg.keyboard.press('j'); await pg.wait_for_timeout(300)
        assert await G("G.menu.kind")=='confirm'; await shot('08_pause_confirm')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200); assert await G("G.menu.kind")=='pause', 'esc cancels confirm'
        # cutscene/stageclear saves next stage; final clear wipes
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        await pg.evaluate("window.__cutscene(0)"); await pg.wait_for_timeout(500); assert await G("G.mode")=='cutscene'
        await pg.evaluate("window.__game.stage=4;window.__game.paused=false;window.__game.menu=null")
        # corrupt save ignored
        await pg.evaluate("localStorage.setItem('harambe-save','{bad')"); await pg.reload(); await pg.wait_for_timeout(1500)
        assert await G("G.menu.items.length")==1, 'corrupt save -> New Game only'
        # blocked storage doesn't crash
        c2=await b.new_context(viewport={'width':844,'height':390},has_touch=True,is_mobile=True)
        p2=await c2.new_page(); e2=[]; p2.on('pageerror',lambda e:e2.append(str(e)))
        await p2.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
        await p2.goto('http://localhost:8099/?skipintro'); await p2.wait_for_timeout(1500)
        assert await p2.evaluate("window.__game.mode")=='title'; assert not e2, e2
        print('ERRS',errs,e2); print('OK')
        await b.close()
    srv.terminate()
asyncio.run(main())
