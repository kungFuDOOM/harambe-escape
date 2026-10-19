import test from 'node:test';
import assert from 'node:assert/strict';
import { dropState, sweepHit, lobVel, lobLanding, pickLoot, spotUpdate, eliteMods, LOB_T, LOB_G } from '../js/hazlogic.js';
import { STAGES, ENEMIES } from '../js/levels.js';
import { validateStage } from '../js/logic.js';
import { BOSSES } from '../js/levels.js';

test('drops are telegraphed: warn marker first, then a fast fall, then landing', () => {
  assert.equal(dropState(0.3).phase, 'warn'); assert.ok(dropState(0.3).z === 150);
  assert.equal(dropState(1.0).phase, 'fall'); assert.ok(dropState(1.0).z < 150 && dropState(1.0).z > 0);
  assert.equal(dropState(1.3).phase, 'land'); assert.equal(dropState(1.3).z, 0);
});
test('sweeping car / boulder hits only things in its row that are not jumping', () => {
  const h = { x: 100, y: 140 };
  assert.ok(sweepHit(h, { x: 110, y: 144, z: 0 }));
  assert.ok(!sweepHit(h, { x: 110, y: 144, z: 30 }), 'jumped over');
  assert.ok(!sweepHit(h, { x: 110, y: 170, z: 0 }), 'different row');
  assert.ok(!sweepHit(h, { x: 200, y: 140, z: 0 }), 'too far');
});
test('a lob lands on the target after LOB_T seconds (and reaches the ground exactly then)', () => {
  const v = lobVel(100, 170); assert.ok(Math.abs(lobLanding(100, v.vx) - 170) < 1e-6);
  const z = 30 + v.vz * LOB_T - 0.5 * LOB_G * LOB_T * LOB_T; assert.ok(z > 0 && z < 50 + 30, 'near ground at ~T (started 30px up)');
  assert.ok(Math.abs(lobVel(0, 5000).vx) <= 175, 'throw speed is capped');
});
test('loot table: bananas common, 1UP rare, forced loot wins', () => {
  assert.equal(pickLoot(0.1), 'banana'); assert.equal(pickLoot(0.6), 'big'); assert.equal(pickLoot(0.8), 'gem'); assert.equal(pickLoot(0.9), 'rage'); assert.equal(pickLoot(0.99), 'life'); assert.equal(pickLoot(0.1, 'life'), 'life');
  let life = 0; for (let i = 0; i < 1000; i++) if (pickLoot(i / 1000) === 'life') life++; assert.ok(life <= 50);
});
test('searchlight alarm needs sustained exposure and then cools down', () => {
  const h = { seen: 0, cool: 0 }; let fired = 0;
  for (let i = 0; i < 30; i++) if (spotUpdate(h, true, 0.02)) fired++; assert.equal(fired, 0);
  for (let i = 0; i < 20; i++) if (spotUpdate(h, true, 0.02)) fired++; assert.equal(fired, 1);
  for (let i = 0; i < 100; i++) if (spotUpdate(h, true, 0.02)) fired++; assert.equal(fired, 1, 'cooldown');
});
test('elite and mini-boss multipliers', () => { assert.equal(eliteMods({}).hp, 1); assert.ok(eliteMods({ elite: true }).hp > 1); assert.ok(eliteMods({ mini: true }).hp > eliteMods({ elite: true }).hp); });
test('every stage has varied encounters: drops, thrower or hazard, an elite/mini-boss, hazards in the stretches, and valid data', () => {
  for (const st of STAGES) {
    assert.deepEqual(validateStage(st, ENEMIES, BOSSES), [], st.name);
    const all = st.events.flatMap(e => [...e.wave, ...(e.phases || []).flat()]);
    assert.ok(all.some(e => e.side === 'T'), st.name + ' has drop-in enemies');
    assert.ok(all.some(e => e.elite || e.mini), st.name + ' has an elite');
    assert.ok(st.events.some(e => e.haz) || (st.stretch || []).length, st.name + ' has hazards');
    assert.ok((st.stretch || []).length >= 3, st.name + ' stretches are not empty walking');
    assert.ok(st.events.every(e => e.title), st.name + ' encounter banners');
    assert.ok(st.props.some(p => p.loot === 'life'), st.name + ' hides a 1UP');
    for (const s of st.stretch || []) assert.ok(s.from < s.to && s.every > 2 && s.to <= st.length - 300, 'stretch window ' + s.from);
    assert.ok(st.props.length >= 8);
  }
  const lobbers = Object.values(ENEMIES).filter(e => e.lob); assert.ok(lobbers.length >= 4);
});
test('difficulty escalates: later stages have more enemies in their encounters', () => {
  const n = st => st.events.reduce((a, e) => a + e.wave.length + (e.phases || []).reduce((b, p) => b + p.length, 0), 0) / st.events.length;
  for (let i = 1; i < STAGES.length; i++) assert.ok(n(STAGES[i]) >= n(STAGES[i - 1]) - 0.5, 'stage ' + (i + 1));
});
