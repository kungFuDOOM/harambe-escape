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
/** AI-painted plate for a landmark screen: drawn over the stage plate at its camera stop, soft-faded at both edges (baked alpha). */
function featured(ctx, L, kind, stops, cam) {
  if (!L.x) return;
  const scr = SCREENS[kind].screens;
  for (let i = 0; i < stops.length; i++) { const p = scr[i].plate; if (!p || !L.x[p]) continue; const x = stops[i] - cam; if (x > W || x + TILE_W < 0) continue; ctx.drawImage(L.x[p], Math.round(x * S) / S, 0, TILE_W, 180); }
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
