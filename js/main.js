import { W, H, clamp, hitTest, radiusTest, scoreFor, heal, applyBlock } from './logic.js';
import { STAGES, ENEMIES, BOSSES } from './levels.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { drawBG, laneOf } from './bg.js';
import { loadAssets, A } from './assets.js';
import { shadow, drawHarambe, drawHuman, drawKid, drawProp, drawBanana, drawRubble, drawHeart, drawProj, drawText, drawSpark, drawDust, drawLogo, textWidth, spr } from './sprites.js';
import { INTRO, drawOutro } from './scenes.js';
import { drawCutscene, stepCutscene } from './cutscene.js';
import { CUTSCENES } from './story.js';
import { fetchTop, getName, getLast, setLast } from './leaderboard.js';
import { openPrompt, promptOpen } from './lbui.js';
import { dropState, sweepHit, lobVel, pickLoot, LOOT, spotUpdate, eliteMods, LOB_G } from './hazlogic.js';
import { drawHazMarkers, hazardEntries, drawLobMarkers, drawItem, drawEliteRing } from './hazdraw.js';
import { makeSave, keepFurthest, writeSave, readSave, clearSave } from './save.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const SCALE = cv.width / W; // canvas is 3x the 320x180 logic grid; art is baked at that resolution
ctx.imageSmoothingEnabled = false;
if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
const qs = new URLSearchParams(location.search);

const G = {
  mode: 'title', t: 0, mt: 0, stage: 0, cam: 0, lock: null, evIdx: 0, ents: [], props: [], items: [], proj: [], fx: [], texts: [],
  lane: { top: 124, bot: 172 }, haz: [], queue: [], hazQ: [], stT: [], idleT: 0, idleX: 0, p: null, score: 0, hiscore: (() => { try { return +(localStorage.getItem('harambe-hi') || 0); } catch (_) { return 0; } })(), combo: 0, comboT: 0, shake: 0, flash: 0, hitstop: 0, goT: 0, boss: null, paused: false, god: qs.has('god'),
};
window.__input = input; window.__game = G; window.__stages = STAGES; // QA hooks

function newPlayer() {
  return { x: 40, y: (G.lane.top + G.lane.bot) / 2, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: 100, max: 100, lives: 3, state: 'idle', t: 0, st: 0, n: 0, comboT: 0, buf: false, inv: 0, hit: new Set(), w: 16 };
}
function setMode(m) { input.releaseTouch(); G.mode = m; G.mt = 0; if (m === 'gameover' || m === 'outro') G.prompted = false; }

// ---------- save / menus ----------
// Stage Continue should land on: once the boss is dead (stageclear / cutscene) that is the NEXT stage, never the one just beaten.
function contStage() { return (G.mode === 'stageclear' || G.mode === 'cutscene') ? G.stage + 1 : G.stage; }
// Never let a save move backwards (a pause / page-hide write must not overwrite a newer stage-clear save). New game / Start over clear the save first.
function checkpoint() {
  if (!G.p || qs.has('nosave')) return;
  const st = contStage(); if (st >= STAGES.length) return;
  writeSave(keepFurthest(makeSave(st, G.p, G.score, STAGES.length), readSave(STAGES.length)));
}
function checkpointIfLive() { if (G.p && ['play', 'stageclear', 'cutscene', 'stageintro'].includes(G.mode)) checkpoint(); }
function loadGame(sv) { G.score = sv.score; G.p = newPlayer(); G.p.lives = sv.lives; G.p.max = sv.max; G.p.hp = sv.max; startStage(sv.stage, true); }
function toTitle() { G.paused = false; G.save = readSave(STAGES.length); G.menu = titleMenu(); setMode('title'); audio.play('title', { root: 52, tempo: 100, mode: 'minor' }); }
function startNew() { clearSave(); G.save = null; audio.init(); audio.sfx('select'); G.menu = null; setMode(qs.has('skipintro') ? 'play0' : 'intro'); if (G.mode === 'play0') newGame(); else audio.play('title', { root: 52, tempo: 100, mode: 'minor' }); }
function confirmMenu(back, yes) { return mkMenu('confirm', [{ label: 'CANCEL', act: () => { G.menu = back(); } }, { label: 'YES, START OVER', act: yes, danger: true }], back); }
function titleMenu() {
  const sv = G.save, items = [];
  if (sv) items.push({ label: 'CONTINUE', sub: 'STAGE ' + (sv.stage + 1) + ' - ' + STAGES[sv.stage].name, tall: true, act: () => { audio.init(); audio.sfx('select'); G.menu = null; loadGame(sv); } });
  items.push({ label: sv ? 'NEW GAME / START OVER' : 'NEW GAME', act: () => { if (sv) G.menu = confirmMenu(titleMenu, startNew); else startNew(); } });
  items.push({ label: 'LEADERBOARD', act: () => openLB('title') });
  return mkMenu('title', items);
}
function pauseMenu() {
  return mkMenu('pause', [{ label: 'RESUME', act: resume }, { label: 'MAIN MENU', act: () => { checkpoint(); G.paused = false; toTitle(); } },
    { label: 'START OVER', act: () => { G.menu = confirmMenu(pauseMenu, () => { clearSave(); G.paused = false; G.menu = null; newGame(); }); } }], resume);
}
function mkMenu(kind, items, back) {
  const w = kind === 'title' ? 150 : 140, gap = kind === 'title' ? 2 : 4; let y = kind === 'title' ? 101 : kind === 'pause' ? 50 : 78;
  for (const it of items) { const h = kind === 'title' ? (it.tall ? 22 : 16) : it.tall ? 24 : 18; it.r = { x: (W - w) / 2, y, w, h }; y += h + gap; }
  return { kind, items, sel: kind === 'confirm' ? 0 : 0, back };
}
function resume() { input.releaseTouch(); G.paused = false; G.menu = null; audio.play('s', STAGES[G.stage].music); }
function openPause() { input.releaseTouch(); G.paused = true; audio.stop(); checkpoint(); input.anyPress(); G.menu = pauseMenu(); }
function menuAct(m, i) { audio.sfx('select'); m.items[i].act(); input.anyPress(); }
function menuStep() {
  const m = G.menu; if (!m) return;
  const n = m.items.length;
  if (input.take('up') || (m.kind === 'lb' && input.take('left'))) m.sel = (m.sel + n - 1) % n;
  if (input.take('down') || (m.kind === 'lb' && input.take('right'))) m.sel = (m.sel + 1) % n;
  if (input.take('atk') || input.take('jump')) { menuAct(m, m.sel); return; }
  if (input.take('start')) { if (m.kind === 'title') menuAct(m, m.sel); else if (m.back) { const b = m.back(); if (b) G.menu = b; } }
}
function drawMenu(m) {
  const T = document.body.classList.contains('touch');
  m.items.forEach((it, i) => {
    const r = it.r, on = i === m.sel;
    panel(r.x, r.y, r.w, r.h);
    if (on) { ctx.fillStyle = '#ffe03a'; ctx.fillRect(r.x - 2, r.y + 2, 1, r.h - 4); ctx.fillRect(r.x + r.w + 1, r.y + 2, 1, r.h - 4); ctx.fillRect(r.x + 2, r.y - 2, r.w - 4, 1); ctx.fillRect(r.x + 2, r.y + r.h + 1, r.w - 4, 1); }
    const col = it.danger ? (on ? '#ff8a8a' : '#e06a6a') : (on ? '#ffe03a' : '#ffffff');
    if (it.sub) { drawText(ctx, it.label, r.x + r.w / 2, r.y + 9, col, 8, 'center'); drawText(ctx, it.sub, r.x + r.w / 2, r.y + 19, '#9af0b0', 7, 'center'); }
    else drawText(ctx, it.label, r.x + r.w / 2, r.y + r.h / 2 + 3, col, 8, 'center');
  });
  return T;
}
function drawPause() {
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H);
  const m = G.menu; if (!m) return;
  if (m.kind === 'confirm') { panel(56, 34, 208, 92); drawText(ctx, 'ERASE SAVED GAME?', W / 2, 50, '#ff8a8a', 9, 'center'); drawText(ctx, 'Your progress will be lost.', W / 2, 62, '#fff', 7, 'center'); }
  else { panel(70, 18, 180, 118); drawText(ctx, 'PAUSED', W / 2, 36, '#ffe03a', 12, 'center'); drawText(ctx, 'Progress saved', W / 2, 129, '#9af0b0', 6, 'center'); }
  drawMenu(m);
}
function menuPointer(e) {
  const m = G.menu; if (!m) return false;
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  m.items.forEach((it, i) => { const b = it.r; if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 2 && y <= b.y + b.h + 2) { m.sel = i; menuAct(m, i); } });
  return true;
}


// ---------- global leaderboard ----------
function openLB(from) {
  G.lbPrev = from; G.lbMt = G.mt; G.lb = { rows: [], status: 'loading' }; G.lastRun = G.lastRun || getLast();
  G.menu = mkLbMenu(); G.mode = 'lb'; G.mt = 0; refreshLB();
}
function mkLbMenu() {
  const m = { kind: 'lb', sel: 2, items: [{ label: 'REFRESH', act: () => refreshLB(), r: { x: 30, y: 154, w: 78, h: 16 } }, { label: 'WALLET', act: askWallet, r: { x: 121, y: 154, w: 78, h: 16 } }, { label: 'BACK', act: closeLB, r: { x: 212, y: 154, w: 78, h: 16 } }], back: () => { closeLB(); return null; } };
  return m;
}
function askWallet() { openPrompt({ walletOnly: true, title: 'SOL WALLET', done: () => { input.releaseAll(); input.anyPress(); } }); }
function closeLB() {
  const prev = G.lbPrev || 'title'; input.releaseTouch();
  if (prev === 'title') { G.menu = titleMenu(); setMode('title'); } else { G.menu = null; G.mode = prev; G.mt = G.lbMt || 0; }
}
function refreshLB() {
  const lb = G.lb = { rows: G.lb ? G.lb.rows : [], status: 'loading' };
  fetchTop(10).then(rows => { if (G.lb === lb) { lb.rows = rows; lb.status = 'ok'; } }).catch(() => { if (G.lb === lb) lb.status = 'error'; });
}
// Ask for a name once per finished run (game over / final victory). Never blocks: SKIP, Esc, or no network just carries on.
function askScore(won) {
  G.prompted = true; const sc = Math.round(G.score);
  if (sc <= 0 || qs.has('nolb')) return;
  openPrompt({ score: sc, stage: Math.min(5, G.stage + 1), won, title: won ? 'YOU WIN!' : 'GAME OVER',
    onSaved: r => { G.lastRun = r; setLast(r); }, done: (sub, board) => { input.releaseAll(); input.anyPress(); if (board) openLB(G.mode); } });
}
function drawLB() {
  drawBG(ctx, 'jungle', G.t * 14, G.t);
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  panel(26, 6, 268, 144);
  drawText(ctx, 'GLOBAL TOP 10', W / 2, 20, '#ffe03a', 12, 'center');
  const lb = G.lb, me = (getName() || '').toLowerCase(), last = G.lastRun;
  drawText(ctx, '#', 36, 31, '#8a8ac0', 6); drawText(ctx, 'NAME', 52, 31, '#8a8ac0', 6); drawText(ctx, 'STG', 200, 31, '#8a8ac0', 6, 'right'); drawText(ctx, 'SCORE', 284, 31, '#8a8ac0', 6, 'right');
  if (lb.status === 'error') drawText(ctx, 'COULD NOT LOAD - OFFLINE?', W / 2, 78, '#ff8a8a', 8, 'center');
  else if (!lb.rows.length) drawText(ctx, lb.status === 'loading' ? 'LOADING...' : 'NO SCORES YET - BE FIRST!', W / 2, 78, '#fff', 8, 'center');
  let inTop = false;
  lb.rows.slice(0, 10).forEach((r, i) => {
    const y = 40 + i * 10, mine = (last && last.id === r.id) || (me && r.name.toLowerCase() === me); if (mine) inTop = true;
    if (mine) { ctx.fillStyle = 'rgba(255,224,58,.22)'; ctx.fillRect(32, y - 7, 256, 9); ctx.fillStyle = '#ffe03a'; ctx.fillRect(32, y - 7, 1, 9); }
    const col = mine ? '#ffe03a' : i === 0 ? '#ffd24a' : i < 3 ? '#e8e8f8' : '#fff';
    drawText(ctx, String(i + 1), 36, y, col, 7); drawText(ctx, r.name.toUpperCase(), 52, y, col, 7);
    drawText(ctx, r.won ? 'WIN' : String(r.stage), 200, y, r.won ? '#9af0b0' : '#9ab8ff', 7, 'right'); drawText(ctx, String(r.score), 284, y, col, 7, 'right');
  });
  if (last && last.rank && !(inTop && lb.rows.some(r => r.id === last.id))) drawText(ctx, 'YOUR LAST RUN: ' + last.score + ' (RANK #' + last.rank + ')', W / 2, 145, '#ffe03a', 7, 'center');
  else if (lb.status === 'loading' && lb.rows.length) drawText(ctx, 'UPDATING...', W / 2, 145, '#8a8ac0', 6, 'center');
  drawMenu(G.menu);
}

// ---------- stage setup ----------
function startStage(i, keepPlayer = true) {
  input.releaseTouch();
  const st = STAGES[i]; G.stage = i; G.lane = laneOf(st.bg); G.cam = 0; G.lock = null; G.evIdx = 0; G.ents = []; G.items = []; G.rubble = []; G.proj = []; G.fx = []; G.texts = []; G.boss = null; G.bossSpawned = false; G.goT = 0; G.stageT = 0; G.haz = []; G.queue = []; G.hazQ = []; G.stT = []; G.bossHT = 0; G.idleT = 0; G.idleX = 40;
  G.props = st.props.map(p => ({ x: p.x, y: G.lane.top + 4 + ((p.x * 7) % Math.max(8, G.lane.bot - G.lane.top - 10)), kind: p.kind, hp: 2, flash: 0, loot: p.loot }));
  if (!keepPlayer || !G.p) G.p = newPlayer(); else { Object.assign(G.p, { rage: 0, x: 40, y: (G.lane.top + G.lane.bot) / 2, z: 0, state: 'idle', vx: 0, hp: G.p.max, inv: 1.5 }); }
  checkpoint(); audio.play('stage' + i, st.music); setMode('stageintro');
}
function startCutscene(idx) { input.releaseTouch(); G.cs = { idx, panel: 0, t: 0, done: false }; audio.play('cs' + idx, CUTSCENES[idx].music); setMode('cutscene'); }
function afterCutscene() { if (G.cs.idx + 1 < STAGES.length) startStage(G.cs.idx + 1); else { clearSave(); audio.play('title', { root: 55, tempo: 110, mode: 'dorian' }); setMode('outro'); } }
window.__cutscene = startCutscene; // QA hook
function newGame() { G.score = 0; G.p = newPlayer(); startStage(+qs.get('stage') || 0, true); if (qs.get('stage')) G.p.lives = 3; }

// ---------- entities ----------
function spawn(type, side, boss = false, o = {}) {
  const d = boss ? BOSSES[type] : ENEMIES[type], df = STAGES[G.stage].diff, k = boss ? { hp: 1, spd: 1, dmg: 1, cd: 1 + (df.cd - 1) * 0.5 } : df, m = eliteMods(o), drop = side === 'T';
  const hp = Math.round(d.hp * k.hp * m.hp);
  let x = side === 'L' ? G.cam - 30 : G.cam + W + 30;
  if (drop) { x = G.cam + 50 + Math.random() * (W - 100); if (Math.abs(x - G.p.x) < 30) x = clamp(x + (x < G.p.x ? -34 : 34), G.cam + 40, G.cam + W - 40); }
  const e = { type: d.sheet, boss, d, x, y: G.lane.top + 2 + Math.random() * (G.lane.bot - G.lane.top - 4), z: drop ? 150 : 0, vx: 0, vy: 0, vz: 0, face: drop ? (G.p.x > x ? 1 : -1) : side === 'L' ? 1 : -1, hp, max: hp,
    spd: d.speed * k.spd * m.spd, dmg: Math.round(d.dmg * k.dmg * m.dmg), cdm: k.cd, maxAtk: df.atk, tag: o.mini ? 'MINI' : o.elite ? 'ELITE' : null, ptsMul: m.pts,
    state: drop ? 'drop' : 'walk', t: Math.random() * 3, st: 0, cd: (0.6 + Math.random() * 1.2) * k.cd, w: boss ? 26 : (o.mini || o.elite) ? 18 : 16, slot: (Math.random() < .5 ? -1 : 1) * (30 + Math.random() * 16), hurtT: 0, inv: 0, rage: false, hit: false, move: null, dead: 0 };
  if (boss) { G.boss = e; e.x = G.cam + W + 40; e.cd = 1.2; }
  G.ents.push(e); return e;
}
function popText(txt, x, y, color = '#ffe03a', life = 0.7) { G.texts.push({ txt, x, y, color, life, max: life }); }
function spark(x, y, big) { G.fx.push({ x, y, t: 0, big }); }

function hurtEnemy(e, dmg, kd, from, heavy) {
  if (e.state === 'dead' || e.inv > 0) return false;
  if (from === G.p && G.p.rage > 0) dmg = Math.round(dmg * 1.5); // RAGE pickup: +50% damage for 8s
  const frontal = (from.x < e.x ? -1 : 1) === e.face * -1 ? false : (from.x - e.x) * e.face > 0;
  const blocking = (e.d.blocks) && (e.state === 'walk' || e.state === 'idle') && frontal;
  const real = applyBlock(dmg, blocking, frontal, heavy);
  if (blocking && real < dmg) { popText('BLOCK', e.x, e.y - 66, '#9ab4d8', 0.4); audio.sfx('swing'); kd = false; }
  e.hp -= real; e.hurtT = 1.5; G.lastHit = e; G.lastHitT = 3; G.hitstop = heavy ? 0.07 : 0.035; G.shake = Math.max(G.shake, heavy ? 3 : 1);
  G.combo++; G.comboT = 1.3; spark(e.x, e.y - 32 - e.z, heavy);
  audio.sfx(heavy ? 'heavy' : 'punch');
  G.score += Math.round(real * 2);
  e.flashT = 0.08;
  if (G.combo >= 3) popText(G.combo + ' HITS!', e.x, e.y - 84, '#ff8a2a', 0.6);
  if (e.hp <= 0) {
    e.state = 'dead'; e.dead = 0; e.vx = from.face * 110; e.vz = 150; e.z = 1; const pts = scoreFor(e.d.pts * (e.ptsMul || 1), G.combo); G.score += pts; audio.sfx('ko'); G.shake = 4;
    popText('+' + pts, e.x, e.y - 90, '#fff', 0.9);
    if (e.tag) { G.items.push({ x: e.x - 10, y: e.y, kind: 'banana', heal: 50 }, { x: e.x + 10, y: e.y + 2, kind: 'gem' }); if (e.tag === 'MINI') G.items.push({ x: e.x, y: e.y - 3, kind: 'rage' }); popText(e.tag === 'MINI' ? 'MINI-BOSS DOWN!' : 'ELITE DOWN!', e.x, e.y - 104, '#ffd23a', 1.2); }
    if (!e.boss && Math.random() < 0.18) G.items.push({ x: e.x, y: e.y, kind: 'banana', heal: 25 });
    return true;
  }
  const knock = kd || (e.boss ? false : heavy);
  if (knock && !(e.boss && e.state === 'charge')) { e.state = 'down'; e.t = 0; e.vx = from.face * (heavy ? 120 : 90); e.vz = 120; e.z = 1; e.st = 0; }
  else if (!e.boss || heavy || e.state === 'walk') { if (e.state !== 'down') { e.state = 'hurt'; e.st = 0; e.vx = from.face * 40; } }
  return true;
}

function hurtPlayer(dmg, srcX, kd) {
  const p = G.p; if (p.inv > 0 || p.state === 'dead' || p.state === 'special' || G.god) return;
  p.hp -= dmg; p.inv = 0.8; G.shake = 3; G.combo = 0; G.flash = 0.08; audio.sfx('hurt'); spark(p.x, p.y - 32 - p.z, false);
  const dir = srcX < p.x ? 1 : -1;
  if (p.hp <= 0) { p.hp = 0; p.state = 'dead'; p.st = 0; p.vz = 160; p.vx = dir * 90; p.z = 1; audio.sfx('ko'); G.shake = 6; return; }
  if (kd || p.z > 0) { p.state = 'down'; p.st = 0; p.vz = 130; p.vx = dir * 80; p.z = Math.max(p.z, 1); p.inv = 1.8; }
  else { p.state = 'hurt'; p.st = 0; p.vx = dir * 30; }
}

// ---------- player ----------
function updatePlayer(dt) {
  const p = G.p, ax = input.axis(); p.t += dt; p.st += dt; p.inv = Math.max(0, p.inv - dt);
  p.comboT -= dt; if (p.comboT <= 0 && p.state !== 'atk') p.n = 0; p.rage = Math.max(0, (p.rage || 0) - dt);
  const free = p.state === 'idle' || p.state === 'walk';
  if (free) {
    const dn = ax.x && ax.y ? 0.8 : 1; // diagonals no longer faster than straight lines (was 97 px/s)
    p.ramp = (ax.x || ax.y) ? Math.min(1, (p.ramp ?? 0) + dt / 0.07) : 0; // 70 ms ease-in so a step starts with a push, not an instant 82 px/s
    const mx = ax.x * 82 * dn * (0.35 + 0.65 * p.ramp), my = ax.y * 52 * dn * (0.35 + 0.65 * p.ramp);
    const py = p.y; p.x += mx * dt; p.y = clamp(p.y + my * dt, G.lane.top, G.lane.bot); p.wd = (p.wd || 0) + Math.hypot(mx * dt, p.y - py);
    if (ax.x) p.face = ax.x; const was = p.state; p.state = (ax.x || ax.y) ? 'walk' : 'idle'; if (p.state === 'walk' && was !== 'walk') p.wd = 0; // every walk starts on the contact pose, never mid-stride
  }
  const startAtk = () => { p.n = (p.n % 3) + 1; p.state = 'atk'; p.st = 0; p.hit.clear(); p.buf = false; p.comboT = 0.7; audio.sfx('swing'); };
  if (input.take('atk')) {
    if (p.z > 1 && p.state !== 'jatk') { p.state = 'jatk'; p.st = 0; p.hit.clear(); audio.sfx('swing'); }
    else if (free) startAtk(); else if (p.state === 'atk' && p.st > 0.08) p.buf = true;
  }
  if (input.take('heavy') && free) { p.state = 'heavy'; p.st = 0; p.hit.clear(); audio.sfx('swing'); }
  if (input.take('jump') && free) { p.vz = 165; p.z = 0.1; p.state = 'jump'; p.st = 0; p.vx = ax.x * 82; audio.sfx('jump'); }
  if (input.take('special') && (free || p.state === 'atk') && p.hp > 16) { p.hp -= 8; p.state = 'special'; p.st = 0; p.hit.clear(); p.inv = 0.8; audio.sfx('special'); G.shake = 5; }
  switch (p.state) {
    case 'atk': { const d = 0.26;
      if (p.st > 0.07 && p.st < 0.16) for (const e of G.ents) if (!p.hit.has(e) && e.state !== 'dead' && hitTest(p, { reach: 26, w: 30 }, e)) { p.hit.add(e); hurtEnemy(e, p.n === 3 ? 11 : 6, p.n === 3, p, false); }
      if (p.st > 0.07 && p.st < 0.16) { hitProps(p, 26); deflect(p, 36); }
      if (p.st > d) { if (p.buf && p.n < 3) startAtk(); else { p.state = 'idle'; if (p.n >= 3) p.n = 0; } } break; }
    case 'heavy': if (p.st > 0.2 && p.st < 0.3) { for (const e of G.ents) if (!p.hit.has(e) && e.state !== 'dead' && hitTest(p, { reach: 30, w: 44, depth: 18 }, e)) { p.hit.add(e); hurtEnemy(e, 18, true, p, true); } hitProps(p, 30); deflect(p, 44); }
      if (p.st > 0.5) p.state = 'idle'; break;
    case 'special': if (p.st > 0.22 && p.st < 0.3 && !p.did) { p.did = true; G.flash = 0.12; for (const e of G.ents) if (e.state !== 'dead' && radiusTest(p, e, 72, 34)) { e.inv = 0; hurtEnemy(e, 24, true, { x: p.x + (e.x < p.x ? 1 : -1), face: e.x < p.x ? -1 : 1 }, true); } for (const pr of G.props) if (Math.abs(pr.x - p.x) < 72) breakProp(pr); G.proj = G.proj.filter(n => Math.abs(n.x - p.x) > 72); }
      if (p.st > 0.6) { p.state = 'idle'; p.did = false; } break;
    case 'jump': case 'jatk':
      p.x += p.vx * dt; p.vz -= 520 * dt; p.z += p.vz * dt; p.y = clamp(p.y + ax.y * 30 * dt, G.lane.top, G.lane.bot);
      if (p.state === 'jatk' && p.st > 0.03) for (const e of G.ents) if (!p.hit.has(e) && e.state !== 'dead' && hitTest(p, { reach: 24, w: 34, height: 44 }, e)) { p.hit.add(e); hurtEnemy(e, 10, true, p, false); }
      if (p.z <= 0) { p.z = 0; p.vz = 0; p.state = 'idle'; audio.sfx('land'); G.fx.push({ x: p.x, y: p.y, t: 0, dust: true }); } break;
    case 'hurt': p.x += p.vx * dt; p.vx *= 0.9; if (p.st > 0.3) p.state = 'idle'; break;
    case 'down': p.x += p.vx * dt; p.vz -= 520 * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vx *= 0.8; if (!p.landed) { p.landed = true; audio.sfx('land'); G.fx.push({ x: p.x, y: p.y, t: 0, dust: true }); } } if (p.st > 1.0 && p.z === 0) { p.state = 'idle'; p.landed = false; } break;
    case 'dead': p.x += p.vx * dt; p.vx *= 0.95; p.vz -= 520 * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z === 0) p.vz = 0;
      if (p.st > 1.4) { if (p.lives > 1) { p.lives--; p.hp = p.max; p.state = 'idle'; p.inv = 2.5; p.z = 0; p.x = Math.max(p.x, G.cam + 30); popText('LIVES x' + p.lives, p.x, p.y - 80, '#fff', 1.2); } else { p.lives = 0; audio.jingle('over'); if (!qs.has('nosave')) writeSave(makeSave(G.stage, { lives: 3, max: 100 }, 0, STAGES.length)); setMode('gameover'); } } break;
  }
  const minX = G.cam + 22, maxX = (G.lock ?? G.cam + W) + (G.lock ? W : 0) - 12;
  p.x = clamp(p.x, minX, G.lock !== null ? G.lock + W - 22 : STAGES[G.stage].length + W);
  // items
  for (const it of G.items) if (!it.got && Math.abs(it.x - p.x) < 16 && Math.abs(it.y - p.y) < 12 && p.z < 12) { it.got = true; const k = it.kind || 'banana';
    if (k === 'banana') { p.hp = heal(p.hp, p.max, it.heal); audio.sfx('banana'); popText('+' + it.heal + ' HP', p.x, p.y - 80, '#ffe03a', 0.8); G.score += 50; }
    else if (k === 'gem') { audio.sfx('banana'); popText('+500', p.x, p.y - 80, '#ffd23a', 0.9); G.score += 500; }
    else if (k === 'rage') { p.rage = 8; audio.sfx('special'); popText('RAGE! +50% DMG', p.x, p.y - 80, '#ff6a3a', 1.2); }
    else if (k === 'life') { p.lives = Math.min(9, p.lives + 1); audio.sfx('fanfare'); popText('1UP!', p.x, p.y - 80, '#ffffff', 1.2); } }
  G.items = G.items.filter(i => !i.got);
}
function deflect(p, reach) { // swings bat comic projectiles out of the air
  const n0 = G.proj.length; G.proj = G.proj.filter(n => !(Math.abs(n.x - (p.x + p.face * reach * 0.6)) < reach * 0.6 + 6 && Math.abs(n.y - p.y) < 16 && n.kind !== 'shell'));
  if (G.proj.length < n0) { popText('DEFLECT!', p.x + p.face * 20, p.y - 60, '#9af0ff', 0.5); audio.sfx('punch'); G.score += 25; } }
function hitProps(p, reach) { for (const pr of G.props) if (!pr.dead && Math.abs(pr.x - (p.x + p.face * reach)) < 18 && Math.abs(pr.y - p.y) < 14 && !pr.hitBy?.has(p.st > 0 ? p.state + p.n + (p.comboT) : 0)) { pr.hp--; pr.flash = 0.08; G.hitstop = 0.03; audio.sfx('punch'); if (pr.hp <= 0) breakProp(pr); else pr.hp = pr.hp; } }
function breakProp(pr) { if (pr.dead) return; pr.dead = true; (G.rubble ||= []).push({ x: pr.x, y: pr.y, kind: pr.kind, t: 0 }); audio.sfx('break'); G.shake = 2; G.score += 30; spark(pr.x, pr.y - 10, true); const k = pickLoot(Math.random(), pr.loot); G.items.push(k === 'banana' || k === 'big' ? { x: pr.x, y: pr.y, kind: 'banana', heal: k === 'big' ? 50 : 20 } : { x: pr.x, y: pr.y, kind: k }); }

// ---------- enemies ----------
function attackersNow() { return G.ents.filter(e => !e.boss && (e.state === 'windup' || e.state === 'atk')).length; }
const PROJ_TEXT = { net: 'NETTED!', dart: 'DARTED!', bolt: 'ZAPPED!', shell: 'BOOM!' };
function shoot(e, dy = 0) {
  if (e.d.lob) { const x0 = e.x + e.face * 14, lv = lobVel(x0, G.p.x); G.proj.push({ kind: e.d.proj, lob: true, x: x0, y: G.p.y, z: 30, vx: lv.vx, vz: lv.vz, dmg: e.dmg, blast: e.d.blast || 16, life: 2 }); audio.sfx('toss'); return; }
  const kind = e.d.proj || 'net', sp = (kind === 'shell' ? 150 : kind === 'bolt' ? 190 : kind === 'dart' ? 210 : 130) * (e.boss ? 1 : Math.min(1.4, e.spd / e.d.speed));
  G.proj.push({ kind, x: e.x + e.face * 26, y: clamp(e.y + dy, G.lane.top, G.lane.bot), z: e.boss ? 26 : 22, vx: e.face * sp, dmg: kind === 'shell' ? e.dmg + 4 : e.dmg, life: 3 });
  audio.sfx(kind === 'net' ? 'net' : kind === 'shell' ? 'heavy' : 'swing');
}
function updateEnemy(e, dt) {
  const p = G.p; e.t += dt; e.st += dt; e.hurtT = Math.max(0, e.hurtT - dt); e.inv = Math.max(0, e.inv - dt); e.cd -= dt; if (e.flashT) e.flashT -= dt;
  const dx = p.x - e.x, dy = p.y - e.y, dist = Math.abs(dx), d = e.d;
  const alive = p.state !== 'dead';
  switch (e.state) {
    case 'walk': {
      const sp = e.spd * (e.rage ? 1.3 : 1), kind = e.boss ? null : d.kind;
      let tx = p.x + e.slot, ty = p.y;
      if (kind === 'ranged') { tx = p.x + (e.x < p.x ? -1 : 1) * (d.range || 120); tx = clamp(tx, G.cam + 24, G.cam + W - 24); }
      else if (kind === 'lunge') tx = p.x + (e.x < p.x ? -1 : 1) * 70;
      if (e.boss) tx = p.x - Math.sign(dx || 1) * 36;
      if (kind !== 'ranged' && (tx < G.cam + (e.boss ? 46 : 30) || tx > G.cam + W - (e.boss ? 46 : 30))) tx = p.x + (p.x - tx); // never queue up off-screen: switch to the hero's other side
      const mx = tx - e.x, my = ty - e.y;
      if (Math.abs(mx) > 3) e.x += Math.sign(mx) * sp * dt; if (Math.abs(my) > 3) e.y += Math.sign(my) * sp * 0.8 * dt;
      e.y = clamp(e.y, G.lane.top, G.lane.bot); e.face = dx >= 0 ? 1 : -1;
      if (e.cd <= 0 && alive) {
        const go = mv => { e.state = 'windup'; e.st = 0; e.move = mv; audio.sfx('alert'); };
        if (e.boss) bossPick(e, dx, dy);
        else if (kind === 'ranged') { if (dist < (d.range || 120) + (d.lob ? 35 : 70) && (d.lob || Math.abs(dy) < 14) && G.proj.length < 3 + G.stage) go('shoot'); }
        else if (kind === 'lunge') { if (Math.abs(dy) < 12 && attackersNow() < e.maxAtk) { if (dist < 130 && dist > 50) go('lunge'); else if (dist <= 50) go('melee'); } }
        else if (dist < (d.reach || 28) + 16 && Math.abs(dy) < 12 && attackersNow() < e.maxAtk) go('melee');
      }
      break; }
    case 'drop': e.vz -= 520 * dt; e.z += e.vz * dt; e.inv = 1; e.face = dx >= 0 ? 1 : -1;
      if (e.z <= 0) { e.z = 0; e.vz = 0; e.state = 'walk'; e.inv = 0.3; e.cd = 0.5 + Math.random() * 0.6; G.shake = Math.max(G.shake, 2); G.fx.push({ x: e.x, y: e.y, t: 0, dust: true }); audio.sfx('land'); if (alive && Math.abs(dx) < 16 && Math.abs(dy) < 10 && p.z < 14) hurtPlayer(Math.round(e.dmg * 0.6), e.x, false); } break;
    case 'windup': {
      const dur = (e.boss ? (e.rage ? 0.42 : 0.55) : 0.42) * Math.max(0.6, e.cdm) + 0.04; e.face = dx >= 0 ? 1 : -1;
      if (e.st > dur) { e.state = e.move === 'charge' ? 'charge' : 'atk'; e.st = 0; e.hit = false; e.hit2 = false; e.shots = 0; if (e.move === 'charge') e.vx = e.face * (e.boss ? 200 : 150); } break; }
    case 'atk': {
      const m = e.move, reach = e.boss ? 42 : (d.reach || 28), cdn = (b, r) => (b + Math.random() * r) * e.cdm;
      if (m === 'melee') {
        const t1 = d.double ? 0.3 : -1;
        if (e.st > 0.1 && !e.hit && hitTest(e, { reach, w: e.boss ? 40 : 28 }, p) && p.state !== 'dead') { e.hit = true; hurtPlayer(e.dmg, e.x, e.boss); }
        if (t1 > 0 && e.st > t1 && !e.hit2 && hitTest(e, { reach, w: 28 }, p) && p.state !== 'dead') { e.hit2 = true; hurtPlayer(Math.ceil(e.dmg * 0.7), e.x, false); }
        if (e.st > (t1 > 0 ? 0.5 : 0.4)) { e.state = 'walk'; e.cd = e.boss ? cdn(0.8, 0.8) : cdn(1.4, 1.0); } }
      else if (m === 'lunge') {
        if (e.st < 0.32) e.x += e.face * 190 * dt;
        if (e.st > 0.04 && !e.hit && hitTest(e, { reach: 22, w: 34 }, p) && p.state !== 'dead') { e.hit = true; hurtPlayer(e.dmg, e.x, true); }
        if (e.st > 0.5) { e.state = 'walk'; e.cd = cdn(1.5, 1.0); } }
      else if (m === 'shoot') {
        if (e.boss) { const n = e.rage ? 3 : 1; if (e.st > 0.15 && !e.hit) { e.hit = true; for (let k = 0; k < n; k++) shoot(e, (k - (n - 1) / 2) * 20); } if (e.st > 0.55) { e.state = 'walk'; e.cd = cdn(1.2, 0.8); } }
        else { const n = d.burst || 1; while (e.shots < n && e.st > 0.15 + e.shots * 0.28) { shoot(e); e.shots++; } if (e.st > 0.5 + (n - 1) * 0.28) { e.state = 'walk'; e.cd = cdn(2.0, 1.0); } } }
      else if (m === 'slam') { if (e.st > 0.12 && !e.hit) { e.hit = true; G.shake = 6; audio.sfx('heavy'); G.fx.push({ x: e.x, y: e.y, t: 0, ring: true }); if (radiusTest(e, p, 68, 28) && p.z < 14) hurtPlayer(e.dmg + 2, e.x, true); } if (e.st > 0.6) { e.state = 'walk'; e.cd = cdn(1, 0.6); } }
      else if (m === 'summon') { if (e.st > 0.2 && !e.hit) { e.hit = true; const sm = d.summons, pick = () => Array.isArray(sm) ? sm[(Math.random() * sm.length) | 0] : sm; spawn(pick(), 'L'); spawn(pick(), 'R'); audio.sfx('alert'); popText('BACKUP!', e.x, e.y - 90, '#ff5050', 0.9); } if (e.st > 0.7) { e.state = 'walk'; e.cd = cdn(3, 1); } }
      break; }
    case 'charge': e.x += e.vx * dt; if (!e.hit && hitTest(e, { reach: 8, w: 34 }, p) && p.state !== 'dead') { e.hit = true; hurtPlayer(e.dmg, e.x, true); } e.y += Math.sign(dy) * 20 * dt;
      if (e.st > 0.8 || e.x < G.cam - 10 || e.x > G.cam + W + 10) { e.state = 'walk'; e.vx = 0; e.cd = 1.4 * e.cdm; e.x = clamp(e.x, G.cam + 10, G.cam + W - 10); } break;
    case 'hurt': e.x += e.vx * dt; e.vx *= 0.9; if (e.st > 0.28) { e.state = 'walk'; e.cd = Math.max(e.cd, 0.4); } break;
    case 'down': e.x += e.vx * dt; e.vz -= 520 * dt; e.z += e.vz * dt; if (e.z <= 0) { e.z = 0; e.vx *= 0.8; if (!e.landed) { e.landed = true; G.fx.push({ x: e.x, y: e.y, t: 0, dust: true }); } } if (e.st > 0.9 && e.z === 0) { e.state = 'walk'; e.inv = 0.6; e.cd = 0.8 * e.cdm; e.landed = false; } break;
    case 'dead': e.dead += dt; e.x += e.vx * dt; e.vx *= 0.97; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); if (e.z === 0) e.vz = 0; break;
  }
  if (e.state !== 'dead' && e.state !== 'charge' && e.state !== 'atk') e.x = clamp(e.x, G.cam - 40, G.cam + W + 40);
  if (e.boss && !e.rage && e.hp < e.max * 0.4) { e.rage = true; popText('ENRAGED!', e.x, e.y - 90, '#ff3030', 1); audio.sfx('boss'); }
}
function bossPick(e, dx, dy) {
  const moves = e.d.moves, near = Math.abs(dx) < 56 && Math.abs(dy) < 14;
  let m = moves[(Math.random() * moves.length) | 0];
  if (near && Math.random() < 0.55) m = 'melee';
  if (!near && m === 'melee') m = moves.find(x => x !== 'melee' && x !== 'summon') || 'charge';
  if (m === 'summon' && (G.ents.filter(x => !x.boss && x.state !== 'dead').length >= 3 || (!e.rage && Math.random() < 0.5))) m = moves.includes('shoot') ? 'shoot' : 'melee';
  if (m === 'shoot' && Math.abs(dy) > 40) m = 'charge';
  e.move = m; e.state = 'windup'; e.st = 0; audio.sfx('alert');
}

// ---------- encounters: phases, hazards, pressure ----------
function spawnHaz(spec) {
  const L = G.lane, p = G.p, rowY = () => L.top + 8 + Math.random() * (L.bot - L.top - 16);
  if (spec.kind === 'drop') { const near = Math.random() < 0.45, x = clamp(near ? p.x + (Math.random() - 0.5) * 60 : G.cam + 30 + Math.random() * (W - 60), G.cam + 24, G.cam + W - 24); G.haz.push({ k: 'drop', obj: spec.obj || 'crate', x, y: L.top + 4 + Math.random() * (L.bot - L.top - 8), t: 0, z: 150 }); }
  else if (spec.kind === 'car') { const dir = Math.random() < 0.5 ? 1 : -1; G.haz.push({ k: 'car', y: rowY(), dir, x: dir > 0 ? G.cam - 70 : G.cam + W + 70, t: 0, hit: new Set(), col: ['#c83a2a', '#2a6ac8', '#e0b020', '#3a9a5a'][(Math.random() * 4) | 0] }); }
  else if (spec.kind === 'roll') G.haz.push({ k: 'roll', y: rowY(), dir: -1, x: G.cam + W + 40, t: 0, hit: new Set() });
  else if (spec.kind === 'spot' && G.haz.filter(h => h.k === 'spot').length < 2) G.haz.push({ k: 'spot', x: G.cam + W * 0.7, y: (L.top + L.bot) / 2, t: 0, seen: 0, cool: 1.5, life: 16, flash: 0 });
}
function updateEncounter(dt, st) {
  const p = G.p, dmgM = 0.8 * st.diff.dmg;
  // next beat of a set piece when the room is nearly empty
  if (G.lock !== null && G.queue.length) {
    const alive = G.ents.filter(e => e.state !== 'dead').length;
    if (alive <= 1) { G.qT += dt; if (G.qT > 0.45) { G.qT = 0; for (const s of G.queue.shift()) spawn(s.t, s.side, false, s); audio.sfx('alert'); popText(G.queue.length ? 'MORE!' : 'LAST WAVE!', G.cam + W / 2, 94, '#ff8a2a', 0.9); } } else G.qT = 0;
  }
  // scheduled hazards of the current encounter, boss-arena hazards, and hazards while walking the stretches between stops
  for (const q of G.hazQ) { q.t -= dt; if (q.t <= 0) { q.done = true; if (G.haz.length < 4) spawnHaz(q.spec); } } G.hazQ = G.hazQ.filter(q => !q.done);
  if (G.bossSpawned && G.lock !== null && st.bossHaz && G.boss) { G.bossHT -= dt; if (G.bossHT <= 0) { G.bossHT = st.bossHaz.every * (0.85 + Math.random() * 0.3); if (G.haz.length < 3) spawnHaz(st.bossHaz); } }
  (st.stretch || []).forEach((s, i) => { const inside = G.lock === null && !G.bossSpawned && G.cam >= s.from && G.cam <= s.to;
    if (!inside) { G.stT[i] = 1.4; return; } G.stT[i] -= dt; if (G.stT[i] <= 0) { G.stT[i] = s.every * (0.8 + Math.random() * 0.45); if (G.haz.length < 3) spawnHaz(s); } });
  const alive = e => e.state !== 'dead' && !e.boss && e.state !== 'drop';
  for (const h of G.haz) {
    h.t += dt;
    if (h.k === 'drop') { const ds = dropState(h.t); h.z = ds.z; if (ds.phase === 'land' && !h.done) { h.done = true; G.shake = Math.max(G.shake, 3); G.fx.push({ x: h.x, y: h.y, t: 0, dust: true }); audio.sfx(h.obj === 'crate' ? 'break' : 'heavy');
        if (p.state !== 'dead' && Math.abs(h.x - p.x) < 17 && Math.abs(h.y - p.y) < 12 && p.z < 14) { hurtPlayer(Math.round(10 * dmgM), h.x, true); popText('OUCH!', p.x, p.y - 80, '#d8d8a0', 0.6); }
        for (const e of G.ents) if (alive(e) && Math.abs(h.x - e.x) < 17 && Math.abs(h.y - e.y) < 12) hurtEnemy(e, 16, true, { x: h.x, face: e.x > h.x ? 1 : -1 }, true);
        if (h.obj === 'crate') { (G.rubble ||= []).push({ x: h.x, y: h.y, kind: 'crate', t: 0 }); if (Math.random() < 0.3) G.items.push({ x: h.x, y: h.y, kind: 'banana', heal: 20 }); } } }
    else if (h.k === 'car' || h.k === 'roll') {
      const car = h.k === 'car', warn = car ? 1.1 : 0.9; if (h.t <= warn) continue;
      h.x += h.dir * (car ? 290 : 125) * dt; const half = car ? 28 : 13;
      if (!h.hit.has(p) && p.state !== 'dead' && sweepHit(h, p, half)) { h.hit.add(p); hurtPlayer(Math.round((car ? 14 : 16) * dmgM), h.x - h.dir * 20, true); popText(car ? 'HONK!' : 'CRUSHED!', p.x, p.y - 80, '#d8d8a0', 0.6); }
      for (const e of G.ents) if (alive(e) && !h.hit.has(e) && sweepHit(h, e, half)) { h.hit.add(e); hurtEnemy(e, 22, true, { x: h.x, face: h.dir }, true); popText(car ? 'ROADKILL!' : 'SQUASHED!', e.x, e.y - 100, '#ff9a2a', 0.8); }
      if (h.x < G.cam - 120 || h.x > G.cam + W + 120) h.done = true; }
    else if (h.k === 'spot') {
      h.life -= dt; h.flash = Math.max(0, h.flash - dt);
      h.x += (clamp(p.x - h.x, -1, 1) * 34 + Math.sin(h.t * 1.4) * 40) * dt; h.y = clamp(h.y + (clamp(p.y - h.y, -1, 1) * 20 + Math.cos(h.t * 1.9) * 26) * dt, G.lane.top, G.lane.bot); h.x = clamp(h.x, G.cam + 24, G.cam + W - 24);
      const inBeam = p.state !== 'dead' && Math.abs(p.x - h.x) < 22 && Math.abs(p.y - h.y) < 14 && p.z < 30;
      if (spotUpdate(h, inBeam, dt)) { h.flash = 0.8; popText('SPOTTED!', p.x, p.y - 86, '#ff4a3a', 1); audio.sfx('siren'); if (G.ents.filter(e => alive(e)).length < 6) for (const t of ['soldier_baton', 'soldier_net']) spawn(t, 'T'); }
      if (h.life <= 0 || (G.lock === null && st.stretch && !(st.stretch.some(z => G.cam >= z.from - 40 && G.cam <= z.to + 60)))) h.done = true; }
  }
  G.haz = G.haz.filter(h => !h.done);
  // forward pressure: stand around between encounters and stragglers come for you; the GO arrow keeps pointing the way
  if (G.lock === null && !G.bossSpawned) {
    if (p.x > G.idleX + 6) { G.idleX = p.x; G.idleT = 0; } else G.idleT += dt;
    if (G.idleT > 3) G.goT = Math.max(G.goT, 0.5);
    if (G.idleT > 6.5) { G.idleT = 4; const pool = st.events[0].wave; if (G.ents.filter(e => e.state !== 'dead').length < 2) { const w0 = pool[(Math.random() * pool.length) | 0]; spawn(w0.t, Math.random() < 0.5 ? 'L' : 'R'); popText('KEEP MOVING!', G.cam + W / 2, 94, '#ff8a2a', 1); audio.sfx('alert'); } }
  } else G.idleT = 0;
}

// ---------- update ----------
function updatePlaying(dt) {
  const st = STAGES[G.stage], p = G.p;
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  updatePlayer(dt); audio.setIntense(G.lock !== null); // fight layer of the music while an encounter is locked
  // camera & waves
  const ev = st.events[G.evIdx];
  if (G.lock === null) {
    const target = clamp(p.x - W * 0.4, G.cam, st.length - W + 0);
    if (target > G.cam) G.cam = Math.min(target, G.cam + Math.min(140 * dt, Math.max(0.15, (target - G.cam) * Math.min(1, dt * 9)))); // eased follow: no sudden start when the hero crosses the 40% line
    const next = ev ? ev.at : (!G.bossSpawned ? st.length - W : null);
    if (ev && G.cam >= ev.at - 1) { G.lock = G.cam; for (const s of ev.wave) spawn(s.t, s.side, false, s); G.evIdx++; G.waveAlive = true; audio.sfx('alert'); G.queue = (ev.phases || []).slice(); G.qT = 0; G.idleT = 0;
      G.hazQ = ev.haz ? Array.from({ length: ev.haz.n || 1 }, (_, i) => ({ t: (ev.haz.start ?? 1) + i * (ev.haz.gap || 3), spec: ev.haz })) : []; if (ev.title) popText(ev.title, G.cam + W / 2, 94, '#ffe03a', 1.5); }
    else if (!ev && !G.bossSpawned && G.cam >= st.length - W - 1) { G.lock = G.cam; G.bossSpawned = true; spawn(st.boss, 'R', true); audio.sfx('boss'); audio.play('boss' + G.stage); popText('WARNING', G.cam + W / 2, 70, '#ff3030', 1.6); G.bossHT = (st.bossHaz?.every || 8) * 0.8; }
  }
  for (const e of G.ents) updateEnemy(e, dt);
  updateEncounter(dt, st);
  G.ents = G.ents.filter(e => !(e.state === 'dead' && e.dead > 0.9));
  // projectiles
  for (const n of G.proj) {
    n.x += n.vx * dt; n.life -= dt;
    if (n.lob) { n.z += n.vz * dt; n.vz -= LOB_G * dt; if (n.z <= 0) { n.life = 0; G.shake = Math.max(G.shake, n.kind === 'nade' ? 4 : 2); G.fx.push(n.kind === 'nade' ? { x: n.x, y: n.y, t: 0, ring: true } : { x: n.x, y: n.y, t: 0, dust: true }); audio.sfx(n.kind === 'nade' ? 'heavy' : 'land');
        if (p.state !== 'dead' && Math.abs(n.x - p.x) < n.blast && Math.abs(n.y - p.y) < 14 && p.z < 14) { hurtPlayer(n.dmg, n.x, n.kind === 'nade'); popText(n.kind === 'nade' ? 'BOOM!' : 'SPLAT!', p.x, p.y - 80, '#d8d8a0', 0.6); } } continue; }
    if (Math.abs(n.x - p.x) < 12 && Math.abs(n.y - p.y) < 13 && p.z < 24 && p.state !== 'dead') { n.life = 0; hurtPlayer(n.dmg, n.x - Math.sign(n.vx), n.kind === 'shell'); popText(PROJ_TEXT[n.kind] || 'HIT!', p.x, p.y - 80, '#d8d8a0', 0.6); } }
  G.proj = G.proj.filter(n => n.life > 0 && n.x > G.cam - 20 && n.x < G.cam + W + 20);
  for (const pr of G.props) if (pr.flash > 0) pr.flash -= dt; G.props = G.props.filter(x => !x.dead);
  for (const r of G.rubble || []) r.t += dt; G.rubble = (G.rubble || []).filter(r => r.t < 1.6);
  // wave clear
  if (G.lock !== null && !G.queue.length && !G.ents.some(e => e.state !== 'dead')) {
    if (G.boss && G.bossSpawned) { G.boss = null; G.lock = null; audio.jingle('clear'); G.clearT = 0; G.clearBonus = 500 + Math.max(0, Math.round((120 - G.stageT) / 2)) * 10; G.score += G.clearBonus; if (G.p.state === 'walk') G.p.state = 'idle'; setMode('stageclear'); if (G.stage + 1 < STAGES.length) checkpoint(); else clearSave(); return; }
    G.lock = null; G.goT = 3; G.hazQ = []; G.idleT = 0; G.idleX = G.p.x; audio.sfx('go');
  }
  if (G.goT > 0) G.goT -= dt; if (G.lastHitT > 0) G.lastHitT -= dt;
  G.shake = Math.max(0, G.shake - dt * 14); G.flash = Math.max(0, G.flash - dt);
  for (const f of G.fx) f.t += dt; G.fx = G.fx.filter(f => f.t < 0.3);
  for (const t of G.texts) { t.life -= dt; t.y -= 14 * dt; } G.texts = G.texts.filter(t => t.life > 0);
  // hard clamp camera lock
  if (G.lock !== null) G.cam += (G.lock - G.cam) * Math.min(1, dt * 8);
}

// ---------- render ----------
function panel(x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2c2a78'); g.addColorStop(0.5, '#1a1850'); g.addColorStop(1, '#0c0a2a');
  ctx.fillStyle = '#05040f'; ctx.fillRect(x - 1, y + 1, w + 2, h - 2); ctx.fillRect(x + 1, y - 1, w - 2, h + 2);
  ctx.fillStyle = g; ctx.fillRect(x, y + 1, w, h - 2); ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillStyle = '#f7d8ff'; ctx.fillRect(x + 2, y, w - 4, 1); ctx.fillRect(x, y + 2, 1, h - 4); ctx.fillStyle = '#ff9ad8'; ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.fillStyle = '#5a3a9a'; ctx.fillRect(x + 2, y + h - 1, w - 4, 1); ctx.fillRect(x + w - 1, y + 2, 1, h - 4); ctx.fillStyle = '#2a1a5a'; ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
  ctx.fillStyle = '#f7d8ff'; ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillStyle = '#5a3a9a'; ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
}
function segBar(x, y, n, v, cols, blink) {
  const lit = Math.ceil(n * Math.max(0, v));
  for (let i = 0; i < n; i++) {
    const on = i < lit && !(blink && Math.floor(G.t * 8) % 2 && i >= lit - 2);
    ctx.fillStyle = '#05040f'; ctx.fillRect(x + i * 4 - 1, y - 1, 5, 8);
    ctx.fillStyle = on ? cols[0] : '#3a1a3a'; ctx.fillRect(x + i * 4, y, 3, 6);
    if (on) { ctx.fillStyle = cols[1]; ctx.fillRect(x + i * 4, y, 3, 2); ctx.fillStyle = cols[2]; ctx.fillRect(x + i * 4, y + 5, 3, 1); } else { ctx.fillStyle = '#5a2a52'; ctx.fillRect(x + i * 4, y, 3, 1); }
  }
}
function drawHUD() {
  const T = document.body.classList.contains('touch'); // leave room for the pause/music buttons
  const p = G.p, r = p.hp / p.max;
  panel(4, 3, 150, 38);
  ctx.drawImage(A.icon, 8, 6, 22, 22);
  drawText(ctx, 'HARAMBE', 34, 14, '#ffe66a', 8);
  drawText(ctx, String(Math.round(G.score)) + ' PTS.', 148, 14, '#ffffff', 8, 'right');
  drawText(ctx, 'HEALTH', 34, 25, '#ff9ad8', 8); segBar(76, 19, 18, r, r > 0.3 ? ['#ffd02a', '#fff09a', '#d88a10'] : ['#ff4a4a', '#ffa0a0', '#a01818'], r <= 0.3);
  drawText(ctx, 'LIVES', 34, 36, '#ff9ad8', 8); drawHeart(ctx, 76, 35.5, 0.85); drawText(ctx, 'x' + String(p.lives), 84, 36, '#ffe66a', 8); drawText(ctx, 'HI ' + String(Math.max(G.hiscore, Math.round(G.score))), 148, 36, '#9ab8ff', 8, 'right');
  // right panel: boss, or the enemy you last hit, else stage info
  const b = G.boss && G.ents.includes(G.boss) ? G.boss : null, le = G.lastHit && G.ents.includes(G.lastHit) && G.lastHit.state !== 'dead' && G.lastHitT > 0 ? G.lastHit : null, el = G.ents.find(e => e.tag && e.state !== 'dead' && e.state !== 'drop'), tgt = b || le || el;
  const OX = T ? (tgt ? 12 : 28) : 0, PW = T && !tgt ? 62 : 150;
  panel(W - 4 - OX - PW, 3, PW, tgt ? 30 : 22);
  if (tgt) { drawText(ctx, (tgt.tag ? (tgt.tag === 'MINI' ? 'MINI ' : 'ELITE ') : '') + tgt.d.name.toUpperCase(), W - OX - 150 + 4, 14, tgt.boss ? '#ff7a7a' : tgt.tag ? '#ffd23a' : '#ffffff', 8); segBar(W - OX - 150 + 2, 20, tgt.boss ? 34 : 18, tgt.hp / tgt.max, ['#ff3a5a', '#ffb0c0', '#a0102a']); }
  else drawText(ctx, 'STAGE ' + (G.stage + 1), W - OX - 8, 14, '#ffffff', 8, 'right');
  if (p.rage > 0) drawText(ctx, 'RAGE ' + Math.ceil(p.rage), 8, 52, Math.floor(G.t * 6) % 2 ? '#ff6a3a' : '#ffd23a', 8);
  if (G.combo >= 2) { drawText(ctx, G.combo + ' HIT COMBO', W - OX - 8, 52, '#ff9a2a', 8, 'right'); }
}
function drawWorld() {
  const sx = G.shake ? (Math.random() - 0.5) * G.shake * 2 : 0, sy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save(); ctx.translate(Math.round(sx), Math.round(sy));
  const camP = Math.round(G.cam * 3) / 3, cam = camP; // one device-pixel camera (the canvas is 3x) for the plate, props, enemies, shadows AND hero: whole-logic-px scrolling stepped 1,1,2,1px and made the ground shimmer past the hero
  drawBG(ctx, STAGES[G.stage].bg, cam, G.t, G.stage);
  drawHazMarkers(ctx, G.haz, cam, G.t, G.lane); drawLobMarkers(ctx, G.proj, cam, G.t, n => n.x + n.vx * ((n.vz + Math.sqrt(n.vz * n.vz + 2 * LOB_G * n.z)) / LOB_G));
  const list = [...hazardEntries(ctx, G.haz, cam, G.t)];
  for (const pr of G.props) list.push({ y: pr.y, f: () => { shadow(ctx, pr.x - cam, pr.y, 18); drawProp(ctx, { ...pr, x: pr.x - cam }); } });
  for (const r of G.rubble || []) list.push({ y: r.y - 1, f: () => drawRubble(ctx, { ...r, x: r.x - cam }) });
  for (const it of G.items) list.push({ y: it.y, f: () => drawItem(ctx, it, it.x - cam, G.t) });
  for (const e of G.ents) list.push({ y: e.y, f: () => { shadow(ctx, e.x - cam, e.y, e.boss ? 56 : 36); if (e.tag) drawEliteRing(ctx, e, e.x - cam, G.t); const st = e.state, dur = { melee: e.d.double ? 0.5 : 0.4, lunge: 0.5, shoot: 0.5, slam: 0.6, summon: 0.7 }[e.move] || 0.4;
    drawHuman(ctx, { type: e.type, x: e.x - cam, y: e.y, z: e.z, face: e.face, t: e.t, state: st === 'charge' ? 'run' : st, at: st === 'hurt' ? e.st / 0.28 : e.st / dur, lieT: st === 'dead' ? e.dead + 0.5 : e.st, flash: e.flashT > 0 || (st === 'dead' && Math.floor(e.dead * 20) % 2) }); } });
  const p = G.p; list.push({ y: p.y, f: () => { shadow(ctx, p.x - cam, p.y, 44); if (p.inv > 0 && Math.floor(G.t * 20) % 2 && p.state !== 'special') return; if (p.rage > 0) { ctx.strokeStyle = `rgba(255,80,40,${0.5 + 0.4 * Math.sin(G.t * 14)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x - cam, p.y, 26, 8, 0, 0, 7); ctx.stroke(); }
    drawHarambe(ctx, { x: p.x - camP, y: p.y, z: p.z, vz: p.vz, face: p.face, t: p.t, wd: p.wd, state: p.state, at: p.st / ({ atk: 0.26, heavy: 0.5, special: 0.6, jatk: 0.3, hurt: 0.3 }[p.state] || 1), lieT: p.st, combo: p.n, flash: p.inv > 1.2 && p.state === 'hurt' }); } });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  for (const n of G.proj) { if (n.lob) shadow(ctx, n.x - cam, n.y, 10); drawProj(ctx, { ...n, x: n.x - cam }, G.t); }
  for (const f of G.fx) { const k = f.t / 0.3, x = f.x - cam; if (f.ring) { ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, f.y, 10 + k * 56, 4 + k * 18, 0, 0, 7); ctx.stroke(); ctx.strokeStyle = `rgba(255,200,60,${1 - k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, f.y, 6 + k * 50, 2 + k * 15, 0, 0, 7); ctx.stroke(); } else if (f.dust) drawDust(ctx, x, f.y, k); else drawSpark(ctx, x, f.y - 32, k, f.big); }
  if (G.p.state === 'special' && G.p.st > 0.2) { const k = (G.p.st - 0.2) / 0.4; ctx.strokeStyle = `rgba(255,224,58,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(G.p.x - cam, G.p.y, 8 + k * 62, 3 + k * 20, 0, 0, 7); ctx.stroke(); }
  for (const t of G.texts) drawText(ctx, t.txt, t.x - cam, t.y, t.color, 8, 'center');
  ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 5})`; ctx.fillRect(0, 0, W, H); }
  drawHUD();
  if (G.goT > 0 && Math.floor(G.t * 3) % 2) { drawText(ctx, 'GO', W - 36, 74, '#ffe03a', 14, 'center'); const ax = W - 20 + Math.round(Math.sin(G.t * 10) * 2); ctx.fillStyle = '#000'; ctx.fillRect(ax - 22, 74, 34, 14); ctx.fillStyle = '#ffe03a'; ctx.fillRect(ax - 21, 76, 22, 10); ctx.beginPath(); ctx.moveTo(ax, 70); ctx.lineTo(ax + 14, 81); ctx.lineTo(ax, 92); ctx.fill(); ctx.fillStyle = '#c88a10'; ctx.fillRect(ax - 21, 84, 22, 2); }
}
function centerBox(lines, y = 70) { const h = lines.length * 14 + 12; panel(60, y - 16, 200, h); lines.forEach((l, i) => drawText(ctx, l[0], W / 2, y + i * 14, l[1] || '#fff', l[2] || 8, 'center')); }

function drawTitle() {
  drawBG(ctx, 'jungle', G.t * 26, G.t);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(0.55, 'rgba(0,0,0,.05)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const y = 9 + Math.round(Math.sin(G.t * 2) * 1.5);
  drawLogo(ctx, 'HARAMBE', W / 2, y, 5, ['#fffbd0', '#ffe040', '#ff9a14', '#d85a00'], '#4a1000');
  drawLogo(ctx, 'JUNGLE BRAWL', W / 2, y + 52, 2, ['#ffffff', '#ff8a6a', '#e83a3a', '#9a1020'], '#2a0408');
  drawText(ctx, 'ALTERNATE UNIVERSE EDITION', W / 2, 96, '#9af0b0', 8, 'center');
  shadow(ctx, 48, 170, 44); drawHarambe(ctx, { x: 48, y: 170, face: 1, t: G.t, state: 'idle' });
  shadow(ctx, 250, 160, 36); drawHuman(ctx, { type: 'keeper_stun', x: 250, y: 160, face: -1, t: G.t, state: 'walk' });
  shadow(ctx, 288, 172, 36); drawHuman(ctx, { type: 'cop_baton', x: 288, y: 172, face: -1, t: G.t + 1, state: 'walk' });
  if (G.menu && G.menu.kind === 'confirm') drawPause(); else if (G.menu) drawMenu(G.menu);
  drawText(ctx, 'HI ' + String(G.hiscore).padStart(7, '0') + '   BY KUNGFUDOOM', W / 2, 175, '#c8d0e0', 7, 'center');
}
function stageIntro() {
  const st = STAGES[G.stage]; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const k = Math.min(1, G.mt / 0.4);
  drawLogo(ctx, 'STAGE ' + (G.stage + 1), W / 2 + (1 - k) * 200, 12, 3, ['#fffbd0', '#ffe040', '#ff9a14', '#d85a00'], '#4a1000');
  drawText(ctx, st.name, W / 2 - (1 - k) * 200, 70, '#fff', 12, 'center');
  drawText(ctx, '"' + st.sub + '"', W / 2, 88, '#8fe0a0', 9, 'center');
  shadow(ctx, ((G.mt * 90) % 380) - 30, 172, 44); drawHarambe(ctx, { x: ((G.mt * 90) % 380) - 30, y: 172, face: 1, t: G.mt, wd: G.mt * 90, state: 'walk' });
  drawText(ctx, 'LIVES ' + G.p.lives + '   SCORE ' + Math.round(G.score), W / 2, 106, '#99a', 7, 'center');
}

let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now; for (const m of [1, 2, 3]) if (Math.abs(dt - m / 60) < 0.0022) dt = m / 60; acc += dt; // snap rAF jitter (16.1/17.2ms...) to whole 60Hz ticks so steps don't alternate 0,2,1,1 (visible stutter on phones)
  input.poll(); if (input.take('mute')) audio.toggleMute();
  while (acc >= 1 / 60 - 1e-6) { acc -= 1 / 60; step(1 / 60); }
  render();
}
function step(dt) {
  if (G.mode === 'play' && G.paused) { menuStep(); return; } // paused = the whole world is frozen, incl. the shared animation clock G.t (hero invuln blink, bananas, bg, GO arrow)
  G.t += dt; G.mt += dt;
  switch (G.mode) {
    case 'title': if (!G.menu) G.menu = titleMenu(); menuStep(); break;
    case 'intro': if (input.take('start') || input.take('atk') || G.mt > INTRO.total) { newGame(); } break;
    case 'stageintro': input.anyPress(); if (G.mt > 2.4) { setMode('play'); } break;
    case 'play':
      if (!G.paused) { if (input.take('start')) openPause(); } else menuStep();
      if (G.paused) return;
      if (G.hitstop > 0) { G.hitstop -= dt; return; }
      updatePlaying(dt); G.stageT += dt; break;
    case 'stageclear': G.clearT = (G.clearT || 0) + dt; if (G.clearT > 3.2 && (input.take('start') || input.take('atk') || G.clearT > 6)) { startCutscene(G.stage); } break;
    case 'cutscene': if (stepCutscene(G.cs, dt, input)) afterCutscene(); break;
    case 'outro': if (G.mt > 5.5 && !G.prompted) askScore(true); else if (promptOpen()) input.anyPress(); else if (G.mt > 4 && (input.take('start') || input.take('atk'))) { saveHi(); toTitle(); } break;
    case 'lb': if (promptOpen()) input.anyPress(); else menuStep(); break;
    case 'gameover': if (G.mt > 1 && !G.prompted) askScore(false); else if (promptOpen()) input.anyPress(); else if (G.mt > 1 && (input.take('start') || input.take('atk'))) { saveHi(); G.score = 0; G.p = newPlayer(); startStage(G.stage, true); } break;
  }
  if (G.mode !== 'play') input.pressed.mute = false;
}
function saveHi() { if (G.score > G.hiscore) { G.hiscore = Math.round(G.score); try { localStorage.setItem('harambe-hi', G.hiscore); } catch (_) {} } }
function render() {
  document.body.classList.toggle('menu', !!G.menu); document.body.classList.toggle('paused', !!G.paused); document.body.classList.toggle('playing', G.mode === 'play'); document.body.classList.toggle('cutscene', G.mode === 'cutscene');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  switch (G.mode) {
    case 'title': drawTitle(); break;
    case 'intro': INTRO.draw(ctx, G.mt); break;
    case 'stageintro': stageIntro(); break;
    case 'play': case 'stageclear': case 'gameover': drawWorld();
      if (G.paused) drawPause();
      if (G.mode === 'stageclear') centerBox([['STAGE CLEAR!', '#ffe03a', 14], [STAGES[G.stage].name + ' cleared', '#fff', 8], ['BONUS +' + G.clearBonus + '  (' + Math.round(G.stageT) + 's)', '#9af0b0', 7], ['SCORE ' + Math.round(G.score), '#8af', 8], ...(G.clearT > 3.2 ? [['ENTER / ATK to continue', '#fff', 7]] : [])], 56);
      if (G.mode === 'gameover') centerBox([['GAME OVER', '#ff3a3a', 16], ['SCORE ' + Math.round(G.score), '#fff', 8], ...(G.mt > 1 ? [['ENTER to retry stage ' + (G.stage + 1), '#ffe03a', 8]] : [])], 70);
      break;
    case 'cutscene': drawCutscene(ctx, G.cs); break;
    case 'lb': drawLB(); break;
    case 'outro': drawOutro(ctx, G.mt, Math.round(G.score)); break;
  }
}
cv.addEventListener('pointerdown', e => {
  if (G.mode === 'cutscene') { const r = cv.getBoundingClientRect(); if (e.clientY < r.top + r.height * 0.2 && e.clientX > r.left + r.width * 0.72) { input.pressed.skip = true; return; } } // tap SKIP (top right)
  if (G.menu) { menuPointer(e); e.preventDefault(); return; }
  if (G.mode !== 'play') input.pressed.start = true;
});
addEventListener('pagehide', checkpointIfLive);
addEventListener('beforeunload', checkpointIfLive);
document.addEventListener('visibilitychange', () => { if (document.hidden) { checkpointIfLive(); if (G.mode === 'play' && !G.paused && !G.menu) openPause(); } last = performance.now(); acc = 0; }); // hide = auto-pause; no catch-up burst on return
G.save = readSave(STAGES.length);
loadAssets().then(() => { if (qs.has('debugstart')) { audio.init(); newGame(); G.mode = 'play'; } requestAnimationFrame(frame); }).catch(e => { { const pre = document.createElement('pre'); pre.style.color = '#f66'; pre.textContent = 'Failed to load art: ' + e.message; document.body.appendChild(pre); } });
// { audio.init(); newGame(); G.mode = 'play'; }
