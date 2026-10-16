import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../js/levels.js';
import { SCREENS, TILE_TYPES, TILE_W, stopsOf, tileAt, lookAt, signature, screenPos } from '../js/bgscreens.js';

for (const st of STAGES) {
  const kind = st.bg, stops = stopsOf(st), S = SCREENS[kind];
  test(`${kind}: one screen look per camera stop`, () => assert.equal(S.screens.length, stops.length));
  test(`${kind}: tile sequence covers the whole stage and joins on shared plate edges (no seams)`, () => {
    const need = Math.ceil((st.length + TILE_W) / TILE_W) + 1;
    assert.ok(S.tiles.length >= need, `${S.tiles.length} tiles < ${need}`);
    for (let k = 1; k < S.tiles.length; k++) assert.equal(TILE_TYPES[S.tiles[k - 1]].end, TILE_TYPES[S.tiles[k]].start, `tile ${k - 1}->${k}`);
  });
  test(`${kind}: adjacent screens differ (look, landmarks and plate tile)`, () => {
    for (let i = 1; i < stops.length; i++) {
      assert.notEqual(signature(kind, i, stops), signature(kind, i - 1, stops), `screen ${i} == ${i - 1}`);
      const a = S.screens[i - 1], b = S.screens[i];
      assert.ok(a.name !== b.name);
      assert.notDeepEqual(a.lm.map(l => l[0] + l[1]), b.lm.map(l => l[0] + l[1]));
    }
  });
  test(`${kind}: at least 4 distinct looks, and no two neighbouring plate tiles are the same type`, () => {
    assert.ok(new Set(stops.map((_, i) => signature(kind, i, stops))).size >= Math.max(4, stops.length));
    for (let k = 1; k < S.tiles.length; k++) assert.notEqual(S.tiles[k], S.tiles[k - 1], `tile ${k} repeats ${k - 1}`);
  });
  test(`${kind}: looks blend continuously while the camera slides (no pop)`, () => {
    for (let i = 0; i < stops.length - 1; i++) {
      let prev = lookAt(kind, stops, stops[i]);
      for (let c = stops[i]; c <= stops[i + 1]; c += 2) {
        const l = lookAt(kind, stops, c), d = Math.max(...l.top.map((v, n) => Math.abs(v - prev.top[n])), ...l.bot.map((v, n) => Math.abs(v - prev.bot[n])));
        assert.ok(d < 12, `tint jumps ${d} at cam ${c}`); prev = l;
      }
      assert.deepEqual(lookAt(kind, stops, stops[i + 1]).top.map(Math.round), S.screens[i + 1].top.map(Math.round));
    }
  });
  test(`${kind}: landmarks sit inside their own screen`, () => { for (const s of S.screens) for (const l of s.lm) assert.ok(typeof l[1] === 'number' && l[1] >= -20 && l[1] <= 320); });
}
test('screenPos clamps at both ends', () => { const s = [0, 100, 300]; assert.deepEqual(screenPos(s, -5), { i: 0, j: 0, t: 0 }); assert.equal(screenPos(s, 999).i, 2); });

import fs from 'node:fs';
const META = JSON.parse(fs.readFileSync(new URL('../assets/bg/bg.json', import.meta.url)));
for (const kind of Object.keys(SCREENS)) {
  test(`${kind}: AI plates referenced by screens exist, are listed in bg.json and stay small`, () => {
    const used = SCREENS[kind].screens.filter(s => s.plate).map(s => s.plate);
    assert.deepEqual([...new Set(used)].sort(), [...(META[kind].extra || [])].sort());
    for (const p of used) assert.ok(fs.statSync(new URL(`../assets/bg/x_${p}.webp`, import.meta.url)).size < 150 * 1024, p);
  });
  test(`${kind}: neighbouring screens never both carry the same AI plate`, () => {
    const s = SCREENS[kind].screens; for (let i = 1; i < s.length; i++) if (s[i].plate) assert.ok(s[i].plate !== s[i - 1].plate);
  });
}
test('AI plate assets total under 2 MB', () => {
  let n = 0; for (const f of fs.readdirSync(new URL('../assets/bg/', import.meta.url))) if (f.startsWith('x_')) n += fs.statSync(new URL(`../assets/bg/${f}`, import.meta.url)).size;
  assert.ok(n < 2 * 1024 * 1024, n);
});

test('every AI plate has per-row haze colours for both edges (tone-matched fade, no crossfade ghosting) and sane floor lift', () => {
  const meta = JSON.parse(fs.readFileSync(new URL('../assets/bg/bg.json', import.meta.url)));
  for (const kind of Object.keys(SCREENS)) for (const s of SCREENS[kind].screens) if (s.plate) {
    const h = meta[kind].haze?.[s.plate]; assert.ok(h && h.l.length >= 16 && h.r.length === h.l.length, s.plate + ' haze');
    for (const c of [...h.l, ...h.r]) assert.ok(c.length === 3 && c.every(v => v >= 0 && v <= 255), s.plate + ' haze colour');
  }
  for (const [kind, n] of [['base', 'Airfield'], ['jungle', 'Dark Canopy']]) assert.ok(SCREENS[kind].screens.find(s => s.name === n).lift > 0.05, n + ' lift');
});
