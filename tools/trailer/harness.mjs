// Trailer harness: loads the game in headless Chromium on a virtual clock (deterministic, frame-perfect capture),
// exposes the game's internals, and lets a simple bot play. Every sound effect the game triggers is logged with its
// virtual time so tools/trailer/audio.mjs can rebuild the soundtrack offline with the game's own synth.
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FPS = 30;
const PORT = +(process.env.PORT || 8099);
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch (_) { return req(execSync('npm root -g').toString().trim() + '/playwright'); } })(); // local or global install

// Runs before any game code: virtual time, seeded randomness, and the bot.
const INIT = `
(() => {
  let vt = 1000, cbs = [];
  performance.now = () => vt;
  window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
  window.__vt = () => vt;
  window.__advance = ms => { vt += ms; const c = cbs; cbs = []; c.forEach(f => f(vt)); };
  let seed = 20161;
  window.__seed = s => { seed = s >>> 0; };
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  window.__sfxlog = [];

  // ---- bot: walks right, lines up on the nearest enemy, combos, mixes in heavies, jump kicks and the chest-pound ----
  const B = window.__botState = { t: 0, atkT: 0, n: 0, specialCD: 90, jumpAtk: -1, keepHp: 45, on: true };
  window.__bot = () => {
    const G = window.__game, I = window.__input; if (!G || !I) return;
    const set = (k, v) => I.core.set('bot', k, v), tap = k => { I.pressed[k] = true; };
    if (G.mode !== 'play' || !G.p || !B.on) { I.core.release('bot'); return; }
    const p = G.p; B.t++; B.specialCD--;
    if (B.keepHp) p.hp = Math.max(p.hp, B.keepHp);
    let mx = 0, my = 0;
    const foes = G.ents.filter(e => e.state !== 'dead' && e.x > G.cam - 6 && e.x < G.cam + 326);
    if (B.force) { const f = B.force; B.force = null; tap(f); }
    else if (!foes.length) {
      const it = G.items.find(i => Math.abs(i.x - p.x) < 60);
      const pr = G.props.find(q => q.x > p.x - 4 && q.x - p.x < 44);
      if (it) { mx = Math.abs(it.x - p.x) > 4 ? Math.sign(it.x - p.x) : 0; my = Math.abs(it.y - p.y) > 3 ? Math.sign(it.y - p.y) : 0; }
      else if (pr) { my = Math.abs(pr.y - p.y) > 3 ? Math.sign(pr.y - p.y) : 0; if (pr.x - p.x > 24) mx = 1; else if (!my && p.face === 1 && B.t - B.atkT >= 5) { B.atkT = B.t; tap('atk'); } }
      else { mx = 1; const mid = (G.lane.top + G.lane.bot) / 2 + (B.laneBias || 0); my = Math.abs(mid - p.y) > 4 ? Math.sign(mid - p.y) : 0; }
    } else {
      const tgt = foes.slice().sort((a, b) => (Math.abs(a.x - p.x) + 2 * Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + 2 * Math.abs(b.y - p.y)))[0];
      const side = tgt.x >= p.x ? -1 : 1, want = tgt.boss ? 32 : 22;
      const gx = tgt.boss ? Math.min(Math.max(tgt.x + side * want, G.cam + 90), G.cam + 190) : tgt.x + side * want; // bosses: hold mid-screen and let them come (chasing pins the fight to the screen edge)
      const dx = gx - p.x, dy = tgt.y - p.y, adx = Math.abs(tgt.x - p.x);
      if (Math.abs(dx) > 5) mx = Math.sign(dx);
      if (Math.abs(dy) > 3) my = Math.sign(dy);
      const facing = Math.sign(tgt.x - p.x) === p.face;
      const near = foes.filter(e => Math.abs(e.x - p.x) < 70 && Math.abs(e.y - p.y) < 30).length;
      if (B.specialCD <= 0 && near >= (B.specialAt || 3) && p.state === 'idle' || B.specialCD <= 0 && near >= (B.specialAt || 3) && p.state === 'walk') { tap('special'); B.specialCD = B.specialEvery || 210; }
      else if (adx < want + 12 && Math.abs(dy) < 7) {
        if (!facing) mx = Math.sign(tgt.x - p.x); else { mx = 0; my = 0; }
        if (facing && B.t - B.atkT >= 4) { B.atkT = B.t; B.n++; tap(B.n % 6 === 0 ? 'heavy' : 'atk'); }
      } else if (facing && Math.abs(dy) < 5 && adx > 46 && adx < 78 && B.t % 45 === 0) { tap('jump'); B.jumpAtk = B.t + 7; mx = Math.sign(tgt.x - p.x); }
      if (B.jumpAtk === B.t) tap('atk');
    }
    set('left', mx < 0); set('right', mx > 0); set('up', my < 0); set('down', my > 0);
  };
})();`;

// Appended to js/main.js so the harness can reach module internals.
const EXPOSE = `
;window.__audio = audio;
audio.sfx = n => { window.__sfxlog.push([performance.now(), n]); };
audio.play = () => {}; audio.stop = () => {}; audio.init = () => {};
window.__T = { G, STAGES, startStage, newGame, setMode, spawn, startCutscene, render, drawWorld, A, ctx, SCALE, INTRO, drawCutscene, drawOutro };
`;

export async function openGame(query = '') {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/js/main.js', async route => {
    const src = readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
    route.fulfill({ status: 200, contentType: 'text/javascript', body: src + EXPOSE });
  });
  await page.addInitScript(INIT);
  await page.goto(`http://localhost:${PORT}/?nosave${query ? '&' + query : ''}`);
  await page.waitForFunction(dbg => window.__T && window.__T.A.ready && (!dbg || (window.__game.mode === 'play' && window.__game.p)), query.includes('debugstart'), { polling: 100 }); // rAF is virtual here, so poll on a timer
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__advance(1000 / 60));
  return { page, errs, close: async () => { await browser.close(); srv.kill(); } };
}

// Encode a clip: `each(i)` (page-side function source) runs before every frame, then the game advances 1/FPS s.
// If `draw` is given the game loop is not advanced; `draw(i)` paints the canvas itself.
export async function record(page, out, frames, { each = '() => {}', draw = null, bot = true } = {}) {
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    ...(out.endsWith('.mov') ? ['-c:v', 'png'] : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '8', '-pix_fmt', 'yuv444p']), out], // .mov keeps alpha (overlays)
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = await page.evaluate(() => window.__vt());
  const logStart = await page.evaluate(() => window.__sfxlog.length);
  for (let i = 0; i < frames; i++) {
    const b64 = await page.evaluate(([i, each, draw, bot]) => {
      const f = (0, eval)('(' + each + ')'); f(i);
      if (draw) (0, eval)('(' + draw + ')')(i);
      else { if (bot) window.__bot(); window.__advance(1000 / 30); }
      return document.getElementById('c').toDataURL('image/png').slice(22);
    }, [i, each, draw, bot]);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  const sfx = await page.evaluate(([n, t0]) => window.__sfxlog.slice(n).map(([t, s]) => [+((t - t0) / 1000 - 1 / 30).toFixed(4), s]), [logStart, t0]);
  return sfx;
}
