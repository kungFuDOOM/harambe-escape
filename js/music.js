// Original procedural music: percussion-driven tropical grooves (congas, bongos, shaker, clave), marimba / steel-drum / pan-flute voices and
// funky syncopated bass, all synthesised with WebAudio. Nothing here is transcribed from any existing game; every hook is composed for this one.
// The engine is renderer-agnostic: `voices(ctx, bus, noiseBuf)` builds the instruments, `playStep` schedules one 16th-note step of a track at an
// absolute time, so the live player (audio.js) and the offline WAV renderer (tools/render-music.mjs / tests) share exactly the same code.
export const SCALES = { ion: [0, 2, 4, 5, 7, 9, 11], mix: [0, 2, 4, 5, 7, 9, 10], dor: [0, 2, 3, 5, 7, 9, 10], min: [0, 2, 3, 5, 7, 8, 10], phr: [0, 1, 3, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9, 12, 14] };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
/** Scale degree (any integer, 7 = next octave) -> midi note. */
export const degNote = (root, scale, d) => root + 12 * Math.floor(d / 7) + SCALES[scale][((d % 7) + 7) % 7];

export function voices(c, bus, nb) {
  const env = (g, t, a, peak, dur) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.02, dur)); };
  const osc = (type, f, t, dur, peak, a = 0.004, dest = bus, detune = 0) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; o.detune.value = detune; env(g, t, a, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; };
  const noise = (t, dur, peak, type, freq, q = 1, dest = bus, a = 0.002) => { const s = c.createBufferSource(); s.buffer = nb; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); env(g, t, a, peak, dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.2); s.stop(t + dur + 0.03); };
  const drop = (f0, f1, t, dur, peak, type = 'sine') => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5); env(g, t, 0.002, peak, dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05); };
  const lp = (freq, dest = bus) => { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.connect(dest); return f; };
  return {
    kick: (t, v = 1) => { drop(130, 46, t, 0.22, 0.9 * v); noise(t, 0.02, 0.12 * v, 'lowpass', 900); },
    tom: (t, f, v = 1) => drop(f * 1.5, f, t, 0.3, 0.55 * v),
    snare: (t, v = 1) => { noise(t, 0.16, 0.42 * v, 'bandpass', 2200, 0.8); drop(240, 150, t, 0.1, 0.3 * v, 'triangle'); },
    conga: (t, kind, v = 1) => { // l = low open, h = high open, s = slap, t = soft tip
      const f = { l: 190, h: 270, s: 300, t: 300 }[kind] || 230, vol = kind === 't' ? 0.2 : kind === 's' ? 0.5 : 0.4;
      drop(f * 1.18, f, t, kind === 's' ? 0.09 : 0.2, vol * v); if (kind === 's') noise(t, 0.05, 0.28 * v, 'bandpass', 2600, 1.2); },
    bongo: (t, hi, v = 1) => { const f = hi ? 430 : 330; drop(f * 1.12, f, t, 0.11, 0.34 * v); noise(t, 0.03, 0.12 * v, 'bandpass', 3200, 1); },
    shaker: (t, acc = false, v = 1) => noise(t, acc ? 0.06 : 0.035, (acc ? 0.15 : 0.08) * v, 'highpass', 6500, 0.7, bus, 0.004),
    hat: (t, v = 1) => noise(t, 0.03, 0.1 * v, 'highpass', 8500),
    clave: (t, v = 1) => { osc('sine', 2150, t, 0.07, 0.22 * v, 0.001); osc('sine', 3200, t, 0.04, 0.08 * v, 0.001); },
    wood: (t, hi, v = 1) => { osc('triangle', hi ? 1200 : 820, t, 0.06, 0.24 * v, 0.001); },
    bass: (t, f, dur, v = 1, bright = 900) => { const flt = lp(bright * 1.6), o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; flt.frequency.setValueAtTime(bright * 1.8, t); flt.frequency.exponentialRampToValueAtTime(Math.max(160, bright * 0.25), t + dur);
      env(g, t, 0.004, 0.46 * v, dur); o.connect(g); g.connect(flt); o.start(t); o.stop(t + dur + 0.05); osc('sine', f, t, dur, 0.34 * v, 0.004); },
    marimba: (t, f, dur = 0.4, v = 1) => { osc('sine', f, t, dur, 0.34 * v, 0.002); osc('sine', f * 4, t, 0.07, 0.17 * v, 0.001); osc('sine', f * 9.2, t, 0.03, 0.05 * v, 0.001); },
    steel: (t, f, dur = 0.7, v = 1) => { osc('sine', f, t, dur, 0.26 * v, 0.003); osc('sine', f * 2.004, t, dur * 0.8, 0.16 * v, 0.003); osc('sine', f * 3.01, t, dur * 0.35, 0.07 * v, 0.003); osc('triangle', f * 0.5, t, dur * 0.5, 0.06 * v, 0.003); },
    pan: (t, f, dur = 0.5, v = 1) => { const g = c.createGain(), o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(); o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5.2; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3 * v, t + 0.07); g.gain.setValueAtTime(0.3 * v, t + Math.max(0.08, dur - 0.1)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.12); lfo.start(t); lfo.stop(t + dur + 0.12);
      noise(t, dur + 0.05, 0.1 * v, 'bandpass', f * 2, 14, bus, 0.05); osc('triangle', f * 2, t, dur * 0.7, 0.04 * v, 0.06); },
    pad: (t, notes, dur, v = 1) => { const flt = lp(1100); for (const m of notes) { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = mtof(m); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * v, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(flt); o.start(t); o.stop(t + dur + 0.05); } },
    stab: (t, notes, v = 1) => { const flt = lp(2400); for (const m of notes) { const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = mtof(m); env(g, t, 0.003, 0.07 * v, 0.14); o.connect(g); g.connect(flt); o.start(t); o.stop(t + 0.2); } },
    saw: (t, f, dur, v = 1) => { const flt = lp(2600); osc('sawtooth', f, t, dur, 0.13 * v, 0.01, flt); osc('sawtooth', f, t, dur, 0.1 * v, 0.01, flt, 9); },
  };
}

const row = s => [...s];           // pattern string -> chars; '.' = rest
const NOTE = (d, len = 2) => [d, len];

// ---------------------------------------------------------------------------------------------------- track data
// Each track: 8 bars of 16 steps. prog = chord root scale-degree per bar. mel = four 2-bar phrases [step(0-31), scale degree, length in steps].
// perc strings are one bar; fills replace the last bar's conga. bassA plays on bars 1-3 of every 4, bassB on bar 4: [step, semitones above chord root, steps].
export const TRACKS = {
  title: { tempo: 110, key: 57, scale: 'mix', prog: [0, 3, 0, 4, 0, 3, 4, 0], lead: 'steel', ctr: 'marimba',
    kick: 'x.....x...x.....', conga: 'l..h..l.h.l.h..s', bongo: '..b..B.b..b..B.b', shaker: 'xxXxxxXxxxXxxxXx', wood: 'x..x..x...x.x...',
    bassA: [[0, 0, 3], [4, 0, 2], [6, 7, 2], [8, 0, 3], [12, 12, 2], [14, 10, 2]], bassB: [[0, 0, 3], [4, 0, 2], [6, 5, 2], [8, 7, 3], [12, 4, 2], [14, 2, 2]], stab: '..x...x...x...x.',
    mel: [[[0, 4, 2], [2, 5, 1], [3, 7, 3], [6, 5, 2], [8, 4, 2], [10, 2, 2], [12, 4, 4], [16, 7, 2], [18, 9, 2], [20, 7, 3], [23, 5, 1], [24, 4, 2], [26, 5, 2], [28, 2, 4]],
      [[0, 2, 2], [2, 4, 2], [4, 5, 2], [6, 7, 2], [8, 9, 4], [12, 7, 2], [14, 5, 2], [16, 4, 3], [19, 2, 1], [20, 4, 2], [22, 5, 2], [24, 7, 6]],
      [[0, 7, 2], [2, 9, 1], [3, 11, 3], [6, 9, 2], [8, 7, 2], [10, 5, 2], [12, 7, 4], [16, 4, 2], [18, 5, 2], [20, 7, 4], [24, 9, 2], [26, 7, 2], [28, 5, 4]],
      [[0, 9, 2], [2, 7, 2], [4, 5, 2], [6, 4, 2], [8, 5, 3], [11, 4, 1], [12, 2, 4], [16, 4, 2], [18, 5, 2], [20, 4, 2], [22, 2, 2], [24, 0, 8]]] },
  // 1: zoo - sunny major, marimba lead, steel-drum offbeat comping
  stage0: { tempo: 120, key: 60, scale: 'ion', prog: [0, 5, 3, 4, 0, 5, 3, 4], lead: 'marimba', ctr: 'steel',
    kick: 'x.....x...x.....', conga: 'l..h..l.h.l.h..s', bongo: '..b..b.b..b..b.b', shaker: 'xxXxxxXxxxXxxxXx', wood: 'x..x..x...x.x...',
    bassA: [[0, 0, 3], [4, 0, 2], [6, 7, 2], [8, 0, 3], [12, 12, 2], [14, 7, 2]], bassB: [[0, 0, 3], [4, 0, 2], [6, 5, 2], [8, 7, 3], [12, 4, 2], [14, 2, 2]], stab: '..x...x...x...x.',
    mel: [[[0, 4, 2], [2, 5, 1], [3, 7, 3], [6, 5, 2], [8, 4, 2], [10, 2, 2], [12, 4, 4], [16, 7, 2], [18, 9, 2], [20, 7, 3], [23, 5, 1], [24, 4, 2], [26, 5, 2], [28, 2, 4]],
      [[0, 2, 2], [2, 4, 2], [4, 5, 2], [6, 7, 2], [8, 9, 4], [12, 7, 2], [14, 5, 2], [16, 4, 3], [19, 2, 1], [20, 4, 2], [22, 5, 2], [24, 7, 6]],
      [[0, 7, 2], [2, 9, 1], [3, 11, 3], [6, 9, 2], [8, 7, 2], [10, 5, 2], [12, 7, 4], [16, 4, 2], [18, 5, 2], [20, 7, 4], [24, 9, 2], [26, 7, 2], [28, 5, 4]],
      [[0, 9, 2], [2, 7, 2], [4, 5, 2], [6, 4, 2], [8, 5, 3], [11, 4, 1], [12, 2, 4], [16, 4, 2], [18, 5, 2], [20, 4, 2], [22, 2, 2], [24, 0, 8]]] },
  // 2: street - dorian funk, bongo groove, muted stabs
  stage1: { tempo: 106, key: 50, scale: 'dor', prog: [0, 0, 3, 0, 0, 4, 3, 0], lead: 'steel', ctr: 'marimba',
    kick: 'x..x....x..x..x.', conga: '.h.l..t.h..l.t.s', bongo: 'b..b.b..b.b..b.b', shaker: 'x.x.xXx.x.x.xXx.', wood: '..x...x...x.....',
    bassA: [[0, 0, 2], [3, 0, 1], [5, 7, 2], [8, 0, 2], [10, 3, 2], [12, 5, 1], [14, 7, 2]], bassB: [[0, 0, 2], [3, 0, 1], [5, 10, 2], [8, 7, 2], [10, 5, 2], [12, 3, 2], [14, 0, 2]], stab: 'x..x..x..x.x....',
    mel: [[[0, 7, 1], [2, 9, 2], [5, 7, 1], [6, 4, 2], [8, 5, 3], [12, 4, 1], [13, 2, 3], [16, 7, 1], [18, 9, 2], [21, 11, 2], [24, 9, 2], [26, 7, 2], [28, 4, 4]],
      [[0, 4, 2], [3, 4, 1], [4, 5, 2], [7, 7, 2], [10, 5, 2], [12, 4, 4], [16, 2, 2], [19, 4, 2], [22, 5, 2], [24, 7, 3], [28, 9, 4]],
      [[0, 11, 1], [2, 9, 2], [5, 7, 1], [6, 9, 2], [8, 11, 3], [12, 9, 1], [13, 7, 3], [16, 5, 2], [18, 7, 2], [21, 9, 2], [24, 7, 2], [26, 5, 2], [28, 4, 4]],
      [[0, 9, 2], [3, 7, 2], [6, 5, 2], [8, 4, 4], [14, 2, 2], [16, 4, 2], [19, 5, 2], [22, 4, 2], [24, 2, 8]]] },
  // 3: office - ticking woodblock, staccato marimba, minor-pentatonic bounce
  stage2: { tempo: 126, key: 55, scale: 'min', prog: [0, 0, 5, 4, 0, 0, 5, 6], lead: 'marimba', ctr: 'pan',
    kick: 'x...x...x..x.x..', conga: '..h.l...h.l.h..t', bongo: '..b..b..b..b..b.', shaker: 'x.x.x.x.x.x.xXxx', wood: 'x.xx.x.xx.x.xx.x', clave: true,
    bassA: [[0, 0, 1], [2, 0, 1], [4, 7, 1], [6, 0, 1], [8, 0, 1], [10, 12, 1], [12, 7, 1], [14, 5, 1]], bassB: [[0, 0, 1], [2, 0, 1], [4, 3, 1], [6, 5, 1], [8, 7, 1], [10, 5, 1], [12, 3, 1], [14, 2, 1]], stab: '....x.......x...',
    mel: [[[0, 7, 1], [1, 7, 1], [3, 9, 1], [4, 7, 2], [8, 4, 1], [9, 5, 1], [10, 7, 2], [12, 4, 2], [16, 7, 1], [17, 9, 1], [19, 11, 1], [20, 9, 2], [24, 7, 1], [25, 5, 1], [26, 4, 2], [28, 2, 4]],
      [[0, 4, 1], [2, 5, 1], [4, 7, 2], [8, 9, 2], [10, 7, 1], [11, 5, 1], [12, 4, 2], [16, 2, 2], [18, 4, 1], [20, 5, 2], [24, 4, 2], [28, 7, 4]],
      [[0, 9, 1], [1, 9, 1], [3, 11, 1], [4, 9, 2], [8, 7, 1], [9, 9, 1], [10, 11, 2], [12, 9, 2], [16, 11, 1], [17, 12, 1], [19, 11, 1], [20, 9, 2], [24, 7, 2], [26, 5, 2], [28, 4, 4]],
      [[0, 7, 2], [2, 5, 1], [3, 4, 1], [4, 2, 2], [8, 4, 2], [10, 5, 2], [12, 7, 4], [16, 5, 2], [18, 4, 2], [20, 2, 2], [22, 0, 2], [24, 0, 8]]] },
  // 4: base - phrygian, low drums, pan-flute lead
  stage3: { tempo: 134, key: 52, scale: 'phr', prog: [0, 0, 1, 0, 0, 5, 1, 0], lead: 'pan', ctr: 'marimba', drums: true,
    kick: 'x..x..x.x..x..x.', conga: 'l.l...l.l..l.l..', bongo: '..b...b...b..b..', shaker: 'x.x.x.x.x.x.x.x.', wood: '..x...x...x...x.',
    bassA: [[0, 0, 2], [2, 0, 1], [4, 0, 2], [6, 1, 2], [8, 0, 2], [10, 0, 1], [12, 7, 2], [14, 5, 2]], bassB: [[0, 0, 2], [2, 0, 1], [4, 0, 2], [6, 1, 2], [8, 3, 2], [10, 1, 1], [12, 0, 2], [14, -2, 2]], stab: '..x.....x.......',
    mel: [[[0, 7, 4], [4, 8, 2], [6, 7, 2], [8, 5, 4], [12, 4, 2], [14, 3, 2], [16, 4, 4], [20, 5, 2], [22, 7, 2], [24, 8, 6]],
      [[0, 7, 2], [2, 8, 2], [4, 10, 4], [8, 8, 2], [10, 7, 2], [12, 5, 4], [16, 3, 3], [19, 4, 1], [20, 5, 4], [24, 4, 8]],
      [[0, 10, 4], [4, 11, 2], [6, 10, 2], [8, 8, 4], [12, 7, 2], [14, 5, 2], [16, 7, 4], [20, 8, 2], [22, 10, 2], [24, 11, 6]],
      [[0, 10, 2], [2, 8, 2], [4, 7, 4], [8, 5, 2], [10, 4, 2], [12, 3, 4], [16, 4, 4], [20, 3, 2], [22, 1, 2], [24, 0, 8]]] },
  // 5: jungle - the big tropical groove: pan flute + marimba, busy hand drums
  stage4: { tempo: 128, key: 57, scale: 'mix', prog: [0, 3, 4, 0, 0, 3, 4, 3], lead: 'pan', ctr: 'marimba',
    kick: 'x.....x...x..x..', conga: 'l.hl.hl.h.hl.hs.', bongo: '.bB.b.B..bB.b.Bb', shaker: 'xxXxxxXxxxXxxxXx', wood: 'x..x..x...x.x...',
    bassA: [[0, 0, 2], [3, 0, 1], [4, 7, 2], [7, 5, 1], [8, 0, 2], [11, 12, 1], [12, 10, 2], [14, 7, 2]], bassB: [[0, 0, 2], [3, 0, 1], [4, 7, 2], [7, 5, 1], [8, 4, 2], [10, 5, 2], [12, 7, 2], [14, 9, 2]], stab: '.x..x..x..x..x..',
    mel: [[[0, 4, 3], [3, 7, 1], [4, 9, 4], [8, 7, 2], [10, 5, 2], [12, 4, 4], [16, 5, 3], [19, 7, 1], [20, 9, 2], [22, 11, 2], [24, 9, 4], [28, 7, 4]],
      [[0, 7, 2], [2, 9, 2], [4, 11, 4], [8, 9, 2], [10, 7, 2], [12, 9, 4], [16, 7, 3], [19, 5, 1], [20, 4, 4], [24, 2, 3], [27, 4, 1], [28, 5, 4]],
      [[0, 9, 3], [3, 11, 1], [4, 12, 4], [8, 11, 2], [10, 9, 2], [12, 7, 4], [16, 9, 3], [19, 7, 1], [20, 5, 2], [22, 7, 2], [24, 9, 4], [28, 11, 4]],
      [[0, 12, 2], [2, 11, 2], [4, 9, 4], [8, 7, 2], [10, 9, 2], [12, 7, 4], [16, 5, 2], [18, 4, 2], [20, 2, 4], [24, 0, 8]]] },
};
for (const k of Object.keys(TRACKS)) TRACKS[k].name = k;

/** Boss version of a stage track: faster, snare + hats on top, saw lead doubling, darker chord order (same key so it feels related). */
export function bossOf(tr) {
  return { ...tr, name: tr.name + '_boss', tempo: Math.round(tr.tempo * 1.2), boss: true, prog: tr.prog.map((d, i) => (i % 4 === 3 ? (d + 4) % 7 : d)), kick: 'x..x..x.x..x..x.', shaker: 'xxxxxxxxxxxxxxxx', lead: tr.lead === 'pan' ? 'saw' : 'marimba', ctr: 'saw' };
}
/** Bar-level mutations: fills on bar 8 and an energy lift on the second half. */
export function playStep(V, tr, step, time, o = {}) {
  const intense = !!(o.intense || tr.boss), spb = 60 / tr.tempo / 4, s = step % 128, bar = s >> 4, i = s & 15, last = bar === 7, vol = o.vol ?? 1;
  const at = time;
  // ---- percussion
  if (tr.kick[i] === 'x') V.kick(at, i === 0 ? 1 : 0.8);
  const cg = tr.conga[i]; if (cg && cg !== '.') V.conga(at, cg, intense ? 1 : 0.85);
  if (last && i >= 12) { V.tom(at, 150 + (i - 12) * 18, 0.7); } // bar-8 tom run into the loop point
  const bg = tr.bongo[i]; if (bg && bg !== '.' && (bar % 2 === 1 || intense)) V.bongo(at, bg === 'B' || (i % 4 === 2), 0.9);
  const sh = tr.shaker[i]; if (sh !== '.') V.shaker(at + (i % 2 ? spb * 0.08 : 0), sh === 'X', intense ? 1.1 : 0.8);
  const wd = tr.wood[i]; if (wd !== '.' && wd) { if (tr.clave) V.wood(at, i % 3 === 0, 0.8); else if (bar >= 2) V.clave(at, 0.7); }
  if (intense) { if (i === 4 || i === 12) V.snare(at, tr.boss ? 1 : 0.7); if (tr.boss && i % 2 === 0) V.hat(at, 0.8); if (!tr.boss && i % 4 === 2) V.hat(at, 0.7); }
  if (tr.drums && (i === 0 || i === 6 || i === 10)) V.tom(at, i === 0 ? 85 : 110, 0.8); // deep war-drum hits
  // ---- bass + harmony
  const rootDeg = tr.prog[bar], rootM = degNote(tr.key, tr.scale, rootDeg) - 24, pat = (bar & 3) === 3 ? tr.bassB : tr.bassA;
  for (const [st, semi, len] of pat) if (st === i) V.bass(at, mtof(rootM + semi), Math.max(0.1, len * spb * 0.9), intense ? 1.1 : 1, tr.scale === 'phr' ? 700 : 1100);
  if (tr.stab[i] === 'x') { const ch = [0, 2, 4].map(k => degNote(tr.key, tr.scale, rootDeg + k) + 12); if (tr.ctr === 'steel') { for (const m of ch.slice(0, 2)) V.steel(at, mtof(m), 0.45, 0.55); } else if (tr.ctr === 'saw' || intense) V.stab(at, ch, 0.9); else V.marimba(at, mtof(ch[1]), 0.3, 0.7); }
  if (i === 0) { const ch = [0, 2, 4].map(k => degNote(tr.key, tr.scale, rootDeg + k)); V.pad(at, ch, spb * 16, intense ? 0.7 : 1); }
  // ---- melody: 2-bar phrases, bars 5-8 re-voice the hook an octave up for the second pass
  const ph = tr.mel[bar >> 1], pos = ((bar & 1) << 4) | i;
  for (const [st, deg, len] of ph) if (st === pos) {
    const up = bar >= 4 ? 7 : 0, f = mtof(degNote(tr.key + 12, tr.scale, deg + up)), dur = len * spb * 0.95, lead = tr.lead, v = vol;
    if (lead === 'marimba') V.marimba(at, f, Math.min(0.6, dur + 0.15), 1 * v); else if (lead === 'steel') V.steel(at, f, Math.min(0.9, dur + 0.3), 1 * v);
    else if (lead === 'pan') V.pan(at, f, dur, 1 * v); else V.saw(at, f, dur, 1 * v);
    if (bar >= 4 || intense) { const c2 = tr.ctr, f2 = f * (bar >= 4 ? 1.5 : 1); if (c2 === 'marimba') V.marimba(at + spb * 0.02, f2 * 0.5, 0.3, 0.55 * v); else if (c2 === 'steel') V.steel(at, f2 * 0.5, 0.5, 0.5 * v); else if (c2 === 'saw') V.saw(at, f * 0.5, dur, 0.5 * v); else if (c2 === 'pan' && bar >= 4) V.pan(at, f * 0.5, dur, 0.5 * v); }
  }
}
export const STEPS_PER_LOOP = 128;
export const loopSeconds = tr => STEPS_PER_LOOP * 60 / tr.tempo / 4;

// ---------------------------------------------------------------------------------------------------- mellow generative cues (cutscenes) + jingles
/** Soft cutscene bed: slow pad chords, a few pan-flute / marimba notes picked from the scale by a seeded generator (so each cutscene is stable). */
export function playCue(V, cfg, step, time, seed) {
  const spb = 60 / cfg.tempo / 2, s = step % 64, bar = s >> 3, scale = cfg.mode === 'dorian' ? 'dor' : 'min', deg = [0, 5, 3, 4, 0, 6, 3, 4][bar];
  const r = k => { let x = (seed * 2654435761 + k * 40503 + bar * 977) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995) >>> 0; return (x % 1000) / 1000; };
  if ((s & 7) === 0) { V.pad(time, [0, 2, 4].map(k => degNote(cfg.root, scale, deg + k)), spb * 8, 1.1); V.bass(time, mtof(degNote(cfg.root, scale, deg) - 12), spb * 3, 0.55, 500); }
  if ((s & 7) === 4) V.tom(time, 90, 0.4);
  if (r(s) < 0.45) { const d = [0, 2, 4, 5, 7, 9][Math.floor(r(s + 50) * 6)] + deg, f = mtof(degNote(cfg.root + 12, scale, d)); if (r(s + 9) < 0.5) V.pan(time, f, spb * 1.6, 0.8); else V.marimba(time, f, 0.5, 0.8); }
  if ((s & 3) === 2) V.shaker(time, false, 0.5);
}
/** One-shot jingles. 'clear' is a bright marimba/steel run over a conga flourish; 'over' is a slow falling steel-drum line over a low drum. */
export function playJingle(V, name, t0) {
  if (name === 'clear') {
    const key = 60, run = [0, 2, 4, 7, 9, 7, 11, 14], sp = 0.11; run.forEach((d, i) => { const f = mtof(key + [0, 2, 4, 7, 9, 12, 14, 16][i]); V.marimba(t0 + i * sp, f, 0.4, 1); V.steel(t0 + i * sp + 0.02, f * 2, 0.5, 0.35); });
    [0, 1, 2, 3].forEach(i => V.conga(t0 + i * sp * 2, i % 2 ? 'h' : 'l', 1)); V.kick(t0, 1); const e = t0 + run.length * sp; V.steel(e, mtof(72), 1.4, 1); V.steel(e, mtof(76), 1.4, 0.8); V.steel(e, mtof(79), 1.4, 0.8); V.marimba(e, mtof(84), 0.8, 1); V.conga(e, 's', 1); V.kick(e, 1);
  } else {
    const run = [67, 65, 63, 60, 58, 55], sp = 0.26; run.forEach((m, i) => V.steel(t0 + i * sp, mtof(m), 0.8, 0.9)); V.tom(t0, 90, 1); V.tom(t0 + 0.52, 80, 0.9); V.tom(t0 + 1.04, 70, 1); V.pad(t0, [43, 46, 50], 2.6, 1.2); V.bass(t0 + run.length * sp, mtof(31), 1.2, 0.8, 400);
  }
}
