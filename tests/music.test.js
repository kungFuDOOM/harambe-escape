import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, bossOf, voices, playStep, playCue, playJingle, loopSeconds, degNote, SCALES } from '../js/music.js';

// A recording stand-in for the WebAudio graph so the whole score can be walked in Node.
function fakeCtx() {
  const calls = { osc: 0, noise: 0 }; const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), detune: param(), Q: param(), start() {}, stop() {}, type: '' });
  return { calls, createOscillator() { calls.osc++; return node(); }, createGain: node, createBiquadFilter: node, createBufferSource() { calls.noise++; return node(); } };
}
const NAMES = ['title', 'stage0', 'stage1', 'stage2', 'stage3', 'stage4'];
test('every track is complete: 16-step patterns, phrases inside 2 bars, 8 chords', () => {
  for (const n of NAMES) { const t = TRACKS[n]; assert.ok(t, n);
    for (const k of ['kick', 'conga', 'bongo', 'shaker', 'wood', 'stab']) assert.equal(t[k].length, 16, n + '.' + k);
    assert.equal(t.prog.length, 8); assert.equal(t.mel.length, 4); assert.ok(SCALES[t.scale]);
    for (const ph of t.mel) for (const [st, d, len] of ph) { assert.ok(st >= 0 && st < 32 && st + len <= 32 + 1 && len > 0, n + ' note ' + st); assert.ok(Number.isInteger(d)); }
    for (const [st, , len] of [...t.bassA, ...t.bassB]) assert.ok(st >= 0 && st + len <= 16 + 1);
    assert.ok(t.tempo >= 100 && t.tempo <= 140, 'tempo'); assert.ok(loopSeconds(t) > 12 && loopSeconds(t) < 22, 'loop length ' + n); }
});
test('each stage has its own sound (different key/mode/tempo/lead), boss tracks are faster and driving', () => {
  const sig = new Set(NAMES.slice(1).map(n => [TRACKS[n].tempo, TRACKS[n].key, TRACKS[n].scale].join())); assert.equal(sig.size, 5);
  for (const n of NAMES.slice(1)) { const b = bossOf(TRACKS[n]); assert.ok(b.tempo > TRACKS[n].tempo && b.boss && b.key === TRACKS[n].key); assert.equal(b.kick.length, 16); }
});
test('the score schedules notes for every step of every track (and the fight layer) without throwing, and loops on step 128', () => {
  for (const n of NAMES) for (const intense of [false, true]) { const c = fakeCtx(), V = voices(c, {}, {}); for (let s = 0; s < 256; s++) playStep(V, TRACKS[n], s, s * 0.1, { intense }); assert.ok(c.calls.osc > 500, n); }
  const c1 = fakeCtx(), c2 = fakeCtx(); for (let s = 0; s < 128; s++) { playStep(voices(c1, {}, {}), TRACKS.stage2, s, 0); playStep(voices(c2, {}, {}), TRACKS.stage2, s + 128, 0); } assert.equal(c1.calls.osc, c2.calls.osc, 'second pass == first pass');
});
test('cutscene beds and jingles run', () => {
  const c = fakeCtx(), V = voices(c, {}, {}); for (let s = 0; s < 64; s++) playCue(V, { root: 50, tempo: 80, mode: 'dorian' }, s, 0, 3); playJingle(V, 'clear', 0); playJingle(V, 'over', 0); assert.ok(c.calls.osc > 100);
});
test('degNote maps scale degrees across octaves', () => { assert.equal(degNote(60, 'ion', 0), 60); assert.equal(degNote(60, 'ion', 7), 72); assert.equal(degNote(60, 'ion', 2), 64); assert.equal(degNote(60, 'min', -1), 58); });
