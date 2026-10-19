// Pure rules for stage hazards, lobbed projectiles and loot (no DOM) so tests/hazards.test.js can pin them down.
export const LOB_T = 0.72, LOB_G = 360; // a lobbed object is airborne for 0.72s: long enough to see the red marker and step away

/** Falling hazard timeline: a red marker for `warn` s, then the object drops from `h0` px up over `fall` s. */
export function dropState(t, warn = 0.95, fall = 0.3, h0 = 150) {
  if (t < warn) return { phase: 'warn', z: h0, k: t / warn };
  const k = (t - warn) / fall; return k >= 1 ? { phase: 'land', z: 0, k: 1 } : { phase: 'fall', z: h0 * (1 - k * k), k };
}
/** A vehicle / boulder sweeping the lane band hits things in its row that are not jumping over it. */
export function sweepHit(h, tgt, halfLen = 28, rowDepth = 11, clearZ = 16) {
  return Math.abs(h.x - tgt.x) < halfLen + (tgt.w || 14) / 2 && Math.abs(h.y - tgt.y) < rowDepth && (tgt.z || 0) < clearZ;
}
/** Launch velocities so a lob thrown from ex lands on tx after LOB_T: vx (clamped to a throwable speed) and vz. */
export function lobVel(ex, tx, T = LOB_T, g = LOB_G, maxV = 175) {
  return { vx: Math.max(-maxV, Math.min(maxV, (tx - ex) / T)), vz: g * T / 2 };
}
/** Where a lob thrown now will touch down (x). */
export function lobLanding(ex, vx, T = LOB_T) { return ex + vx * T; }
/** Loot table for a broken crate/barrel. forced = a designated `loot` on the prop. r in [0,1). */
export function pickLoot(r, forced) {
  if (forced) return forced;
  if (r < 0.52) return 'banana'; if (r < 0.66) return 'big'; if (r < 0.88) return 'gem'; if (r < 0.96) return 'rage'; return 'life';
}
export const LOOT = { banana: { heal: 20 }, big: { heal: 50 }, gem: { score: 500 }, rage: { rage: 8 }, life: { life: 1 } };
/** Searchlight: time the hero has stood in the beam; the alarm fires once it passes `need` s. */
export function spotUpdate(h, inBeam, dt, need = 0.7) {
  h.seen = inBeam ? h.seen + dt : Math.max(0, h.seen - dt); h.cool = Math.max(0, h.cool - dt);
  if (h.seen >= need && h.cool <= 0) { h.seen = 0; h.cool = 7; return true; } return false;
}
/** Elite / mini-boss stat multipliers. */
export function eliteMods(o) { return o.mini ? { hp: 2.4, dmg: 1.2, spd: 1, pts: 3 } : o.elite ? { hp: 1.7, dmg: 1.15, spd: 1.05, pts: 2 } : { hp: 1, dmg: 1, spd: 1, pts: 1 }; }
