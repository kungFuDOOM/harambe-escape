// Sprite drawing: frames come from pre-rendered, shaded & outlined 16-bit style sheets (tools/art).
import { A } from './assets.js';

const FRAME = (sheetName, anim, i) => { const m = A.meta[sheetName], a = m.anims[anim]; return a[Math.max(0, Math.min(a.length - 1, i | 0))]; };
function blitFrame(ctx, sheetName, anim, i, x, y, face, flash) {
  const m = A.meta[sheetName]; if (!m) return;
  const f = FRAME(sheetName, anim, i), sx = (f % m.cols) * m.cw, sy = Math.floor(f / m.cols) * m.ch;
  const img = flash ? A.flash[sheetName] : A.sheets[sheetName];
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, m.cw, m.ch, -m.ax, -m.ay, m.cw, m.ch); ctx.restore();
}
export function spr(ctx, name, x, y, flip = false) { // props atlas item, anchored bottom-centre
  const r = A.props[name]; if (!r) return; ctx.drawImage(A.propsImg, r[0], r[1], r[2], r[3], Math.round(x - r[2] / 2) , Math.round(y - r[3]), r[2], r[3]);
}
const white = {};
function sprWhite(ctx, name, x, y) {
  const r = A.props[name]; if (!r) return;
  if (!white[name]) { const c = document.createElement('canvas'); c.width = r[2]; c.height = r[3]; const g = c.getContext('2d'); g.drawImage(A.propsImg, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, r[2], r[3]); white[name] = c; }
  ctx.drawImage(white[name], Math.round(x - r[2] / 2), Math.round(y - r[3]));
}

export function shadow(ctx, x, y, w = 16) { spr(ctx, w >= 34 ? 'shadow_l' : w >= 20 ? 'shadow_m' : 'shadow_s', x, y + 4); }

/** Harambe: maps game state + timers to animation frames. */
export function drawHarambe(ctx, s) {
  const { x, y, z = 0, face, t = 0, state, at = 0, flash, vz = 0 } = s;
  let anim = 'idle', i = 0;
  switch (state) {
    case 'walk': anim = 'walk'; i = (t * 11) % 6; break;
    case 'atk': anim = 'atk' + Math.min(3, Math.max(1, s.combo || 1)); i = at < 0.3 ? 0 : at < 0.7 ? 1 : 2; break;
    case 'heavy': anim = 'heavy'; i = at < 0.3 ? 0 : at < 0.4 ? 1 : at < 0.68 ? 2 : 3; break;
    case 'jump': anim = 'jump'; i = vz > 70 ? 0 : vz > -40 ? 1 : 2; break;
    case 'jatk': anim = 'jatk'; i = at < 0.5 ? 0 : 1; break;
    case 'hurt': anim = 'hurt'; i = at < 0.4 ? 0 : 1; break;
    case 'down': case 'dead': anim = 'down'; i = z > 3 ? 0 : (s.lieT > 0.5 ? 2 : 1); break;
    case 'special': anim = 'special'; i = at < 0.25 ? 0 : at < 0.5 ? 1 : at < 0.7 ? 2 : at < 0.85 ? 1 : 3; break;
    default: anim = 'idle'; i = (t * 4) % 4;
  }
  blitFrame(ctx, 'harambe', anim, i, x, y - z, face, flash);
}

/** Humans & bosses: s.type selects the sheet. */
export function drawHuman(ctx, s) {
  const { x, y, z = 0, face, t = 0, state, at = 0, flash, type } = s;
  let anim = 'idle', i = 0;
  switch (state) {
    case 'walk': anim = 'walk'; i = (t * 10) % 6; break;
    case 'run': anim = 'run'; i = (t * 16) % 6; break;
    case 'windup': anim = 'windup'; i = 0; break;
    case 'atk': anim = 'atk'; i = at < 0.25 ? 0 : at < 0.6 ? 1 : 2; break;
    case 'hurt': anim = 'hurt'; i = at < 0.5 ? 0 : 1; break;
    case 'down': case 'dead': anim = 'down'; i = z > 3 ? 0 : (s.lieT > 0.45 ? 2 : 1); break;
    default: anim = 'idle'; i = (t * 3) % 2;
  }
  blitFrame(ctx, type, anim, i, x, y - z, face, flash);
}

export function drawKid(ctx, x, y, pose = 'kid_idle', face = 1) {
  const r = A.props[pose]; if (!r) return;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(A.propsImg, r[0], r[1], r[2], r[3], -22, -40, r[2], r[3]); ctx.restore();
}

export function drawProp(ctx, p) {
  const f = p.flash ? sprWhite : spr; f(ctx, p.kind === 'crate' ? 'crate' : 'barrel', p.x, p.y);
}

export function drawBanana(ctx, x, y, t, big) {
  const bob = Math.round(Math.sin(t * 6) * 2); shadow(ctx, x, y, 10);
  spr(ctx, big ? 'banana_big' : 'banana', x, y - 4 + bob);
}
export function drawNet(ctx, n) { spr(ctx, 'net', n.x, n.y - n.z + 10); }
export function drawSpark(ctx, x, y, k, big) { const n = Math.min(5, Math.floor(k * 6)); const r = A.props[(big ? 'bspark' : 'spark') + n]; if (r) ctx.drawImage(A.propsImg, r[0], r[1], r[2], r[3], Math.round(x - r[2] / 2), Math.round(y - r[3] / 2), r[2], r[3]); }
export function drawDust(ctx, x, y, k) { const n = Math.min(3, Math.floor(k * 4)); spr(ctx, 'dust' + n, x, y + 4); }

// ---- pixel font ----
const CH = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u007f\u2665\u25b6';
const cache = new Map();
function idxOf(c) { let i = CH.indexOf(c); if (i < 0) i = CH.indexOf(c.toUpperCase()); return i; }
function render(str, color, scale, outline) {
  const key = str + '|' + color + '|' + scale + '|' + outline; let c = cache.get(key); if (c) return c;
  const pad = outline ? scale : 0, w = str.length * 6 * scale + pad * 2 + 1, h = 8 * scale + pad * 2 + 1;
  const mk = col => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    for (let k = 0; k < str.length; k++) { const gi = idxOf(str[k]); if (gi < 0) continue; g.drawImage(A.font, (gi % 16) * 6, Math.floor(gi / 16) * 8, 6, 8, pad + k * 6 * scale, pad, 6 * scale, 8 * scale); }
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, w, h); return cv; };
  const out = document.createElement('canvas'); out.width = w; out.height = h; const g = out.getContext('2d');
  if (outline) { const o = mk(outline); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1], [0, 2]]) g.drawImage(o, dx * scale, dy * scale); }
  g.drawImage(mk(color), 0, 0); cache.set(key, out); return out;
}
export function textWidth(str, size = 8) { return str.length * 6 * (size <= 9 ? 1 : size <= 14 ? 2 : 3); }
export function drawText(ctx, str, x, y, color = '#fff', size = 8, align = 'left', outline = '#000') {
  const scale = size <= 9 ? 1 : size <= 14 ? 2 : 3; str = String(str);
  const c = render(str, color, scale, outline), w = str.length * 6 * scale, pad = outline ? scale : 0;
  let dx = x; if (align === 'center') dx = x - w / 2; else if (align === 'right') dx = x - w;
  ctx.drawImage(c, Math.round(dx) - pad, Math.round(y - 7 * scale) - pad);
}
/** Big logo text: cel-shaded 4-stop fill, thick dark outline and drop shadow. cols = [top, upperMid, lowerMid, bottom]. */
export function drawLogo(ctx, str, cx, y, scale, cols, edge = '#2a0a00') {
  const w = str.length * 6 * scale, h = 8 * scale, pad = 3, cv = document.createElement('canvas'); cv.width = w + pad * 2; cv.height = h + pad * 2 + 3; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const base = document.createElement('canvas'); base.width = w; base.height = h; const b = base.getContext('2d');
  for (let k = 0; k < str.length; k++) { const gi = idxOf(str[k]); if (gi >= 0) b.drawImage(A.font, (gi % 16) * 6, Math.floor(gi / 16) * 8, 6, 8, k * 6 * scale, 0, 6 * scale, 8 * scale); }
  b.globalCompositeOperation = 'source-atop';
  const rows = [[0, 0.16, cols[0]], [0.16, 0.5, cols[1]], [0.5, 0.84, cols[2]], [0.84, 1, cols[3]]];
  for (const [a0, a1, c] of rows) { b.fillStyle = c; b.fillRect(0, Math.round(a0 * h), w, Math.ceil((a1 - a0) * h)); }
  const tint = col => { const t = document.createElement('canvas'); t.width = w; t.height = h; const q = t.getContext('2d'); q.drawImage(base, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, w, h); return t; };
  const dark = tint(edge), black = tint('#000'); const r = Math.max(1, Math.round(scale * 0.6));
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r + 2; dy++) if (dx * dx + dy * dy <= r * r + 1 || dy > r) g.drawImage(dy > r ? black : dark, pad + dx, pad + dy);
  g.drawImage(base, pad, pad);
  ctx.drawImage(cv, Math.round(cx - cv.width / 2), Math.round(y));
}
