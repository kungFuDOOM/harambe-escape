// Trailer title cards, drawn with the game's own font, logo renderer, backgrounds and sprites (320x180 logic grid).
// Loaded in the page by capture.mjs; CARDS[name](ctx, t) paints one frame t seconds into the card.
import { W, H } from '../../js/logic.js';
import { A } from '../../js/assets.js';
import { drawBG } from '../../js/bg.js';
import { drawText, drawLogo, drawHarambe, drawHuman, shadow } from '../../js/sprites.js';
import { INTRO } from '../../js/scenes.js';

const GOLD = ['#fffbd0', '#ffe040', '#ff9a14', '#d85a00'], RED = ['#ffffff', '#ff8a6a', '#e83a3a', '#9a1020'];
const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const slide = (t, d = 0, from = 1) => (1 - ease((t - d) / 0.28)) * 220 * from;

function panel(ctx, x, y, w, h) { // same bevelled menu panel as the game's HUD
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2c2a78'); g.addColorStop(0.5, '#1a1850'); g.addColorStop(1, '#0c0a2a');
  ctx.fillStyle = '#05040f'; ctx.fillRect(x - 1, y + 1, w + 2, h - 2); ctx.fillRect(x + 1, y - 1, w - 2, h + 2);
  ctx.fillStyle = g; ctx.fillRect(x, y + 1, w, h - 2); ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillStyle = '#f7d8ff'; ctx.fillRect(x + 2, y, w - 4, 1); ctx.fillRect(x, y + 2, 1, h - 4); ctx.fillStyle = '#ff9ad8'; ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.fillStyle = '#5a3a9a'; ctx.fillRect(x + 2, y + h - 1, w - 4, 1); ctx.fillRect(x + w - 1, y + 2, 1, h - 4);
}
function black(ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
function bars(ctx) { ctx.fillStyle = '#05040f'; ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 14, W, 14); ctx.fillStyle = '#5a3a9a'; ctx.fillRect(0, 14, W, 1); ctx.fillStyle = '#ff9ad8'; ctx.fillRect(0, H - 15, W, 1); }

// plain text card: lines = [[text, color, size, delay]]
const words = lines => (ctx, t) => {
  black(ctx); bars(ctx);
  const total = lines.reduce((a, l) => a + (l[2] > 9 ? 18 : 12), 0); let y = 90 - total / 2 + 10;
  lines.forEach(([s, col, size, d = 0], i) => { if (t >= d) drawText(ctx, s, W / 2 + slide(t, d, i % 2 ? -1 : 1), y, col, size, 'center'); y += size > 9 ? 18 : 12; });
};

// faction card: who wants him back, over the dimmed stage backdrop, with the roster marching in
const faction = (name, line2, bg, cam, crew, boss) => (ctx, t) => {
  drawBG(ctx, bg, cam + t * 30, t); ctx.fillStyle = 'rgba(4,2,16,.62)'; ctx.fillRect(0, 0, W, H);
  drawLogo(ctx, name, W / 2 + slide(t, 0), 22, 3, GOLD, '#4a1000');
  drawText(ctx, line2, W / 2 - slide(t, 0.12), 66, '#fff', 12, 'center');
  const xs = [128, 168, 208], ys = [158, 170, 162];
  crew.forEach((c, i) => { const k = ease((t - 0.25 - i * 0.08) / 0.5), x = xs[i] + (1 - k) * 200; shadow(ctx, x, ys[i], 36); drawHuman(ctx, { type: c, x, y: ys[i], face: -1, t: t + i, state: k < 1 ? 'run' : 'idle' }); });
  const kb = ease((t - 0.55) / 0.5), bx = 268 + (1 - kb) * 160; shadow(ctx, bx, 168, 56); drawHuman(ctx, { type: boss, x: bx, y: 168, face: -1, t, state: kb < 1 ? 'walk' : 'idle' });
  const hx = 54; shadow(ctx, hx, 168, 44); drawHarambe(ctx, { x: hx, y: 168, face: 1, t, state: 'idle' });
  bars(ctx);
};

function endCard(ctx, t) {
  drawBG(ctx, 'jungle', 300 + t * 26, t);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.5, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const drop = k => Math.round((1 - ease(k)) * -70);
  const y = 9 + Math.round(Math.sin(t * 2) * 1.5);
  drawLogo(ctx, 'HARAMBE', W / 2, y + drop(t / 0.35), 5, GOLD, '#4a1000');
  if (t > 0.25) drawLogo(ctx, 'JUNGLE BRAWL', W / 2 + slide(t, 0.25), y + 52, 2, RED, '#2a0408');
  if (t > 0.6) drawText(ctx, '5 STAGES - 5 BOSSES - 1 GORILLA', W / 2, 96, '#9af0b0', 8, 'center');
  shadow(ctx, 44, 172, 44); drawHarambe(ctx, { x: 44, y: 172, face: 1, t, state: t > 1.1 && t < 1.7 ? 'special' : 'idle', at: (t - 1.1) / 0.6 });
  shadow(ctx, 270, 164, 36); drawHuman(ctx, { type: 'cop_baton', x: 270, y: 164, face: -1, t, state: 'walk' });
  shadow(ctx, 298, 174, 36); drawHuman(ctx, { type: 'keeper_net', x: 298, y: 174, face: -1, t: t + 1, state: 'walk' });
  if (t > 0.9) {
    panel(ctx, 84, 108, 152, 36);
    drawText(ctx, 'PLAY FREE IN YOUR BROWSER', W / 2, 121, '#ffe03a', 8, 'center');
    drawText(ctx, 'harambe-escape.vercel.app', W / 2, 136, '#fff', 8, 'center');
  }
  if (t > 1.3) drawText(ctx, 'KEYBOARD - GAMEPAD - TOUCH', W / 2, 158, '#c8d0e0', 7, 'center');
  if (t > 1.3) drawText(ctx, 'BY KUNGFUDOOM', W / 2, 172, '#9ab8ff', 7, 'center');
}

function warning(ctx, t) { // flashing boss alarm
  black(ctx); const on = Math.floor(t * 6) % 2 === 0;
  ctx.fillStyle = on ? '#3a0006' : '#140002'; ctx.fillRect(0, 50, W, 80);
  ctx.fillStyle = '#ff3030'; for (let x = -40 + ((t * 80) % 20); x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x + 10, 50); ctx.lineTo(x + 4, 56); ctx.lineTo(x - 6, 56); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, 124); ctx.lineTo(x + 10, 124); ctx.lineTo(x + 4, 130); ctx.lineTo(x - 6, 130); ctx.fill(); }
  if (on || t > 0.9) drawLogo(ctx, 'WARNING', W / 2, 64, 4, RED, '#2a0408');
  if (t > 0.35) drawText(ctx, 'FIVE BOSSES. ZERO CHILL.', W / 2 + slide(t, 0.35), 116, '#fff', 8, 'center');
}

// ---------------- arcade attract-mode cards (build-arcade.mjs) ----------------
const big = (ctx, x, y, k, fn) => { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(k, k); fn(); ctx.restore(); }; // sprite drawn k x size, feet at (x, y)
const hero2 = (ctx, x, y, face, t, state = 'idle', at = 0) => big(ctx, x, y, 2, () => { shadow(ctx, 0, 0, 44); drawHarambe(ctx, { x: 0, y: 0, face, t, state, at }); });
const boss2 = (ctx, type, x, y, face, t, state = 'idle') => big(ctx, x, y, 2, () => { shadow(ctx, 0, 0, 56); drawHuman(ctx, { type, x: 0, y: 0, face, t, state }); });
function rays(ctx, cx, cy, t, a, b, n = 16) { // rotating sunburst
  ctx.fillStyle = a; ctx.fillRect(0, 0, W, H); ctx.fillStyle = b;
  for (let i = 0; i < n; i++) { const a0 = t * 0.4 + (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * 400, cy + Math.sin(a0) * 400); ctx.lineTo(cx + Math.cos(a1) * 400, cy + Math.sin(a1) * 400); ctx.fill(); }
}
function star(ctx, x, y, r, spikes, fill, edge) {
  ctx.beginPath(); for (let i = 0; i < spikes * 2; i++) { const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.62 : r * (i % 4 ? 0.9 : 1.05); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = edge; ctx.stroke();
}
const shake = (t, t0, amp = 3) => t > t0 && t < t0 + 0.3 ? Math.round(Math.sin(t * 90) * amp * (1 - (t - t0) / 0.3)) : 0;
const blink = (t, hz = 2) => Math.floor(t * hz * 2) % 2 === 0;

function boot(ctx, t) { // cabinet power-on self test
  black(ctx);
  if (t < 0.12) { const h = Math.max(1, (t / 0.12) * 90); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(0, 90 - h / 2, W, h); return; }
  const L = [['MAIN CPU', 'OK'], ['SOUND CPU', 'OK'], ['BANANA ROM', 'OK'], ['HAYSTACK', 'OK'], ['GORILLA', 'VERY ANGRY']];
  L.forEach(([a, b], i) => { if (t > 0.2 + i * 0.16) { drawText(ctx, a, 64, 46 + i * 14, '#fff', 8, 'left', null); drawText(ctx, b, 256, 46 + i * 14, i === 4 ? '#ff5050' : '#9af0b0', 8, 'right', null); } });
  if (t > 1.05) drawText(ctx, '(C) 2026 KUNGFUDOOM', W / 2, 152, '#9ab8ff', 8, 'center', null);
  drawText(ctx, 'CREDIT 0', W - 8, H - 6, '#fff', 7, 'right', null);
}

function news(ctx, t) { // breaking news over the intro's zoo-chaos scene
  INTRO.draw(ctx, 12.7 + t);
  ctx.fillStyle = '#05040f'; ctx.fillRect(0, 0, W, 16); ctx.fillRect(0, H - 36, W, 36);
  ctx.fillStyle = '#c01818'; ctx.fillRect(4, 3, 56, 11); drawText(ctx, 'CH 9 NEWS', 32, 12, '#fff', 7, 'center', null);
  if (blink(t)) { ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(W - 40, 8, 3, 0, 7); ctx.fill(); } drawText(ctx, 'LIVE', W - 8, 12, '#fff', 8, 'right', null);
  const k = ease(t / 0.3);
  ctx.fillStyle = '#d01c1c'; ctx.fillRect(-W + k * W, H - 34, 120, 12); drawText(ctx, 'BREAKING NEWS', -W + k * W + 60, H - 25, '#fff', 8, 'center', null);
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(W - k * W, H - 22, W, 12); drawText(ctx, 'GORILLA LOOSE IN CINCINNATI', W - k * W + 6, H - 13, '#101018', 8, 'left', null);
  const tick = '  ZOO, POLICE, FBI AND ARMY IN PURSUIT  --  KID TOTALLY FINE, WANTS TO GO AGAIN  --  RESIDENTS ADVISED TO HIDE BANANAS  --';
  ctx.fillStyle = '#ffd02a'; ctx.fillRect(0, H - 9, W, 9); drawText(ctx, tick, W - t * 70, H - 2, '#101018', 7, 'left', null);
}

function slam(ctx, t) { // logo slams down, flash, shake
  const sx = shake(t, 0.15), sy = shake(t + 0.05, 0.15);
  ctx.save(); ctx.translate(sx, sy);
  rays(ctx, W / 2, 70, t, '#3a0a10', '#5a1418');
  const y = t < 0.15 ? -60 + (t / 0.15) * 76 : 16;
  drawLogo(ctx, 'HARAMBE', W / 2, y, 6, GOLD, '#4a1000');
  if (t > 0.3) drawLogo(ctx, 'JUNGLE BRAWL', W / 2 + slide(t, 0.3), 80, 3, RED, '#2a0408');
  if (t > 0.6) drawText(ctx, 'ALTERNATE UNIVERSE EDITION', W / 2, 128, '#9af0b0', 8, 'center');
  ctx.restore();
  if (t >= 0.15 && t < 0.22) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
}

function heroCard(ctx, t) { // character-select style intro
  ctx.fillStyle = '#1a0a3a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2a1458'; for (let i = -6; i < 14; i++) { ctx.beginPath(); const x = i * 30 + (t * 40) % 30; ctx.moveTo(x, 0); ctx.lineTo(x + 14, 0); ctx.lineTo(x - 46, H); ctx.lineTo(x - 60, H); ctx.fill(); }
  ctx.fillStyle = '#ff9a14'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(150, 0); ctx.lineTo(110, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = '#d85a00'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(130, 0); ctx.lineTo(90, H); ctx.lineTo(0, H); ctx.fill();
  const pose = t > 1.7 && t < 2.3 ? 'special' : 'idle';
  hero2(ctx, 74 - slide(t, 0) * 0.6, 172, 1, t, pose, (t - 1.7) / 0.6);
  drawText(ctx, 'PLAYER 1', 236 + slide(t, 0.05), 24, '#ffe03a', 8, 'center');
  drawLogo(ctx, 'HARAMBE', 236 + slide(t, 0.1), 30, 3, GOLD, '#4a1000');
  if (t > 0.3) drawText(ctx, 'SILVERBACK. ZERO PATIENCE.', 236, 72, '#fff', 7, 'center');
  [['POWER', 9], ['SPEED', 6], ['TOSSING', 10], ['CHEST POUND', 10]].forEach(([n, v], i) => {
    const d = 0.45 + i * 0.12; if (t < d) return; const y = 88 + i * 16, k = ease((t - d) / 0.3);
    drawText(ctx, n, 162, y + 7, '#ff9ad8', 7, 'left');
    for (let s = 0; s < 10; s++) { ctx.fillStyle = '#05040f'; ctx.fillRect(232 + s * 8, y, 7, 8); if (s < Math.round(v * k)) { ctx.fillStyle = s >= 8 ? '#ff4a4a' : '#ffd02a'; ctx.fillRect(233 + s * 8, y + 1, 5, 6); } }
  });
  if (t > 1.2 && blink(t, 3)) drawText(ctx, 'SELECTED!', 236, 164, '#9af0b0', 12, 'center');
}

const VS = { boss_head: ['HEAD ZOOKEEPER', 'zoo'], boss_captain: ['POLICE CAPTAIN', 'street'], boss_agent: ['SPECIAL AGENT', 'office'], boss_general: ['ARMORED GENERAL', 'base'], boss_baron: ['THE BARON', 'jungle'] };
const vs = (type, taunt) => (ctx, t) => { // split-screen versus card
  const [name, bg] = VS[type];
  drawBG(ctx, bg, 600 + t * 40, t); ctx.fillStyle = 'rgba(10,0,20,.55)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(80,20,140,.75)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(176, 0); ctx.lineTo(144, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = 'rgba(170,16,30,.75)'; ctx.beginPath(); ctx.moveTo(180, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(148, H); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(176, 0); ctx.lineTo(180, 0); ctx.lineTo(148, H); ctx.lineTo(144, H); ctx.fill();
  const k = ease(t / 0.18);
  hero2(ctx, 70 - (1 - k) * 120, 174, 1, t);
  boss2(ctx, type, 252 + (1 - k) * 120, 174, -1, t);
  const vy = t < 0.12 ? -40 + t / 0.12 * 100 : 60;
  drawLogo(ctx, 'VS', W / 2 - 2 + shake(t, 0.12, 2), vy, 5, RED, '#2a0408');
  drawLogo(ctx, name, W / 2 + slide(t, 0.1, -1), 146, 2, GOLD, '#4a1000');
  if (taunt && t > 0.45) { const w = taunt.length * 6 + 10, x = Math.min(W - w / 2 - 4, 230), y = 26;
    ctx.fillStyle = '#000'; ctx.fillRect(x - w / 2 - 1, y - 11, w + 2, 16); ctx.fillStyle = '#fff'; ctx.fillRect(x - w / 2, y - 10, w, 14); ctx.fillRect(x + 20, y + 4, 6, 5);
    drawText(ctx, taunt, x, y + 1, '#111', 8, 'center', null); }
};

// transparent overlays for gameplay: a SCENE splash at the start of the cut, comic bursts at given times
const scene = (n, place) => (ctx, t) => {
  if (t > 1.25) return; const k = t < 1.05 ? ease(t / 0.16) : 1 - ease((t - 1.05) / 0.2), x = (1 - k) * -W * (t < 1.05 ? 1 : -1);
  ctx.save(); ctx.translate(Math.round(x), 0);
  ctx.fillStyle = '#05040f'; ctx.fillRect(0, 60, W, 46); ctx.fillStyle = '#c01818'; ctx.fillRect(0, 62, W, 42); ctx.fillStyle = '#ff6a3a'; ctx.fillRect(0, 62, W, 2);
  drawLogo(ctx, 'SCENE ' + n, W / 2, 63, 2, GOLD, '#4a1000'); drawText(ctx, place, W / 2, 100, '#fff', 12, 'center');
  ctx.restore();
};
const WORDS = { POW: ['#ffe03a', '#ff3a1a'], WHAM: ['#7af0ff', '#2a4aff'], BONK: ['#9aff7a', '#1a8a2a'], SMASH: ['#ffe03a', '#d01c8a'], 'KA-BOOM': ['#fff', '#ff7a14'] };
const bursts = list => (ctx, t) => { for (const [t0, word, x, y] of list) { const d = t - t0; if (d < 0 || d > 0.5) continue;
  const [fill, edge] = WORDS[word], r = 26 + word.length * 4, pop = d < 0.07 ? 1.25 : 1;
  star(ctx, x, y, r * pop, 12, edge, '#000'); star(ctx, x, y, r * 0.8 * pop, 12, fill, edge);
  drawLogo(ctx, word + '!', x, y - 9, 2, ['#ffffff', '#fff7c0', '#ffd040', '#ff8a00'], '#000'); } };
const both = (...fs) => (ctx, t) => fs.forEach(f => f(ctx, t));

function attract(ctx, t) { // closing attract screen
  drawBG(ctx, 'jungle', 300 + t * 26, t);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(0.5, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,.7)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const y = 8 + Math.round(Math.sin(t * 2) * 1.5), sx = shake(t, 0.12);
  drawLogo(ctx, 'HARAMBE', W / 2 + sx, t < 0.12 ? -60 + t / 0.12 * 68 : y, 5, GOLD, '#4a1000');
  if (t >= 0.12 && t < 0.18) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  if (t > 0.25) drawLogo(ctx, 'JUNGLE BRAWL', W / 2 + slide(t, 0.25), y + 52, 2, RED, '#2a0408');
  hero2(ctx, 30, 178, 1, t, t > 1.0 && t < 1.6 ? 'special' : 'idle', (t - 1.0) / 0.6);
  shadow(ctx, 272, 166, 36); drawHuman(ctx, { type: 'cop_baton', x: 272, y: 166, face: -1, t, state: 'walk' });
  shadow(ctx, 298, 176, 36); drawHuman(ctx, { type: 'agent_kick', x: 298, y: 176, face: -1, t: t + 1, state: 'walk' });
  if (t > 0.7) { drawText(ctx, '1 PLAYER - 5 STAGES - 5 BOSSES', W / 2, 96, '#9af0b0', 8, 'center');
    panel(ctx, 92, 104, 136, 34); drawText(ctx, 'PLAY FREE IN YOUR BROWSER', W / 2, 117, '#ffe03a', 7, 'center'); drawText(ctx, 'harambe-escape.vercel.app', W / 2, 131, '#fff', 8, 'center'); }
  if (t > 1.4 && blink(t, 1.5)) drawText(ctx, 'PUSH START', W / 2, 156, '#fff', 12, 'center');
  drawText(ctx, '(C) 2026 KUNGFUDOOM', W / 2, 174, '#9ab8ff', 7, 'center');
  if (t > 1.4 && !blink(t, 1.5)) drawText(ctx, 'INSERT COIN', W / 2, 156, '#ffe03a', 12, 'center');
  drawText(ctx, 'CREDIT 0', W - 6, 174, '#fff', 7, 'right');
}

export const CARDS = {
  loose: words([['THE KID IS FINE.', '#9af0b0', 12, 0], ['THE GORILLA, HOWEVER...', '#fff', 8, 0.7]]),
  everyone: words([['NOW THE WHOLE CITY', '#fff', 12, 0], ['WANTS HIM BACK.', '#ffe03a', 12, 0.25]]),
  zoo: faction('THE ZOO', 'WANTS HIM BACK', 'zoo', 500, ['keeper_net', 'keeper_dart', 'keeper_stun'], 'boss_head'),
  cops: faction('THE COPS', 'WANT HIM BACK', 'street', 500, ['cop_baton', 'cop_shield', 'cop_taser'], 'boss_captain'),
  fbi: faction('THE FBI', 'WANTS HIM BACK', 'office', 500, ['agent_kick', 'agent_net', 'agent_case'], 'boss_agent'),
  army: faction('THE ARMY', 'WANTS HIM BACK', 'base', 500, ['soldier_shield', 'soldier_net', 'soldier_baton'], 'boss_general'),
  warning,
  home: words([['ONE GORILLA.', '#fff', 12, 0], ['ONE WAY HOME.', '#ffe03a', 12, 0.45]]),
  end: endCard,
  kidfine: words([['(THE KID IS FINE.)', '#9af0b0', 8, 0]]),
  // arcade trailer
  boot, news, slam, hero: heroCard, attract,
  vs_head: vs('boss_head'), vs_captain: vs('boss_captain'), vs_agent: vs('boss_agent'), vs_general: vs('boss_general'),
  vs_baron: vs('boss_baron', "YOU'LL LOOK GREAT IN MY COLLECTION!"),
  o_zoo: both(scene(1, 'CINCINNATI ZOO'), bursts([[2.9, 'POW', 236, 60]])),
  o_street: both(scene(2, 'VINE STREET'), bursts([[2.3, 'KA-BOOM', 230, 62]])),
  o_fbi: both(scene(3, 'FBI FIELD OFFICE'), bursts([[2.9, 'WHAM', 88, 62]])),
  o_army: both(scene(4, 'FORT CINCINNATI'), bursts([[2.0, 'BONK', 236, 60]])),
  o_jungle: both(scene(5, 'THE JUNGLE'), bursts([[1.8, 'SMASH', 230, 60]])),
  // second arcade cut (build-arcade2.mjs): same splashes, bursts on that footage's knockouts
  o2_zoo: both(scene(1, 'CINCINNATI ZOO'), bursts([[2.1, 'KA-BOOM', 230, 62]])),
  o2_street: both(scene(2, 'VINE STREET'), bursts([[2.2, 'WHAM', 88, 62]])),
  o2_fbi: both(scene(3, 'FBI FIELD OFFICE'), bursts([[2.8, 'POW', 236, 60]])),
  o2_army: both(scene(4, 'FORT CINCINNATI'), bursts([[2.2, 'SMASH', 88, 62]])),
  o2_jungle: both(scene(5, 'THE JUNGLE'), bursts([[2.0, 'BONK', 236, 60]])),
};
