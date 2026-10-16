// Stage backgrounds: AI-generated 16:9 plates (960x540 device px = 320x180 logic) tiled with mirroring along the stage,
// with a slower sky strip and/or a faster foreground strip for slight parallax. The floor band of each plate matches that stage's lane.
import { W, H } from './logic.js';
import { A } from './assets.js';
import { STAGES } from './levels.js';
import { TILE_W, TILE_TYPES, stopsOf, tileAt, lookAt, SCREENS } from './bgscreens.js';
import { drawLandmarks, drawGrade } from './bgdraw.js';

const S = 3; // device pixels per logic pixel
/** Draw a strip tiled across the screen; alternate tiles are mirrored so the seams are continuous. off in device px. */
function tile(ctx, im, off, y) {
  const w = im.width; off = Math.round(off); const k0 = Math.floor(off / w), x0 = -(((off % w) + w) % w);
  for (let i = 0, x = x0; x < W * S; x += w, i++) {
    const flip = ((k0 + i) % 2 + 2) % 2 === 1;
    if (flip) { ctx.save(); ctx.translate((x + w) / S, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, y / S, w / S, im.height / S); ctx.restore(); }
    else ctx.drawImage(im, x / S, y / S, w / S, im.height / S);
  }
}
export function laneOf(kind) { const l = A.bgMeta[kind].lane; return { top: l[0], bot: l[1] }; }

/** Stage plate: each 320px tile is two plate halves (left/right, mirrored or not) in the stage's TILE sequence, so the scenery
 * changes every screen while every tile joins its neighbour on a shared edge (no seams). */
function plate(ctx, im, kind, cam) {
  const hw = im.width / 2, k0 = Math.floor(cam / TILE_W);
  for (let k = k0; k <= k0 + 1; k++) {
    const tt = tileAt(kind, k), x0 = k * TILE_W - cam;
    tt.halves.forEach((h, n) => {
      const right = h[0] === 'B', flip = h.length > 1, dx = x0 + n * (TILE_W / 2), sx = right ? hw : 0;
      if (flip) { ctx.save(); ctx.translate(dx + TILE_W / 2, 0); ctx.scale(-1, 1); ctx.drawImage(im, sx, 0, hw, im.height, 0, 0, TILE_W / 2, 180); ctx.restore(); }
      else ctx.drawImage(im, sx, 0, hw, im.height, dx, 0, TILE_W / 2, 180);
    });
  }
}
/** Screen-to-screen transition: a same-resolution crossfade of the two neighbouring plates' real pixels (no blur, no fog colour).
 * Each plate is extended past its edge by mirroring its own outermost columns (so the join is continuous), then plate B fades in over
 * plate A across TZ logic px centred on the boundary. Floors share one lane height so the floor stays continuous. Built once per boundary. */
const stripCache = {};
const tz = () => Math.max(8, Math.min(300, Math.round(globalThis.__TZ ?? 140)));
function oriented(im, fl) { // plate as it appears on screen (flip:1 reuses are mirrored)
  if (!fl) return im; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
  g.translate(im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, 0); return c;
}
function xfade(imA, imB, pwA, pwB, Z) {
  const h = Z / 2, hd = h * S, c = document.createElement('canvas'); c.width = Z * S; c.height = imA.height; const g = c.getContext('2d');
  const wa = Math.min(imA.width / 2, Math.round(h * imA.width / pwA)), wb = Math.min(imB.width / 2, Math.round(h * imB.width / pwB));
  g.drawImage(imA, imA.width - wa, 0, wa, imA.height, 0, 0, hd, c.height); // A real tail
  g.save(); g.translate(hd * 2, 0); g.scale(-1, 1); g.drawImage(imA, imA.width - wa, 0, wa, imA.height, 0, 0, hd, c.height); g.restore(); // A mirrored beyond the edge
  const b = document.createElement('canvas'); b.width = c.width; b.height = c.height; const q = b.getContext('2d');
  q.save(); q.translate(hd, 0); q.scale(-1, 1); q.drawImage(imB, 0, 0, wb, imB.height, 0, 0, hd, c.height); q.restore(); // B mirrored before its edge
  q.drawImage(imB, 0, 0, wb, imB.height, hd, 0, hd, c.height); // B real head
  const gr = q.createLinearGradient(0, 0, c.width, 0);
  for (let i = 0; i <= 10; i++) { const u = i / 10; gr.addColorStop(u, `rgba(0,0,0,${u * u * (3 - 2 * u)})`); }
  q.globalCompositeOperation = 'destination-in'; q.fillStyle = gr; q.fillRect(0, 0, c.width, c.height);
  g.drawImage(b, 0, 0); return c;
}
/** AI-painted plate for every screen, drawn at its camera stop (stretched <=3% to meet the next stop), with a crossfade strip on each boundary. */
function featured(ctx, L, kind, stops, cam) {
  if (!L.x) return;
  const scr = SCREENS[kind].screens, Z = tz(), pw = i => { const g = i < stops.length - 1 ? stops[i + 1] - stops[i] : TILE_W; return g >= TILE_W && g <= TILE_W + 16 ? g : TILE_W; };
  for (let i = 0; i < stops.length; i++) {
    const p = scr[i].plate; if (!p || !L.x[p]) continue; const x = stops[i] - cam; if (x > W || x + TILE_W + 16 < 0) continue;
    const xr = Math.round(x * S) / S, w = pw(i), fl = !!scr[i].flip;
    if (fl) { ctx.save(); ctx.translate(xr + w, 0); ctx.scale(-1, 1); ctx.drawImage(L.x[p], 0, 0, w, 180); ctx.restore(); }
    else ctx.drawImage(L.x[p], xr, 0, w, 180);
  }
  if (Z <= 8) return;
  for (let i = 0; i + 1 < stops.length; i++) {
    const p = scr[i].plate, q = scr[i + 1].plate; if (!p || !q || !L.x[p] || !L.x[q]) continue;
    const bx = stops[i] + pw(i) - cam; if (bx + Z / 2 < 0 || bx - Z / 2 > W) continue;
    const k = `${kind}|${i}|${Z}|${pw(i)}|${pw(i + 1)}|${p}|${q}`;
    const st = stripCache[k] || (stripCache[k] = xfade(oriented(L.x[p], !!scr[i].flip), oriented(L.x[q], !!scr[i + 1].flip), pw(i), pw(i + 1), Z));
    ctx.drawImage(st, Math.round((bx - Z / 2) * S) / S, 0, Z, 180);
  }
}
const stopsCache = new WeakMap();
const stopsFor = st => stopsCache.get(st) || (stopsCache.set(st, stopsOf(st)), stopsCache.get(st));

/** stage (index) enables the per-screen variety; without it (title, cutscenes) the plain mirrored tiling is used. */
export function drawBG(ctx, kind, cam, t, stage) {
  const L = A.bg[kind], m = A.bgMeta[kind], st = stage !== undefined ? STAGES[stage] : null;
  if (L.sky) tile(ctx, L.sky, cam * S * m.sky.speed + t * 5, 0);
  if (!st || !SCREENS[kind]) { tile(ctx, L.main, cam * S, 0); if (L.fg) tile(ctx, L.fg, cam * S * m.fg.speed, m.fg.y); return; }
  const stops = stopsFor(st), look = lookAt(kind, stops, cam);
  plate(ctx, L.main, kind, cam);
  featured(ctx, L, kind, stops, cam);
  drawLandmarks(ctx, kind, stops, cam);
  if (L.fg) tile(ctx, L.fg, cam * S * m.fg.speed, m.fg.y);
  drawGrade(ctx, kind, stops, cam, t, look);
}
