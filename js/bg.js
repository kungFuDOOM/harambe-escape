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
/** Haze strip that the neighbouring (old) plate fades into just outside an AI plate's edge: the plate's own per-row edge colour,
 * alpha ramping 0 -> HAZE_A towards the edge. The plate itself ramps out of the same colour (baked in), so a slide goes
 * old plate -> haze -> new plate with no two scenes overlapping (no ghosting). */
const HZ = 30, HAZE_A = 0.85, hazeCache = {};
function hazeStrip(kind, name, side, from = side) { // side = where the strip sits, from = which plate edge's colours it takes (differs when the plate is mirrored)
  const key = kind + name + side + from; if (hazeCache[key]) return hazeCache[key];
  const rows = A.bgMeta[kind].haze[name][from], n = rows.length, t = document.createElement('canvas'); t.width = 1; t.height = n;
  const tc = t.getContext('2d'), id = tc.createImageData(1, n); rows.forEach((c, i) => { id.data.set([c[0], c[1], c[2], 255], i * 4); }); tc.putImageData(id, 0, 0);
  const c = document.createElement('canvas'); c.width = HZ; c.height = 180; const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(t, 0, 0, 1, n, 0, 0, HZ, 180);
  const gr = g.createLinearGradient(0, 0, HZ, 0), e = side === 'l' ? 1 : 0; // alpha is highest at the plate edge
  for (let i = 0; i <= 8; i++) { const u = i / 8, s = u * u * (3 - 2 * u); gr.addColorStop(u, `rgba(0,0,0,${HAZE_A * (e ? s : 1 - s)})`); }
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, HZ, 180);
  return hazeCache[key] = c;
}
/** AI-painted plate for a landmark screen: drawn over the stage plate at its camera stop. Its edges ramp out of a haze colour
 * (baked), and the neighbouring plate is hazed over to the same colour right outside the edge. */
function featured(ctx, L, kind, stops, cam) {
  if (!L.x) return;
  const scr = SCREENS[kind].screens;
  for (let i = 0; i < stops.length; i++) {
    const p = scr[i].plate; if (!p || !L.x[p]) continue; const x = stops[i] - cam; if (x > W + HZ || x + TILE_W + HZ < 0) continue;
    const xr = Math.round(x * S) / S;
    const fl = !!scr[i].flip; // mirrored reuse of a plate: its left edge is the plate's right edge
    ctx.drawImage(hazeStrip(kind, p, 'l', fl ? 'r' : 'l'), xr - HZ, 0); ctx.drawImage(hazeStrip(kind, p, 'r', fl ? 'l' : 'r'), xr + TILE_W, 0);
    if (fl) { ctx.save(); ctx.translate(xr + TILE_W, 0); ctx.scale(-1, 1); ctx.drawImage(L.x[p], 0, 0, TILE_W, 180); ctx.restore(); }
    else ctx.drawImage(L.x[p], xr, 0, TILE_W, 180);
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
