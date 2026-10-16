// Records the raw trailer footage: gameplay for every stage (waves + boss), the intro, story panels and the title.
// usage: node tools/trailer/capture.mjs <outdir> [job ...]   (jobs: see JOBS below; default = all)
import { openGame, record } from './harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'trailer-raw');
mkdirSync(OUT, { recursive: true });
const sec = s => Math.round(s * 30);

// jump the camera to just before the stage's boss trigger, enemies cleared
const TO_BOSS = `() => { const T = window.__T, G = T.G, st = T.STAGES[G.stage];
  G.evIdx = st.events.length; G.ents = []; G.proj = []; G.lock = null; G.goT = 0; G.cam = st.length - 320 - 70; G.p.x = G.cam + 110; G.p.y = (G.lane.top + G.lane.bot) / 2; G.p.state = 'idle'; }`;

const JOBS = {
  async waves(stage, secs = 34, seed = 7) {
    const g = await openGame(`debugstart&stage=${stage}`);
    await g.page.evaluate(s => { window.__seed(s); }, seed);
    const sfx = await record(g.page, path.join(OUT, `s${stage}_waves.mp4`), sec(secs));
    await g.close(); return { sfx, errs: g.errs };
  },
  async boss(stage, secs = 26, seed = 11, hpK = 1) {
    const g = await openGame(`debugstart&stage=${stage}`);
    await g.page.evaluate(([s, js]) => { window.__seed(s); (0, eval)('(' + js + ')')(); window.__botState.specialAt = 2; }, [seed, TO_BOSS]);
    const sfx = await record(g.page, path.join(OUT, `s${stage}_boss${hpK < 1 ? 'ko' : ''}.mp4`), sec(secs), {
      each: `i => { const G = window.__T.G; if (G.boss && !G.boss.__k) { G.boss.__k = 1; G.boss.hp = G.boss.max * ${hpK}; } }` });
    await g.close(); return { sfx, errs: g.errs };
  },
  async title() {
    const g = await openGame('');
    await g.page.evaluate(() => { window.__T.G.menu = { kind: 'none', items: [] }; });
    const sfx = await record(g.page, path.join(OUT, `title.mp4`), sec(8), { bot: false });
    await g.close(); return { sfx, errs: g.errs };
  },
  async intro() {
    const g = await openGame('');
    const total = await g.page.evaluate(() => window.__T.INTRO.total);
    const sfx = await record(g.page, path.join(OUT, `intro.mp4`), sec(total), { draw: `i => { const T = window.__T, c = T.ctx;
      c.setTransform(T.SCALE, 0, 0, T.SCALE, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 320, 180);
      T.INTRO.draw(c, i / 30); c.fillStyle = '#05040f'; c.fillRect(250, 0, 70, 14); }` });
    await g.close(); return { sfx, errs: g.errs };
  },
  async story(idx, pnl, secs = 6) { // one cutscene panel, caption typed out, SKIP label masked
    const g = await openGame('');
    const sfx = await record(g.page, path.join(OUT, `cs${idx}_${pnl}.mp4`), sec(secs), { draw: `i => { const T = window.__T, c = T.ctx;
      c.setTransform(T.SCALE, 0, 0, T.SCALE, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 320, 180);
      T.drawCutscene(c, { idx: ${idx}, panel: ${pnl}, t: i / 30 }); c.fillStyle = '#05040f'; c.fillRect(150, 0, 170, 14); c.fillRect(300, 160, 20, 20); }` });
    await g.close(); return { sfx, errs: g.errs };
  },
  async card(name, secs = 2) {
    const g = await openGame('');
    await g.page.evaluate(async () => { window.__cards = (await import('/tools/trailer/cards.js')).CARDS; });
    const sfx = await record(g.page, path.join(OUT, `card_${name}.mp4`), sec(secs), { draw: `i => { const T = window.__T, c = T.ctx;
      c.setTransform(T.SCALE, 0, 0, T.SCALE, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 320, 180); window.__cards['${name}'](c, i / 30); }` });
    await g.close(); return { sfx, errs: g.errs };
  },
  async outro() {
    const g = await openGame('');
    const sfx = await record(g.page, path.join(OUT, `outro.mp4`), sec(5), { draw: `i => { const T = window.__T, c = T.ctx;
      c.setTransform(T.SCALE, 0, 0, T.SCALE, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 320, 180); T.drawOutro(c, i / 30, 0); }` });
    await g.close(); return { sfx, errs: g.errs };
  },
};

const ALL = [
  ['title'], ['intro'],
  ...[0, 1, 2, 3, 4].flatMap(s => [['waves', s], ['boss', s]]),
  ['story', 1, 2], ['story', 2, 2], ['story', 3, 3], ['story', 0, 1], ['outro'],
];
const want = process.argv.slice(3);
const jobs = want.length ? want.map(w => { const [n, ...a] = w.split(':'); return [n, ...a.map(x => isNaN(+x) ? x : +x)]; }) : ALL;
const log = {};
for (const [name, ...args] of jobs) {
  const t = Date.now();
  const r = await JOBS[name](...args);
  const key = [name, ...args].join('_');
  log[key] = r.sfx;
  console.log(key, ((Date.now() - t) / 1000).toFixed(1) + 's', r.sfx.length, 'sfx', r.errs.length ? 'ERRORS: ' + r.errs.join(' | ') : '');
  writeFileSync(path.join(OUT, `${key}.sfx.json`), JSON.stringify(r.sfx));
}
