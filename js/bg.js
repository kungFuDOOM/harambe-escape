import { W, GROUND_TOP } from './logic.js';

const band = (ctx, cols, h) => cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * (h / cols.length), W, Math.ceil(h / cols.length)); });
const rep = (cam, f, period) => -((cam * f) % period) - period; // starting x for repeating tiles
function seeded(n) { let s = n * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

const SKY = {
  zoo: ['#6ec6ff', '#8fd3ff', '#aee0ff', '#c9ecff'], street: ['#ff9a5a', '#ff8a5a', '#e0705a', '#b05a6a'],
  river: ['#7ab8e8', '#9acaf0', '#b8d8f0', '#d8e8f5'], night: ['#0a0f2a', '#101838', '#18224a', '#222c5a'], jungle: ['#2a6a4a', '#2f7a50', '#3a8a58', '#4a9a60'],
};

export function drawBG(ctx, kind, cam, t) {
  band(ctx, SKY[kind], GROUND_TOP + 8);
  const r = seeded(kind.length * 7);
  if (kind === 'zoo') {
    // clouds
    ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { const x = (i * 130 - cam * 0.08 - t * 4) % 800; const xx = ((x % 800) + 800) % 800 - 80; ctx.fillRect(xx, 14 + (i % 3) * 14, 36, 8); ctx.fillRect(xx + 8, 8 + (i % 3) * 14, 20, 8); }
    // far trees
    for (let i = 0; i < 16; i++) { const x = rep(cam, 0.25, 640) + i * 40; const xx = ((x % 640) + 640) % 640 - 40; ctx.fillStyle = '#2f8a3a'; ctx.fillRect(xx, 52 + (i % 3) * 4, 30, 40); ctx.fillStyle = '#216a2a'; ctx.fillRect(xx + 12, 80, 6, 34); }
    // sign + fence
    for (let i = 0; i < 40; i++) { const x = i * 14 - cam * 0.7; const xx = ((x % 560) + 560) % 560 - 20; if (xx < W + 20) { ctx.fillStyle = '#3a3a44'; ctx.fillRect(xx, 82, 2, 30); ctx.fillStyle = '#555563'; ctx.fillRect(xx - 12, 90, 14, 2); ctx.fillRect(xx - 12, 100, 14, 2); } }
    const sx = 40 - cam * 0.7; if (sx > -160 && sx < W) { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(sx, 48, 130, 22); ctx.fillStyle = '#e8d8a0'; ctx.fillRect(sx + 2, 50, 126, 18); ctx.fillStyle = '#5a3a1a'; ctx.font = 'bold 9px monospace'; ctx.fillText('CINCINNATI ZOO', sx + 8, 62); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(sx + 10, 70, 4, 40); ctx.fillRect(sx + 116, 70, 4, 40); }
    // giant haystack at start (the soft landing)
    const hx = 250 - cam * 0.7; if (hx > -80 && hx < W) { ctx.fillStyle = '#d8b84a'; ctx.beginPath(); ctx.moveTo(hx - 34, 112); ctx.lineTo(hx - 20, 84); ctx.lineTo(hx + 20, 84); ctx.lineTo(hx + 36, 112); ctx.fill(); ctx.fillStyle = '#b8942a'; for (let i = 0; i < 8; i++) ctx.fillRect(hx - 24 + i * 6, 90 + (i % 3) * 7, 8, 2); }
  } else if (kind === 'street') {
    for (let i = 0; i < 8; i++) { const x = rep(cam, 0.3, 8 * 80) + i * 80; const xx = ((x % 640) + 640) % 640 - 80; const hh = 60 + ((i * 37) % 4) * 14; ctx.fillStyle = '#5a3a5a'; ctx.fillRect(xx, 112 - hh, 70, hh); ctx.fillStyle = '#ffd86a'; for (let wy = 0; wy < hh - 10; wy += 12) for (let wx = 6; wx < 64; wx += 14) if ((wx + wy + i * 3) % 3) ctx.fillRect(xx + wx, 112 - hh + 6 + wy, 6, 7); }
    for (let i = 0; i < 6; i++) { const x = rep(cam, 0.7, 6 * 120) + i * 120; const xx = ((x % 720) + 720) % 720 - 80; ctx.fillStyle = '#2a2a3a'; ctx.fillRect(xx, 60, 3, 52); ctx.fillRect(xx - 6, 58, 15, 3); ctx.fillStyle = '#ffe9a0'; ctx.fillRect(xx - 6, 61, 5, 3); }
    const bx = 600 - cam * 0.7; if (bx > -80 && bx < W) { ctx.fillStyle = '#e8c83a'; ctx.fillRect(bx, 76, 70, 28); ctx.fillStyle = '#222'; ctx.fillRect(bx + 4, 80, 56, 8); ctx.fillStyle = '#e8c83a'; ctx.font = 'bold 6px monospace'; ctx.fillText('ZOO BUS', bx + 14, 98); }
  } else if (kind === 'river') {
    ctx.fillStyle = '#3a78b8'; ctx.fillRect(0, 74, W, 38); ctx.fillStyle = '#6ab0e8'; for (let i = 0; i < 24; i++) { const x = ((i * 31 - cam * 0.4 + Math.sin(t + i) * 4) % 340 + 340) % 340; ctx.fillRect(x, 80 + (i % 5) * 7, 14, 1); }
    ctx.fillStyle = '#3a4a6a'; ctx.fillRect(0, 70, W, 4);
    for (let i = 0; i < 5; i++) { const x = rep(cam, 0.35, 5 * 160) + i * 160; const xx = ((x % 800) + 800) % 800 - 120; ctx.fillStyle = '#6a5a6a'; ctx.fillRect(xx, 28, 8, 46); ctx.fillRect(xx + 120, 28, 8, 46); ctx.fillRect(xx, 38, 128, 3); ctx.fillStyle = '#8a7a8a'; for (let c = 0; c <= 14; c++) ctx.fillRect(xx + 4 + c * 8, 38 + Math.abs(7 - c) * 2, 1, 32 - Math.abs(7 - c) * 2); }
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(0, 108, W, 6); ctx.fillStyle = '#3a2a1a'; for (let i = 0; i < 40; i++) { const x = ((i * 16 - cam * 0.9) % 640 + 640) % 640; if (x < W) ctx.fillRect(x, 108, 2, 6); }
  } else if (kind === 'night') {
    ctx.fillStyle = '#fff'; for (let i = 0; i < 40; i++) ctx.fillRect(r() * W, r() * 70, 1, 1);
    ctx.fillStyle = '#f5f0c8'; ctx.fillRect(250, 18, 14, 14); ctx.fillStyle = '#18224a'; ctx.fillRect(255, 18, 10, 10);
    for (let i = 0; i < 12; i++) { const x = rep(cam, 0.3, 12 * 70) + i * 70; const xx = ((x % 840) + 840) % 840 - 60; ctx.fillStyle = '#0a1a22'; ctx.fillRect(xx, 60 + (i % 3) * 6, 40, 52); ctx.fillStyle = '#0d2a2a'; ctx.fillRect(xx + 6, 48 + (i % 3) * 6, 28, 20); }
    for (let i = 0; i < 6; i++) { const x = rep(cam, 0.7, 6 * 120) + i * 120; const xx = ((x % 720) + 720) % 720 - 40; ctx.fillStyle = '#2a1a0a'; ctx.fillRect(xx, 50, 3, 62); ctx.fillRect(xx - 10, 54, 23, 2); ctx.fillStyle = '#222'; ctx.fillRect(xx - 120, 56 + Math.round(Math.sin(i) * 2), 240, 1); }
  } else if (kind === 'jungle') {
    for (let i = 0; i < 10; i++) { const x = rep(cam, 0.25, 10 * 64) + i * 64; const xx = ((x % 640) + 640) % 640 - 50; ctx.fillStyle = '#1e5a36'; ctx.fillRect(xx, 20, 44, 92); ctx.fillStyle = '#287a44'; ctx.fillRect(xx - 10, 10 + (i % 2) * 8, 64, 28); }
    for (let i = 0; i < 8; i++) { const x = rep(cam, 0.6, 8 * 90) + i * 90; const xx = ((x % 720) + 720) % 720 - 40; ctx.fillStyle = '#4a3016'; ctx.fillRect(xx, 0, 14, 112); ctx.fillStyle = '#2f6a2a'; for (let v = 0; v < 6; v++) ctx.fillRect(xx + 14 + (v % 2) * 3, 8 + v * 6 + Math.round(Math.sin(t * 2 + i + v) * 1), 2, 22 + v * 4); ctx.fillStyle = '#3a9a3a'; ctx.fillRect(xx - 16, 0, 46, 14); }
    ctx.fillStyle = 'rgba(200,255,220,.12)'; ctx.fillRect(0, 60, W, 52);
    const gx = 1900 - cam; if (gx > -80 && gx < W) { ctx.fillStyle = '#e8d848'; ctx.font = 'bold 10px monospace'; ctx.fillText('HOME →', gx, 70); }
  }
  // ground
  const g = { zoo: ['#b8a878', '#a89868'], street: ['#4a4a58', '#40404e'], river: ['#8a7a6a', '#7a6a5a'], night: ['#2a2a34', '#22222c'], jungle: ['#4a6a2a', '#3e5a22'] }[kind];
  for (let y = GROUND_TOP; y < 180; y += 8) { ctx.fillStyle = g[((y - GROUND_TOP) / 8) & 1]; ctx.fillRect(0, y, W, 8); }
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let i = 0; i < 30; i++) { const x = ((i * 23 - cam) % 700 + 700) % 700; if (x < W) ctx.fillRect(x, GROUND_TOP + 6 + (i * 13) % 56, 10, 1); }
  if (kind === 'street' || kind === 'night') { ctx.fillStyle = '#e8d84a'; for (let i = 0; i < 20; i++) { const x = ((i * 48 - cam) % 960 + 960) % 960 - 20; if (x < W) ctx.fillRect(x, 142, 24, 2); } }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, GROUND_TOP, W, 1);
}
