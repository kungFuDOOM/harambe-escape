// Keyboard + touch + gamepad input. `down` = held, `pressed` = edge since last poll.
// Stuck-input hardening: every source is tracked separately (see inputcore.js), touches are tracked per pointerId,
// every end/cancel/lost-capture path releases, window-level listeners catch releases outside the element, and a
// watchdog zeroes touch input when the browser says no fingers remain (event.touches).
import { createCore, stickDirs } from './inputcore.js';
const core = createCore(), down = core.down, pressed = core.pressed;
const MAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  j: 'atk', J: 'atk', z: 'atk', Z: 'atk', k: 'heavy', K: 'heavy', x: 'heavy', X: 'heavy', ' ': 'jump', c: 'jump', C: 'jump', l: 'special', L: 'special', v: 'special', V: 'special',
  Tab: 'skip', Enter: 'start', p: 'start', P: 'start', m: 'mute', M: 'mute', Escape: 'start' };
addEventListener('keydown', e => { const k = MAP[e.key]; if (k) { core.set('kb:' + e.key, k, true); e.preventDefault(); } });
addEventListener('keyup', e => { const k = MAP[e.key]; if (k) core.set('kb:' + e.key, k, false); });

// gamepad (optional): A=attack/select, B=jump, X=heavy, Y=special, Start=pause, d-pad/left stick=move/navigate
const GP = { 0: 'atk', 1: 'jump', 2: 'heavy', 3: 'special', 9: 'start', 8: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
function pollPad() {
  let pads = []; try { pads = (navigator.getGamepads && navigator.getGamepads()) || []; } catch (_) {}
  const now = {};
  for (const g of pads) { if (!g || !g.connected) continue;
    for (const b in GP) if (g.buttons[b] && g.buttons[b].pressed) now[GP[b]] = true;
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    if (ax < -0.5) now.left = true; if (ax > 0.5) now.right = true; if (ay < -0.5) now.up = true; if (ay > 0.5) now.down = true; }
  for (const k of ['atk', 'jump', 'heavy', 'special', 'start', 'up', 'down', 'left', 'right']) core.set('pad', k, !!now[k]);
}
// ---- touch bookkeeping ----
let stickId = null, stickType = '', sc = null, touchCount = 0, lastTouchT = 0;
const zone = document.getElementById('zone'), stick = document.getElementById('stick'), knob = document.getElementById('knob');
const btnHold = new Map(); // pointerId -> {btn,key}
function hideStick() { if (stick) stick.style.display = 'none'; if (knob) knob.style.transform = ''; }
function releaseStick() { stickId = null; stickType = ''; sc = null; core.release('stick'); hideStick(); }
function releaseButtons() { btnHold.forEach(h => h.btn.classList.remove('on')); btnHold.clear(); core.release('btn:'); }
// Release every on-screen touch input (stick + buttons). Called on blur/hide/pause/menu/stage/cutscene transitions.
function releaseTouch() { releaseStick(); releaseButtons(); }
function releaseAll() { releaseTouch(); core.release(''); }
export const input = {
  poll() { pollPad(); watchdog(); },
  down, pressed, releaseAll, releaseTouch, core,
  axis() { return { x: (down.right ? 1 : 0) - (down.left ? 1 : 0), y: (down.down ? 1 : 0) - (down.up ? 1 : 0) }; },
  take(k) { const v = !!pressed[k]; pressed[k] = false; return v; },
  anyPress() { const v = Object.keys(pressed).some(k => pressed[k]); for (const k in pressed) pressed[k] = false; return v; },
};
// Watchdog: browsers (esp. iOS Safari with system gestures / app switcher / notifications) can drop touchend+pointerup.
// event.touches is the ground truth of fingers on screen; if it says 0 (and it has been 0 for a few frames), nothing touch-driven may be held.
function watchdog() {
  if (touchCount > 0 || performance.now() - lastTouchT < 80) return;
  if (stickId !== null && stickType === 'touch') releaseStick();
  btnHold.forEach((h, id) => { if (h.type === 'touch') dropBtn(id); });
}
function onTouch(e) { touchCount = e.touches ? e.touches.length : 0; lastTouchT = performance.now(); if (touchCount === 0) { if (stickType === 'touch') releaseStick(); btnHold.forEach((h, id) => { if (h.type === 'touch') dropBtn(id); }); } }
['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(t => addEventListener(t, onTouch, { capture: true, passive: true }));
// stop iOS pinch / gesture zoom, double-tap zoom, and long-press selection
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => addEventListener(t, e => e.preventDefault(), { passive: false }));
addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
addEventListener('selectstart', e => e.preventDefault());
addEventListener('dragstart', e => e.preventDefault());
// any pointer ending anywhere (even outside the element/window) releases whatever it held
function endPointer(e) { if (e.pointerId === stickId) releaseStick(); const h = btnHold.get(e.pointerId); if (h) dropBtn(e.pointerId); }
function dropBtn(id) { const h = btnHold.get(id); if (!h) return; btnHold.delete(id); core.set('btn:' + id, h.key, false); let still = false; btnHold.forEach(x => { if (x.btn === h.btn) still = true; }); if (!still) h.btn.classList.remove('on'); }
addEventListener('pointerup', endPointer, true); addEventListener('pointercancel', endPointer, true);
addEventListener('lostpointercapture', endPointer, true);
addEventListener('blur', releaseAll); addEventListener('pagehide', releaseAll);
document.addEventListener('visibilitychange', releaseAll);
addEventListener('contextmenu', e => { e.preventDefault(); releaseTouch(); });
document.addEventListener('mouseleave', () => { /* mouse left the window: nothing to do, pointerup on window still fires with capture */ });

// ---- floating stick (appears under the left thumb) ----
function stickMove(e) {
  const dx = e.clientX - sc.x, dy = e.clientY - sc.y, r = 40, d = Math.hypot(dx, dy) || 1, m = Math.min(d, r);
  knob.style.transform = `translate(${(dx / d) * m}px,${(dy / d) * m}px)`;
  const f = stickDirs(dx, dy); for (const k in f) core.set('stick', k, f[k]);
}
if (zone) {
  zone.addEventListener('pointerdown', e => {
    if (stickId !== null) releaseStick(); // a new finger always wins over a possibly-stale old one
    const cut = document.body.classList.contains('cutscene');
    if (cut && e.clientY < innerHeight * 0.2 && e.clientX > innerWidth * 0.72) { pressed.skip = true; e.preventDefault(); return; } // story: tap SKIP (top right)
    stickId = e.pointerId; stickType = e.pointerType; try { zone.setPointerCapture(e.pointerId); } catch (_) {} sc = { x: e.clientX, y: e.clientY };
    stick.style.display = 'block'; stick.style.left = sc.x + 'px'; stick.style.top = sc.y + 'px'; knob.style.transform = '';
    if (!document.body.classList.contains('playing')) pressed.start = true; // menus: tap anywhere
    stickMove(e); e.preventDefault();
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === stickId) { if (e.buttons === 0 && e.pointerType === 'mouse') releaseStick(); else stickMove(e); } });
}
// first tap: go fullscreen where the browser allows it (not iPhone Safari; there, Add to Home Screen hides the toolbar)
let fsTried = false;
addEventListener('pointerdown', e => {
  if (fsTried || e.pointerType !== 'touch') return; fsTried = true;
  const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen;
  if (f) { try { const r = f.call(el); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (_) {}
}, true);
document.querySelectorAll('[data-btn]').forEach(b => {
  const k = b.dataset.btn;
  b.addEventListener('pointerdown', e => { btnHold.set(e.pointerId, { btn: b, key: k, type: e.pointerType }); core.set('btn:' + e.pointerId, k, true); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
});
