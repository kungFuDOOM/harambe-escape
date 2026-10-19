// Drawing for stage hazards, telegraph markers, loot and the elite ring. Cars are painted sprites; the rest is still code-drawn from rects/ellipses.
import { drawProp, drawBanana, drawHeart, drawText, shadow } from './sprites.js';
import { W } from './logic.js';
import { A } from './assets.js';

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const pulse = t => 0.55 + 0.45 * Math.abs(Math.sin(t * 9));

/** Flat markers that sit on the floor under everything else: where a drop lands, which row a vehicle will sweep. */
export function drawHazMarkers(c, haz, cam, t, lane) {
  for (const h of haz) {
    if (h.k === 'drop' && h.t < 0.95) { const x = h.x - cam, k = h.t / 0.95;
      c.fillStyle = `rgba(255,50,40,${0.25 + 0.4 * pulse(t) * k})`; c.beginPath(); c.ellipse(x, h.y, 10 + 8 * k, 3 + 3 * k, 0, 0, 7); c.fill();
      c.strokeStyle = `rgba(255,220,200,${0.5 * pulse(t)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(x, h.y, 10 + 8 * k, 3 + 3 * k, 0, 0, 7); c.stroke(); }
    else if ((h.k === 'car' || h.k === 'roll') && h.t < (h.k === 'car' ? 1.1 : 0.9)) { // lane warning: faint red strip + flashing arrows on the side it enters from
      c.fillStyle = `rgba(255,40,40,${0.10 + 0.10 * pulse(t)})`; c.fillRect(0, h.y - 9, W, 18);
      const ex = h.dir > 0 ? 14 : W - 14; if (Math.floor(t * 8) % 2) { drawText(c, h.dir > 0 ? '\u25b6\u25b6' : '\u25b6\u25b6', ex, h.y + 3, '#ff5040', 8, 'center'); } }
    else if (h.k === 'spot') { const x = h.x - cam, hot = h.flash > 0;
      const g = c.createRadialGradient(x, h.y, 2, x, h.y, 26); g.addColorStop(0, hot ? 'rgba(255,90,70,.75)' : 'rgba(255,250,200,.7)'); g.addColorStop(1, 'rgba(255,250,200,0)');
      c.fillStyle = g; c.save(); c.translate(x, h.y); c.scale(1, 0.4); c.translate(-x, -h.y); c.beginPath(); c.arc(x, h.y, 26, 0, 7); c.fill(); c.restore();
      c.fillStyle = hot ? 'rgba(255,80,60,.2)' : 'rgba(255,250,210,.18)'; c.beginPath(); c.moveTo(x - 3, 0); c.lineTo(x + 3, 0); c.lineTo(x + 24, h.y); c.lineTo(x - 24, h.y); c.fill(); }
  }
}
const CARS = ['car_a', 'car_b', 'car_c']; // painted 3x sprites (assets/props/cars.webp, tools/ai-art/build_cars.py), drawn facing +x and mirrored
function car(c, x, y, dir, v) {
  const s = A.sp[CARS[v % CARS.length] || CARS[0]] || A.sp.car_a; if (!s) return; const [sx, sy, w, h] = s.r;
  c.save(); c.translate(Math.round(x), Math.round(y) + 1); c.scale(dir, 1); c.drawImage(s.im, sx, sy, w, h, -w / 6, -h / 3, w / 3, h / 3); c.restore();
}
function boulder(c, x, y, t) { c.save(); c.translate(Math.round(x), Math.round(y) - 13); c.rotate(t * 3.2);
  c.fillStyle = '#10100e'; c.beginPath(); c.arc(0, 0, 14, 0, 7); c.fill(); c.fillStyle = '#7a705e'; c.beginPath(); c.arc(0, 0, 12.5, 0, 7); c.fill();
  c.fillStyle = '#9a8f78'; c.beginPath(); c.arc(-3, -4, 6, 0, 7); c.fill(); c.strokeStyle = '#3a342a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-8, 3); c.lineTo(-1, 0); c.lineTo(4, 6); c.moveTo(2, -9); c.lineTo(5, -2); c.stroke(); c.restore(); }
function cabinet(c, x, y) { R(c, x - 9, y - 26, 18, 26, '#0c0c14'); R(c, x - 8, y - 25, 16, 24, '#8a929e'); R(c, x - 8, y - 25, 16, 2, '#c4ccd6'); for (let i = 0; i < 3; i++) { R(c, x - 7, y - 23 + i * 8, 14, 6, '#6a727e'); R(c, x - 3, y - 21 + i * 8, 6, 2, '#d8d8c0'); } }
function coconut(c, x, y) { c.fillStyle = '#0c0c08'; c.beginPath(); c.arc(Math.round(x), Math.round(y) - 7, 8, 0, 7); c.fill(); c.fillStyle = '#6a4220'; c.beginPath(); c.arc(Math.round(x), Math.round(y) - 7, 6.6, 0, 7); c.fill(); c.fillStyle = '#9a6a3a'; c.beginPath(); c.arc(Math.round(x) - 2, Math.round(y) - 9, 2.4, 0, 7); c.fill(); R(c, x - 1, y - 6, 1, 1, '#1a1008'); R(c, x + 2, y - 6, 1, 1, '#1a1008'); }

/** Sorted-with-actors objects (anything with height). Returns {y, f} entries for the world's depth-sort list. */
export function hazardEntries(c, haz, cam, t) {
  const out = [];
  for (const h of haz) {
    if (h.k === 'drop') { if (h.t < 0.95) continue; out.push({ y: h.y, f: () => { const x = h.x - cam, z = h.z || 0; shadow(c, x, h.y, 18);
      if (h.obj === 'cabinet') cabinet(c, x, h.y - z); else if (h.obj === 'coconut') coconut(c, x, h.y - z); else drawProp(c, { kind: 'crate', x, y: h.y - z }); } }); }
    else if (h.k === 'car' && h.t > 1.1) out.push({ y: h.y, f: () => { shadow(c, h.x - cam, h.y, 60); car(c, h.x - cam, h.y, h.dir, h.v | 0); } });
    else if (h.k === 'roll' && h.t > 0.9) out.push({ y: h.y, f: () => { shadow(c, h.x - cam, h.y, 30); boulder(c, h.x - cam, h.y, h.t); } });
  }
  return out;
}
export function drawLobMarkers(c, proj, cam, t, landX) {
  for (const n of proj) if (n.lob) { const x = landX(n) - cam; c.fillStyle = `rgba(255,60,40,${0.25 + 0.35 * pulse(t)})`; c.beginPath(); c.ellipse(x, n.y, (n.blast || 16) * 0.8, 4, 0, 0, 7); c.fill(); c.strokeStyle = `rgba(255,230,210,${0.6 * pulse(t)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(x, n.y, (n.blast || 16) * 0.8, 4, 0, 0, 7); c.stroke(); }
}
export function drawItem(c, it, x, t) {
  const bob = Math.round(Math.sin(t * 6) * 2), k = it.kind || 'banana';
  if (k === 'banana') { drawBanana(c, x, it.y, t, it.heal > 25); return; }
  shadow(c, x, it.y, 12);
  if (k === 'life') { drawHeart(c, x, it.y - 6 + bob, 1.2); drawText(c, '1UP', x, it.y - 20 + bob, '#ffffff', 6, 'center'); return; }
  if (k === 'gem') { const y = it.y - 9 + bob; c.fillStyle = '#4a3200'; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 6, y); c.lineTo(x, y + 7); c.lineTo(x - 6, y); c.fill(); c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 5, y); c.lineTo(x, y + 6); c.lineTo(x - 5, y); c.fill(); c.fillStyle = '#fff6b0'; c.fillRect(x - 2, y - 4, 2, 4); return; }
  if (k === 'rage') { const y = it.y - 10 + bob, s = 1 + 0.15 * Math.sin(t * 10); c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#300'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9; c.lineTo(Math.cos(i * Math.PI / 5 - 1.57) * r, Math.sin(i * Math.PI / 5 - 1.57) * r); } c.fill(); c.fillStyle = '#ff4a2a'; c.scale(.82, .82); c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9; c.lineTo(Math.cos(i * Math.PI / 5 - 1.57) * r, Math.sin(i * Math.PI / 5 - 1.57) * r); } c.fill(); c.restore(); }
}
/** Ring + tag under elites and mini-bosses so the tougher fighter reads at a glance. */
export function drawEliteRing(c, e, x, t) {
  const a = 0.45 + 0.35 * Math.sin(t * 6); c.strokeStyle = e.tag === 'ELITE' ? `rgba(255,208,58,${a})` : `rgba(255,90,60,${a})`; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(x, e.y, 24, 7, 0, 0, 7); c.stroke();
}
