// Comic-panel story cutscenes between stages (data in story.js): Ken Burns pan/zoom on stage art, silhouettes, a route map.
import { W, H } from './logic.js';
import { A } from './assets.js';
import { drawBG } from './bg.js';
import { drawHarambe, drawHuman, drawKid, drawText, shadow } from './sprites.js';
import { CUTSCENES, MAP_NODES, typedChars, csAdvance } from './story.js';

const lerp = (a, b, k) => a + (b - a) * k, ease = k => k * k * (3 - 2 * k);
let tmp = null;
function silhouette(ctx, fn) { // draw actor into a scratch canvas, flood it dark, composite back (keeps the art's outline)
  if (!tmp) { tmp = document.createElement('canvas'); tmp.width = W * 3; tmp.height = H * 3; }
  const g = tmp.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, tmp.width, tmp.height); g.setTransform(3, 0, 0, 3, 0, 0); g.imageSmoothingEnabled = false;
  fn(g); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(8,6,20,.88)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  ctx.drawImage(tmp, 0, 0, W, H);
}
function actor(ctx, a, k, t) {
  const x = lerp(a.x0, a.x1, k), d = Math.abs(a.x1 - a.x0) * k;
  const go = c => {
    if (a.who === 'h') { shadow(c, x, a.y, 44); drawHarambe(c, { x, y: a.y, face: a.face, t, wd: a.walk ? d + t * 0 : undefined, state: a.walk && a.x0 !== a.x1 && k < 1 ? 'walk' : 'idle' }); }
    else if (a.who === 'kid') { shadow(c, x, a.y, 14); drawKid(c, x, a.y, 'kid_idle', a.face); }
    else { shadow(c, x, a.y, a.who.startsWith('boss') ? 56 : 36); drawHuman(c, { type: a.who, x, y: a.y, face: a.face, t, wd: d, state: a.x0 !== a.x1 && k < 1 ? 'walk' : 'idle' }); }
  };
  if (a.sil) silhouette(ctx, go); else go(ctx);
}
function drawMap(ctx, leg, t) {
  ctx.fillStyle = '#10202c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#183a2a'; ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(W, 20); ctx.lineTo(W, 150); ctx.lineTo(0, 150); ctx.fill();
  ctx.fillStyle = '#1d4a34'; for (let i = 0; i < 40; i++) { const px = (i * 53) % W, py = 24 + (i * 37) % 120; ctx.fillRect(px, py, 5, 2); }
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 150); ctx.stroke(); } for (let y = 20; y < 150; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = '#3a7ac8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(112, 20); for (let y = 20; y <= 150; y += 10) ctx.lineTo(112 + Math.sin(y / 14) * 8 + (y - 20) * 0.18, y); ctx.stroke();
  ctx.strokeStyle = '#a03030'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(182, 20); ctx.lineTo(182, 150); ctx.stroke(); ctx.setLineDash([]);
  drawText(ctx, 'OHIO R.', 118, 36, '#7ab4f0', 6, 'left'); drawText(ctx, 'BORDER', 186, 36, '#e07070', 6, 'left');
  const N = MAP_NODES; // finished legs solid, current leg animates
  ctx.lineWidth = 2;
  for (let i = 0; i < N.length - 1; i++) {
    const a = N[i], b = N[i + 1], k = i < leg ? 1 : i === leg ? ease(Math.min(1, Math.max(0, (t - 0.3) / 1.6))) : 0; if (!k) continue;
    ctx.strokeStyle = i < leg ? '#ffe03a' : '#ffb02a'; ctx.setLineDash(i < leg ? [] : [4, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(lerp(a.x, b.x, k), lerp(a.y, b.y, k)); ctx.stroke();
  }
  ctx.setLineDash([]);
  N.forEach((n, i) => {
    const on = i <= leg, cur = i === leg + 1; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, 7); ctx.fill();
    ctx.fillStyle = on ? '#ffe03a' : cur ? (Math.floor(t * 4) % 2 ? '#ff5050' : '#a02020') : '#556'; ctx.beginPath(); ctx.arc(n.x, n.y, 3.5, 0, 7); ctx.fill();
    drawText(ctx, n.name, n.x, n.y + 15, on ? '#ffe03a' : '#ccd', 6, 'center');
  });
  const a = N[leg], b = N[leg + 1] || N[leg], k = ease(Math.min(1, Math.max(0, (t - 0.3) / 1.6)));
  const hx = lerp(a.x, b.x, k), hy = lerp(a.y, b.y, k) - 9 - Math.abs(Math.sin(t * 8)) * 2; if (A.icon) ctx.drawImage(A.icon, hx - 8, hy - 8, 16, 16);
  drawText(ctx, 'THE ROUTE HOME', W / 2, 13, '#fff', 8, 'center');
}
function fxLayer(ctx, fx, t) {
  if (fx === 'siren') { ctx.fillStyle = Math.floor(t * 3) % 2 ? 'rgba(255,0,0,.13)' : 'rgba(0,60,255,.13)'; ctx.fillRect(0, 0, W, H); }
  else if (fx === 'search') { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, 0, W, H); const g = ctx.createRadialGradient(160 + Math.sin(t) * 90, 100, 8, 160 + Math.sin(t) * 90, 100, 70); g.addColorStop(0, 'rgba(255,250,200,.30)'); g.addColorStop(1, 'rgba(255,250,200,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  else if (fx === 'leaves') { ctx.fillStyle = 'rgba(40,160,70,.5)'; for (let i = 0; i < 10; i++) ctx.fillRect(((i * 61 + t * 14) % (W + 20)) - 10, (i * 29 + t * 22) % H, 3, 2); }
}
const capLen = c => c.cap.join(' ').length;
const lines = (p, n) => { let left = n; return p.cap.map(l => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; return s; }); };

export function drawCutscene(ctx, cs) {
  const C = CUTSCENES[cs.idx], p = C.panels[cs.panel], t = cs.t, pk = Math.min(1, t / 6);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (p.map !== undefined) drawMap(ctx, p.map, t);
  else {
    const z = lerp(p.zoom[0], p.zoom[1], pk), px = lerp(p.pan[0], p.pan[1], pk), cy = 80;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 15, W, H - 45); ctx.clip();
    ctx.translate(W / 2 + px, cy); ctx.scale(z, z); ctx.translate(-W / 2, -cy);
    drawBG(ctx, p.bg, p.cam + t * 6, t);
    for (const a of p.actors) actor(ctx, a, ease(Math.min(1, t / 4)), t + 0.0);
    ctx.restore();
    fxLayer(ctx, p.fx, t);
    if (p.say && t > 0.8) { const w = p.say.txt.length * 6 + 8; ctx.fillStyle = '#fff'; ctx.fillRect(p.say.x - w / 2, p.say.y - 12, w, 14); ctx.fillStyle = '#000'; ctx.fillRect(p.say.x - w / 2, p.say.y - 12, w, 1); ctx.fillRect(p.say.x - w / 2, p.say.y + 1, w, 1); ctx.fillStyle = '#fff'; ctx.fillRect(p.say.x - 2, p.say.y + 2, 5, 4); drawText(ctx, p.say.txt, p.say.x, p.say.y - 1, '#111', 8, 'center', null); }
  }
  // comic frame + caption bar
  ctx.fillStyle = '#05040f'; ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 30, W, 30); ctx.fillStyle = '#ff9ad8'; ctx.fillRect(0, H - 31, W, 1); ctx.fillStyle = '#5a3a9a'; ctx.fillRect(0, 14, W, 1);
  drawText(ctx, C.title, 6, 10, '#ffe03a', 8, 'left'); drawText(ctx, (cs.panel + 1) + '/' + C.panels.length, W / 2 + 40, 10, '#99a', 6, 'center');
  drawText(ctx, 'SKIP \u25b6\u25b6', W - 6, 10, '#aab', 7, 'right');
  const n = typedChars(t, capLen(p));
  lines(p, n).forEach((l, i) => drawText(ctx, l, W / 2, H - 19 + i * 9, '#fff', 8, 'center'));
  if (n >= capLen(p) && Math.floor(t * 2.5) % 2) drawText(ctx, '\u25b6', W - 8, H - 4, '#ffe03a', 8, 'right');
}
export const csCapLen = (idx, panel) => capLen(CUTSCENES[idx].panels[panel]);
export function stepCutscene(cs, dt, input) {
  cs.t += dt;
  const n = csCapLen(cs.idx, cs.panel), np = CUTSCENES[cs.idx].panels.length;
  let a = null; if (input.take('skip') || input.take('special')) a = 'skip'; else if (input.take('start') || input.take('atk') || input.take('jump')) a = 'adv';
  input.take('heavy');
  if (a && cs.t > 0.15) Object.assign(cs, csAdvance(cs, a, np, n));
  return cs.done;
}
