// Sprite drawing: frames come from pre-rendered, shaded & outlined 16-bit style sheets (tools/art).
import { A } from './assets.js';

const S = 3; // device px per logic px: atlas frames are baked at 3x
const q3 = v => Math.round(v * S) / S; // snap to device pixels so sprites never shimmer
/** Draw one atlas frame anchored at its feet (ax, ay). `face` < 0 mirrors it. */
function blitFrame(ctx, sheetName, anim, i, x, y, face, flash) {
  const m = A.atlas[sheetName]; if (!m) return;
  const a = m.anims[anim] || m.anims.idle, f = m.frames[a[Math.max(0, Math.min(a.length - 1, i | 0))]];
  const img = flash ? A.flash[sheetName] : A.sheets[sheetName];
  ctx.save(); ctx.translate(q3(x), q3(y)); if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, f.x, f.y, f.w, f.h, -f.ax / S, -f.ay / S, f.w / S, f.h / S); ctx.restore();
}
/** AI-generated prop (props_ai atlas, baked at 3x), anchored bottom-centre. `s` = extra scale, `face` < 0 mirrors. */
function aiProp(ctx, name, x, y, s = 1, face = 1, white = false) {
  const r = A.propsAi && A.propsAi[name]; if (!r) return false;
  const src = white ? aiWhite(name) : A.propsAiImg, sx = white ? 0 : r[0], sy = white ? 0 : r[1];
  ctx.save(); ctx.translate(q3(x), q3(y)); if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(src, sx, sy, r[2], r[3], -r[4] / S * s, -r[5] / S * s, r[2] / S * s, r[3] / S * s); ctx.restore(); return true;
}
const aiw = {};
function aiWhite(name) {
  if (aiw[name]) return aiw[name]; const r = A.propsAi[name], c = document.createElement('canvas'); c.width = r[2]; c.height = r[3]; const g = c.getContext('2d');
  g.drawImage(A.propsAiImg, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, r[2], r[3]); return aiw[name] = c;
}
export function spr(ctx, name, x, y, flip = false) { // props atlas item, anchored bottom-centre
  if (name === 'haystack' && aiProp(ctx, 'haybale', x, y)) return;
  const r = A.props[name]; if (!r) return; ctx.drawImage(A.propsImg, r[0], r[1], r[2], r[3], Math.round(x - r[2] / 2) , Math.round(y - r[3]), r[2], r[3]);
}
const white = {};
function sprWhite(ctx, name, x, y) {
  const r = A.props[name]; if (!r) return;
  if (!white[name]) { const c = document.createElement('canvas'); c.width = r[2]; c.height = r[3]; const g = c.getContext('2d'); g.drawImage(A.propsImg, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, r[2], r[3]); white[name] = c; }
  ctx.drawImage(white[name], Math.round(x - r[2] / 2), Math.round(y - r[3]));
}

export function shadow(ctx, x, y, w = 16) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y) + 1, w / 2, Math.max(2, w / 9), 0, 0, 7); ctx.fill(); }

export const WALK_PX = 20 / 6; // ground distance (logic px) per walk frame: the stance foot slides back 60 device px (20 logic px) over 6 frames (tools/ai-art/build_walk.py)
/** Harambe: maps game state + timers to animation frames. */
export function drawHarambe(ctx, s) {
  const { x, y, z = 0, face, t = 0, state, at = 0, flash, vz = 0 } = s;
  let anim = 'idle', i = 0, bob = 0;
  switch (state) {
    case 'walk': { // 12-frame two-step cycle (frames 0 and 6 are the contact poses); phase is driven by ground distance so the planted foot never slides
      anim = 'walk'; i = ((s.wd != null ? s.wd / WALK_PX : t * 82 / WALK_PX) % 12 + 12) % 12; break; }
    case 'atk': anim = 'atk' + Math.min(3, Math.max(1, s.combo || 1)); i = at < 0.3 ? 0 : at < 0.75 ? 1 : 2; break;
    case 'heavy': anim = 'heavy'; i = at < 0.3 ? 0 : at < 0.4 ? 1 : at < 0.68 ? 2 : 3; break;
    case 'jump': anim = 'jump'; i = vz > 70 ? 0 : vz > -40 ? 1 : 2; break;
    case 'jatk': anim = 'jatk'; i = 0; break;
    case 'hurt': anim = 'hurt'; i = 0; break;
    case 'down': case 'dead': anim = 'down'; i = z > 3 ? 0 : (s.lieT > 0.5 ? 2 : 1); break;
    case 'special': anim = 'special'; i = at < 0.25 ? 0 : at < 0.5 ? 1 : at < 0.7 ? 2 : at < 0.85 ? 1 : 3; break;
    default: anim = 'idle'; i = (t * 3) % 4;
  }
  blitFrame(ctx, 'harambe', anim, i, x, y - z + bob, face, flash);
}

/** Humans & bosses: s.type is the atlas character (e.g. 'cop_baton'). */
export function drawHuman(ctx, s) {
  const { x, y, z = 0, face, t = 0, state, at = 0, flash, type } = s;
  const m = A.atlas[type]; if (!m) return;
  let anim = 'idle', i = 0;
  switch (state) {
    case 'walk': anim = 'walk'; i = (t * 7) % m.anims.walk.length; break;
    case 'run': anim = 'walk'; i = (t * 13) % m.anims.walk.length; break;
    case 'windup': anim = 'windup'; i = (t * 8) % m.anims.windup.length; break;
    case 'atk': anim = 'atk'; i = Math.min(m.anims.atk.length - 1, Math.floor(at * m.anims.atk.length)); break;
    case 'hurt': anim = 'hurt'; i = 0; break;
    case 'down': case 'dead': anim = 'down'; i = z > 3 ? 0 : (s.lieT > 0.45 ? 2 : 1); break;
    default: anim = 'idle'; i = 0;
  }
  const bob = (state === 'walk' || state === 'run') && m.anims.walk.length < 2 ? Math.abs(Math.sin(t * 9)) * 1.6 : 0; // single-frame walkers get a stomp bob
  blitFrame(ctx, type, anim, i, x, y - z - bob, face, flash);
}

/** The kid (AI art). pose: kid_idle / kid_walk0 / kid_walk1 (idle with a hop) / kid_fly (tumbling) / kid_flop, kid_cheer (landed in the hay nest). Anchored at the feet. */
export function drawKid(ctx, x, y, pose = 'kid_idle', face = 1) {
  const name = pose === 'kid_fly' ? 'kid_fly' : pose === 'kid_flop' || pose === 'kid_cheer' ? 'kid_hay' : 'kid_idle';
  const hop = pose === 'kid_walk0' ? -1 : pose === 'kid_walk1' ? 1 : 0;
  if (!aiProp(ctx, name, x, y + hop, 1, face)) { const r = A.props[pose]; if (r) ctx.drawImage(A.propsImg, r[0], r[1], r[2], r[3], Math.round(x - r[2] / 2), Math.round(y - r[3]), r[2], r[3]); }
}
export function drawRubble(ctx, r) { // broken crate/barrel left behind for a moment, blinking out
  if (r.t > 1.1 && Math.floor(r.t * 16) % 2) return; aiProp(ctx, r.kind === 'crate' ? 'crate_broken' : 'barrel_broken', r.x, r.y);
}
export function drawHeart(ctx, x, y, s = 1) { aiProp(ctx, 'heart', x, y, s); }

export function drawProp(ctx, p) {
  const n = p.kind === 'crate' ? 'crate' : 'barrel';
  if (aiProp(ctx, n, p.x, p.y, 1, 1, !!p.flash)) return;
  const f = p.flash ? sprWhite : spr; f(ctx, n, p.x, p.y);
}

export function drawBanana(ctx, x, y, t, big) {
  const bob = Math.round(Math.sin(t * 6) * 2); shadow(ctx, x, y, big ? 14 : 11);
  if (!aiProp(ctx, big ? 'banana_big' : 'banana', x, y - 3 + bob)) spr(ctx, big ? 'banana_big' : 'banana', x, y - 4 + bob);
}
/** Comic projectiles: nets, tranquilizer darts, stun bolts, cannon shells. */
export function drawProj(ctx, n, t = 0) {
  const x = Math.round(n.x), y = Math.round(n.y - n.z), d = Math.sign(n.vx) || 1;
  switch (n.kind) {
    case 'dart': ctx.fillStyle = '#e8f0f0'; ctx.fillRect(x - 5 * d - (d < 0 ? 0 : 0), y, 10, 1); ctx.fillStyle = '#4ae06a'; ctx.fillRect(x + 3 * d - (d < 0 ? 2 : 0), y - 1, 3, 3); ctx.fillStyle = '#ff4a4a'; ctx.fillRect(x - 7 * d - (d < 0 ? 3 : 0), y - 1, 3, 3); break;
    case 'bolt': { ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 9 * d, y); for (let k = 1; k <= 6; k++) ctx.lineTo(x - 9 * d + k * 3 * d, y + (k % 2 ? -3 : 3) * (1 + Math.sin(t * 40 + k) * 0.3)); ctx.stroke(); ctx.strokeStyle = '#3aa8ff'; ctx.beginPath(); ctx.moveTo(x - 9 * d, y + 1); ctx.lineTo(x + 9 * d, y + 1); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(x + 8 * d - 1, y - 1, 3, 3); break; }
    case 'shell': { ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#ffb02a'; ctx.beginPath(); ctx.arc(x - 6 * d, y, 3 + Math.sin(t * 50), 0, 7); ctx.fill(); ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.arc(x - 6 * d, y, 1.5, 0, 7); ctx.fill(); ctx.fillStyle = '#7a7a88'; ctx.fillRect(x - 2, y - 3, 3, 2); break; }
    case 'bucket': { ctx.fillStyle = '#10121a'; ctx.fillRect(x - 6, y - 5, 12, 11); ctx.fillStyle = '#4a8ad8'; ctx.fillRect(x - 5, y - 4, 10, 9); ctx.fillStyle = '#9ad0ff'; ctx.fillRect(x - 5, y - 4, 10, 2); ctx.fillStyle = '#2a4a88'; ctx.fillRect(x - 5, y + 3, 10, 2); break; }
    case 'brick': { ctx.fillStyle = '#10121a'; ctx.fillRect(x - 6, y - 4, 12, 9); ctx.fillStyle = '#b8503a'; ctx.fillRect(x - 5, y - 3, 10, 7); ctx.fillStyle = '#e08a6a'; ctx.fillRect(x - 5, y - 3, 10, 1); ctx.fillStyle = '#7a2a1a'; ctx.fillRect(x - 5, y, 10, 1); ctx.fillRect(x, y - 3, 1, 3); break; }
    case 'files': { for (let k = 0; k < 4; k++) { const a = t * 14 + k * 1.6; ctx.fillStyle = k % 2 ? '#f4f4ec' : '#e0d8b0'; ctx.fillRect(Math.round(x + Math.cos(a) * 6) - 3, Math.round(y + Math.sin(a) * 4) - 2, 7, 5); } ctx.fillStyle = '#10121a'; ctx.fillRect(x - 4, y - 1, 9, 1); break; }
    case 'nade': { ctx.fillStyle = '#10121a'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#4a6a2a'; ctx.beginPath(); ctx.arc(x, y, 4.8, 0, 7); ctx.fill(); ctx.fillStyle = '#8aaa5a'; ctx.fillRect(x - 3, y - 3, 2, 2); ctx.fillStyle = '#c8c8d0'; ctx.fillRect(x - 1, y - 8, 3, 3); if (Math.floor(t * 14) % 2) { ctx.fillStyle = '#ff4a2a'; ctx.fillRect(x, y - 9, 2, 2); } break; }
    default: spr(ctx, 'net', n.x, n.y - n.z + 10); break;
  }
}
export function drawNet(ctx, n) { drawProj(ctx, n); }
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
