// Ground locomotion for Harambe. Pure (no DOM) so the feel can be unit-tested.
// Cruise speeds match the previous tuned values: 82 px/s along the stage, 52 px/s
// between depth lanes (already slower, so changing lanes doesn't outrun the side step),
// diagonals scaled by 0.8 so they aren't faster than a straight line. Combat knockback
// and jumps keep using the separate vx/vz fields and are not touched here.
import { clamp } from './logic.js';

export const WALK_FRAMES = 8;
// Leading sole travels ~24 device px over the 4-frame plant (see tools/ai-art/build_walk.py).
// 24 device px / 3 = 8 logic px per step, spread across the frames of that step.
export const WALK_PX = (24 / 3) / (WALK_FRAMES / 2);

export const LOCO = {
  vxMax: 82,
  vyMax: 52,
  diag: 0.8,
  accel: 460,   // px/s^2, full speed in ~0.18s
  decel: 340,   // px/s^2, a stop takes ~0.24s
  stop: 7,      // below this, snap to rest
  engage: 0.05, // intent must hold this long (or speed must build) before idle becomes a walk
  release: 0.09,// and a walk doesn't drop to idle until we've been stopped at least this long
  turn: 0.11,   // squash-through-flip duration
};

const approach = (v, target, maxDelta) => {
  if (v < target) return Math.min(target, v + maxDelta);
  if (v > target) return Math.max(target, v - maxDelta);
  return v;
};

/**
 * Advance ground movement. Mutates `s` (x, y, face, state, mvx, mvy, wd, turnT, ...).
 * Only call while the actor is free to walk (idle or walk); combat owns the other states.
 * `ax` is {x, y} in -1..1. `bounds` is the depth lane {top, bot}.
 */
export function stepLoco(s, ax, dt, bounds) {
  if (s.mvx == null) s.mvx = 0;
  if (s.mvy == null) s.mvy = 0;
  if (s.wd == null) s.wd = 0;
  if (s.engageT == null) s.engageT = 0;
  if (s.releaseT == null) s.releaseT = 1;
  if (s.turnT == null) s.turnT = 0;

  const has = !!(ax.x || ax.y);
  if (has) { s.engageT += dt; s.releaseT = 0; }
  else { s.engageT = 0; s.releaseT += dt; }

  const dn = ax.x && ax.y ? LOCO.diag : 1;
  const rate = (has ? LOCO.accel : LOCO.decel) * dt;
  s.mvx = approach(s.mvx, has ? ax.x * LOCO.vxMax * dn : 0, rate);
  s.mvy = approach(s.mvy, has ? ax.y * LOCO.vyMax * dn : 0, rate);
  if (!has && Math.hypot(s.mvx, s.mvy) < LOCO.stop) { s.mvx = 0; s.mvy = 0; }

  const ox = s.x, oy = s.y;
  s.x += s.mvx * dt;
  const y2 = clamp(s.y + s.mvy * dt, bounds.top, bounds.bot);
  if ((y2 === bounds.top && s.mvy < 0) || (y2 === bounds.bot && s.mvy > 0)) s.mvy = 0;
  s.y = y2;
  const dist = Math.hypot(s.x - ox, s.y - oy);
  const speed = Math.hypot(s.mvx, s.mvy);

  const wantWalk = has ? (s.engageT >= LOCO.engage || speed > 22) : speed > LOCO.stop;
  if (s.state !== 'walk' && wantWalk) {
    // a real start (we've actually been idle) begins on the contact pose; a flicker does not get here
    if (s.releaseT > 0.12) s.wd = 0;
    s.state = 'walk';
  }
  if (s.state === 'walk') {
    s.wd += dist;
    if (!has && speed <= LOCO.stop && s.releaseT >= LOCO.release) s.state = 'idle';
  }

  // 2-frame squash: pinch through profile, flip the facing at the middle, ease back out
  if (ax.x && ax.x !== s.face && !(s.turnT > 0)) {
    s.turnT = LOCO.turn;
    s.faceTo = ax.x;
    s.turned = false;
  } else if (s.turnT > 0) {
    if (ax.x) s.faceTo = ax.x;
    s.turnT -= dt;
    if (!s.turned && s.turnT <= LOCO.turn * 0.5) {
      if (s.faceTo && s.faceTo !== s.face) s.face = s.faceTo;
      s.turned = true;
    }
    if (s.turnT < 0) s.turnT = 0;
  } else if (ax.x) s.face = ax.x;
  return s;
}

/** Walk-cycle frame for a distance travelled. `frames` defaults to the hero cycle. */
export function walkFrame(wd, px = WALK_PX, frames = WALK_FRAMES) {
  const n = frames;
  return ((wd / px) % n + n) % n;
}
