// Chiptune audio, all synthesized with WebAudio (no files).
const MODES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10] };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

class Audio8 {
  constructor() { this.ctx = null; this.muted = false; this.track = null; this.timer = null; this.step = 0; this.next = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain(); this.music.gain.value = 0.35; this.music.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
    const len = this.ctx.sampleRate * 0.5; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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
  play(stage, cfg) { // cfg {root,tempo,mode} ; stage 'title' uses default
    this.stop(); if (!this.ctx) { this.pending = [stage, cfg]; return; }
    this.cfg = cfg || { root: 55, tempo: 120, mode: 'minor' }; this.step = 0; this.next = this.ctx.currentTime + 0.1;
    this.seed = (stage === 'title' ? 7 : 11 + (cfg ? cfg.root : 0)); this.melody = this.makeMelody();
    this.timer = setInterval(() => this.schedule(), 50);
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  makeMelody() {
    const m = []; let deg = 0;
    for (let bar = 0; bar < 4; bar++) for (let i = 0; i < 16; i++) {
      if (i % 4 === 0 || this.rnd() < 0.45) { deg = Math.max(-2, Math.min(9, deg + Math.floor(this.rnd() * 5) - 2)); m.push(deg); } else m.push(null);
    }
    return m;
  }
  schedule() {
    if (!this.ctx) return; const c = this.ctx, spb = 60 / this.cfg.tempo / 4, scale = MODES[this.cfg.mode], root = this.cfg.root;
    while (this.next < c.currentTime + 0.25) {
      const s = this.step % 64, t = this.next, bar = Math.floor(s / 16);
      const chordDeg = [0, 5, 3, 4][bar] % 7;
      const note = d => { const o = Math.floor(d / 7); const k = ((d % 7) + 7) % 7; return root + 12 * o + scale[k]; };
      if (s % 2 === 0) this.tone('triangle', mtof(note(chordDeg) - 12), t, spb * 1.8, 0.5, this.music);
      if (s % 4 === 2) this.tone('triangle', mtof(note(chordDeg) - 12 + 12), t, spb, 0.25, this.music);
      const md = this.melody[s]; if (md !== null && md !== undefined) this.tone('square', mtof(note(md + chordDeg) + 12), t, spb * 1.6, 0.18, this.music);
      if (s % 8 === 0) { this.noise(t, 0.12, 0.5, this.music, 120); this.tone('sine', 110, t, 0.12, 0.6, this.music, 40); }
      if (s % 8 === 4) this.noise(t, 0.1, 0.4, this.music, 1500);
      if (s % 2 === 1) this.noise(t, 0.03, 0.12, this.music, 6000);
      this.step++; this.next += spb;
    }
  }
}
export const audio = new Audio8();
