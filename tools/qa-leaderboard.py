# Leaderboard QA: python3 tools/qa-leaderboard.py  (needs playwright + chromium; talks to the real Supabase backend, rows named QA_*/FAKE_* are test data)
import asyncio, subprocess, time, os, json, urllib.request, secrets, re
from playwright.async_api import async_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT=os.environ.get('OUT','/workspace/shots-harambe-lb'); os.makedirs(OUT,exist_ok=True)
cfg=open(ROOT+'/js/lbconfig.js').read(); URL=re.search(r"LB_URL = '([^']+)'",cfg).group(1); KEY=re.search(r"LB_KEY = '([^']+)'",cfg).group(1)
def rpc(fn,body):
    r=urllib.request.Request(URL+'/rest/v1/rpc/'+fn,json.dumps(body).encode(),{'apikey':KEY,'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
async def main():
    for n,s,st,w in [('FAKE_ALPHA',48210,5,True),('FAKE_BRAVO',31500,4,False),('FAKE_CHARLIE',22780,3,False),('FAKE_DELTA',15400,3,False),('FAKE_ECHO',9100,2,False),('FAKE_FOXTROT',4250,1,False)]:
        rpc('submit_score',{'p_name':n,'p_score':s,'p_stage':st,'p_won':w,'p_token':secrets.token_hex(16)})
    srv=subprocess.Popen(['python3','-m','http.server','8097'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for tag,vp,touch in [('desktop',{'width':1280,'height':720},False),('phone',{'width':844,'height':390},True)]:
            ctx=await b.new_context(viewport=vp,has_touch=touch,is_mobile=touch); pg=await ctx.new_page(); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
            G=lambda e: pg.evaluate("(()=>{const G=window.__game;return "+e+"})()")
            shot=lambda n: pg.screenshot(path=f'{OUT}/{tag}_{n}.png')
            await pg.goto('http://localhost:8097/?skipintro'); await pg.wait_for_function('window.__game'); await pg.wait_for_timeout(1200)
            await shot('1_title')
            # title -> leaderboard via the menu
            idx=await G("G.menu.items.findIndex(i=>i.label=='LEADERBOARD')"); assert idx>=0
            r=await pg.evaluate("(()=>{const G=window.__game,it=G.menu.items[%d].r,c=document.getElementById('c').getBoundingClientRect();return [c.left+(it.x+it.w/2)/320*c.width,c.top+(it.y+it.h/2)/180*c.height,it.h/180*c.height]})()"%idx)
            if touch: assert r[2]>=34,r; await pg.touchscreen.tap(r[0],r[1])
            else: await pg.mouse.click(r[0],r[1])
            await pg.wait_for_function("window.__game.mode=='lb' && window.__game.lb.status=='ok'",timeout=10000); await pg.wait_for_timeout(300)
            assert await G("G.lb.rows.length")>=6; await shot('3_leaderboard_data')
            # back
            await pg.evaluate("window.__game.menu.items[1].act()"); assert await G("G.mode")=='title'
            # start a run, die with a score -> prompt
            await pg.evaluate("window.__game.menu.items[%d].act()"%(await G("G.menu.items.findIndex(i=>i.label.startsWith('NEW'))")))
            await pg.wait_for_function('window.__game.mode=="play"',timeout=9000)
            nm='QA_'+tag.upper()[:5]+secrets.token_hex(1)
            await pg.evaluate("(()=>{const G=window.__game;G.score=27500;G.stage=2;G.p.lives=1;G.p.hp=0;G.p.state='dead';G.p.st=1.5})()")
            await pg.wait_for_function('window.__game.mode=="gameover"',timeout=5000)
            await pg.wait_for_selector('#lbPrompt:not([hidden])',timeout=6000); await pg.wait_for_timeout(300)
            await pg.fill('#lbPrompt input',''); await pg.type('#lbPrompt input','wasd jkl'); assert (await pg.input_value('#lbPrompt input')).upper()=='WASD JKL','typing blocked'
            await pg.fill('#lbPrompt input','fuck'); await pg.click('#lbPrompt .lbgo'); assert 'DIFFERENT' in await pg.inner_text('.lbm')
            await pg.fill('#lbPrompt input','ab'); await pg.click('#lbPrompt .lbgo'); assert '3-12' in await pg.inner_text('.lbm')
            await pg.fill('#lbPrompt input',nm); await shot('2_name_prompt')
            await pg.click('#lbPrompt .lbgo'); await pg.wait_for_function("document.querySelector('.lbm').textContent.startsWith('SAVED')",timeout=8000); await shot('2b_saved')
            assert (await G("G.lastRun.rank"))>=1; print(tag,'rank',await G("G.lastRun.rank"))
            await pg.click('#lbPrompt .lbgo')  # LEADERBOARD
            await pg.wait_for_function("window.__game.mode=='lb' && window.__game.lb.status=='ok'",timeout=10000); await pg.wait_for_timeout(300)
            assert nm.lower() in [x['name'].lower() for x in await G("G.lb.rows")], 'submitted score not listed'
            await shot('4_leaderboard_mine')
            await pg.evaluate("window.__game.menu.items[1].act()"); assert await G("G.mode")=='gameover'
            # offline: block network and try again on a fresh game over
            await ctx.set_offline(True)
            await pg.evaluate("(()=>{const G=window.__game;G.prompted=false;G.mt=2})()"); await pg.wait_for_selector('#lbPrompt:not([hidden])')
            await pg.fill('#lbPrompt input','QA_OFFLINE'); await pg.click('#lbPrompt .lbgo'); await pg.wait_for_function("document.querySelector('.lbm').textContent.includes('OFFLINE')",timeout=9000); await shot('5_offline')
            await pg.click('#lbPrompt .lbsk'); await ctx.set_offline(False)
            assert await G("G.mode")=='gameover'
            # game still continues: enter retries stage
            await pg.wait_for_timeout(300); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500); await pg.wait_for_function('window.__game.mode=="stageintro"',timeout=4000)
            assert await pg.evaluate("localStorage.getItem('harambe-save')") is not None
            print(tag,'errors:',[e for e in errs if 'offline' not in e.lower() and 'Failed to load resource' not in e and 'ERR_INTERNET' not in e]); await ctx.close()
        await b.close()
    srv.terminate()
asyncio.run(main())
