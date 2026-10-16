import { W, H, clamp, hitTest, radiusTest, scoreFor, heal, applyBlock } from './logic.js';
import { STAGES, ENEMIES, BOSSES } from './levels.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { drawBG, laneOf } from './bg.js';
import { loadAssets, A } from './assets.js';
import { shadow, drawHarambe, drawHuman, drawKid, drawProp, drawBanana, drawRubble, drawHeart, drawProj, drawText, drawSpark, drawDust, drawLogo, textWidth, spr } from './sprites.js';
import { INTRO, drawOutro } from './scenes.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const SCALE = cv.width / W; // canvas is 3x the 320x180 logic grid; art is baked at that resolution
ctx.imageSmoothingEnabled = false;
if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
const qs = new URLSearchParams(location.search);

const G = {
  mode: 'title', t: 0, mt: 0, stage: 0, cam: 0, lock: null, evIdx: 0, ents: [], props: [], items: [], proj: [], fx: [], texts: [],
  lane: { top: 124, bot: 172 }, p: null, score: 0, hiscore: +(localStorage.getItem('harambe-hi') || 0), combo: 0, comboT: 0, shake: 0, flash: 0, hitstop: 0, goT: 0, boss: null, paused: false, god: qs.has('god'),
};
window.__game = G; window.__stages = STAGES; // QA hooks

function newPlayer() {
  return { x: 40, y: (G.lane.top + G.lane.bot) / 2, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: 100, max: 100, lives: 3, state: 'idle', t: 0, st: 0, n: 0, comboT: 0, buf: false, inv: 0, hit: new Set(), w: 16 };
}
function setMode(m) { G.mode = m; G.mt = 0; }

// ---------- stage setup ----------
function startStage(i, keepPlayer = true) {
  const st = STAGES[i]; G.stage = i; G.lane = laneOf(st.bg); G.cam = 0; G.lock = null; G.evIdx = 0; G.ents = []; G.items = []; G.rubble = []; G.proj = []; G.fx = []; G.texts = []; G.boss = null; G.bossSpawned = false; G.goT = 0;
  G.props = st.props.map(p => ({ x: p.x, y: G.lane.top + 4 + ((p.x * 7) % Math.max(8, G.lane.bot - G.lane.top - 10)), kind: p.kind, hp: 2, flash: 0 }));
  if (!keepPlayer || !G.p) G.p = newPlayer(); else { Object.assign(G.p, { x: 40, y: (G.lane.top + G.lane.bot) / 2, z: 0, state: 'idle', vx: 0, hp: G.p.max, inv: 1.5 }); }
  audio.play('stage' + i, st.music); setMode('stageintro');
}
function newGame() { G.score = 0; G.p = newPlayer(); startStage(+qs.get('stage') || 0, true); if (qs.get('stage')) G.p.lives = 3; }

// ---------- entities ----------
function spawn(type, side, boss = false) {
  const d = boss ? BOSSES[type] : ENEMIES[type], df = STAGES[G.stage].diff, k = boss ? { hp: 1, spd: 1, dmg: 1, cd: 1 + (df.cd - 1) * 0.5 } : df;
  const hp = Math.round(d.hp * k.hp);
  const e = { type: d.sheet, boss, d, x: side === 'L' ? G.cam - 30 : G.cam + W + 30, y: G.lane.top + 2 + Math.random() * (G.lane.bot - G.lane.top - 4), z: 0, vx: 0, vy: 0, vz: 0, face: side === 'L' ? 1 : -1, hp, max: hp,
    spd: d.speed * k.spd, dmg: Math.round(d.dmg * k.dmg), cdm: k.cd, maxAtk: df.atk,
    state: 'walk', t: Math.random() * 3, st: 0, cd: (0.6 + Math.random() * 1.2) * k.cd, w: boss ? 26 : 16, slot: (Math.random() < .5 ? -1 : 1) * (30 + Math.random() * 16), hurtT: 0, inv: 0, rage: false, hit: false, move: null, dead: 0 };
  if (boss) { G.boss = e; e.x = G.cam + W + 40; e.cd = 1.2; }
  G.ents.push(e); return e;
}
function popText(txt, x, y, color = '#ffe03a', life = 0.7) { G.texts.push({ txt, x, y, color, life, max: life }); }
function spark(x, y, big) { G.fx.push({ x, y, t: 0, big }); }

function hurtEnemy(e, dmg, kd, from, heavy) {
  if (e.state === 'dead' || e.inv > 0) return false;
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
    e.state = 'dead'; e.dead = 0; e.vx = from.face * 110; e.vz = 150; e.z = 1; G.score += scoreFor(e.d.pts, G.combo); audio.sfx('ko'); G.shake = 4;
    popText('+' + scoreFor(e.d.pts, G.combo), e.x, e.y - 90, '#fff', 0.9);
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
  p.comboT -= dt; if (p.comboT <= 0 && p.state !== 'atk') p.n = 0;
  const free = p.state === 'idle' || p.state === 'walk';
  if (free) {
    const mx = ax.x * 82, my = ax.y * 52;
    p.x += mx * dt; p.y = clamp(p.y + my * dt, G.lane.top, G.lane.bot);
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
      if (p.st > 1.4) { if (p.lives > 1) { p.lives--; p.hp = p.max; p.state = 'idle'; p.inv = 2.5; p.z = 0; p.x = Math.max(p.x, G.cam + 30); popText('LIVES x' + p.lives, p.x, p.y - 80, '#fff', 1.2); } else { p.lives = 0; audio.stop(); setMode('gameover'); } } break;
  }
  const minX = G.cam + 22, maxX = (G.lock ?? G.cam + W) + (G.lock ? W : 0) - 12;
  p.x = clamp(p.x, minX, G.lock !== null ? G.lock + W - 22 : STAGES[G.stage].length + W);
  // items
  for (const it of G.items) if (!it.got && Math.abs(it.x - p.x) < 16 && Math.abs(it.y - p.y) < 12 && p.z < 12) { it.got = true; p.hp = heal(p.hp, p.max, it.heal); audio.sfx('banana'); popText('+' + it.heal + ' HP', p.x, p.y - 80, '#ffe03a', 0.8); G.score += 50; }
  G.items = G.items.filter(i => !i.got);
}
function deflect(p, reach) { // swings bat comic projectiles out of the air
  const n0 = G.proj.length; G.proj = G.proj.filter(n => !(Math.abs(n.x - (p.x + p.face * reach * 0.6)) < reach * 0.6 + 6 && Math.abs(n.y - p.y) < 16 && n.kind !== 'shell'));
  if (G.proj.length < n0) { popText('DEFLECT!', p.x + p.face * 20, p.y - 60, '#9af0ff', 0.5); audio.sfx('punch'); G.score += 25; } }
function hitProps(p, reach) { for (const pr of G.props) if (!pr.dead && Math.abs(pr.x - (p.x + p.face * reach)) < 18 && Math.abs(pr.y - p.y) < 14 && !pr.hitBy?.has(p.st > 0 ? p.state + p.n + (p.comboT) : 0)) { pr.hp--; pr.flash = 0.08; G.hitstop = 0.03; audio.sfx('punch'); if (pr.hp <= 0) breakProp(pr); else pr.hp = pr.hp; } }
function breakProp(pr) { if (pr.dead) return; pr.dead = true; (G.rubble ||= []).push({ x: pr.x, y: pr.y, kind: pr.kind, t: 0 }); audio.sfx('break'); G.shake = 2; G.score += 30; spark(pr.x, pr.y - 10, true); const r = Math.random(); G.items.push({ x: pr.x, y: pr.y, kind: 'banana', heal: r < 0.25 ? 50 : 20 }); }

// ---------- enemies ----------
function attackersNow() { return G.ents.filter(e => !e.boss && (e.state === 'windup' || e.state === 'atk')).length; }
const PROJ_TEXT = { net: 'NETTED!', dart: 'DARTED!', bolt: 'ZAPPED!', shell: 'BOOM!' };
function shoot(e, dy = 0) {
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
        else if (kind === 'ranged') { if (dist < (d.range || 120) + 70 && Math.abs(dy) < 14 && G.proj.length < 3 + G.stage) go('shoot'); }
        else if (kind === 'lunge') { if (Math.abs(dy) < 12 && attackersNow() < e.maxAtk) { if (dist < 130 && dist > 50) go('lunge'); else if (dist <= 50) go('melee'); } }
        else if (dist < (d.reach || 28) + 16 && Math.abs(dy) < 12 && attackersNow() < e.maxAtk) go('melee');
      }
      break; }
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
    else if (!ev && !G.bossSpawned && G.cam >= st.length - W - 1) { G.lock = G.cam; G.bossSpawned = true; spawn(st.boss, 'R', true); audio.sfx('boss'); popText('WARNING', G.cam + W / 2, 70, '#ff3030', 1.6); }
  }
  for (const e of G.ents) updateEnemy(e, dt);
  G.ents = G.ents.filter(e => !(e.state === 'dead' && e.dead > 0.9));
  // projectiles
  for (const n of G.proj) { n.x += n.vx * dt; n.life -= dt; if (Math.abs(n.x - p.x) < 12 && Math.abs(n.y - p.y) < 13 && p.z < 24 && p.state !== 'dead') { n.life = 0; hurtPlayer(n.dmg, n.x - Math.sign(n.vx), n.kind === 'shell'); popText(PROJ_TEXT[n.kind] || 'HIT!', p.x, p.y - 80, '#d8d8a0', 0.6); } }
  G.proj = G.proj.filter(n => n.life > 0 && n.x > G.cam - 20 && n.x < G.cam + W + 20);
  for (const pr of G.props) if (pr.flash > 0) pr.flash -= dt; G.props = G.props.filter(x => !x.dead);
  for (const r of G.rubble || []) r.t += dt; G.rubble = (G.rubble || []).filter(r => r.t < 1.6);
  // wave clear
  if (G.lock !== null && !G.ents.some(e => e.state !== 'dead')) {
    if (G.boss && G.bossSpawned) { G.boss = null; G.lock = null; audio.stop(); audio.sfx('fanfare'); G.clearT = 0; setMode('stageclear'); return; }
    G.lock = null; G.goT = 3; audio.sfx('go');
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
  drawText(ctx, 'LIFE', 34, 25, '#ff9ad8', 8); segBar(60, 19, 22, r, r > 0.3 ? ['#ffd02a', '#fff09a', '#d88a10'] : ['#ff4a4a', '#ffa0a0', '#a01818'], r <= 0.3);
  drawText(ctx, 'REST', 34, 36, '#ff9ad8', 8); drawHeart(ctx, 67, 36); drawText(ctx, 'x' + String(p.lives), 74, 36, '#ffe66a', 8); drawText(ctx, 'HI ' + String(Math.max(G.hiscore, Math.round(G.score))), 148, 36, '#9ab8ff', 8, 'right');
  // right panel: boss, or the enemy you last hit, else stage info
  const b = G.boss && G.ents.includes(G.boss) ? G.boss : null, le = G.lastHit && G.ents.includes(G.lastHit) && G.lastHit.state !== 'dead' && G.lastHitT > 0 ? G.lastHit : null, tgt = b || le;
  const OX = T ? (tgt ? 12 : 28) : 0, PW = T && !tgt ? 62 : 150;
  panel(W - 4 - OX - PW, 3, PW, tgt ? 30 : 22);
  if (tgt) { drawText(ctx, tgt.d.name.toUpperCase(), W - OX - 150 + 4, 14, tgt.boss ? '#ff7a7a' : '#ffffff', 8); segBar(W - OX - 150 + 2, 20, tgt.boss ? 34 : 18, tgt.hp / tgt.max, ['#ff3a5a', '#ffb0c0', '#a0102a']); }
  else drawText(ctx, 'STAGE ' + (G.stage + 1), W - OX - 8, 14, '#ffffff', 8, 'right');
  if (G.combo >= 2) { drawText(ctx, G.combo + ' HIT COMBO', W - OX - 8, 52, '#ff9a2a', 8, 'right'); }
}
function drawWorld() {
  const sx = G.shake ? (Math.random() - 0.5) * G.shake * 2 : 0, sy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save(); ctx.translate(Math.round(sx), Math.round(sy));
  const cam = Math.round(G.cam);
  drawBG(ctx, STAGES[G.stage].bg, cam, G.t);
  const list = [];
  for (const pr of G.props) list.push({ y: pr.y, f: () => { shadow(ctx, pr.x - cam, pr.y, 18); drawProp(ctx, { ...pr, x: pr.x - cam }); } });
  for (const r of G.rubble || []) list.push({ y: r.y - 1, f: () => drawRubble(ctx, { ...r, x: r.x - cam }) });
  for (const it of G.items) list.push({ y: it.y, f: () => drawBanana(ctx, it.x - cam, it.y, G.t, it.heal > 25) });
  for (const e of G.ents) list.push({ y: e.y, f: () => { shadow(ctx, e.x - cam, e.y, e.boss ? 56 : 36); const st = e.state, dur = { melee: e.d.double ? 0.5 : 0.4, lunge: 0.5, shoot: 0.5, slam: 0.6, summon: 0.7 }[e.move] || 0.4;
    drawHuman(ctx, { type: e.type, x: e.x - cam, y: e.y, z: e.z, face: e.face, t: e.t, state: st === 'charge' ? 'run' : st, at: st === 'hurt' ? e.st / 0.28 : e.st / dur, lieT: st === 'dead' ? e.dead + 0.5 : e.st, flash: e.flashT > 0 || (st === 'dead' && Math.floor(e.dead * 20) % 2) }); } });
  const p = G.p; list.push({ y: p.y, f: () => { shadow(ctx, p.x - cam, p.y, 44); if (p.inv > 0 && Math.floor(G.t * 20) % 2 && p.state !== 'special') return;
    drawHarambe(ctx, { x: p.x - cam, y: p.y, z: p.z, vz: p.vz, face: p.face, t: p.t, state: p.state, at: p.st / ({ atk: 0.26, heavy: 0.5, special: 0.6, jatk: 0.3, hurt: 0.3 }[p.state] || 1), lieT: p.st, combo: p.n, flash: p.inv > 1.2 && p.state === 'hurt' }); } });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  for (const n of G.proj) drawProj(ctx, { ...n, x: n.x - cam }, G.t);
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
  if (Math.floor(G.t * 2) % 2 === 0) drawText(ctx, 'PRESS ENTER / TAP TO START', W / 2, 124, '#ffffff', 8, 'center');
  drawText(ctx, 'HI ' + String(G.hiscore).padStart(7, '0'), W / 2, 138, '#9ab8ff', 8, 'center');
  drawText(ctx, 'BY KUNGFUDOOM', W / 2, 150, '#c8d0e0', 8, 'center');
}
function stageIntro() {
  const st = STAGES[G.stage]; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const k = Math.min(1, G.mt / 0.4);
  drawLogo(ctx, 'STAGE ' + (G.stage + 1), W / 2 + (1 - k) * 200, 12, 3, ['#fffbd0', '#ffe040', '#ff9a14', '#d85a00'], '#4a1000');
  drawText(ctx, st.name, W / 2 - (1 - k) * 200, 70, '#fff', 12, 'center');
  drawText(ctx, '"' + st.sub + '"', W / 2, 88, '#8fe0a0', 9, 'center');
  shadow(ctx, ((G.mt * 90) % 380) - 30, 172, 44); drawHarambe(ctx, { x: ((G.mt * 90) % 380) - 30, y: 172, face: 1, t: G.mt, state: 'walk' });
  drawText(ctx, 'LIVES ' + G.p.lives + '   SCORE ' + Math.round(G.score), W / 2, 106, '#99a', 7, 'center');
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
  document.body.classList.toggle('playing', G.mode === 'play');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0); ctx.imageSmoothingEnabled = false;
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
loadAssets().then(() => { if (qs.has('debugstart')) { audio.init(); newGame(); G.mode = 'play'; } requestAnimationFrame(frame); }).catch(e => { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f66">Failed to load art: ' + e.message + '</pre>'); });
// { audio.init(); newGame(); G.mode = 'play'; }
