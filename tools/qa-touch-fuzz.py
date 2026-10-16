# Multi-touch fuzz in headless Chrome: random simultaneous touchStart/Move/End/Cancel over stick + buttons for N seconds
# (also random blur/visibility/pause), then end every touch and assert nothing remains held. Usage: qa-touch-fuzz.py [seconds]
import asyncio, random, subprocess, sys, time
from playwright.async_api import async_playwright
SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 30
async def main():
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8797'], cwd=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); ctx = await b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://localhost:8797/?skipintro&god&debugstart&nosave'); await pg.wait_for_function('window.__game && window.__game.mode==="play"', timeout=20000)
            cdp = await ctx.new_cdp_session(pg)
            pts = await pg.evaluate("""()=>{const r=e=>{const b=e.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]};
              return {btns:[...document.querySelectorAll('[data-btn]:not([data-btn=start]):not([data-btn=mute])')].map(r)}}""")
            btns = pts['btns']; held = {}; end = time.time() + SECS; n = 0; bad = []
            def rnd():
                r = random.random()
                return random.choice(btns) if r < .45 else [random.uniform(5, 420), random.uniform(40, 380)] if r < .9 else [random.uniform(0, 844), random.uniform(0, 390)]
            async def send(t):
                await cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in held.items()]})
            while time.time() < end:
                a = random.random(); n += 1
                if a < .35 and len(held) < 5:
                    i = random.randint(0, 9)
                    if i not in held:
                        held[i] = rnd(); await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': held[i][0], 'y': held[i][1], 'id': i}]})
                elif a < .65 and held:
                    i = random.choice(list(held)); held[i] = [held[i][0] + random.uniform(-60, 60), held[i][1] + random.uniform(-60, 60)]; await send('touchMove')
                elif a < .9 and held:
                    i = random.choice(list(held)); pt = held.pop(i); await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': pt[0], 'y': pt[1], 'id': i}]})
                elif a < .93 and held:
                    held.clear(); await cdp.send('Input.dispatchTouchEvent', {'type': 'touchCancel', 'touchPoints': []})
                elif a < .95: await pg.evaluate("window.dispatchEvent(new Event('blur'))")
                if n % 40 == 0:  # invariant: if no fingers are down for >150ms nothing may be held
                    if not held:
                        await asyncio.sleep(.2); s = await pg.evaluate("Object.entries(document.querySelector('#zone')&&window.__input?window.__input.down:{}).filter(e=>e[1]).map(e=>e[0])")
                        if s: bad.append(('held-with-no-fingers', s))
                await asyncio.sleep(random.uniform(0, .02))
            if held: await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            held.clear(); await asyncio.sleep(.4)
            s = await pg.evaluate("Object.entries(window.__input.down).filter(e=>e[1]).map(e=>e[0])")
            hs = await pg.evaluate("window.__input.core.held('').map(String)")
            print('events', n, 'held after all touches end:', s, hs, 'invariant violations:', bad[:3], 'page errors:', errs[:3])
            await b.close(); sys.exit(1 if (s or hs or bad or errs) else 0)
    finally: srv.kill()
asyncio.run(main())
