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
// stick vector -> direction flags (dead zone th px)
export function stickDirs(dx, dy, th = 12) { return { left: dx < -th, right: dx > th, up: dy < -th, down: dy > th }; }
