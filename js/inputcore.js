// Pure input state machine (no DOM) so it can be unit-tested.
// Every physical source (keyboard, gamepad, touch stick, each on-screen button/finger) holds keys under its own
// source id; `down[k]` is true while ANY source holds k. Releasing a source can therefore never leave a key stuck,
// and one source letting go can never cancel another (e.g. keyboard A vs. touch stick).
export function createCore() {
  const holders = {}, down = {}, pressed = {};
  const recompute = k => { const h = holders[k], v = !!(h && h.size); if (v && !down[k]) pressed[k] = true; down[k] = v; };
  return {
    down, pressed, holders,
    set(src, k, v) { const h = holders[k] || (holders[k] = new Set()); if (v) h.add(src); else h.delete(src); recompute(k); },
    // release every key held by sources whose id starts with `prefix` ('' = everything)
    release(prefix = '') { for (const k in holders) { for (const s of [...holders[k]]) if (String(s).startsWith(prefix)) holders[k].delete(s); recompute(k); } },
    held(prefix = '') { const out = []; for (const k in holders) for (const s of holders[k]) if (String(s).startsWith(prefix)) out.push([s, k]); return out; },
    anyDown() { return Object.keys(down).some(k => down[k]); },
  };
}
// stick vector -> direction flags (dead zone th px, release hysteresis when `prev` is passed)
// The minor axis only counts once it is at least half the major one, so a slightly off-axis thumb walks straight along the lane instead of drifting up/down; real diagonals (>~27deg) still work.
// A direction that is already held stays held until the stick returns to 55% of the engage threshold, so a thumb resting on the edge of the dead zone doesn't flicker idle/walk.
export function stickDirs(dx, dy, th = 16, bias = 0.5, prev = null) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const thX = prev && (prev.left || prev.right) ? th * 0.55 : th;
  const thY = prev && (prev.up || prev.down) ? th * 0.55 : th;
  const X = ax >= thX && (ax >= ay ? true : ax >= ay * bias), Y = ay >= thY && (ay >= ax ? true : ay >= ax * bias);
  return { left: X && dx < 0, right: X && dx > 0, up: Y && dy < 0, down: Y && dy > 0 };
}
