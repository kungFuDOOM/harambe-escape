import test from 'node:test';
import assert from 'node:assert/strict';
import { stepLoco, walkFrame, LOCO, WALK_FRAMES, WALK_PX } from '../js/loco.js';

const lane = { top: 124, bot: 172 };
const fresh = (over = {}) => ({ x: 40, y: 148, face: 1, state: 'idle', releaseT: 1, ...over });

test('cruise speed stays at the tuned caps and depth is slower than sideways', () => {
  const wide = { top: 0, bot: 800 }; // long enough that a 1.5s run doesn't hit the rail
  const side = fresh(), depth = fresh(), diag = fresh();
  for (let i = 0; i < 90; i++) {
    stepLoco(side, { x: 1, y: 0 }, 1 / 60, wide);
    stepLoco(depth, { x: 0, y: 1 }, 1 / 60, wide);
    stepLoco(diag, { x: 1, y: 1 }, 1 / 60, wide);
  }
  assert.ok(Math.abs(side.mvx - LOCO.vxMax) < 0.01);
  assert.equal(side.mvy, 0);
  assert.equal(side.state, 'walk');
  assert.ok(Math.abs(depth.mvy - LOCO.vyMax) < 0.01, 'mvy ' + depth.mvy);
  assert.ok(depth.mvy < side.mvx);
  assert.ok(Math.hypot(diag.mvx, diag.mvy) <= LOCO.vxMax + 0.01);
  assert.ok(diag.mvx < LOCO.vxMax && diag.mvy < LOCO.vyMax);
});

test('a one-frame stick blip does not leave idle, and a short release does not drop a walk', () => {
  const s = fresh();
  stepLoco(s, { x: 1, y: 0 }, 1 / 60, lane);
  assert.equal(s.state, 'idle');
  stepLoco(s, { x: 0, y: 0 }, 1 / 60, lane);
  assert.equal(s.state, 'idle');
  assert.ok(Math.abs(s.mvx) < 12);

  for (let i = 0; i < 30; i++) stepLoco(s, { x: 1, y: 0 }, 1 / 60, lane);
  assert.equal(s.state, 'walk');
  const wd = s.wd;
  stepLoco(s, { x: 0, y: 0 }, 1 / 60, lane);
  stepLoco(s, { x: 0, y: 0 }, 1 / 60, lane);
  assert.equal(s.state, 'walk');
  assert.ok(s.wd > wd);
});

test('releasing eases to a stop and then idle, instead of snapping', () => {
  const s = fresh();
  for (let i = 0; i < 40; i++) stepLoco(s, { x: 1, y: 0 }, 1 / 60, lane);
  const full = s.mvx;
  stepLoco(s, { x: 0, y: 0 }, 1 / 60, lane);
  assert.ok(s.mvx < full && s.mvx > full * 0.7);
  assert.equal(s.state, 'walk');
  for (let i = 0; i < 30; i++) stepLoco(s, { x: 0, y: 0 }, 1 / 60, lane);
  assert.equal(s.mvx, 0);
  assert.equal(s.state, 'idle');
});

test('walk frames advance with distance, so a slower depth step cycles slower', () => {
  const side = fresh(), depth = fresh();
  for (let i = 0; i < 60; i++) {
    stepLoco(side, { x: 1, y: 0 }, 1 / 60, lane);
    stepLoco(depth, { x: 0, y: 1 }, 1 / 60, lane);
  }
  assert.ok(side.wd > depth.wd * 1.3);
  assert.ok(walkFrame(side.wd) >= 0 && walkFrame(side.wd) < WALK_FRAMES);
  assert.ok(WALK_PX > 0);
  // one step (half a cycle) of travel lands halfway through the cycle
  const half = walkFrame(WALK_PX * (WALK_FRAMES / 2) - 1e-6);
  assert.equal(Math.floor(half), WALK_FRAMES / 2 - 1);
});

test('turning pinches through the old facing before the flip', () => {
  const s = fresh();
  for (let i = 0; i < 10; i++) stepLoco(s, { x: 1, y: 0 }, 1 / 60, lane);
  assert.equal(s.face, 1);
  stepLoco(s, { x: -1, y: 0 }, 1 / 60, lane);
  assert.equal(s.face, 1);
  assert.ok(s.turnT > LOCO.turn * 0.5);
  for (let i = 0; i < 5; i++) stepLoco(s, { x: -1, y: 0 }, 1 / 60, lane);
  assert.equal(s.face, -1);
});

test('depth movement stays inside the lane and does not keep speed against the edge', () => {
  const s = fresh({ y: 170 });
  for (let i = 0; i < 40; i++) stepLoco(s, { x: 0, y: 1 }, 1 / 60, lane);
  assert.equal(s.y, lane.bot);
  assert.equal(s.mvy, 0);
  assert.equal(s.state, 'walk');
});
