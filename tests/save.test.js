import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEY, SAVE_VERSION, makeSave, sanitize, writeSave, readSave, clearSave } from '../js/save.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };

test('save round-trips stage, lives, score and max health', () => {
  const s = mem(); const sv = makeSave(2, { lives: 2, max: 100 }, 4321.7);
  assert.ok(writeSave(sv, s));
  const r = readSave(5, s);
  assert.deepEqual([r.v, r.stage, r.lives, r.score, r.max], [SAVE_VERSION, 2, 2, 4322, 100]);
});
test('no save, then clear removes it', () => {
  const s = mem(); assert.equal(readSave(5, s), null);
  writeSave(makeSave(1, { lives: 3, max: 100 }, 10), s); assert.ok(readSave(5, s));
  clearSave(s); assert.equal(readSave(5, s), null);
});
test('corrupt, wrong-version and out-of-range data is ignored', () => {
  const s = mem();
  for (const raw of ['{not json', 'null', '[]', '"x"', JSON.stringify({ v: 99, stage: 1, lives: 3, score: 0 }), JSON.stringify({ v: 1, stage: 9, lives: 3, score: 0 }), JSON.stringify({ v: 1, stage: -1, lives: 3, score: 0 }), JSON.stringify({ v: 1, stage: 1.5, lives: 3, score: 0 }), JSON.stringify({ v: 1, stage: 1, lives: 'x', score: 0 })]) {
    s.setItem(SAVE_KEY, raw); assert.equal(readSave(5, s), null, raw);
  }
});
test('values are clamped so a tampered save cannot give absurd stats', () => {
  const r = sanitize({ v: 1, stage: 0, lives: 999, score: -5, max: 1e9, at: 1 });
  assert.equal(r.lives, 9); assert.equal(r.score, 0); assert.equal(r.max, 999);
  assert.equal(makeSave(0, { lives: 0, max: 100 }, 0).lives, 1);
});
test('blocked storage never throws', () => {
  assert.equal(writeSave(makeSave(0, { lives: 3, max: 100 }, 0), blocked), false);
  assert.equal(readSave(5, blocked), null); assert.equal(clearSave(blocked), false);
  assert.equal(readSave(5, null === 1 ? 0 : undefined), null); // no localStorage in node
});

import { keepFurthest } from '../js/save.js';
test('keepFurthest: an older stage never overwrites a newer save', () => {
  const s = mem(); const adv = makeSave(2, { lives: 2, max: 100 }, 900), stale = makeSave(1, { lives: 3, max: 100 }, 500);
  writeSave(adv, s);
  writeSave(keepFurthest(stale, readSave(5, s)), s);
  assert.equal(readSave(5, s).stage, 2);
  writeSave(keepFurthest(makeSave(2, { lives: 1, max: 100 }, 950), readSave(5, s)), s);
  assert.deepEqual([readSave(5, s).stage, readSave(5, s).lives, readSave(5, s).score], [2, 1, 950]);
});
test('level clear then reload: Continue points at the next stage with hearts and score', () => {
  const s = mem();
  writeSave(makeSave(0, { lives: 3, max: 100 }, 0), s);
  writeSave(makeSave(1, { lives: 2, max: 120 }, 3210), s);
  writeSave(keepFurthest(makeSave(0, { lives: 2, max: 120 }, 3210), readSave(5, s)), s);
  const r = readSave(5, s);
  assert.deepEqual([r.stage, r.lives, r.max, r.score], [1, 2, 120, 3210]);
});
