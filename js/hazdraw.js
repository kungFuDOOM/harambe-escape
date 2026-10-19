// Drawing for stage hazards, telegraph markers, loot and the elite ring. Hazards and pickups are painted sprites; only the warning markers, cone and ring are code.
import { drawProp, drawBanana, drawText, shadow } from './sprites.js';
import { W } from './logic.js';
import { A } from './assets.js';
import { CAR_DEPTH } from './hazlogic.js';

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const pulse = t => 0.55 + 0.45 * Math.abs(Math.sin(t * 9));

/** Flat markers that sit on the floor under everything else: where a drop lands, which row a vehicle will sweep. */
export function drawHazMarkers(c, haz, cam, t, lane) {
  for (const h of haz) {
    if (h.k === 'drop' && h.t < 0.95) { const x = h.x - cam, k = h.t / 0.95;
      c.fillStyle = `rgba(255,50,40,${0.25 + 0.4 * pulse(t) * k})`; c.beginPath(); c.ellipse(x, h.y, 10 + 8 * k, 3 + 3 * k, 0, 0, 7); c.fill();
      c.strokeStyle = `rgba(255,220,200,${0.5 * pulse(t)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(x, h.y, 10 + 8 * k, 3 + 3 * k, 0, 0, 7); c.stroke(); }
    else if ((h.k === 'car' || h.k === 'roll') && h.t < (h.k === 'car' ? 1.1 : 0.9)) { // lane warning: faint red strip + flashing arrows on the side it enters from
      c.fillStyle = `rgba(255,40,40,${0.10 + 0.10 * pulse(t)})`; const d = h.k === 'car' ? CAR_DEPTH : 9; c.fillRect(0, h.y - d, W, d * 2);
      const ex = h.dir > 0 ? 14 : W - 14; if (Math.floor(t * 8) % 2) { drawText(c, h.dir > 0 ? '\u25b6\u25b6' : '\u25b6\u25b6', ex, h.y + 3, '#ff5040', 8, 'center'); } }
    else if (h.k === 'spot') { const x = h.x - cam, hot = h.flash > 0;
      const g = c.createRadialGradient(x, h.y, 2, x, h.y, 26); g.addColorStop(0, hot ? 'rgba(255,90,70,.75)' : 'rgba(255,250,200,.7)'); g.addColorStop(1, 'rgba(255,250,200,0)');
      c.fillStyle = g; c.save(); c.translate(x, h.y); c.scale(1, 0.4); c.translate(-x, -h.y); c.beginPath(); c.arc(x, h.y, 26, 0, 7); c.fill(); c.restore();
      const lx = (h.ax ?? h.x) - cam, ly = (h.ay == null ? h.y - 30 : h.ay) - lampTop; // soft cone from the painted lamp head to the spot
      c.fillStyle = hot ? 'rgba(255,80,60,.2)' : 'rgba(255,250,210,.18)'; const dx = x - lx, dy = h.y - ly, n = Math.hypot(dx, dy) || 1, px = -dy / n, py = dx / n; // widen along the beam's normal
      c.beginPath(); c.moveTo(lx + px * 3, ly + py * 3); c.lineTo(lx - px * 3, ly - py * 3); c.lineTo(x - px * 22, h.y - py * 9); c.lineTo(x + px * 22, h.y + py * 9); c.fill(); }
  }
}
const CARS = ['car_a', 'car_b', 'car_c']; // painted 3x sprites (assets/props/cars.webp, tools/ai-art/build_cars.py), drawn facing +x and mirrored
function car(c, x, y, dir, v) {
  const s = A.sp[CARS[v % CARS.length] || CARS[0]] || A.sp.car_a; if (!s) return; const [sx, sy, w, h] = s.r;
  c.save(); c.translate(Math.round(x), Math.round(y) + 1); c.scale(dir, 1); c.drawImage(s.im, sx, sy, w, h, -w / 6, -h / 3, w / 3, h / 3); c.restore();
}
// painted hazard / pickup sprites (assets/props/haz.webp, tools/ai-art/build_hazards.py), 3x art drawn at 1/3, anchored bottom-centre
function hs(c, name, x, y, rot = 0) { const s = A.sp[name]; if (!s) return; const [sx, sy, w, h] = s.r, dw = w / 3, dh = h / 3;
  if (!rot) { c.drawImage(s.im, sx, sy, w, h, Math.round(x - dw / 2), Math.round(y - dh), dw, dh); return; }
  c.save(); c.translate(Math.round(x), Math.round(y - dh / 2)); c.rotate(rot); c.drawImage(s.im, sx, sy, w, h, -dw / 2, -dh / 2, dw, dh); c.restore(); }
const boulder = (c, x, y, t, dir) => hs(c, 'boulder', x, y + 1, t * 3.2 * (dir || 1) / 1.2); // rolls: spin matches travel direction
const cabinet = (c, x, y) => hs(c, 'cabinet', x, y + 1), coconut = (c, x, y) => hs(c, 'coconut', x, y + 1);
const lampTop = 36; // beam leaves the lamp head this far above the tripod feet

/** Sorted-with-actors objects (anything with height). Returns {y, f} entries for the world's depth-sort list. */
export function hazardEntries(c, haz, cam, t) {
  const out = [];
  for (const h of haz) {
    if (h.k === 'drop') { if (h.t < 0.95) continue; out.push({ y: h.y, f: () => { const x = h.x - cam, z = h.z || 0; shadow(c, x, h.y, h.obj === 'cabinet' ? 28 : h.obj === 'coconut' ? 16 : 18);
      if (h.obj === 'cabinet') cabinet(c, x, h.y - z); else if (h.obj === 'coconut') coconut(c, x, h.y - z); else drawProp(c, { kind: 'crate', x, y: h.y - z }); } }); }
    else if (h.k === 'car' && h.t > 1.1) out.push({ y: h.y, f: () => { shadow(c, h.x - cam, h.y, 120); car(c, h.x - cam, h.y, h.dir, h.v | 0); } });
    else if (h.k === 'spot') { const ay = h.ay == null ? h.y - 30 : h.ay; out.push({ y: ay, f: () => { shadow(c, (h.ax ?? h.x) - cam, ay, 22); hs(c, 'searchlight', (h.ax ?? h.x) - cam, ay + 1); } }); }
    else if (h.k === 'roll' && h.t > 0.9) out.push({ y: h.y, f: () => { shadow(c, h.x - cam, h.y, 34); boulder(c, h.x - cam, h.y, h.t, h.dir); } });
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
  if (k === 'life') { hs(c, 'oneup', x, it.y - 1 + bob); return; } // painted gorilla badge with a plus (no text)
  if (k === 'gem') { hs(c, 'gem', x, it.y - 2 + bob); return; }
  if (k === 'rage') { const s = 1 + 0.08 * Math.sin(t * 10), sp = A.sp.rage; if (!sp) return; const [sx, sy, w, h] = sp.r, dw = w / 3 * s, dh = h / 3 * s;
    c.drawImage(sp.im, sx, sy, w, h, Math.round(x - dw / 2), Math.round(it.y - 2 + bob - dh), dw, dh); }
}
/** Ring + tag under elites and mini-bosses so the tougher fighter reads at a glance. */
export function drawEliteRing(c, e, x, t) {
  const a = 0.45 + 0.35 * Math.sin(t * 6); c.strokeStyle = e.tag === 'ELITE' ? `rgba(255,208,58,${a})` : `rgba(255,90,60,${a})`; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(x, e.y, 24, 7, 0, 0, 7); c.stroke();
}
