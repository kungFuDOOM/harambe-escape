import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SCREENS } from '../js/bgscreens.js';
const dir = new URL('../assets/props/', import.meta.url), GROUPS = ['common', 'zoo', 'street', 'office', 'base', 'jungle'];
const meta = Object.assign({}, ...GROUPS.map(g => JSON.parse(fs.readFileSync(new URL(g + '.json', dir)))));

test('painted prop atlases exist, each <= 1024px wide/<=1024 tall and total under 500 KB', () => {
  let n = 0; for (const g of GROUPS) { n += fs.statSync(new URL(g + '.webp', dir)).size; const m = JSON.parse(fs.readFileSync(new URL(g + '.json', dir))); for (const r of Object.values(m)) assert.ok(r[0] + r[2] <= 1024 && r[1] + r[3] <= 1024, g); }
  assert.ok(n < 500 * 1024, 'total ' + n);
});
test('every sprite rect is sane and sign/plaque faces sit inside their sprite', () => {
  for (const [k, r] of Object.entries(meta)) { assert.ok(r.length === 4 || r.length === 8, k); assert.ok(r[2] > 8 && r[3] > 8, k); if (r.length === 8) assert.ok(r[4] >= 0 && r[5] >= 0 && r[4] + r[6] <= r[2] && r[5] + r[7] <= r[3], k + ' face'); }
  for (const s of ['sign_s', 'sign_m', 'sign_l', 'hsign', 'diner']) assert.equal(meta[s].length, 8, s);
});
test('every code-drawn prop kind used by the screens has a painted sprite (except water/bus/lights which stay code)', () => {
  const need = { sign: ['sign_s', 'sign_m', 'sign_l'], hsign: ['hsign'], bush: ['bush_a'], tree: ['tree'], stand: ['stand_a', 'stand_b'], bench: ['bench'], lamp: ['lamp'], cone: ['cone'], dumpster: ['dumpster'], hydrant: ['hydrant'], pipe: ['pipe'], planter: ['planter'], diner: ['diner'], girders: ['girders'], barrier: ['barrier'], plant: ['plant'], seal: ['seal'], cubicle: ['cubicle_a'], cooler: ['cooler'], door: ['door_a'], glass: ['glass'], table: ['table'], flag: ['flag'], cart: ['cart'], elevator: ['elevator'], curtain: ['curtain'], gatepost: ['gatepost'], sandbags: ['sandbags3', 'sandbags4'], jeep: ['jeep'], drums: ['drum_a', 'drum_b'], tent: ['tent'], tank: ['tank'], wire: ['wire'], bunker: ['bunker'], hq: ['hq'], fern: ['fern_a'], vines: ['vine_s', 'vine_m', 'vine_l'], rocks: ['rock_a'], pillar: ['pillar_t', 'pillar_s'], totem: ['totem'], glowflower: ['flower_a', 'flower_b'] };
  const kinds = new Set(); for (const k of Object.values(SCREENS)) for (const s of k.screens) for (const l of s.lm) kinds.add(l[0]);
  for (const k of kinds) { if (k === 'bus' || k === 'ptext') continue; assert.ok(need[k], 'no sprite mapping for ' + k); for (const n of need[k]) assert.ok(meta[n], k + ' -> ' + n); }
});
test('the WELCOME sign is painted into the Entrance Plaza plate (no code-drawn sign on top)', () => { const z = SCREENS.zoo.screens[0]; assert.equal(z.plate, 'zoo-plaza'); assert.ok(!z.lm.some(l => /sign/.test(l[0]))); });
test('mirrored plate reuse: no two neighbouring screens show the same plate image (flip counts as the same image)', () => {
  for (const [kind, S] of Object.entries(SCREENS)) for (let i = 1; i < S.screens.length; i++) { const a = S.screens[i - 1], b = S.screens[i]; if (a.plate && b.plate) assert.notEqual(a.plate, b.plate, kind + ' ' + i); }
});
