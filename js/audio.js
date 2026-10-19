// Audio, all synthesized with WebAudio (no files): SFX here, music in js/music.js.
import { TRACKS, bossOf, voices, playStep, playCue, playJingle } from './music.js';

class Audio8 {
  constructor() { this.ctx = null; this.muted = false; this.track = null; this.timer = null; this.step = 0; this.next = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.comp = this.ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.2; this.comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.comp);
    this.music = this.ctx.createGain(); this.music.gain.value = 0.26; this.music.connect(this.master); // music sits ~6dB under the SFX bus so hits and pickups always cut through
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
    // iOS/Safari: the context starts (or falls back to) suspended/interrupted; resume it on every gesture until it runs, and play a silent buffer once to unlock output
    const unlock = () => { const c = this.ctx; if (!c) return; if (c.state !== 'running') { const r = c.resume(); if (r && r.catch) r.catch(() => {}); } if (!this.unlocked) { this.unlocked = true; try { const b = c.createBuffer(1, 1, 22050), src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); } catch (_) {} } };
    unlock(); ['pointerdown', 'touchend', 'keydown'].forEach(e => addEventListener(e, unlock, { capture: true, passive: true })); this.ctx.onstatechange = () => { if (this.ctx.state === 'interrupted') unlock(); };
    const len = this.ctx.sampleRate * 0.5; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.pending) { const [n, cf] = this.pending; this.pending = null; this.play(n, cf); } // music asked for before the first tap starts as soon as audio is unlocked
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }
  tone(type, f, t, dur, vol, bus, slide) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(t, dur, vol, bus, hp = 800) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur);
  }
  sfx(name) {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime, b = this.sfxBus;
    switch (name) {
      case 'punch': this.noise(t, 0.08, 0.5, b, 1200); this.tone('square', 220, t, 0.08, 0.25, b, 90); break;
      case 'swing': this.noise(t, 0.07, 0.15, b, 3000); break;
      case 'heavy': this.noise(t, 0.2, 0.7, b, 300); this.tone('square', 140, t, 0.2, 0.35, b, 50); break;
      case 'jump': this.tone('square', 260, t, 0.16, 0.2, b, 620); break;
      case 'land': this.noise(t, 0.06, 0.25, b, 200); break;
      case 'hurt': this.tone('sawtooth', 300, t, 0.22, 0.3, b, 90); break;
      case 'banana': [660, 880, 1320].forEach((f, i) => this.tone('square', f, t + i * 0.06, 0.1, 0.22, b)); break;
      case 'special': this.noise(t, 0.5, 0.6, b, 150); this.tone('sawtooth', 90, t, 0.5, 0.4, b, 400); this.tone('square', 60, t + 0.1, 0.4, 0.4, b, 30); break;
      case 'ko': this.tone('square', 400, t, 0.35, 0.3, b, 60); this.noise(t, 0.2, 0.4, b, 400); break;
      case 'break': this.noise(t, 0.18, 0.6, b, 500); break;
      case 'net': this.tone('triangle', 500, t, 0.25, 0.25, b, 200); break;
      case 'alert': this.tone('square', 880, t, 0.1, 0.2, b); this.tone('square', 660, t + 0.12, 0.1, 0.2, b); break;
      case 'boss': [110, 104, 98, 92].forEach((f, i) => this.tone('sawtooth', f, t + i * 0.18, 0.3, 0.35, b)); break;
      case 'go': [523, 659, 784].forEach((f, i) => this.tone('square', f, t + i * 0.08, 0.12, 0.2, b)); break;
      case 'select': this.tone('square', 880, t, 0.08, 0.2, b); this.tone('square', 1175, t + 0.07, 0.1, 0.2, b); break;
      case 'toss': this.tone('triangle', 200, t, 0.7, 0.3, b, 900); break;
      case 'flop': this.noise(t, 0.15, 0.3, b, 150); this.tone('triangle', 180, t, 0.2, 0.3, b, 60); break;
      case 'siren': for (let i = 0; i < 4; i++) this.tone('square', i % 2 ? 700 : 950, t + i * 0.22, 0.2, 0.15, b); break;
      case 'fanfare': [523, 523, 523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, t + i * 0.13, 0.2, 0.25, b)); break;
    }
  }
  // ---- music (js/music.js): original percussion-led tropical grooves, per theme. `name`: 'title' | 'stage0..4' | 'boss0..4' | 'cs0..4' (mellow cutscene bed) | 's' (resume the last one)
  play(name, cfg) {
    if (name === 's') { if (!this.last) return; [name, cfg] = this.last; }
    this.stop(); this.last = [name, cfg]; if (!this.ctx) { this.pending = [name, cfg]; return; }
    const c = this.ctx; this.pending = null;
    let tr = TRACKS[name], cue = null;
    if (!tr && /^boss\d$/.test(name)) tr = bossOf(TRACKS['stage' + name[4]]);
    if (!tr && /^cs\d$/.test(name)) cue = { cfg: cfg || { root: 50, tempo: 80, mode: 'minor' }, seed: +name[2] + 3 };
    if (!tr && !cue) tr = /^stage\d$/.test(name) ? TRACKS[name] : TRACKS.title;
    this.tr = tr; this.cue = cue; this.step = 0; this.next = c.currentTime + 0.12;
    this.tbus = c.createGain(); this.tbus.gain.value = 1; this.tbus.connect(this.music); this.V = voices(c, this.tbus, this.noiseBuf);
    this.timer = setInterval(() => this.schedule(), 40); this.schedule();
  }
  stop() { clearInterval(this.timer); this.timer = null; if (this.tbus && this.ctx) { const g = this.tbus.gain, t = this.ctx.currentTime, b = this.tbus; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.12); setTimeout(() => { try { b.disconnect(); } catch (_) {} }, 400); } this.tbus = null; this.tr = null; this.cue = null; }
  /** Fight layer: snare backbeat, hats and a doubled hook while a wave is on; calm groove otherwise. Switches on the next step, no restart. */
  setIntense(on) { this.intense = !!on; }
  /** One-shot stinger ('clear' = stage cleared, 'over' = game over). Replaces the music. */
  jingle(name) { this.stop(); this.last = null; if (!this.ctx || this.muted) return; const c = this.ctx; this.tbus = c.createGain(); this.tbus.connect(this.music); playJingle(voices(c, this.tbus, this.noiseBuf), name, c.currentTime + 0.05); }
  schedule() {
    if (!this.ctx || !this.V || (!this.tr && !this.cue)) return; const c = this.ctx;
    const spb = this.tr ? 60 / this.tr.tempo / 4 : 60 / this.cue.cfg.tempo / 2;
    while (this.next < c.currentTime + 0.3) {
      if (this.tr) playStep(this.V, this.tr, this.step, this.next, { intense: this.intense }); else playCue(this.V, this.cue.cfg, this.step, this.next, this.cue.seed);
      this.step++; this.next += spb;
    }
  }
}
export const audio = new Audio8();
