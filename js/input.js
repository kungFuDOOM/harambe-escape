// Keyboard + touch input. `down` = held, `pressed` = edge since last poll.
const down = {}, pressed = {};
const MAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  j: 'atk', J: 'atk', z: 'atk', Z: 'atk', k: 'heavy', K: 'heavy', x: 'heavy', X: 'heavy', ' ': 'jump', c: 'jump', C: 'jump', l: 'special', L: 'special', v: 'special', V: 'special',
  Enter: 'start', p: 'start', P: 'start', m: 'mute', M: 'mute', Escape: 'start' };
function set(k, v) { if (v && !down[k]) pressed[k] = true; down[k] = v; }
addEventListener('keydown', e => { const k = MAP[e.key]; if (k) { set(k, true); e.preventDefault(); } });
addEventListener('keyup', e => { const k = MAP[e.key]; if (k) set(k, false); });
addEventListener('blur', () => { for (const k in down) down[k] = false; });

export const input = {
  down, pressed,
  axis() { return { x: (down.right ? 1 : 0) - (down.left ? 1 : 0), y: (down.down ? 1 : 0) - (down.up ? 1 : 0) }; },
  take(k) { const v = !!pressed[k]; pressed[k] = false; return v; },
  anyPress() { const v = Object.keys(pressed).some(k => pressed[k]); for (const k in pressed) pressed[k] = false; return v; },
};

// ---- touch ----
const stick = document.getElementById('stick'), knob = document.getElementById('knob');
let stickId = null, sc = null;
function stickMove(e) {
  const dx = e.clientX - sc.x, dy = e.clientY - sc.y, r = 46, d = Math.hypot(dx, dy) || 1, m = Math.min(d, r);
  knob.style.transform = `translate(${(dx / d) * m}px,${(dy / d) * m}px)`;
  const th = 12; set('left', dx < -th); set('right', dx > th); set('up', dy < -th); set('down', dy > th);
}
if (stick) {
  stick.addEventListener('pointerdown', e => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); const b = stick.getBoundingClientRect(); sc = { x: b.left + b.width / 2, y: b.top + b.height / 2 }; stickMove(e); e.preventDefault(); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
  const end = e => { if (e.pointerId !== stickId) return; stickId = null; knob.style.transform = ''; ['left', 'right', 'up', 'down'].forEach(k => set(k, false)); };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
}
document.querySelectorAll('[data-btn]').forEach(b => {
  const k = b.dataset.btn;
  b.addEventListener('pointerdown', e => { set(k, true); b.classList.add('on'); b.setPointerCapture(e.pointerId); e.preventDefault(); });
  const up = () => { set(k, false); b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
});
addEventListener('contextmenu', e => e.preventDefault());
