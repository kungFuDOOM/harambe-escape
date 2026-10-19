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

import fs from 'node:fs';
const asset = p => new URL('../assets/' + p, import.meta.url);
const pngSize = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('atlas has every character and animation the game uses, and every frame lies inside its sheet', () => {
  const atlas = JSON.parse(fs.readFileSync(asset('atlas.json')));
  const need = { harambe: ['idle', 'walk', 'atk1', 'atk2', 'atk3', 'heavy', 'jump', 'jatk', 'hurt', 'down', 'special'] };
  for (const d of [...Object.values(ENEMIES), ...Object.values(BOSSES)]) need[d.sheet] = ['idle', 'walk', 'windup', 'atk', 'hurt', 'down'];
  for (const [name, anims] of Object.entries(need)) {
    const m = atlas[name]; assert.ok(m, 'character ' + name);
    assert.ok(fs.existsSync(asset(m.img)), m.img);
    const [w, h] = pngSize(asset(m.img));
    for (const a of anims) { assert.ok(m.anims[a]?.length, name + '.' + a); for (const i of m.anims[a]) assert.ok(m.frames[i], name + '.' + a + ' frame ' + i); }
    for (const f of m.frames) {
      assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= w && f.y + f.h <= h, name + ' frame outside sheet');
      assert.ok(f.ax > 0 && f.ax < f.w && f.ay === f.h, name + ' anchor must sit at the feet (bottom edge) inside the frame');
    }
  }
});
test('bosses use the multi-frame strips: walk cycle, wind-up, strike, hurt and a defeat sequence of distinct frames', () => {
  const atlas = JSON.parse(fs.readFileSync(asset('atlas.json')));
  for (const d of Object.values(BOSSES)) {
    const m = atlas[d.sheet], a = m.anims;
    assert.ok(a.walk.length >= 3, d.sheet + ' walk cycle');
    assert.ok(new Set([...a.walk, ...a.windup, ...a.atk, ...a.hurt, ...a.down]).size >= 7, d.sheet + ' distinct frames');
    assert.ok(a.down.length >= 3 && a.down[2] !== a.down[0], d.sheet + ' defeat differs from hurt');
  }
});
test('every stage has a background with sky/foreground files and a sane lane', () => {
  const bg = JSON.parse(fs.readFileSync(asset('bg/bg.json')));
  for (const s of STAGES) {
    const m = bg[s.bg]; assert.ok(m, 'bg ' + s.bg);
    assert.ok(fs.existsSync(asset(`bg/${s.bg}.webp`)));
    if (m.sky) assert.ok(fs.existsSync(asset(`bg/${s.bg}_sky.webp`)));
    if (m.fg) assert.ok(fs.existsSync(asset(`bg/${s.bg}_fg.webp`)));
    assert.ok(m.lane[0] >= 100 && m.lane[1] <= 178 && m.lane[1] - m.lane[0] >= 40, 'lane ' + s.bg);
  }
  for (const f of ['props.png', 'props.json', 'font.png', 'icon.png']) assert.ok(fs.existsSync(asset(f)), f);
  const props = JSON.parse(fs.readFileSync(asset('props.json')));
  for (const k of ['crate', 'barrel', 'banana', 'net', 'haystack', 'spark0', 'bspark5', 'dust3', 'kid_fly']) assert.ok(props[k], k);
  const ai = JSON.parse(fs.readFileSync(asset('props_ai.json'))); assert.ok(fs.existsSync(asset('props_ai.png')));
  const [pw, ph] = pngSize(asset('props_ai.png'));
  for (const k of ['kid_idle', 'kid_fly', 'kid_hay', 'crate', 'crate_broken', 'barrel', 'barrel_broken', 'banana', 'banana_big', 'heart', 'haybale']) {
    const r = ai[k]; assert.ok(r, 'AI prop ' + k); const [x, y, w, h, ax, ay] = r;
    assert.ok(x >= 0 && y >= 0 && x + w <= pw && y + h <= ph && ax > 0 && ax < w && ay === h, k + ' inside sheet, anchored bottom');
  }
});
test('difficulty ramps stage by stage and the roster matches the theme', () => {
  for (let i = 1; i < STAGES.length; i++) {
    const a = STAGES[i - 1], b = STAGES[i];
    assert.ok(b.diff.hp > a.diff.hp && b.diff.spd > a.diff.spd && b.diff.dmg > a.diff.dmg && b.diff.cd < a.diff.cd && b.diff.atk >= a.diff.atk, 'diff ' + i);
    assert.ok(BOSSES[b.boss].hp > BOSSES[a.boss].hp, 'boss hp ' + i);
    const count = s => s.events.reduce((n, e) => n + e.wave.length, 0);
    assert.ok(count(b) > count(a) * 0.95, 'enemy count ' + i);
  }
  const types = i => new Set(STAGES[i].events.flatMap(e => e.wave.map(x => x.t.split('_')[0])));
  assert.deepEqual([...types(0)], ['keeper']);
  assert.deepEqual([...types(1)].sort(), ['cop', 'keeper']);
  assert.ok(types(2).has('agent') && types(3).has('soldier'));
  assert.ok(['keeper', 'cop', 'agent', 'soldier'].every(t => types(4).has(t)), 'jungle mixes every squad');
  assert.ok(Object.values(ENEMIES).some(e => e.kind === 'ranged' && e.proj === 'net') && Object.values(ENEMIES).some(e => e.proj === 'dart') && Object.values(ENEMIES).some(e => e.proj === 'bolt'), 'nets, darts and bolts');
  assert.equal(BOSSES.boss_baron.name, 'THE BARON');
});
test('every walking character has one painted passing pose (anims.pass) that is foot-anchored and as tall as the stride it alternates with', () => {
  const atlas = JSON.parse(fs.readFileSync(asset('atlas.json')));
  for (const [name, m] of Object.entries(atlas)) {
    if (!m.anims.pass) continue;
    const f = m.frames[m.anims.pass[0]], ref = name === 'harambe' ? m.frames[24] : m.frames[Math.max(...m.anims.walk)];
    assert.equal(f.ay, f.h, name); assert.ok(Math.abs(f.h - ref.h) <= 3, name + ' passing pose must be as tall as the stride (head level, no pop): ' + f.h + ' vs ' + ref.h);
  }
});
