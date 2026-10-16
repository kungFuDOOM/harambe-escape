// Stage backgrounds: AI-generated 16:9 plates (960x540 device px = 320x180 logic) tiled with mirroring along the stage,
// with a slower sky strip and/or a faster foreground strip for slight parallax. The floor band of each plate matches that stage's lane.
import { W, H } from './logic.js';
import { A } from './assets.js';

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

export function drawBG(ctx, kind, cam, t) {
  const L = A.bg[kind], m = A.bgMeta[kind];
  if (L.sky) tile(ctx, L.sky, cam * S * m.sky.speed + t * 5, 0);
  tile(ctx, L.main, cam * S, 0);
  if (L.fg) tile(ctx, L.fg, cam * S * m.fg.speed, m.fg.y);
}
