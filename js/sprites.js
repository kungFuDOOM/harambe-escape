// Procedural chunky pixel art: every sprite is a list of rects drawn with a 1px black outline.
function drawRects(ctx, rects) {
  ctx.fillStyle = '#0a0a12';
  for (const [x, y, w, h] of rects) ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  for (const [x, y, w, h, c] of rects) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
}
const sh = (c, a) => c; // palette placeholder

export function shadow(ctx, x, y, w = 16) {
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 3);
}

/** Harambe: black gorilla, brown face, red TMNT-style bandana. */
export function drawHarambe(ctx, s) {
  const { x, y, z = 0, face, t = 0, state, at = 0, flash } = s; // at: attack progress 0..1
  ctx.save(); ctx.translate(Math.round(x), Math.round(y - z)); ctx.scale(face, 1);
  const walk = state === 'walk' ? Math.sin(t * 14) : 0, bob = state === 'idle' ? Math.sin(t * 3) * 0.6 : 0;
  const fur = flash ? '#fff' : '#26262e', fur2 = flash ? '#fff' : '#3a3a46', skin = flash ? '#fff' : '#8a5a3a';
  if (state === 'down') { ctx.translate(0, -4); ctx.rotate(-Math.PI / 2 * 0.95); ctx.translate(0, 8); }
  if (state === 'special') { ctx.scale(1 + Math.sin(at * 20) * 0.04, 1); }
  const R = [], b = Math.round(bob);
  const legA = Math.round(walk * 3), air = z > 1;
  R.push([-9 + (air ? -2 : -legA), -11, 7, 11, fur], [2 + (air ? 3 : legA), -11, 7, 11, fur]);
  R.push([-10 + (air ? -2 : -legA), -3, 9, 3, '#17171c'], [2 + (air ? 3 : legA), -3, 9, 3, '#17171c']);
  R.push([-13, -29 + b, 26, 19, fur], [-9, -26 + b, 18, 10, fur2]); // torso + chest
  R.push([-6, -42 + b, 14, 12, fur], [-3, -38 + b, 10, 8, skin], [1, -36 + b, 2, 2, '#fff'], [4, -36 + b, 2, 2, '#fff'], [2, -35 + b, 1, 1, '#000'], [5, -35 + b, 1, 1, '#000']);
  R.push([-6, -43 + b, 14, 3, '#d8262e'], [-10, -42 + b, 5, 2, '#d8262e'], [-13, -40 + b + Math.round(Math.sin(t * 10) * 1.5), 4, 2, '#d8262e']); // bandana + tails
  const k = state;
  if (k === 'atk') { // light jabs, alternate arms by combo
    const ext = Math.sin(Math.min(1, at) * Math.PI) * 16;
    R.push([-15, -28 + b, 5, 15, fur], [8, -27 + b + (s.combo % 2 ? 0 : 3), 8 + ext, 6, fur], [14 + ext, -29 + b + (s.combo % 2 ? 0 : 3), 7, 9, fur2]);
  } else if (k === 'heavy' || k === 'special') { // overhead slam
    const up = at < 0.4 ? -12 - at * 20 : 0 + (at - 0.4) * 30;
    R.push([-16, -30 + up, 6, 16, fur], [10, -30 + up, 6, 16, fur], [-18, -34 + up, 9, 8, fur2], [10, -34 + up, 9, 8, fur2]);
  } else if (k === 'jatk') {
    R.push([-15, -28 + b, 5, 15, fur], [9, -22, 18, 6, fur], [24, -24, 7, 9, fur2]);
  } else if (k === 'hurt') {
    R.push([-17, -26, 5, 15, fur], [12, -26, 5, 15, fur], [-3, -36, 6, 2, '#d8262e']);
  } else {
    R.push([-17, -29 + b, 6, 18 + Math.round(walk * 2), fur], [11, -29 + b, 6, 18 - Math.round(walk * 2), fur]);
  }
  drawRects(ctx, R); ctx.restore();
}

export function drawHuman(ctx, s) {
  const { x, y, z = 0, face, t = 0, state, at = 0, pal, scale = 1, flash, prop, windup, shield } = s;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y - z)); ctx.scale(face * scale, scale);
  const walk = state === 'walk' ? Math.sin(t * 12) : 0, c = n => (flash ? '#fff' : pal[n]);
  if (state === 'down') { ctx.translate(0, -3); ctx.rotate(-Math.PI / 2 * 0.95); ctx.translate(0, 7); }
  const R = []; const la = Math.round(walk * 3);
  R.push([-5 - la, -10, 4, 10, c('pants')], [1 + la, -10, 4, 10, c('pants')], [-6 - la, -2, 6, 2, '#222'], [1 + la, -2, 6, 2, '#222']);
  R.push([-6, -22, 12, 12, c('body')], [-6, -13, 12, 2, '#222']);
  R.push([-4, -31, 8, 9, c('skin')], [-5, -33, 10, 3, c('hat')], [0, -35, 7, 2, c('hat')], [2, -28, 2, 2, '#000']);
  if (windup) R.push([-3, -41, 6, 6, '#ffe03a'], [-1, -40, 2, 3, '#a00']);
  if (state === 'atk') { const ext = Math.sin(Math.min(1, at) * Math.PI) * 12; R.push([4, -20, 7 + ext, 4, c('body')], [10 + ext, -21, 4, 5, c('skin')]); if (prop === 'anchor') R.push([8 + ext, -30, 3, 18, '#777'], [4 + ext, -32, 11, 3, '#777']); }
  else if (state === 'hurt') R.push([-10, -20, 4, 8, c('body')], [6, -20, 4, 8, c('body')]);
  else R.push([-9, -21 + la, 3, 9, c('body')], [6, -21 - la, 3, 9, c('body')]);
  if (prop === 'tranq') R.push([6, -22, 14, 3, '#555'], [18, -23, 3, 5, '#c33']);
  if (prop === 'rifle') R.push([5, -23, 18, 2, '#4a3a1e'], [20, -24, 4, 4, '#222']);
  if (prop === 'net') R.push([6, -26, 3, 12, '#6a4a2a'], [4, -31, 9, 6, '#cfcf8a']);
  if (prop === 'anchor' && state !== 'atk') R.push([7, -34, 2, 14, '#777'], [4, -36, 8, 3, '#777']);
  if (shield) R.push([5, -26, 5, 20, '#9ab4d8'], [6, -24, 2, 16, '#cfe0f5']);
  if (s.blocks && !shield) R.push([6, -22, 3, 9, '#6a748a']);
  drawRects(ctx, R); ctx.restore();
}

export function drawKid(ctx, x, y, rot = 0) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot);
  drawRects(ctx, [[-3, -7, 6, 7, '#ff8a2a'], [-3, -12, 6, 5, '#f2c49b'], [-4, -13, 8, 2, '#5a3a1a'], [-6, -6, 3, 2, '#f2c49b'], [3, -6, 3, 2, '#f2c49b'], [-3, 0, 2, 4, '#3a6ad8'], [1, 0, 2, 4, '#3a6ad8']]);
  ctx.restore();
}

export function drawProp(ctx, p) {
  const x = Math.round(p.x), y = Math.round(p.y), f = p.flash ? '#fff' : null;
  ctx.save(); ctx.translate(x, y);
  if (p.kind === 'crate') drawRects(ctx, [[-9, -16, 18, 16, f || '#b8843a'], [-9, -16, 18, 3, f || '#8a5a22'], [-9, -4, 18, 4, f || '#8a5a22'], [-1, -16, 3, 16, f || '#8a5a22']]);
  else drawRects(ctx, [[-7, -20, 14, 20, f || '#c0392b'], [-8, -16, 16, 3, '#555'], [-8, -6, 16, 3, '#555'], [-5, -22, 10, 3, f || '#8f2a20']]);
  ctx.restore();
}

export function drawBanana(ctx, x, y, t, big) {
  const bob = Math.round(Math.sin(t * 6) * 2), k = big ? 1.6 : 1;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y - 8 + bob)); ctx.scale(k, k);
  drawRects(ctx, [[-5, -2, 3, 4, '#ffe03a'], [-3, 1, 5, 3, '#ffe03a'], [2, -1, 3, 3, '#ffe03a'], [4, -4, 2, 3, '#ffd01a'], [-6, -4, 2, 2, '#6a4a1a']]);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(Math.round(x - 5), Math.round(y), 10, 2);
}

export function drawNet(ctx, n) {
  ctx.save(); ctx.translate(Math.round(n.x), Math.round(n.y - n.z));
  drawRects(ctx, [[-6, -6, 12, 12, '#d8d8a0'], [-6, -1, 12, 1, '#7a7a50'], [-1, -6, 1, 12, '#7a7a50']]); ctx.restore();
}

export function drawText(ctx, str, x, y, color = '#fff', size = 8, align = 'left', outline = '#000') {
  ctx.font = `bold ${size}px "Courier New", monospace`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = outline;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) ctx.fillText(str, Math.round(x + dx), Math.round(y + dy));
  ctx.fillStyle = color; ctx.fillText(str, Math.round(x), Math.round(y));
}
