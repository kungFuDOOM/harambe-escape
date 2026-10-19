// Pure game rules: no DOM, no canvas. Unit-tested in tests/logic.test.js.
export const W = 320, H = 180, GROUND_TOP = 112, GROUND_BOT = 172;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Hit test in pseudo-3D. box = {x,y,z,face,reach,w,depth,height} (attacker); target {x,y,z,w}. */
export function hitTest(att, box, tgt) {
  const cx = att.x + att.face * box.reach;
  const dx = Math.abs(cx - tgt.x);
  const dy = Math.abs(att.y - tgt.y);
  const dz = Math.abs((att.z || 0) - (tgt.z || 0));
  return dx <= box.w / 2 + (tgt.w || 10) / 2 && dy <= (box.depth ?? 14) && dz <= (box.height ?? 26);
}

export function radiusTest(a, tgt, r, depth = 22) {
  return Math.abs(a.x - tgt.x) <= r && Math.abs(a.y - tgt.y) <= depth;
}

/** Combo multiplier for score: 1x up to 2 hits, then +0.25 each, capped at 3x. */
export function comboMult(n) {
  return n <= 2 ? 1 : Math.min(3, 1 + (n - 2) * 0.25);
}

export function scoreFor(base, comboCount) {
  return Math.round(base * comboMult(comboCount));
}

/** Banana healing never exceeds max. */
export function heal(hp, max, amount) {
  return Math.min(max, hp + amount);
}

/** Damage after block (cops/riot shield) — frontal light hits are halved. */
export function applyBlock(dmg, blocking, frontal, heavy) {
  if (blocking && frontal && !heavy) return Math.ceil(dmg / 2);
  return dmg;
}

/** Validate a stage definition; returns array of error strings (empty = ok). */
export function validateStage(st, enemyTypes, bossTypes) {
  const errs = [];
  if (!st.name) errs.push('no name');
  if (!(st.length > 400)) errs.push('length too short');
  let last = 0;
  for (const ev of st.events) {
    if (ev.at < last) errs.push('events out of order at ' + ev.at);
    last = ev.at;
    if (ev.at > st.length) errs.push('event beyond length');
    for (const e of ev.wave) if (!enemyTypes[e.t]) errs.push('unknown enemy ' + e.t);
    for (const ph of ev.phases || []) for (const e of ph) if (!enemyTypes[e.t]) errs.push('unknown enemy ' + e.t);
    if (ev.haz && !['drop', 'car', 'roll', 'spot'].includes(ev.haz.kind)) errs.push('unknown hazard ' + ev.haz.kind);
  }
  if (!bossTypes[st.boss]) errs.push('unknown boss ' + st.boss);
  return errs;
}
