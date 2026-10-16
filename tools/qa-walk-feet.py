import asyncio, subprocess, time, os
from playwright.async_api import async_playwright
OUT='/workspace/shots-harambe-v13'; os.makedirs(OUT,exist_ok=True)
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8098'],cwd=os.path.join(os.path.dirname(__file__),'..'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':844,'height':390})).new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8098/?skipintro'); await pg.wait_for_function('window.__game'); await pg.wait_for_timeout(1200)
        await pg.keyboard.press('j'); await pg.wait_for_function('window.__game.mode=="play"',timeout=9000)
        n=0; await pg.wait_for_timeout(1500)
        for key in ('d','a'):
            await pg.keyboard.down(key)
            for i in range(4):
                await pg.wait_for_timeout(250); await pg.screenshot(path=f'{OUT}/play_{key}_{i}.png'); n+=1
            await pg.keyboard.up(key)
        print('shots',n,'errors',errs); await b.close()
    srv.terminate()
asyncio.run(main())
