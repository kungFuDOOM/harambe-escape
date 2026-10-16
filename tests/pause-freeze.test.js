// Source-level guard (the real behavioural check is tools/qa-pause-freeze.py, run in headless Chrome):
// while paused, step() must return before advancing the shared animation clock G.t.
import test from 'node:test'; import assert from 'node:assert'; import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
test('paused play step returns before G.t advances', () => {
  const body = src.slice(src.indexOf('function step(dt)'));
  const guard = body.indexOf("G.mode === 'play' && G.paused"), adv = body.indexOf('G.t += dt');
  assert.ok(guard > 0 && adv > guard, 'pause guard must precede G.t += dt');
});
test('hiding the tab auto-pauses and resets the frame clock', () => {
  const l = src.slice(src.indexOf("document.addEventListener('visibilitychange'")).split('\n')[0];
  assert.match(l, /openPause\(\)/); assert.match(l, /last = performance\.now\(\)/);
});
