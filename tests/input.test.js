import test from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
import { createCore, stickDirs } from '../js/inputcore.js';
test('down is the OR of sources; releasing one source keeps others', () => {
  const c = createCore(); c.set('kb:a', 'left', true); c.set('stick', 'left', true);
  c.set('stick', 'left', false); assert.equal(c.down.left, true);
  c.set('kb:a', 'left', false); assert.equal(c.down.left, false);
});
test('pressed edge fires once per rising edge', () => {
  const c = createCore(); c.set('btn:1', 'atk', true); c.set('btn:2', 'atk', true); assert.equal(c.pressed.atk, true);
  c.pressed.atk = false; c.set('btn:1', 'atk', false); assert.equal(c.down.atk, true); assert.equal(c.pressed.atk, false);
});
test('two fingers on one button: stays held until both lift', () => {
  const c = createCore(); c.set('btn:1', 'jump', true); c.set('btn:2', 'jump', true);
  c.set('btn:1', 'jump', false); assert.equal(c.down.jump, true); c.set('btn:2', 'jump', false); assert.equal(c.down.jump, false);
});
test('release(prefix) clears only that family; release() clears everything', () => {
  const c = createCore(); c.set('stick', 'left', true); c.set('btn:3', 'atk', true); c.set('kb:j', 'heavy', true);
  c.release('stick'); assert.equal(c.down.left, false); assert.equal(c.down.atk, true);
  c.release('btn:'); assert.equal(c.down.atk, false); assert.equal(c.down.heavy, true);
  c.release(''); assert.equal(c.anyDown(), false);
});
test('stale stick vector cannot survive releaseAll', () => {
  const c = createCore(); const f = stickDirs(-30, 0); for (const k in f) c.set('stick', k, f[k]);
  assert.equal(c.down.left, true); c.release(''); assert.equal(c.anyDown(), false);
});
test('stickDirs dead zone', () => { assert.deepEqual(stickDirs(5, -5), { left: false, right: false, up: false, down: false }); assert.equal(stickDirs(0, 20).down, true); });
const src = readFileSync(new URL('../js/input.js', import.meta.url), 'utf8');
test('every end path is wired', () => { for (const s of ["'pointercancel'", "'lostpointercapture'", "'touchcancel'", "'visibilitychange'", "'blur'", "'gesturestart'", "'contextmenu'"]) assert.ok(src.includes(s), s); });
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
test('transitions release touch input', () => { for (const f of ['function setMode', 'function openPause', 'function startStage', 'function startCutscene', 'function resume']) { const i = main.indexOf(f); assert.match(main.slice(i, i + 120), /releaseTouch/, f); } });
test('stickDirs: slightly off-axis thumb walks straight, real diagonals still work', () => {
  assert.deepEqual(stickDirs(40, 12), { left: false, right: true, up: false, down: false });
  assert.deepEqual(stickDirs(40, 25), { left: false, right: true, up: false, down: true });
  assert.deepEqual(stickDirs(-30, -30), { left: true, right: false, up: true, down: false });
});
