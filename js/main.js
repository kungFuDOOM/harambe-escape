import { W, H, GROUND_TOP, GROUND_BOT, clamp, hitTest, radiusTest, scoreFor, heal, applyBlock } from './logic.js';
import { STAGES, ENEMIES, BOSSES } from './levels.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { drawBG } from './bg.js';
import { shadow, drawHarambe, drawHuman, drawKid, drawProp, drawBanana, drawNet, drawText } from './sprites.js';
import { INTRO, drawOutro } from './scenes.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
const qs = new URLSearchParams(location.search);

const G = {
  mode: 'title', t: 0, mt: 0, stage: 0, cam: 0, lock: null, evIdx: 0, ents: [], props: [], items: [], proj: [], fx: [], texts: [],
  p: null, score: 0, hiscore: +(localStorage.getItem('harambe-hi') || 0), combo: 0, comboT: 0, shake: 0, flash: 0, hitstop: 0, goT: 0, boss: null, paused: false, god: qs.has('god'),
};
window.__game = G; // QA hook

function newPlayer() {
  return { x: 40, y: 142, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: 100, max: 100, lives: 3, state: 'idle', t: 0, st: 0, n: 0, comboT: 0, buf: false, inv: 0, hit: new Set(), w: 14 };
}
function setMode(m) { G.mode = m; G.mt = 0; }

// ---------- stage setup ----------
function startStage(i, keepPlayer = true) {
  const st = STAGES[i]; G.stage = i; G.cam = 0; G.lock = null; G.evIdx = 0; G.ents = []; G.items = []; G.proj = []; G.fx = []; G.texts = []; G.boss = null; G.bossSpawned = false; G.goT = 0;
  G.props = st.props.map(p => ({ x: p.x, y: 130 + ((p.x * 7) % 36), kind: p.kind, hp: 2, flash: 0 }));
  if (!keepPlayer || !G.p) G.p = newPlayer(); else { Object.assign(G.p, { x: 40, y: 142, z: 0, state: 'idle', vx: 0, hp: G.p.max, inv: 1.5 }); }
  audio.play('stage' + i, st.music); setMode('stageintro');
}
function newGame() { G.score = 0; G.p = newPlayer(); startStage(+qs.get('stage') || 0, true); if (qs.get('stage')) G.p.lives = 3; }

// ---------- entities ----------
function spawn(type, side, boss = false) {
  const d = boss ? BOSSES[type] : ENEMIES[type];
  const e = { type, boss, d, x: side === 'L' ? G.cam - 20 : G.cam + W + 20, y: GROUND_TOP + 14 + Math.random() * (GROUND_BOT - GROUND_TOP - 16), z: 0, vx: 0, vy: 0, vz: 0, face: side === 'L' ? 1 : -1, hp: d.hp, max: d.hp, state: 'walk', t: Math.random() * 3, st: 0, cd: 0.6 + Math.random() * 1.2, w: boss ? 22 : 14, slot: (Math.random() < .5 ? -1 : 1) * (26 + Math.random() * 18), hurtT: 0, inv: 0, rage: false, hit: false, move: null, dead: 0 };
  if (boss) { G.boss = e; e.x = G.cam + W + 30; e.cd = 1.2; }
  G.ents.push(e); return e;
}
function popText(txt, x, y, color = '#ffe03a', life = 0.7) { G.texts.push({ txt, x, y, color, life, max: life }); }
function spark(x, y, big) { G.fx.push({ x, y, t: 0, big }); }

function hurtEnemy(e, dmg, kd, from, heavy) {
  if (e.state === 'dead' || e.inv > 0) return false;
  const frontal = (from.x < e.x ? -1 : 1) === e.face * -1 ? false : (from.x - e.x) * e.face > 0;
  const blocking = (e.d.blocks) && (e.state === 'walk' || e.state === 'idle') && frontal;
  const real = applyBlock(dmg, blocking, frontal, heavy);
  if (blocking && real < dmg) { popText('BLOCK', e.x, e.y - 40, '#9ab4d8', 0.4); audio.sfx('swing'); kd = false; }
  e.hp -= real; e.hurtT = 1.5; G.hitstop = heavy ? 0.07 : 0.035; G.shake = Math.max(G.shake, heavy ? 3 : 1);
  G.combo++; G.comboT = 1.3; spark(e.x, e.y - 22 - e.z, heavy);
  audio.sfx(heavy ? 'heavy' : 'punch');
  G.score += Math.round(real * 2);
  e.flashT = 0.08;
  if (G.combo >= 3) popText(G.combo + ' HITS!', e.x, e.y - 52, '#ff8a2a', 0.6);
  if (e.hp <= 0) {
    e.state = 'dead'; e.dead = 0; e.vx = from.face * 110; e.vz = 150; e.z = 1; G.score += scoreFor(e.d.pts, G.combo); audio.sfx('ko'); G.shake = 4;
    popText('+' + scoreFor(e.d.pts, G.combo), e.x, e.y - 60, '#fff', 0.9);
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
  p.hp -= dmg; p.inv = 0.8; G.shake = 3; G.combo = 0; G.flash = 0.08; audio.sfx('hurt'); spark(p.x, p.y - 22 - p.z, false);
  const dir = srcX < p.x ? 1 : -1;
  if (p.hp <= 0) { p.hp = 0; p.state = 'dead'; p.st = 0; p.vz = 160; p.vx = dir * 90; p.z = 1; audio.sfx('ko'); G.shake = 6; return; }
  if (kd || p.z > 0) { p.state = 'down'; p.st = 0; p.vz = 130; p.vx = dir * 80; p.z = Math.max(p.z, 1); p.inv = 1.8; }
  else { p.state = 'hurt'; p.st = 0; p.vx = dir * 30; }
}

// ---------- player ----------
function updatePlayer(dt) {
  const p = G.p, ax = input.axis(); p.t += dt; p.st += dt; p.inv = Math.max(0, p.inv - dt);
  p.comboT -= dt; if (p.comboT <= 0 && p.state !== 'atk') p.n = 0;
  const free = p.state === 'idle' || p.state === 'walk';
  if (free) {
    const mx = ax.x * 82, my = ax.y * 52;
    p.x += mx * dt; p.y = clamp(p.y + my * dt, GROUND_TOP + 6, GROUND_BOT);
    if (ax.x) p.face = ax.x; p.state = (ax.x || ax.y) ? 'walk' : 'idle';
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
      if (p.st > 0.07 && p.st < 0.16) for (const e of G.ents) if (!p.hit.has(e) && e.state !== 'dead' && hitTest(p, { reach: 20, w: 22 }, e)) { p.hit.add(e); hurtEnemy(e, p.n === 3 ? 11 : 6, p.n === 3, p, false); }
      if (p.st > 0.07 && p.st < 0.16) hitProps(p, 22);
      if (p.st > d) { if (p.buf && p.n < 3) startAtk(); else { p.state = 'idle'; if (p.n >= 3) p.n = 0; } } break; }
    case 'heavy': if (p.st > 0.2 && p.st < 0.3) { for (const e of G.ents) if (!p.hit.has(e) && e.state !== 'dead' && hitTest(p, { reach: 24, w: 34, depth: 18 }, e)) { p.hit.add(e); hurtEnemy(e, 18, true, p, true); } hitProps(p, 26); }
      if (p.st > 0.5) p.state = 'idle'; break;
    case 'special': if (p.st > 0.22 && p.st < 0.3 && !p.did) { p.did = true; G.flash = 0.12; for (const e of G.ents) if (e.state !== 'dead' && radiusTest(p, e, 62, 34)) { e.inv = 0; hurtEnemy(e, 24, true, { x: p.x + (e.x < p.x ? 1 : -1), face: e.x < p.x ? -1 : 1 }, true); } for (const pr of G.props) if (Math.abs(pr.x - p.x) < 62) breakProp(pr); G.proj = G.proj.filter(n => Math.abs(n.x - p.x) > 62); }
      if (p.st > 0.6) { p.state = 'idle'; p.did = false; } break;
    case 'jump': case 'jatk':
      p.x += p.vx * dt; p.vz -= 520 * dt; p.z += p.vz * dt; p.y = clamp(p.y + ax.y * 30 * dt, GROUND_TOP + 6, GROUND_BOT);
      if (p.state === 'jatk' && p.st > 0.03) for (const e of G.ents) if (!p.hit.has(e) && e.state !== 'dead' && hitTest(p, { reach: 18, w: 26, height: 34 }, e)) { p.hit.add(e); hurtEnemy(e, 10, true, p, false); }
      if (p.z <= 0) { p.z = 0; p.vz = 0; p.state = 'idle'; audio.sfx('land'); } break;
    case 'hurt': p.x += p.vx * dt; p.vx *= 0.9; if (p.st > 0.3) p.state = 'idle'; break;
    case 'down': p.x += p.vx * dt; p.vz -= 520 * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vx *= 0.8; if (!p.landed) { p.landed = true; audio.sfx('land'); } } if (p.st > 1.0 && p.z === 0) { p.state = 'idle'; p.landed = false; } break;
    case 'dead': p.x += p.vx * dt; p.vx *= 0.95; p.vz -= 520 * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z === 0) p.vz = 0;
      if (p.st > 1.4) { if (p.lives > 1) { p.lives--; p.hp = p.max; p.state = 'idle'; p.inv = 2.5; p.z = 0; p.x = Math.max(p.x, G.cam + 30); popText('LIVES x' + p.lives, p.x, p.y - 50, '#fff', 1.2); } else { p.lives = 0; audio.stop(); setMode('gameover'); } } break;
  }
  const minX = G.cam + 12, maxX = (G.lock ?? G.cam + W) + (G.lock ? W : 0) - 12;
  p.x = clamp(p.x, minX, G.lock !== null ? G.lock + W - 12 : STAGES[G.stage].length + W);
  // items
  for (const it of G.items) if (!it.got && Math.abs(it.x - p.x) < 14 && Math.abs(it.y - p.y) < 12 && p.z < 12) { it.got = true; p.hp = heal(p.hp, p.max, it.heal); audio.sfx('banana'); popText('+' + it.heal + ' HP', p.x, p.y - 56, '#ffe03a', 0.8); G.score += 50; }
  G.items = G.items.filter(i => !i.got);
}
function hitProps(p, reach) { for (const pr of G.props) if (!pr.dead && Math.abs(pr.x - (p.x + p.face * reach)) < 18 && Math.abs(pr.y - p.y) < 14 && !pr.hitBy?.has(p.st > 0 ? p.state + p.n + (p.comboT) : 0)) { pr.hp--; pr.flash = 0.08; G.hitstop = 0.03; audio.sfx('punch'); if (pr.hp <= 0) breakProp(pr); else pr.hp = pr.hp; } }
function breakProp(pr) { if (pr.dead) return; pr.dead = true; audio.sfx('break'); G.shake = 2; G.score += 30; spark(pr.x, pr.y - 10, true); const r = Math.random(); G.items.push({ x: pr.x, y: pr.y, kind: 'banana', heal: r < 0.25 ? 50 : 20 }); }

// ---------- enemies ----------
function attackersNow() { return G.ents.filter(e => !e.boss && (e.state === 'windup' || e.state === 'atk')).length; }
function updateEnemy(e, dt) {
  const p = G.p; e.t += dt; e.st += dt; e.hurtT = Math.max(0, e.hurtT - dt); e.inv = Math.max(0, e.inv - dt); e.cd -= dt; if (e.flashT) e.flashT -= dt;
  const dx = p.x - e.x, dy = p.y - e.y, dist = Math.abs(dx);
  const alive = p.state !== 'dead';
  switch (e.state) {
    case 'walk': {
      const sp = e.d.speed * (e.rage ? 1.35 : 1);
      const kind = e.boss ? null : e.d.kind;
      let tx = p.x - Math.sign(dx || 1) * (kind === 'net' ? 120 : 0) + (e.boss ? 0 : (kind === 'net' ? 0 : e.slot)), ty = p.y;
      if (kind === 'net') { tx = p.x + (e.x < p.x ? -110 : 110); tx = clamp(tx, G.cam + 20, G.cam + W - 20); }
      if (e.boss) { tx = p.x - Math.sign(dx || 1) * 28; }
      const mx = tx - e.x, my = ty - e.y;
      if (Math.abs(mx) > 3) e.x += Math.sign(mx) * sp * dt; if (Math.abs(my) > 3) e.y += Math.sign(my) * sp * 0.8 * dt;
      e.y = clamp(e.y, GROUND_TOP + 6, GROUND_BOT); e.face = dx >= 0 ? 1 : -1;
      if (e.cd <= 0 && alive) {
        if (e.boss) bossPick(e, dx, dy);
        else if (kind === 'net') { if (dist < 190 && Math.abs(dy) < 40 && G.proj.length < 3) { e.state = 'windup'; e.st = 0; e.move = 'net'; audio.sfx('alert'); } }
        else if (dist < 30 && Math.abs(dy) < 12 && attackersNow() < 2) { e.state = 'windup'; e.st = 0; e.move = 'melee'; audio.sfx('alert'); }
      }
      break; }
    case 'windup': {
      const dur = e.boss ? 0.55 : 0.42; e.face = dx >= 0 ? 1 : -1;
      if (e.move === 'slam' && e.st < 0.01) e.slamX = e.x;
      if (e.st > dur) { e.state = e.move === 'charge' ? 'charge' : 'atk'; e.st = 0; e.hit = false; if (e.move === 'charge') e.vx = e.face * (e.boss ? 190 : 150); } break; }
    case 'atk': {
      const m = e.move;
      if (m === 'melee') { if (e.st > 0.1 && !e.hit && hitTest(e, { reach: 20 * (e.boss ? 1.4 : 1), w: 24 }, p) && p.state !== 'dead') { e.hit = true; hurtPlayer(e.d.dmg, e.x, e.boss); } if (e.st > 0.4) { e.state = 'walk'; e.cd = (e.boss ? 0.8 : 1.4) + Math.random(); } }
      else if (m === 'net') { if (e.st > 0.15 && !e.hit) { e.hit = true; G.proj.push({ x: e.x + e.face * 12, y: e.y, z: 14, vx: e.face * 120, dmg: e.d.dmg, life: 3 }); audio.sfx('net'); } if (e.st > 0.5) { e.state = 'walk'; e.cd = 2.2 + Math.random(); } }
      else if (m === 'slam') { if (e.st > 0.12 && !e.hit) { e.hit = true; G.shake = 6; audio.sfx('heavy'); G.fx.push({ x: e.x, y: e.y, t: 0, ring: true }); if (radiusTest(e, p, 58, 26) && p.z < 14) hurtPlayer(e.d.dmg + 2, e.x, true); } if (e.st > 0.6) { e.state = 'walk'; e.cd = 1 + Math.random() * 0.6; } }
      else if (m === 'summon') { if (e.st > 0.2 && !e.hit) { e.hit = true; const t = e.d.summons || 'sailor'; spawn(t, 'L'); spawn(t, 'R'); audio.sfx('alert'); popText('BACKUP!', e.x, e.y - 70, '#ff5050', 0.9); } if (e.st > 0.7) { e.state = 'walk'; e.cd = 3 + Math.random(); } }
      break; }
    case 'charge': e.x += e.vx * dt; if (!e.hit && hitTest(e, { reach: 6, w: 24 }, p) && p.state !== 'dead') { e.hit = true; hurtPlayer(e.d.dmg, e.x, true); } e.y += Math.sign(dy) * 20 * dt;
      if (e.st > 0.8 || e.x < G.cam - 10 || e.x > G.cam + W + 10) { e.state = 'walk'; e.vx = 0; e.cd = 1.4; e.x = clamp(e.x, G.cam + 10, G.cam + W - 10); } break;
    case 'hurt': e.x += e.vx * dt; e.vx *= 0.9; if (e.st > 0.28) { e.state = 'walk'; e.cd = Math.max(e.cd, 0.4); } break;
    case 'down': e.x += e.vx * dt; e.vz -= 520 * dt; e.z += e.vz * dt; if (e.z <= 0) { e.z = 0; e.vx *= 0.8; } if (e.st > 0.9 && e.z === 0) { e.state = 'walk'; e.inv = 0.6; e.cd = 0.8; } break;
    case 'dead': e.dead += dt; e.x += e.vx * dt; e.vx *= 0.97; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); if (e.z === 0) e.vz = 0; break;
  }
  if (e.state !== 'dead' && e.state !== 'charge') e.x = clamp(e.x, G.cam - 40, G.cam + W + 40);
  if (e.boss && !e.rage && e.hp < e.max * 0.4) { e.rage = true; popText('ENRAGED!', e.x, e.y - 70, '#ff3030', 1); audio.sfx('boss'); }
}
function bossPick(e, dx, dy) {
  const moves = e.d.moves, near = Math.abs(dx) < 46 && Math.abs(dy) < 14;
  let m = moves[(Math.random() * moves.length) | 0];
  if (near && Math.random() < 0.6) m = 'melee';
  if (!near && m === 'melee') m = moves.find(x => x !== 'melee') || 'charge';
  if (m === 'summon' && G.ents.filter(x => !x.boss && x.state !== 'dead').length >= 3) m = 'slam';
  if (m === 'slam' && !moves.includes('slam')) m = 'melee';
  e.move = m; e.state = 'windup'; e.st = 0; audio.sfx('alert');
}

// ---------- update ----------
function updatePlaying(dt) {
  const st = STAGES[G.stage], p = G.p;
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  updatePlayer(dt);
  // camera & waves
  const ev = st.events[G.evIdx];
  if (G.lock === null) {
    const target = clamp(p.x - W * 0.4, G.cam, st.length - W + 0);
    if (target > G.cam) G.cam = Math.min(target, G.cam + 140 * dt);
    const next = ev ? ev.at : (!G.bossSpawned ? st.length - W : null);
    if (ev && G.cam >= ev.at - 1) { G.lock = G.cam; for (const s of ev.wave) spawn(s.t, s.side); G.evIdx++; G.waveAlive = true; audio.sfx('alert'); }
    else if (!ev && !G.bossSpawned && G.cam >= st.length - W - 1) { G.lock = G.cam; G.bossSpawned = true; spawn(st.boss, 'R', true); audio.sfx('boss'); popText('WARNING', G.cam + W / 2, 60, '#ff3030', 1.6); }
  }
  for (const e of G.ents) updateEnemy(e, dt);
  G.ents = G.ents.filter(e => !(e.state === 'dead' && e.dead > 0.9));
  // projectiles
  for (const n of G.proj) { n.x += n.vx * dt; n.life -= dt; if (Math.abs(n.x - p.x) < 10 && Math.abs(n.y - p.y) < 12 && p.z < 18 && p.state !== 'dead') { n.life = 0; hurtPlayer(n.dmg, n.x - Math.sign(n.vx), false); popText('NETTED!', p.x, p.y - 56, '#d8d8a0', 0.6); } }
  G.proj = G.proj.filter(n => n.life > 0 && n.x > G.cam - 20 && n.x < G.cam + W + 20);
  for (const pr of G.props) if (pr.flash > 0) pr.flash -= dt; G.props = G.props.filter(x => !x.dead);
  // wave clear
  if (G.lock !== null && !G.ents.some(e => e.state !== 'dead')) {
    if (G.boss && G.bossSpawned) { G.boss = null; G.lock = null; audio.stop(); audio.sfx('fanfare'); G.clearT = 0; setMode('stageclear'); return; }
    G.lock = null; G.goT = 3; audio.sfx('go');
  }
  if (G.goT > 0) G.goT -= dt;
  G.shake = Math.max(0, G.shake - dt * 14); G.flash = Math.max(0, G.flash - dt);
  for (const f of G.fx) f.t += dt; G.fx = G.fx.filter(f => f.t < 0.3);
  for (const t of G.texts) { t.life -= dt; t.y -= 14 * dt; } G.texts = G.texts.filter(t => t.life > 0);
  // hard clamp camera lock
  if (G.lock !== null) G.cam += (G.lock - G.cam) * Math.min(1, dt * 8);
}

// ---------- render ----------
function drawHUD() {
  const p = G.p; const bar = (x, y, w, h, v, c, bg = '#300') => { ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = c; ctx.fillRect(x, y, Math.max(0, w * v), h); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, Math.max(0, w * v), 2); };
  drawText(ctx, 'HARAMBE', 8, 12, '#ffe03a', 8); bar(8, 15, 80, 7, p.hp / p.max, p.hp / p.max > 0.3 ? '#3adf5a' : '#ff3a3a');
  for (let i = 0; i < p.lives; i++) { ctx.fillStyle = '#000'; ctx.fillRect(8 + i * 10 - 1, 25, 9, 9); ctx.fillStyle = '#d8262e'; ctx.fillRect(8 + i * 10, 26, 7, 3); ctx.fillStyle = '#3a3a46'; ctx.fillRect(8 + i * 10, 29, 7, 4); }
  drawText(ctx, String(Math.round(G.score)).padStart(7, '0'), 104, 12, '#fff', 8);
  drawText(ctx, 'HI ' + String(Math.max(G.hiscore, Math.round(G.score))).padStart(7, '0'), 104, 22, '#8af', 7);
  drawText(ctx, 'STAGE ' + (G.stage + 1), W - 8, 12, '#fff', 8, 'right');
  if (G.combo >= 2) drawText(ctx, G.combo + ' HIT COMBO', W - 8, 24, '#ff8a2a', 8, 'right');
  const b = G.boss && G.ents.includes(G.boss) ? G.boss : null;
  if (b) { drawText(ctx, b.d.name, W / 2, 162, '#ff5050', 8, 'center'); bar(W / 2 - 70, 166, 140, 6, b.hp / b.max, '#ff3a3a'); }
  else { for (const e of G.ents) if (e.hurtT > 0 && e.state !== 'dead') bar(Math.round(e.x - G.cam - 10), Math.round(e.y - 44), 20, 3, e.hp / e.max, '#ff5a3a'); }
}
function drawWorld() {
  const sx = G.shake ? (Math.random() - 0.5) * G.shake * 2 : 0, sy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save(); ctx.translate(Math.round(sx), Math.round(sy));
  const cam = Math.round(G.cam);
  drawBG(ctx, STAGES[G.stage].bg, cam, G.t);
  const list = [];
  for (const pr of G.props) list.push({ y: pr.y, f: () => { shadow(ctx, pr.x - cam, pr.y, 18); drawProp(ctx, { ...pr, x: pr.x - cam }); } });
  for (const it of G.items) list.push({ y: it.y, f: () => drawBanana(ctx, it.x - cam, it.y, G.t, it.heal > 25) });
  for (const e of G.ents) list.push({ y: e.y, f: () => { shadow(ctx, e.x - cam, e.y, e.boss ? 28 : 16); drawHuman(ctx, { x: e.x - cam, y: e.y, z: e.z, face: e.face, t: e.t, state: e.state === 'windup' || e.state === 'charge' ? 'walk' : (e.state === 'dead' ? 'down' : e.state), at: e.st / (e.move === 'slam' ? 0.5 : 0.4), pal: e.d.pal, scale: e.d.scale || 1, flash: e.flashT > 0 || (e.state === 'dead' && Math.floor(e.dead * 20) % 2), prop: e.boss ? e.d.prop : (e.d.kind === 'net' ? 'net' : null), windup: e.state === 'windup', shield: e.d.prop === 'shield', blocks: e.d.blocks }); } });
  const p = G.p; list.push({ y: p.y, f: () => { shadow(ctx, p.x - cam, p.y, 20); if (p.inv > 0 && Math.floor(G.t * 20) % 2 && p.state !== 'special') return; drawHarambe(ctx, { x: p.x - cam, y: p.y, z: p.z, face: p.face, t: p.t, state: p.state === 'jump' && false ? 'idle' : p.state, at: p.st / ({ atk: 0.26, heavy: 0.5, special: 0.6, jatk: 0.3 }[p.state] || 1), combo: p.n, flash: p.inv > 0 && p.state === 'hurt' }); } });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  for (const n of G.proj) drawNet(ctx, { ...n, x: n.x - cam });
  for (const f of G.fx) { const k = f.t / 0.3, x = f.x - cam; if (f.ring) { ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, f.y, 10 + k * 56, 4 + k * 18, 0, 0, 7); ctx.stroke(); } else { const r = (f.big ? 10 : 6) * (0.5 + k); ctx.fillStyle = k < 0.5 ? '#fff' : '#ffe03a'; ctx.fillRect(x - r, f.y - 22 - 1, r * 2, 2); ctx.fillRect(x - 1, f.y - 22 - r, 2, r * 2); ctx.fillRect(x - r * 0.6, f.y - 22 - r * 0.6, 3, 3); ctx.fillRect(x + r * 0.5, f.y - 22 + r * 0.5, 3, 3); } }
  if (G.p.state === 'special' && G.p.st > 0.2) { const k = (G.p.st - 0.2) / 0.4; ctx.strokeStyle = `rgba(255,224,58,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(G.p.x - cam, G.p.y, 8 + k * 62, 3 + k * 20, 0, 0, 7); ctx.stroke(); }
  for (const t of G.texts) drawText(ctx, t.txt, t.x - cam, t.y, t.color, 8, 'center');
  ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 5})`; ctx.fillRect(0, 0, W, H); }
  drawHUD();
  if (G.goT > 0 && Math.floor(G.t * 4) % 2) { drawText(ctx, 'GO', W - 30, 80, '#ffe03a', 14, 'center'); ctx.fillStyle = '#ffe03a'; ctx.fillRect(W - 24, 84, 10, 4); ctx.fillRect(W - 18, 80, 3, 12); }
}
function centerBox(lines, y = 70) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, y - 14, W, lines.length * 14 + 14); lines.forEach((l, i) => drawText(ctx, l[0], W / 2, y + i * 14, l[1] || '#fff', l[2] || 8, 'center')); }

function drawTitle() {
  drawBG(ctx, 'jungle', G.t * 30, G.t);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H);
  const y = 40 + Math.sin(G.t * 2) * 2;
  ctx.save(); ctx.translate(W / 2, y); ctx.font = 'bold 30px "Courier New",monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('HARAMBE', 3, 3); ctx.fillStyle = '#ffe03a'; ctx.fillText('HARAMBE', 0, 0); ctx.font = 'bold 18px "Courier New",monospace'; ctx.fillStyle = '#000'; ctx.fillText('JUNGLE BRAWL', 2, 22); ctx.fillStyle = '#ff5a2a'; ctx.fillText('JUNGLE BRAWL', 0, 20); ctx.restore();
  drawHarambe(ctx, { x: 80, y: 150, face: 1, t: G.t, state: 'idle' }); drawHuman(ctx, { x: 240, y: 150, face: -1, t: G.t, state: 'walk', pal: ENEMIES.keeper.pal });
  drawHuman(ctx, { x: 270, y: 156, face: -1, t: G.t + 1, state: 'walk', pal: ENEMIES.cop.pal });
  if (Math.floor(G.t * 2) % 2 === 0) drawText(ctx, 'PRESS ENTER / TAP TO START', W / 2, 108, '#fff', 9, 'center');
  drawText(ctx, 'ALTERNATE UNIVERSE EDITION', W / 2, 90, '#8fe0a0', 7, 'center');
  drawText(ctx, 'HI ' + String(G.hiscore).padStart(7, '0'), W / 2, 124, '#8af', 8, 'center');
  drawText(ctx, 'by kungFuDOOM · single player', W / 2, 174, '#99a', 6, 'center');
}
function stageIntro() {
  const st = STAGES[G.stage]; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const k = Math.min(1, G.mt / 0.4);
  drawText(ctx, 'STAGE ' + (G.stage + 1), W / 2 + (1 - k) * 200, 70, '#ffe03a', 20, 'center');
  drawText(ctx, st.name, W / 2 - (1 - k) * 200, 95, '#fff', 12, 'center');
  drawText(ctx, '"' + st.sub + '"', W / 2, 115, '#8fe0a0', 9, 'center');
  const g = G.stage; drawHarambe(ctx, { x: ((G.mt * 90) % 380) - 30, y: 150, face: 1, t: G.mt, state: 'walk' });
  drawText(ctx, 'LIVES ' + G.p.lives + '   SCORE ' + Math.round(G.score), W / 2, 170, '#99a', 7, 'center');
}

let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt;
  if (input.take('mute')) audio.toggleMute();
  while (acc >= 1 / 60) { acc -= 1 / 60; step(1 / 60); }
  render();
}
function step(dt) {
  G.t += dt; G.mt += dt;
  switch (G.mode) {
    case 'title': if (input.take('start') || input.take('atk') || input.take('jump')) { audio.init(); audio.sfx('select'); setMode(qs.has('skipintro') ? 'play0' : 'intro'); if (G.mode === 'play0') newGame(); else { audio.play('title', { root: 52, tempo: 100, mode: 'minor' }); } } break;
    case 'intro': if (input.take('start') || input.take('atk') || G.mt > INTRO.total) { newGame(); } break;
    case 'stageintro': input.anyPress(); if (G.mt > 2.4) { setMode('play'); } break;
    case 'play':
      if (input.take('start')) { G.paused = !G.paused; if (G.paused) audio.stop(); else audio.play('s', STAGES[G.stage].music); }
      if (G.paused) return;
      if (G.hitstop > 0) { G.hitstop -= dt; return; }
      updatePlaying(dt); break;
    case 'stageclear': G.clearT = (G.clearT || 0) + dt; if (G.clearT > 3.2 && (input.take('start') || input.take('atk') || G.clearT > 6)) { if (G.stage + 1 < STAGES.length) startStage(G.stage + 1); else { audio.play('title', { root: 55, tempo: 110, mode: 'dorian' }); setMode('outro'); } } break;
    case 'outro': if (G.mt > 4 && (input.take('start') || input.take('atk'))) { saveHi(); setMode('title'); audio.play('title', { root: 52, tempo: 100, mode: 'minor' }); } break;
    case 'gameover': if (G.mt > 1 && (input.take('start') || input.take('atk'))) { saveHi(); G.score = 0; G.p = newPlayer(); startStage(G.stage, true); } break;
  }
  if (G.mode !== 'play') input.pressed.mute = false;
}
function saveHi() { if (G.score > G.hiscore) { G.hiscore = Math.round(G.score); localStorage.setItem('harambe-hi', G.hiscore); } }
function render() {
  ctx.clearRect(0, 0, W, H);
  switch (G.mode) {
    case 'title': drawTitle(); break;
    case 'intro': INTRO.draw(ctx, G.mt); break;
    case 'stageintro': stageIntro(); break;
    case 'play': case 'stageclear': case 'gameover': drawWorld();
      if (G.paused) centerBox([['PAUSED', '#ffe03a', 12], ['ENTER to resume', '#fff', 8]]);
      if (G.mode === 'stageclear') centerBox([['STAGE CLEAR!', '#ffe03a', 14], [STAGES[G.stage].name + ' cleared', '#fff', 8], ['SCORE ' + Math.round(G.score), '#8af', 8], ...(G.clearT > 3.2 ? [['ENTER / ATK to continue', '#fff', 7]] : [])], 60);
      if (G.mode === 'gameover') centerBox([['GAME OVER', '#ff3a3a', 16], ['SCORE ' + Math.round(G.score), '#fff', 8], ...(G.mt > 1 ? [['ENTER to retry stage ' + (G.stage + 1), '#ffe03a', 8]] : [])], 70);
      break;
    case 'outro': drawOutro(ctx, G.mt, Math.round(G.score)); break;
  }
}
cv.addEventListener('pointerdown', () => { if (G.mode !== 'play') input.pressed.start = true; });
requestAnimationFrame(frame);
if (qs.has('debugstart')) { audio.init(); newGame(); G.mode = 'play'; }
