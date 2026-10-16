// Cutscenes: comic-style intro (kid is tossed to a soft haystack, totally fine) and the jungle ending.
import { W, H } from './logic.js';
import { drawHarambe, drawHuman, drawKid, drawText, shadow, spr } from './sprites.js';
import { drawBG } from './bg.js';
import { ENEMIES } from './levels.js';
import { audio } from './audio.js';

const hay = (ctx, x, y, s = 1) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); spr(ctx, 'haystack', 0, 0); ctx.restore(); };
const panel = (ctx, caption) => { ctx.fillStyle = '#05040f'; ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 30, W, 30); ctx.fillStyle = '#ff9ad8'; ctx.fillRect(0, H - 31, W, 1); ctx.fillStyle = '#5a3a9a'; ctx.fillRect(0, 14, W, 1); const lines = caption.split('\n'); lines.forEach((l, i) => drawText(ctx, l, W / 2, H - 18 + i * 9, '#fff', 8, 'center')); };
const sfxOnce = {};
const once = (k, t, now, fn) => { if (now >= t && !sfxOnce[k]) { sfxOnce[k] = 1; fn(); } if (now < 0.05) delete sfxOnce[k]; };

const scenes = [
  { dur: 4.2, draw(ctx, t) { // kid wanders in
    drawBG(ctx, 'zoo', 120, t); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(0, 0, W, H);
    shadow(ctx, 230, 150, 44); drawHarambe(ctx, { x: 230, y: 150, face: -1, t, state: 'idle' });
    const kx = 20 + t * 40; shadow(ctx, kx, 150, 14); drawKid(ctx, kx, 150 + Math.abs(Math.sin(t * 8)) * -2, Math.floor(t * 5) % 2 ? 'kid_walk0' : 'kid_walk1');
    if (t > 2.2) { drawText(ctx, '!', 232, 92, '#ff3030', 16, 'center'); drawText(ctx, 'uh oh', kx, 124, '#fff', 7, 'center'); }
    panel(ctx, 'CINCINNATI ZOO. A CURIOUS KID WANDERS INTO\nTHE GORILLA WORLD EXHIBIT...'); } },
  { dur: 3.6, draw(ctx, t) { // alt universe — Harambe has a better idea
    drawBG(ctx, 'zoo', 120, t); hay(ctx, 70, 150, 1.1);
    shadow(ctx, 230, 150, 44); drawHarambe(ctx, { x: 230, y: 150, face: -1, t, state: t > 1.8 ? 'special' : 'idle', at: Math.min(0.5, (t - 1.8) / 1.2 * 0.5) });
    shadow(ctx, 205, 150, 14); drawKid(ctx, 205, 150, 'kid_idle', -1);
    drawText(ctx, 'HARAMBE HAS A BETTER IDEA.', W / 2, 40, '#ffe03a', 9, 'center');
    panel(ctx, 'ALTERNATE UNIVERSE: INSTEAD OF A SAD ENDING,\nHE SPOTS A GIANT HAYSTACK...'); } },
  { dur: 4.6, draw(ctx, t) { // the toss: safe, soft landing, kid delighted
    drawBG(ctx, 'zoo', 120, t); hay(ctx, 62, 152, 1.1);
    shadow(ctx, 235, 150, 44); drawHarambe(ctx, { x: 235, y: 150, face: -1, t, state: t < 0.3 ? 'idle' : 'atk', combo: 2, at: Math.min(1, (t - 0.3) / 0.5) });
    once('toss', 0.3, t, () => audio.sfx('toss')); once('flop', 2.1, t, () => audio.sfx('flop'));
    if (t < 0.3) drawKid(ctx, 215, 150, 'kid_idle', -1);
    else if (t < 2.1) { const k = (t - 0.3) / 1.8, x = 215 - k * 150, y = 120 - Math.sin(k * Math.PI) * 70 + k * 22; drawKid(ctx, x, y + 40, 'kid_fly', -1); drawText(ctx, 'WHEEEEE!', x, y - 24, '#fff', 8, 'center'); }
    else { drawKid(ctx, 62, 118 - Math.max(0, 0.4 - (t - 2.1)) * 20, t > 2.8 ? 'kid_cheer' : 'kid_flop', 1); drawText(ctx, '*FLOP*', 62, 78, '#ffe03a', 8, 'center'); if (t > 2.8) drawText(ctx, '"AGAIN!"', 62, 66, '#fff', 8, 'center'); for (let i = 0; i < 6; i++) { ctx.fillStyle = '#e8d070'; ctx.fillRect(40 + i * 8 + Math.sin(t * 6 + i) * 3, 90 - ((t * 20 + i * 9) % 30), 3, 1); } }
    panel(ctx, t < 2.1 ? '...AND TOSSES THE KID TO SAFETY!' : 'THE KID IS PERFECTLY FINE. HAY EVERYWHERE.\nBEST DAY EVER.'); } },
  { dur: 4.6, draw(ctx, t) { // chaos, escape
    drawBG(ctx, 'zoo', 120, t); ctx.fillStyle = (Math.floor(t * 4) % 2) ? 'rgba(255,0,0,.12)' : 'rgba(0,0,255,.12)'; ctx.fillRect(0, 0, W, H);
    once('siren', 0.1, t, () => audio.sfx('siren'));
    shadow(ctx, 120, 150, 44); drawHarambe(ctx, { x: 120, y: 150, face: 1, t, state: t > 2.5 ? 'special' : 'idle', at: ((t - 2.5) * 0.5) % 0.6 });
    for (let i = 0; i < 3; i++) { const ex = 330 - Math.min(t * 60, 130) - i * 26, ey = 148 + i * 6; shadow(ctx, ex, ey, 36); drawHuman(ctx, { type: ['keeper_net', 'keeper_stun', 'keeper_dart'][i % 3], x: ex, y: ey, face: -1, t: t + i, state: ex > 220 ? 'run' : 'walk' }); }
    drawText(ctx, 'THE GORILLA IS LOOSE!!', 250, 70, '#ff5050', 8, 'center');
    if (t > 2.5) drawText(ctx, '"Time to go home."', 120, 90, '#fff', 8, 'center');
    panel(ctx, 'THE ZOO IS IN CHAOS. COPS, THE FBI AND THE ARMY\nARE COMING. HARAMBE CRACKS HIS KNUCKLES: JUNGLE, HO!'); } },
];
const total = scenes.reduce((a, s) => a + s.dur, 0);
export const INTRO = {
  total,
  draw(ctx, t) { let a = 0; for (const s of scenes) { if (t < a + s.dur) { s.draw(ctx, t - a); break; } a += s.dur; } drawText(ctx, 'ENTER: SKIP', W - 6, 10, '#99a', 6, 'right'); if (t < 0.05) for (const k in sfxOnce) delete sfxOnce[k]; },
};

export function drawOutro(ctx, t, score) {
  drawBG(ctx, 'jungle', 1700 + t * 20, t);
  const hx = Math.min(60 + t * 40, 200); shadow(ctx, t < 4 ? hx : 200, 156, 44); drawHarambe(ctx, { x: t < 4 ? hx : 200, y: 156, face: 1, t, state: t < 4 ? 'walk' : (t > 4.6 ? 'special' : 'idle'), at: ((t - 4.6) * 0.6) % 0.6 });
  if (t > 4.5) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.75, (t - 4.5) * 0.4)})`; ctx.fillRect(0, 0, W, H); }
  if (t > 1) drawText(ctx, 'THE BARON IS DOWN. THE JUNGLE. FINALLY.', W / 2, 40, '#ffe03a', 9, 'center');
  if (t > 5) { drawText(ctx, 'THE END', W / 2, 70, '#fff', 20, 'center'); drawText(ctx, '(the kid is fine. the army is not.)', W / 2, 90, '#8fe0a0', 7, 'center'); drawText(ctx, 'FINAL SCORE ' + score, W / 2, 110, '#8af', 9, 'center'); if (Math.floor(t * 2) % 2) drawText(ctx, 'ENTER: TITLE', W / 2, 140, '#fff', 8, 'center'); }
}
