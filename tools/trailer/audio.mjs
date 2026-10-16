// Renders the trailer soundtrack offline with the game's own chiptune synth (js/audio.js), so the music and every
// punch, KO and siren are the real in-game sounds. spec = { dur, sfx: [[t, name]], music: [section], extra: [...] }.
import { openGame } from './harness.mjs';

const PAGE_RENDER = async spec => {
  const sr = 44100, off = new OfflineAudioContext(2, Math.ceil(spec.dur * sr), sr);
  let T = 0; // the synth reads ctx.currentTime as "now": point it wherever the next sound belongs
  const fake = { get currentTime() { return T; }, sampleRate: sr, destination: off.destination, state: 'running', resume() {},
    createOscillator: () => off.createOscillator(), createGain: () => off.createGain(), createBiquadFilter: () => off.createBiquadFilter(),
    createBufferSource: () => off.createBufferSource(), createBuffer: (c, n, r) => off.createBuffer(c, n, r) };
  const a = new window.__audio.constructor(), AC = window.AudioContext;
  window.AudioContext = function () { return fake; }; a.init(); window.AudioContext = AC;
  a.master.gain.value = 0.62; a.music.gain.value = spec.musicVol ?? 0.42; a.sfxBus.gain.value = spec.sfxVol ?? 0.7;
  for (const [t, name] of spec.sfx) { T = t; a.sfx(name); }

  const MODES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10] };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  for (const s of spec.music) { // same voices/pattern as Audio8.schedule, with parts switchable per section
    const bus = off.createGain(); bus.connect(a.music); bus.gain.setValueAtTime(s.vol ?? 1, s.t0);
    if (s.fadeOut) { bus.gain.setValueAtTime(s.vol ?? 1, s.t1 - s.fadeOut); bus.gain.linearRampToValueAtTime(0.0001, s.t1); }
    const spb = 60 / s.tempo / 4, scale = MODES[s.mode], root = s.root, P = s.parts || {}, prog = s.prog || [0, 5, 3, 4];
    a.seed = s.seed; const mel = a.makeMelody();
    const note = d => { const o = Math.floor(d / 7), k = ((d % 7) + 7) % 7; return root + 12 * o + scale[k]; };
    for (let st = 0, t = s.t0; t < s.t1 - 1e-6; st++, t = s.t0 + st * spb) {
      const i = (st + (s.offset || 0)) % 64, bar = Math.floor(i / 16), cd = prog[bar] % 7;
      if (P.bass !== false && i % 2 === 0) a.tone('triangle', mtof(note(cd) - 12), t, spb * 1.8, 0.5, bus);
      if (P.bass !== false && i % 4 === 2) a.tone('triangle', mtof(note(cd)), t, spb, 0.25, bus);
      if (P.mel !== false && mel[i] != null) a.tone('square', mtof(note(mel[i] + cd) + 12), t, spb * 1.6, 0.18, bus);
      if (P.arp && i % 2 === 1) a.tone('square', mtof(note(cd + [0, 2, 4, 7][(i >> 1) % 4]) + 24), t, spb * 0.9, 0.06, bus);
      if (P.kick !== false && (i % 8 === 0 || (P.drive && i % 8 === 6))) { a.noise(t, 0.12, 0.5, bus, 120); a.tone('sine', 110, t, 0.12, 0.6, bus, 40); }
      if (P.snare !== false && i % 8 === 4) a.noise(t, 0.1, 0.4, bus, 1500);
      if (P.hat !== false && i % 2 === 1) a.noise(t, 0.03, 0.12, bus, 6000);
    }
  }
  for (const e of spec.extra || []) {
    if (e.kind === 'riser') { // pitch sweep + snare roll into the logo
      const o = off.createOscillator(), g = off.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, e.t0); o.frequency.exponentialRampToValueAtTime(1200, e.t1);
      g.gain.setValueAtTime(0.0001, e.t0); g.gain.exponentialRampToValueAtTime(0.12, e.t1); g.gain.setValueAtTime(0.0001, e.t1 + 0.01);
      o.connect(g); g.connect(a.music); o.start(e.t0); o.stop(e.t1 + 0.02);
      for (let t = e.t0, k = 0; t < e.t1; k++) { const d = e.t1 - e.t0, f = (t - e.t0) / d; a.noise(t, 0.06, 0.15 + 0.35 * f, a.music, 1500); t += f < 0.5 ? d / 8 : f < 0.75 ? d / 16 : d / 32; }
    } else if (e.kind === 'chord') { // big held chord for the title
      const MOD = MODES[e.mode || 'dorian'];
      for (const [deg, oct, type, v] of [[0, -1, 'triangle', 0.5], [0, 0, 'square', 0.12], [2, 0, 'square', 0.1], [4, 0, 'square', 0.1], [0, 1, 'square', 0.08]])
        a.tone(type, mtof(e.root + 12 * oct + MOD[deg]), e.t, e.dur, v, a.music);
      a.noise(e.t, 0.6, 0.5, a.music, 200); a.tone('sine', 80, e.t, 0.5, 0.7, a.music, 30);
    } else if (e.kind === 'boom') { a.noise(e.t, 0.35, 0.6, a.music, 100); a.tone('sine', 90, e.t, 0.4, 0.8, a.music, 28); }
  }
  const buf = await off.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, out = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  const bytes = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

export async function renderAudio(spec) {
  const g = await openGame('');
  try { return Buffer.from(await g.page.evaluate(PAGE_RENDER, spec), 'base64'); } finally { await g.close(); }
}
