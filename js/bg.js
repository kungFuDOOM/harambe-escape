import { W, GROUND_TOP } from './logic.js';
import { A } from './assets.js';
import { spr } from './sprites.js';

const PAR = { sky: 0.04, far: 0.14, mid: 0.4, near: 1, ground: 1 };
function tile(ctx, im, off, y, drift = 0) {
  const w = im.width; let x = -(((off + drift) % w) + w) % w;
  for (; x < W; x += w) ctx.drawImage(im, Math.round(x), y);
}
const rngf = n => { let s = n * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };

export function drawBG(ctx, kind, cam, t, noProps = false) {
  const L = A.bg[kind];
  tile(ctx, L.sky, cam * PAR.sky, 0, t * 2.2);
  tile(ctx, L.far, cam * PAR.far, 0, kind === 'night' ? 0 : t * 0.6);
  tile(ctx, L.mid, cam * PAR.mid, 0);
  tile(ctx, L.near, cam * PAR.near, 0);
  // set pieces anchored in world space
  if (noProps) {} else if (kind === 'zoo') spr(ctx, 'haystack', 250 - cam, 114);
  else if (kind === 'street') spr(ctx, 'zoobus', 640 - cam, 114);
  else if (kind === 'jungle') spr(ctx, 'homegate', 1960 - cam, 116);
  tile(ctx, L.ground, cam * PAR.ground, GROUND_TOP);
  // atmosphere
  if (kind === 'night') {
    const r = rngf(7);
    for (let i = 0; i < 14; i++) { const bx = r() * 340, by = 70 + r() * 90, ph = r() * 6; const x = ((bx - cam * 0.9 + Math.sin(t * 0.8 + ph) * 10) % 340 + 340) % 340, y = by + Math.cos(t * 1.1 + ph) * 6; if (Math.sin(t * 3 + ph) > -0.3) { ctx.fillStyle = 'rgba(190,255,100,.9)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); ctx.fillStyle = 'rgba(190,255,100,.25)'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); } }
  } else if (kind === 'jungle') {
    ctx.save(); ctx.globalAlpha = 0.10; ctx.fillStyle = '#e8ffc0';
    for (let i = 0; i < 4; i++) { const x = ((i * 90 - cam * 0.5 + Math.sin(t * 0.3 + i) * 6) % 400 + 400) % 400 - 40; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 26, 0); ctx.lineTo(x + 70, 118); ctx.lineTo(x + 30, 118); ctx.fill(); }
    ctx.restore();
    const r = rngf(3); ctx.fillStyle = '#c8e070';
    for (let i = 0; i < 8; i++) { const lx = ((r() * 340 - cam * 0.7 - t * 8 * (0.5 + r())) % 340 + 340) % 340, ly = ((r() * 120 + t * (10 + r() * 8)) % 130); ctx.fillRect(Math.round(lx), Math.round(ly), 2, 1); }
  } else if (kind === 'river') {
    const r = rngf(9); ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 18; i++) { const x = ((r() * 340 - cam * 0.2) % 340 + 340) % 340, y = 92 + r() * 8; if (Math.sin(t * 2 + i * 1.7) > 0.5) ctx.fillRect(Math.round(x), Math.round(y), 2, 1); }
  } else if (kind === 'street') {
    ctx.fillStyle = 'rgba(255,170,90,.05)'; ctx.fillRect(0, 0, W, 112);
  }
  // soft vignette on the floor top (depth)
  const g = ctx.createLinearGradient(0, GROUND_TOP, 0, GROUND_TOP + 14); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, GROUND_TOP, W, 14);
}
