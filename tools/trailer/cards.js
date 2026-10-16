// Trailer title cards, drawn with the game's own font, logo renderer, backgrounds and sprites (320x180 logic grid).
// Loaded in the page by capture.mjs; CARDS[name](ctx, t) paints one frame t seconds into the card.
import { W, H } from '../../js/logic.js';
import { A } from '../../js/assets.js';
import { drawBG } from '../../js/bg.js';
import { drawText, drawLogo, drawHarambe, drawHuman, shadow } from '../../js/sprites.js';

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
};
