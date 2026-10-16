import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CUTSCENES, MAP_NODES, MAX_CAP, typedChars, csAdvance } from '../js/story.js';
import { STAGES } from '../js/levels.js';

test('one cutscene after every stage, incl. the ending after the jungle', () => {
  assert.equal(CUTSCENES.length, STAGES.length);
  assert.equal(MAP_NODES.length, STAGES.length);
});
test('captions are short and every panel is well formed', () => {
  const atlas = JSON.parse(readFileSync(new URL('../assets/atlas.json', import.meta.url)));
  const bgs = JSON.parse(readFileSync(new URL('../assets/bg/bg.json', import.meta.url)));
  for (const c of CUTSCENES) {
    assert.ok(c.panels.length >= 3 && c.panels.length <= 4, c.title);
    for (const p of c.panels) {
      assert.ok(p.cap.length >= 1 && p.cap.length <= 2);
      for (const l of p.cap) assert.ok(l.length <= MAX_CAP, 'too long: ' + l);
      if (p.map !== undefined) assert.ok(p.map >= 0 && p.map < MAP_NODES.length - 1 || p.map === MAP_NODES.length - 1);
      else { assert.ok(bgs[p.bg], 'bg ' + p.bg); for (const a of p.actors) assert.ok(a.who === 'h' || a.who === 'kid' || atlas[a.who], 'actor ' + a.who); }
      if (p.say) assert.ok(p.say.txt.length <= 34);
    }
  }
});
test('each route has a map panel that moves one leg further', () => {
  const legs = CUTSCENES.map(c => c.panels.find(p => p.map !== undefined)?.map);
  assert.deepEqual(legs, [0, 1, 2, 3, 4]);
});
test('typewriter and advance: first tap completes text, second advances, skip ends', () => {
  assert.equal(typedChars(0, 50), 0); assert.equal(typedChars(1, 50), 48); assert.equal(typedChars(9, 50), 50);
  let s = { panel: 0, t: 0.1, done: false };
  s = csAdvance(s, 'adv', 3, 80); assert.equal(s.panel, 0); assert.ok(typedChars(s.t, 80) >= 80);
  s = csAdvance(s, 'adv', 3, 80); assert.equal(s.panel, 1); assert.equal(s.t, 0);
  s = csAdvance({ ...s, t: 9 }, 'adv', 3, 80); s = csAdvance({ ...s, t: 9 }, 'adv', 3, 80); assert.ok(s.done);
  assert.ok(csAdvance({ panel: 0, t: 0, done: false }, 'skip', 3, 80).done);
});
test('walk cycle: torso-aligned, ping-pong, no per-frame x jitter', () => {
  const a = JSON.parse(readFileSync(new URL('../assets/atlas.json', import.meta.url))).harambe;
  assert.deepEqual(a.anims.walk, [3, 4, 5, 6, 5, 4]);
  const ax = a.anims.walk.map(i => a.frames[i].ax - a.frames[i].w / 2);
  assert.ok(Math.max(...ax) - Math.min(...ax) <= 40);
});
