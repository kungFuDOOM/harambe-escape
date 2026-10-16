import test from 'node:test';
import assert from 'node:assert/strict';
import { hitTest, comboMult, scoreFor, heal, applyBlock, validateStage, clamp } from '../js/logic.js';
import { STAGES, ENEMIES, BOSSES } from '../js/levels.js';

test('hitTest respects reach, depth and height', () => {
  const a = { x: 100, y: 140, z: 0, face: 1 };
  const box = { reach: 20, w: 16 };
  assert.ok(hitTest(a, box, { x: 122, y: 142, z: 0, w: 10 }));
  assert.ok(!hitTest(a, box, { x: 80, y: 140, z: 0, w: 10 }), 'behind');
  assert.ok(!hitTest(a, box, { x: 122, y: 170, z: 0, w: 10 }), 'wrong lane');
  assert.ok(!hitTest(a, box, { x: 122, y: 140, z: 60, w: 10 }), 'too high');
  assert.ok(hitTest({ ...a, face: -1 }, box, { x: 78, y: 140, z: 0, w: 10 }), 'facing left');
});
test('combo multiplier', () => {
  assert.equal(comboMult(1), 1);
  assert.equal(comboMult(2), 1);
  assert.equal(comboMult(6), 2);
  assert.equal(comboMult(99), 3);
  assert.equal(scoreFor(100, 6), 200);
});
test('banana heal clamps', () => {
  assert.equal(heal(90, 100, 30), 100);
  assert.equal(heal(10, 100, 30), 40);
});
test('block halves light frontal only', () => {
  assert.equal(applyBlock(10, true, true, false), 5);
  assert.equal(applyBlock(10, true, true, true), 10);
  assert.equal(applyBlock(10, true, false, false), 10);
  assert.equal(applyBlock(10, false, true, false), 10);
});
test('clamp', () => assert.equal(clamp(5, 0, 3), 3));
test('all stages valid, 5 stages, bosses unique', () => {
  assert.equal(STAGES.length, 5);
  for (const s of STAGES) assert.deepEqual(validateStage(s, ENEMIES, BOSSES), [], s.name);
  assert.equal(new Set(STAGES.map(s => s.boss)).size, 5);
});
test('validateStage catches bad data', () => {
  const bad = { name: 'x', length: 1000, boss: 'nope', events: [{ at: 500, wave: [{ t: 'zzz' }] }, { at: 100, wave: [] }] };
  assert.ok(validateStage(bad, ENEMIES, BOSSES).length >= 3);
});
