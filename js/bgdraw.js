// Procedural set dressing for the per-screen backgrounds (js/bgscreens.js): landmarks are painted once per screen into a small
// offscreen layer (device-pixel crisp), then blitted every frame; lights/fog/rain/etc. are cheap animated overlays.
import { A } from './assets.js';
import { drawText } from './sprites.js';
import { SCREENS, TILE_W } from './bgscreens.js';

const S = 3, PAD = 40, LW = 320 + PAD * 2;
const hx = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const sh = (c, f) => { const [r, g, b] = hx(c); const q = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${q(r)},${q(g)},${q(b)})`; };
const q = v => Math.round(v * S) / S;
let g; // current layer ctx (scaled S)
const R = (x, y, w, h, c) => { g.fillStyle = c; const X = q(x), Y = q(y); g.fillRect(X, Y, q(x + w) - X, q(y + h) - Y); };
const box = (x, y, w, h, c, edge = '#10121a') => { R(x - 1, y - 1, w + 2, h + 2, edge); R(x, y, w, h, c); R(x, y, w, 1, sh(c, 1.25)); R(x, y + h - 1, w, 1, sh(c, 0.7)); };
const blob = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(q(x), q(y), rx, ry, 0, 0, 7); g.fill(); };
/** Smooth neon lettering (canvas font, not the 6px bitmap font scaled up): glow pass + bright core. */
function neon(t, x, y, px, core, glow) { g.save(); g.font = `900 ${px}px Impact, "Arial Black", "Helvetica Neue", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.shadowColor = glow; g.shadowBlur = 5; g.lineWidth = 2.2; g.strokeStyle = glow; g.strokeText(t, x, y); g.shadowBlur = 0; g.fillStyle = core; g.fillText(t, x, y); g.restore(); }
const text = (t, x, y, col) => drawText(g, t, x, y, col, 8, 'center', '#000');

const LM = {
  /** Lettering on a painted sign board of the plate (x = centre from the screen's left edge, y = text centre; crisp canvas text, no bitmap font). */
  ptext(x, gy, y, t, kind) { if (kind === 'neon') { neon(t, x, y + 3.6, 10.5, '#ffc0c0', '#ff3a4a'); return; }
    g.save(); g.font = '700 8px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.letterSpacing = '1.5px';
    g.fillStyle = 'rgba(8,10,16,0.75)'; g.fillText(t, x + 0.4, y + 3.4); g.fillStyle = 'rgba(214,206,170,0.92)'; g.fillText(t, x, y + 2.8); g.restore(); },
  sign(x, gy, t, bg, fg) { const w = t.length * 6 + 10; R(x - w / 2 + 3, gy - 14, 2, 14, '#2a2418'); R(x + w / 2 - 5, gy - 14, 2, 14, '#2a2418'); box(x - w / 2, gy - 30, w, 16, bg); R(x - w / 2 + 2, gy - 28, w - 4, 1, sh(fg, 0.55)); text(t, x, gy - 16, fg); },
  hsign(x, gy, t, bg, fg) { const w = t.length * 6 + 12, y = gy - 50; R(x - w / 2, y - 8, w, 2, '#1a1a20'); R(x - w / 2 + 4, y - 6, 1, 6, '#6a6a72'); R(x + w / 2 - 5, y - 6, 1, 6, '#6a6a72'); box(x - w / 2, y, w, 16, bg); R(x - w / 2 + 2, y + 2, w - 4, 1, sh(fg, 0.55)); text(t, x, y + 14, fg); },
  bush(x, gy, w, c) { for (let i = 0; i < 4; i++) blob(x + (i - 1.5) * w / 4, gy - 5 - (i % 2) * 3, w / 3.2, 8, '#0c1a10'); for (let i = 0; i < 4; i++) { blob(x + (i - 1.5) * w / 4, gy - 6 - (i % 2) * 3, w / 3.4, 7, c); blob(x + (i - 1.5) * w / 4 - 2, gy - 9 - (i % 2) * 3, w / 7, 3, sh(c, 1.5)); } },
  tree(x, gy, h) { R(x - 3, gy - h, 6, h, '#2a1c12'); R(x - 3, gy - h, 2, h, '#4a3220'); for (const [dx, dy, r] of [[0, 0, 20], [-16, 8, 15], [16, 8, 15], [-6, -8, 14], [8, -6, 13]]) blob(x + dx, gy - h + dy, r, r * 0.8, '#10281a'); for (const [dx, dy, r] of [[-4, -3, 10], [10, 4, 7], [-14, 6, 6]]) blob(x + dx, gy - h + dy, r, r * 0.7, '#1e4a2a'); },
  stand(x, gy, c1, c2, t) { box(x, gy - 22, 40, 22, '#3a2c22'); R(x + 3, gy - 18, 34, 8, '#14100c'); R(x + 3, gy - 10, 34, 3, '#7a5a38'); for (let i = 0; i < 8; i++) R(x - 2 + i * 5, gy - 34, 5, 10, i % 2 ? c2 : c1); R(x - 2, gy - 25, 44, 1, '#10121a'); R(x - 2, gy - 35, 44, 1, '#10121a'); text(t, x + 20, gy - 38, '#ffe9a0'); },
  bench(x, gy) { R(x, gy - 12, 26, 3, '#5a3a1e'); R(x, gy - 16, 26, 3, '#6a4624'); R(x + 2, gy - 9, 2, 9, '#1a1a1a'); R(x + 22, gy - 9, 2, 9, '#1a1a1a'); },
  lamp(x, gy, c) { R(x - 1, gy - 52, 3, 52, '#15171c'); R(x - 1, gy - 52, 1, 52, '#3a3e48'); R(x - 5, gy - 56, 11, 3, '#15171c'); R(x - 4, gy - 53, 9, 3, c); blob(x, gy - 54, 5, 3, c); },
  cage(x, gy, w, c) { box(x, gy - 54, w, 54, '#14110e'); R(x + 2, gy - 50, w - 4, 46, '#07060a'); for (let i = 0; i <= w / 6; i++) R(x + 3 + i * 6, gy - 52, 1.5, 50, '#6a6a72'); R(x + 2, gy - 38, w - 4, 1.5, '#6a6a72'); R(x + 2, gy - 18, w - 4, 1.5, '#6a6a72'); R(x + w * 0.4, gy - 30, 3, 2, '#ffd23a'); R(x + w * 0.4 + 9, gy - 30, 3, 2, '#ffd23a'); blob(x + w * 0.5, gy - 20, 14, 8, '#2a1a0c'); },
  cone(x, gy) { R(x - 4, gy - 2, 8, 2, '#202020'); for (let i = 0; i < 8; i++) R(x - 3 + i * 0.4, gy - 3 - i, 6 - i * 0.8, 1, i % 4 < 2 ? '#ff7a1a' : '#f4f4f4'); },
  dumpster(x, gy) { box(x, gy - 18, 34, 18, '#2c4a38'); R(x - 1, gy - 22, 36, 4, '#1e3628'); R(x + 3, gy - 14, 28, 1, '#14281c'); R(x + 3, gy - 9, 28, 1, '#14281c'); R(x + 4, gy - 3, 3, 3, '#000'); R(x + 27, gy - 3, 3, 3, '#000'); },
  hydrant(x, gy) { box(x - 4, gy - 14, 8, 14, '#b0281c'); R(x - 6, gy - 10, 12, 3, '#c83a2a'); blob(x, gy - 15, 4, 3, '#b0281c'); },
  pipe(x, gy) { R(x, 20, 4, gy - 20, '#2a2e36'); R(x, 20, 1, gy - 20, '#555b68'); R(x - 2, gy - 40, 8, 3, '#1a1c22'); },
  planter(x, gy) { box(x, gy - 10, 22, 10, '#4a4036'); for (let i = 0; i < 4; i++) blob(x + 4 + i * 5, gy - 14 - (i % 2) * 3, 5, 5, '#1c4a2a'); },
  shop(x, gy, h, c, t) { h = 58; box(x, gy - h, 74, h, '#17151f'); R(x + 6, gy - h + 16, 26, h - 16, sh(c, 0.3)); R(x + 8, gy - h + 18, 22, h - 18, sh(c, 0.62)); R(x + 10, gy - h + 22, 18, 1, sh(c, 1.1)); R(x + 38, gy - h + 16, 30, 22, sh(c, 0.35)); R(x + 40, gy - h + 18, 26, 18, '#0c0e18'); for (let i = 0; i < 6; i++) R(x - 2 + i * 13, gy - h + 5, 13, 9, i % 2 ? c : sh(c, 0.5)); box(x + 37 - (t.length * 6 + 8) / 2, gy - h - 12, t.length * 6 + 8, 11, '#0a0a12', c); text(t, x + 37, gy - h - 3, c); },
  diner(x, gy) { box(x, gy - 54, 120, 54, '#4a4036'); R(x + 6, gy - 40, 108, 24, '#2a3a50'); R(x + 6, gy - 40, 108, 3, '#9ad0ff'); for (let i = 0; i < 12; i++) R(x - 2 + i * 10.3, gy - 56, 10.3, 7, i % 2 ? '#e8e8e8' : '#c8321e'); box(x + 30, gy - 70, 60, 12, '#10101a', '#ff5a5a'); text('DINER', x + 60, gy - 60, '#ff6a6a'); for (let i = 0; i < 4; i++) { blob(x + 18 + i * 26, gy - 18, 4, 3, '#c8321e'); R(x + 17 + i * 26, gy - 18, 2, 18, '#aaa'); } },
  cables(x, gy) { for (let i = 0; i < 6; i++) { R(x + 28 + i * 44, 8 + i * 4, 1, 100 - i * 4 - 18, '#8a929e'); } g.strokeStyle = '#aab2be'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 320, 52); g.stroke(); R(x + 300, 0, 10, gy, '#4a525e'); R(x + 300, 0, 3, gy, '#6a7280'); },
  girders(x, gy) { R(x, 0, 320, 12, '#2a2e38'); R(x, 12, 320, 2, '#14161c'); for (let i = 0; i < 9; i++) { R(x + i * 40, 0, 6, 70, '#323644'); R(x + i * 40, 0, 2, 70, '#4a5060'); } for (let i = 0; i < 8; i++) { g.strokeStyle = '#242832'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + i * 40 + 6, 14); g.lineTo(x + i * 40 + 40, 70); g.stroke(); } },
  barrier(x, gy) { R(x, gy - 10, 3, 10, '#202020'); R(x + 40, gy - 10, 3, 10, '#202020'); box(x - 2, gy - 22, 48, 11, '#f4f4f4'); for (let i = 0; i < 6; i++) R(x - 2 + i * 8, gy - 22, 4, 11, '#e03a1a'); },
  plant(x, gy) { box(x - 6, gy - 12, 12, 12, '#6a4a30'); for (let i = 0; i < 6; i++) { blob(x + (i - 2.5) * 3, gy - 20 - (i % 3) * 4, 4, 8, i % 2 ? '#1e5a30' : '#2a7a40'); } },
  seal(x, gy) { blob(x, 50, 22, 22, '#14161c'); blob(x, 50, 19, 19, '#c8a24a'); blob(x, 50, 14, 14, '#1a2a5a'); R(x - 8, 48, 16, 2, '#e8d890'); R(x - 1, 40, 2, 20, '#e8d890'); },
  cubicle(x, gy) { box(x, gy - 34, 76, 34, '#6a7280'); R(x + 4, gy - 30, 68, 26, '#8a92a0'); box(x + 14, gy - 22, 22, 14, '#1a2230', '#222'); R(x + 16, gy - 20, 18, 10, '#4a8ac8'); R(x + 44, gy - 20, 18, 8, '#e8e0c8'); R(x + 46, gy - 18, 12, 1, '#aa9'); },
  cooler(x, gy) { box(x - 7, gy - 34, 14, 34, '#d8dde4'); blob(x, gy - 40, 6, 7, '#7ac0f0'); R(x - 4, gy - 26, 8, 2, '#4a8ac8'); },
  door(x, gy, n) { box(x, gy - 52, 30, 52, '#4a3220'); R(x + 3, gy - 48, 24, 22, '#5a3e28'); R(x + 3, gy - 22, 24, 18, '#5a3e28'); R(x + 24, gy - 26, 2, 3, '#e8c870'); box(x + 8, gy - 62, 14, 8, '#e8e0c8'); text(n, x + 15, gy - 55, '#222'); },
  glass(x, gy, w) { R(x, gy - 60, w, 2, '#5a7a98'); R(x, gy - 2, w, 2, '#5a7a98'); R(x, gy - 60, 2, 60, '#5a7a98'); R(x + w - 2, gy - 60, 2, 60, '#5a7a98'); R(x + w / 2 - 1, gy - 58, 2, 56, '#5a7a98'); g.globalAlpha = 0.22; R(x + 2, gy - 58, w - 4, 56, '#bfe4ff'); g.globalAlpha = 1; for (let i = 0; i < 5; i++) R(x + 10 + i * 26, gy - 50, 8, 1, '#ffffff'); },
  table(x, gy) { R(x, gy - 18, 110, 5, '#4a3020'); R(x, gy - 18, 110, 1, '#7a5030'); R(x + 8, gy - 13, 4, 13, '#2a1c12'); R(x + 98, gy - 13, 4, 13, '#2a1c12'); for (let i = 0; i < 5; i++) { R(x + 8 + i * 20, gy - 30, 12, 12, '#1c2430'); R(x + 10 + i * 20, gy - 34, 8, 6, '#2a3444'); } },
  flag(x, gy) { R(x - 1, gy - 70, 2, 70, '#c8a24a'); blob(x, gy - 71, 2, 2, '#e8d070'); R(x + 1, gy - 68, 24, 16, '#2a3a8a'); R(x + 1, gy - 68, 24, 2, '#4a5ac0'); R(x + 9, gy - 62, 8, 5, '#e8d070'); },
  rack(x, gy) { box(x, gy - 62, 40, 62, '#1c222c'); for (let i = 0; i < 7; i++) { R(x + 3, gy - 58 + i * 8, 34, 6, '#10141c'); R(x + 5, gy - 56 + i * 8, 2, 2, (i * 3 + (x | 0)) % 4 ? '#3aff8a' : '#ff5a3a'); R(x + 9, gy - 56 + i * 8, 2, 2, '#4a9aff'); R(x + 26, gy - 56 + i * 8, 8, 1, '#3a4252'); } },
  shelf(x, gy, w) { box(x, gy - 64, w, 64, '#4a3a2a'); for (let r = 0; r < 4; r++) { R(x + 2, gy - 16 - r * 15, w - 4, 2, '#2a1e14'); for (let i = 0; i < (w - 8) / 6; i++) R(x + 4 + i * 6, gy - 30 - r * 15 + (i % 3), 5, 14 - (i % 3), ['#c8b890', '#a08a60', '#e8dcc0', '#8a7a58'][(i + r) % 4]); } },
  cart(x, gy) { box(x - 12, gy - 14, 24, 8, '#8a8a92'); R(x - 10, gy - 6, 3, 6, '#222'); R(x + 7, gy - 6, 3, 6, '#222'); R(x - 8, gy - 22, 14, 8, '#e8dcc0'); },
  elevator(x, gy) { box(x, gy - 62, 44, 62, '#9aa2ae'); R(x + 4, gy - 58, 17, 56, '#c8d0dc'); R(x + 23, gy - 58, 17, 56, '#c8d0dc'); R(x + 21, gy - 58, 2, 56, '#6a727e'); box(x + 14, gy - 72, 16, 8, '#10101a', '#444'); R(x + 18, gy - 70, 8, 4, '#ff5a3a'); R(x + 47, gy - 34, 3, 6, '#ffd070'); },
  curtain(x, gy) { for (let i = 0; i < 6; i++) { R(x + i * 5, 4, 5, 90, i % 2 ? '#6a1a22' : '#8a2a32'); } R(x - 2, 2, 34, 3, '#c8a24a'); },
  gatepost(x, gy) { box(x - 7, gy - 46, 14, 46, '#5a4a3a'); R(x - 9, gy - 50, 18, 5, '#3a2e22'); R(x - 5, gy - 40, 10, 6, '#8a2a1a'); },
  sandbags(x, gy, n) { for (let r = 0; r < 2; r++) for (let i = 0; i < n - r; i++) blob(x + i * 13 + r * 6, gy - 5 - r * 7, 8, 5, r ? '#8a7a54' : '#7a6a48'); for (let i = 0; i < n; i++) R(x + i * 13 - 4, gy - 6, 8, 1, '#4a3e28'); },
  jeep(x, gy) { box(x, gy - 22, 56, 14, '#4a5a30'); box(x + 8, gy - 34, 26, 13, '#3a4a26'); R(x + 11, gy - 31, 20, 8, '#7ab0c8'); blob(x + 12, gy - 6, 7, 7, '#111'); blob(x + 44, gy - 6, 7, 7, '#111'); R(x + 46, gy - 30, 2, 12, '#2a2a2a'); },
  drums(x, gy, n) { for (let i = 0; i < n; i++) { const dx = x + i * 13; box(dx, gy - 18, 11, 18, i % 2 ? '#8a3a1a' : '#4a5a30'); R(dx, gy - 13, 11, 1, '#000'); R(dx, gy - 6, 11, 1, '#000'); } },
  tent(x, gy, h) { g.fillStyle = '#10140a'; g.beginPath(); g.moveTo(q(x - 2), gy); g.lineTo(q(x + 36), gy - h - 2); g.lineTo(q(x + 74), gy); g.fill(); g.fillStyle = '#5a6a3a'; g.beginPath(); g.moveTo(q(x + 2), gy); g.lineTo(q(x + 36), gy - h + 2); g.lineTo(q(x + 70), gy); g.fill(); g.fillStyle = '#3a4a24'; g.beginPath(); g.moveTo(q(x + 28), gy); g.lineTo(q(x + 36), gy - 22); g.lineTo(q(x + 44), gy); g.fill(); },
  tank(x, gy) { box(x, gy - 38, 70, 30, '#7a7a82'); R(x + 4, gy - 34, 62, 3, '#aaaab2'); R(x + 10, gy - 8, 3, 8, '#333'); R(x + 56, gy - 8, 3, 8, '#333'); R(x + 30, gy - 44, 10, 6, '#444'); R(x + 8, gy - 24, 18, 6, '#c8321e'); },
  wire(x, gy) { for (let i = 0; i < 5; i++) R(x + i * 20, gy - 24, 2, 24, '#2a2418'); g.strokeStyle = '#8a8a92'; g.lineWidth = 0.5; for (let r = 0; r < 3; r++) { g.beginPath(); g.moveTo(q(x), gy - 22 + r * 7); for (let i = 0; i < 16; i++) g.lineTo(q(x + 4 + i * 5), gy - 22 + r * 7 + (i % 2) * 2); g.stroke(); } },
  helipad(x, gy) { g.save(); g.translate(q(x + 50), q(gy + 18)); g.scale(1, 0.28); g.fillStyle = '#2a2e34'; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill(); g.strokeStyle = '#e8e8e8'; g.lineWidth = 3; g.stroke(); g.restore(); R(x + 38, gy + 10, 3, 14, '#e8e8e8'); R(x + 59, gy + 10, 3, 14, '#e8e8e8'); R(x + 38, gy + 16, 24, 3, '#e8e8e8'); },
  windsock(x, gy) { R(x, gy - 44, 2, 44, '#333'); for (let i = 0; i < 5; i++) R(x + 2 + i * 4, gy - 44 + i * 0.5, 4, 8 - i, i % 2 ? '#f4f4f4' : '#ff6a1a'); },
  bunker(x, gy) { g.fillStyle = '#10140a'; g.beginPath(); g.ellipse(q(x + 62), gy, 66, 36, 0, Math.PI, 0); g.fill(); g.fillStyle = '#5a5a4a'; g.beginPath(); g.ellipse(q(x + 62), gy, 62, 32, 0, Math.PI, 0); g.fill(); R(x + 40, gy - 20, 44, 7, '#06060a'); R(x + 40, gy - 21, 44, 1, '#8a8a78'); sandbagsRow(x, gy); },
  hq(x, gy) { box(x, gy - 70, 150, 70, '#6a6a58'); R(x + 4, gy - 66, 142, 8, '#4a4a3c'); for (let i = 0; i < 5; i++) { R(x + 12 + i * 28, gy - 46, 18, 16, '#1a2236'); R(x + 14 + i * 28, gy - 44, 14, 12, i % 2 ? '#e8c870' : '#30405a'); } box(x + 62, gy - 30, 26, 30, '#3a3a2e'); R(x + 100, gy - 90, 2, 20, '#aaa'); R(x + 96, gy - 84, 10, 1, '#aaa'); R(x + 94, gy - 79, 14, 1, '#aaa'); },
  fern(x, gy) { for (let i = -3; i <= 3; i++) { g.strokeStyle = i % 2 ? '#1e5a2a' : '#2e8a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(q(x), gy); g.quadraticCurveTo(q(x + i * 5), gy - 18 - Math.abs(3 - Math.abs(i)) * 4, q(x + i * 9), gy - 8 + Math.abs(i) * 2); g.stroke(); } },
  vines(x, gy, n) { for (let i = 0; i < n / 2 | 0; i++) { const vx = x + i * 11 + (i % 2) * 4, len = 30 + ((i * 37) % 40); g.strokeStyle = '#0e2a14'; g.lineWidth = 3; g.beginPath(); g.moveTo(q(vx), 0); g.quadraticCurveTo(q(vx + 4), len / 2, q(vx - 2), len); g.stroke(); g.strokeStyle = '#2a7a38'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(q(vx), 0); g.quadraticCurveTo(q(vx + 4), len / 2, q(vx - 2), len); g.stroke(); for (let k = 1; k < 4; k++) blob(vx + (k % 2 ? 3 : -3), len * k / 4, 3.5, 2.2, '#3a9a46'); } },
  rocks(x, gy) { for (const [dx, r] of [[0, 14], [18, 9], [-14, 8]]) { blob(x + dx, gy - r * 0.4, r, r * 0.6, '#1c1e22'); blob(x + dx - 1, gy - r * 0.5, r * 0.85, r * 0.5, '#5a5e64'); blob(x + dx - 3, gy - r * 0.7, r * 0.4, r * 0.2, '#8a9096'); } },
  water(x, gy, w) { const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, 'rgba(190,240,255,0.0)'); gr.addColorStop(0.3, 'rgba(190,240,255,0.55)'); gr.addColorStop(1, 'rgba(120,200,230,0.8)'); g.fillStyle = gr; g.fillRect(q(x), 10, q(w * 0.34), gy - 10); for (let i = 0; i < 8; i++) R(x + 3 + i * 6, 20 + (i * 17) % 60, 1, 18, 'rgba(255,255,255,0.7)'); blob(x + w * 0.17, gy, w * 0.3, 7, 'rgba(210,245,255,0.6)'); },
  pillar(x, gy, h) { box(x - 9, gy - h, 18, h, '#6a6a58'); R(x - 11, gy - h - 4, 22, 5, '#4a4a3c'); for (let i = 0; i < h / 8; i++) R(x - 8 + (i * 5) % 9, gy - h + 4 + i * 8, 4 + i % 3, 1, '#3a4a30'); R(x - 9, gy - h, 3, h, '#8a8a74'); for (let i = 0; i < 4; i++) R(x + 3, gy - h + 6 + i * 14, 4, 6, '#2a6a34'); },
  totem(x, gy) { box(x - 8, gy - 52, 16, 52, '#5a4a30'); for (let i = 0; i < 3; i++) { R(x - 6, gy - 48 + i * 16, 12, 12, '#7a6440'); R(x - 4, gy - 45 + i * 16, 3, 3, '#e8c040'); R(x + 1, gy - 45 + i * 16, 3, 3, '#e8c040'); R(x - 3, gy - 39 + i * 16, 6, 2, '#2a1c0c'); } },
  shroom(x, gy) { R(x - 1, gy - 8, 3, 8, '#cfe8e0'); blob(x, gy - 9, 7, 4, '#20c8a0'); blob(x - 1, gy - 10, 4, 1.5, '#a0ffe0'); },
  glowflower(x, gy) { R(x - 1, gy - 18, 2, 18, '#1a4a30'); for (let i = 0; i < 5; i++) { const a = i * 1.26; blob(x + Math.cos(a) * 5, gy - 20 + Math.sin(a) * 5, 3.5, 3, x % 2 ? '#a070ff' : '#50d0ff'); } blob(x, gy - 20, 2.5, 2.5, '#ffffff'); },
};
function sandbagsRow(x, gy) { for (let i = 0; i < 8; i++) blob(x + 12 + i * 14, gy - 4, 8, 4.5, '#7a6a48'); }


// ---- painted sprites (assets/props/*.webp, A.sp): same positions/ground anchoring as the old code drawing; missing sprite => old drawing ----
const tints = new Map();
function tinted(name, col, face) { // multiply-tint the whole sprite, or only its face rect, cached per name+colour
  const k = name + col + (face ? 'f' : ''); let c = tints.get(k); if (c) return c; const s = A.sp[name], [sx, sy, w, h] = s.r;
  c = document.createElement('canvas'); c.width = w; c.height = h; const t = c.getContext('2d'); t.drawImage(s.im, sx, sy, w, h, 0, 0, w, h);
  t.globalCompositeOperation = 'multiply'; t.fillStyle = col; if (face) t.fillRect(face[0], face[1], face[2], face[3]); else t.fillRect(0, 0, w, h);
  t.globalCompositeOperation = 'destination-in'; t.drawImage(s.im, sx, sy, w, h, 0, 0, w, h); tints.set(k, c); return c;
}
/** Blit sprite `name`: mode 'ctr' (x = centre) or 'left' (x = left edge); feet on gy (sunk dy px); `top` fixes the y instead (hanging props). */
function spr(name, x, gy, o = {}) {
  const s = A.sp[name]; if (!s) return null; const [sx, sy, w, h] = s.r, lw = w / S * (o.sw || o.sc || 1), lh = h / S * (o.sc || 1);
  const dx = o.mode === 'left' ? x : x - lw / 2, dy = o.top != null ? o.top : gy + (o.dy == null ? 1 : o.dy) - lh;
  const src = o.tint ? tinted(name, o.tint, o.face) : s.im, ox = o.tint ? 0 : sx, oy = o.tint ? 0 : sy;
  g.drawImage(src, ox, oy, w, h, q(dx), q(dy), lw, lh); return { x: dx, y: dy, w: lw, h: lh, s, sc: o.sc || 1 };
}
const faceOf = s => s.r.length >= 8 ? [s.r[4], s.r[5], s.r[6], s.r[7]] : null;
const pick = (x, n) => Math.abs(Math.round(x * 7 + n)) % n;
const SPRL = ['', 'a', 'b', 'c'];
const SP = {
  bus(x, gy) { return !!spr('bus', x, gy, { dy: 4 }); }, // painted open-air zoo tram (assets/props/haz.webp)
  lights(x, gy, w) { const s = A.sp.lights; return !!(s && spr('lights', x, gy, { mode: 'left', top: 46, sw: w * S / s.r[2] })); }, // painted string lights, stretched to the span
  sign(x, gy, t, bg, fg) { const tw = t.length * 6, nm = tw <= 26 ? 'sign_s' : tw <= 48 ? 'sign_m' : 'sign_l', s0 = A.sp[nm]; if (!s0) return false; const f = faceOf(s0);
    const sc = Math.max(0.55, Math.min(1, (tw + 12) / (f[2] / S))); // board only as wide as its lettering needs
    const r = spr(nm, x, gy, { dy: 2, tint: bg, face: f, sc }); const cx = r.x + (f[0] + f[2] / 2) / S * sc, cy = r.y + (f[1] + f[3] / 2) / S * sc; text(t, cx, cy + 3, fg); return true; },
  hsign(x, gy, t, bg, fg) { const s0 = A.sp.hsign; if (!s0) return false; const f = faceOf(s0), top = gy - 50 - f[1] / S; // board top sits at gate height (gy-50)
    const r = spr('hsign', x, gy, { top, face: f }); const cx = r.x + (f[0] + f[2] / 2) / S, cy = r.y + (f[1] + f[3] / 2) / S; // dark lettering on the parchment board (light text on cream was unreadable)
    g.save(); g.font = '700 8px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '1px';
    g.fillStyle = 'rgba(255,244,214,0.6)'; g.fillText(t, cx + 0.5, cy + 0.9); g.fillStyle = '#3a2410'; g.fillText(t, cx + 0.75, cy + 0.2); g.restore(); return true; },
  bush(x, gy, w, c) { const dark = hx(c).reduce((a, b) => a + b, 0) < 150; return !!spr('bush_' + 'abc'[pick(x, 3)], x, gy, { tint: dark ? '#7d8fa0' : null, dy: 2 }); },
  tree(x, gy) { return !!spr('tree', x, gy, { dy: 2 }); },
  stand(x, gy, c1, c2, t) { const r = spr(c1 === '#e0a020' ? 'stand_a' : 'stand_b', x + 20, gy, { dy: 1 }); if (!r) return false; const cx = r.x + r.w / 2; box(cx - t.length * 3 - 3, r.y - 11, t.length * 6 + 6, 10, '#3a2a1a'); text(t, cx, r.y - 3, '#ffe9a0'); return true; },
  bench(x, gy) { return !!spr('bench', x, gy, { mode: 'left', dy: 1 }); },
  lamp(x, gy, c) { const r = spr('lamp', x, gy, { dy: 1 }); if (!r) return false; g.globalAlpha = 0.8; blob(x, r.y + 7, 2.6, 3.2, c); g.globalAlpha = 1; return true; },
  cone(x, gy) { return !!spr('cone', x, gy, { dy: 1 }); },
  dumpster(x, gy) { return !!spr('dumpster', x, gy, { mode: 'left', dy: 1 }); },
  hydrant(x, gy) { return !!spr('hydrant', x, gy, { dy: 1 }); },
  pipe(x, gy) { return !!spr('pipe', x + 2, gy, { dy: 0 }); },
  planter(x, gy) { return !!spr('planter', x, gy, { mode: 'left', dy: 1 }); },
  diner(x, gy) { const s0 = A.sp.diner; if (!s0) return false; const f = faceOf(s0), r = spr('diner', x, gy, { mode: 'left', dy: 1 }); const cx = r.x + (f[0] + f[2] / 2) / S, cy = r.y + (f[1] + f[3] / 2) / S;
    neon('DINER', cx, cy + 5, 17, '#ffb0b0', '#ff3a4a'); return true; },
  girders(x, gy) { return !!spr('girders', x, gy, { mode: 'left', top: -36 }); },
  barrier(x, gy) { return !!spr('barrier', x, gy, { mode: 'left', dy: 1 }); },
  plant(x, gy) { return !!spr('plant', x, gy, { dy: 1 }); },
  seal(x, gy) { return !!spr('seal', x, gy, { top: 27 }); },
  cubicle(x, gy) { return !!spr('cubicle_' + 'ab'[pick(x, 2)], x, gy, { mode: 'left', dy: 1 }); },
  cooler(x, gy) { return !!spr('cooler', x, gy, { dy: 1 }); },
  door(x, gy, n) { const r = spr('door_' + 'ab'[pick(x, 2)], x + 15, gy, { dy: 1 }); if (!r) return false; const cx = r.x + r.w / 2; box(cx - 11, r.y - 5, 22, 11, '#e8e0c8', '#3a2a1a'); drawText(g, n, cx, r.y + 4, '#2a2018', 8, 'center', null); return true; },
  glass(x, gy) { const r = spr('glass', x, gy, { mode: 'left', dy: 1 }); return !!r; },
  table(x, gy) { return !!spr('table', x, gy, { mode: 'left', dy: 1 }); },
  flag(x, gy) { return !!spr('flag', x + 6, gy, { dy: 1 }); },
  cart(x, gy) { return !!spr('cart', x, gy, { dy: 1 }); },
  elevator(x, gy) { const r = spr('elevator', x, gy, { mode: 'left', dy: 1, sw: 0.72 }); if (!r) return false; R(r.x + r.w * 0.5 - 3, r.y + 3, 6, 2, '#ff5a3a'); return true; },
  curtain(x, gy) { return !!spr('curtain', x + 12, gy, { top: 4, sw: 0.55 }); },
  gatepost(x, gy) { return !!spr('gatepost', x, gy, { dy: 1 }); },
  sandbags(x, gy, n) { return !!spr(n >= 4 ? 'sandbags4' : 'sandbags3', x, gy, { mode: 'left', dy: 1 }); },
  jeep(x, gy) { return !!spr('jeep', x, gy, { mode: 'left', dy: 2 }); },
  drums(x, gy, n) { if (!A.sp.drum_a) return false; for (let i = 0; i < n; i++) spr(i % 2 ? 'drum_b' : 'drum_a', x + 6 + i * 13, gy, { dy: 1 }); return true; },
  tent(x, gy) { return !!spr('tent', x + 37, gy, { dy: 2 }); },
  tank(x, gy) { return !!spr('tank', x, gy, { mode: 'left', dy: 1 }); },
  wire(x, gy) { return !!spr('wire', x, gy, { mode: 'left', dy: 1 }); },
  bunker(x, gy) { return !!spr('bunker', x, gy, { mode: 'left', dy: 2 }); },
  hq(x, gy) { return !!spr('hq', x, gy, { mode: 'left', dy: 1 }); },
  fern(x, gy) { return !!spr('fern_' + 'abc'[pick(x, 3)], x, gy, { dy: 3 }); },
  vines(x, gy, n) { if (!A.sp.vine_s) return false; for (let i = 0; i < n / 2 | 0; i++) { const vx = x + i * 11 + (i % 2) * 4; spr('vine_' + 'sml'[(i * 7 + (n | 0)) % 3], vx, gy, { top: 0 }); } return true; },
  rocks(x, gy) { return !!spr('rock_' + 'ab'[pick(x, 2)], x, gy, { dy: 2 }); },
  pillar(x, gy, h) { return !!spr(h >= 90 ? 'pillar_t' : 'pillar_s', x, gy, { dy: 2 }); },
  totem(x, gy) { return !!spr('totem', x, gy, { dy: 1 }); },
  glowflower(x, gy) { return !!spr('flower_' + 'ab'[Math.floor(x / 20) % 2], x, gy, { dy: 1 }); },
};

const layers = new Map(); // "kind:i" -> canvas (LRU, max 4)
function layer(kind, i, x0) {
  const key = kind + ':' + i; let c = layers.get(key); if (c) { layers.delete(key); layers.set(key, c); return c; }
  c = document.createElement('canvas'); c.width = LW * S; c.height = 180 * S; g = c.getContext('2d'); g.scale(S, S); g.translate(PAD, 0); g.imageSmoothingEnabled = false;
  const lane = A.bgMeta[kind].lane, gy = lane[0] + 2;
  for (const l of SCREENS[kind].screens[i].lm) { const a = l.slice(1); if (SP[l[0]] && SP[l[0]](a[0], gy, ...a.slice(1))) continue; const f = LM[l[0]]; if (f) f(a[0], gy, ...a.slice(1)); }
  layers.set(key, c); if (layers.size > 4) layers.delete(layers.keys().next().value);
  return c;
}
/** Landmarks for any screens overlapping the view [cam, cam+320]. */
export function drawLandmarks(ctx, kind, stops, cam) {
  for (let i = 0; i < stops.length; i++) { const x0 = stops[i]; if (x0 + 320 + PAD < cam || x0 - PAD > cam + 320) continue; ctx.drawImage(layer(kind, i, x0), 0, 0, LW * S, 180 * S, Math.round((x0 - PAD - cam) * S) / S, 0, LW, 180); }
}

// ---- animated overlays ----
const glowCache = {};
function glow(col, r) { const k = col.join() + r; if (glowCache[k]) return glowCache[k]; const c = document.createElement('canvas'); c.width = c.height = r * 2; const x = c.getContext('2d'), gr = x.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.55)`); gr.addColorStop(0.4, `rgba(${col[0]},${col[1]},${col[2]},0.18)`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`); x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2); return glowCache[k] = c; }
let fogC = null;
function fogTex() { if (fogC) return fogC; fogC = document.createElement('canvas'); fogC.width = 320; fogC.height = 48; const x = fogC.getContext('2d'); for (let i = 0; i < 9; i++) for (const o of [-320, 0, 320]) { const cx = i * 40 + 12 + (i * 53) % 20 + o, cy = 24 + ((i * 29) % 14) - 7, rx = 46 + (i * 17) % 30; const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rx); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.save(); x.translate(0, cy); x.scale(1, 0.22); x.translate(0, -cy); x.fillRect(cx - rx, cy - rx, rx * 2, rx * 2); x.restore(); } return fogC; }
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** Colour grade + animated light/weather layers. Called after the plate and landmarks are drawn. */
export function drawGrade(ctx, kind, stops, cam, t, look) {
  const lane = A.bgMeta[kind].lane, scr = SCREENS[kind].screens;
  const c = a => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
  if (look.top.some(v => v < 255) || look.bot.some(v => v < 255)) { // multiply: sky/walls (top) to floor (bottom)
    const gr = ctx.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, c(look.top)); gr.addColorStop(0.62, c(look.top)); gr.addColorStop(0.72, c(look.bot)); gr.addColorStop(1, c(look.bot));
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gr; ctx.fillRect(0, 0, 320, 180); ctx.globalCompositeOperation = 'source-over';
  }
  if (look.warm[3] > 0.004) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${look.warm[0] | 0},${look.warm[1] | 0},${look.warm[2] | 0},${look.warm[3]})`; ctx.fillRect(0, 0, 320, 180); ctx.globalCompositeOperation = 'source-over'; }
  if (look.lift > 0.01) { // soft light across the walk band so heroes and enemies stand out against dark floors (peaks mid-lane, fades above/below)
    const gr = ctx.createLinearGradient(0, lane[0] - 14, 0, lane[1] + 8); gr.addColorStop(0, 'rgba(255,238,215,0)'); gr.addColorStop(0.5, `rgba(255,238,215,${look.lift})`); gr.addColorStop(1, 'rgba(255,238,215,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(0, lane[0] - 14, 320, lane[1] - lane[0] + 22); ctx.globalCompositeOperation = 'source-over';
  }
  if (look.stars > 0.02) { ctx.fillStyle = '#fff'; for (let i = 0; i < 28; i++) { const px = ((hash(i) * 400 - cam * 0.08) % 320 + 320) % 320, py = 4 + hash(i + 99) * 56; ctx.globalAlpha = look.stars * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + i))) ; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); } ctx.globalAlpha = 1; }
  if (look.beams > 0.02 && kind === 'base') { ctx.globalCompositeOperation = 'lighter'; for (let b = 0; b < 2; b++) { const bx = ((b ? 250 : 60) + b * 40 - cam * 0.2 % 640 + 640) % 640 - 160, a = Math.sin(t * 0.7 + b * 2) * 0.35; ctx.fillStyle = `rgba(255,250,200,${0.13 * look.beams})`; ctx.beginPath(); ctx.moveTo(bx - 2, 44); ctx.lineTo(bx + Math.sin(a) * 130 - 14, -8); ctx.lineTo(bx + Math.sin(a) * 130 + 14, -8); ctx.lineTo(bx + 2, 44); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; }
  // lights of nearby screens (flicker a little), added after the grade so they stay bright
  ctx.globalCompositeOperation = 'lighter';
  for (let i = Math.max(0, look.i - 1); i <= Math.min(stops.length - 1, look.j + 1); i++) for (const L of scr[i].lights || []) { const x = stops[i] + L[0] - cam; if (x < -L[2] || x > 320 + L[2]) continue; ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 3 + L[0]); const im = glow(L[3], L[2]); ctx.drawImage(im, Math.round(x - L[2]), Math.round(L[1] - L[2])); }
  ctx.globalAlpha = 1;
  if (look.blink > 0.05) { for (let i = 0; i < 14; i++) { const x = ((i * 37 + 12 - cam) % 360 + 360) % 360 - 20; if (Math.floor(t * 4 + i * 1.7) % 3) continue; ctx.fillStyle = `rgba(90,255,150,${0.5 * look.blink})`; ctx.fillRect(Math.round(x), 54 + (i * 11) % 30, 2, 2); } }
  if (look.siren > 0.05) { const ph = Math.floor(t * 3) % 2; ctx.fillStyle = ph ? `rgba(255,40,50,${0.09 * look.siren})` : `rgba(40,90,255,${0.09 * look.siren})`; ctx.fillRect(0, 0, 320, 180); }
  if (look.motes > 0.02) { ctx.fillStyle = '#fff6c0'; for (let i = 0; i < 26; i++) { const px = ((hash(i + 5) * 420 - cam * 1.15 - t * (4 + i % 5)) % 340 + 340) % 340 - 10, py = 8 + hash(i + 50) * 120 + Math.sin(t * 0.8 + i) * 4; ctx.globalAlpha = look.motes * 0.5 * (0.4 + 0.6 * Math.abs(Math.sin(t + i))); ctx.fillRect(Math.round(px), Math.round(py), 1, 1); } ctx.globalAlpha = 1; }
  if (look.flies > 0.05) { for (let i = 0; i < 12; i++) { const px = ((hash(i + 9) * 340 - cam * 0.9 + Math.sin(t * 0.6 + i) * 14) % 340 + 340) % 340, py = 60 + hash(i + 70) * 60 + Math.cos(t * 0.7 + i) * 6; ctx.fillStyle = `rgba(190,255,150,${0.9 * look.flies * Math.max(0, Math.sin(t * 2 + i * 2))})`; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); } }
  ctx.globalCompositeOperation = 'source-over';
  if (look.fog > 0.02) { const f = fogTex(); ctx.globalAlpha = look.fog; const off = -((cam * 0.55 + t * 3) % 320 + 320) % 320; for (let x = off; x < 320; x += 320) { ctx.drawImage(f, Math.round(x), lane[0] - 12); ctx.drawImage(f, Math.round(x - 90), lane[0] + 26); } ctx.globalAlpha = 1; }
  if (look.rain > 0.02) { ctx.strokeStyle = `rgba(190,215,255,${0.35 * look.rain})`; ctx.lineWidth = 0.5; ctx.beginPath(); for (let i = 0; i < 40; i++) { const px = ((hash(i) * 340 - cam * (i % 3 ? 1.1 : 0.7) - t * 30) % 340 + 340) % 340, py = ((hash(i + 40) * 200 + t * (140 + (i % 4) * 30)) % 200) - 10; ctx.moveTo(px, py); ctx.lineTo(px - 2, py + 7); } ctx.stroke(); }
}
