export class AudioBus {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (!this.noise && this.ctx) {
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.25), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
  }

  play(name: string) {
    if (this.muted || !this.ctx) return;
    if (name === "hurt") this.tone(140, 0.16, "sawtooth", 0.05, 70);
    else if (name === "ko") {
      this.tone(90, 0.22, "square", 0.05, 40);
      this.blip(0.08, 0.05);
    } else if (name === "punch") {
      this.blip(0.05, 0.07);
      this.tone(110, 0.07, "sine", 0.06);
    } else if (name === "pound") {
      this.blip(0.12, 0.09);
      this.tone(58, 0.2, "sine", 0.08, 32);
    } else if (name === "dart") this.tone(720, 0.06, "square", 0.03, 240);
    else if (name === "jump") this.tone(220, 0.08, "triangle", 0.03, 360);
    else if (name === "land") this.blip(0.04, 0.03);
    else if (name === "gate") {
      this.tone(180, 0.12, "square", 0.04, 90);
      this.blip(0.1, 0.05);
    } else if (name === "block") this.tone(160, 0.05, "square", 0.03);
    else if (name === "win") {
      [262, 330, 392, 523].forEach((freq, i) => {
        window.setTimeout(() => this.tone(freq, 0.14, "triangle", 0.04), i * 90);
      });
    } else if (name === "start") this.tone(196, 0.1, "triangle", 0.04, 320);
  }

  beat(step: number, biome: number) {
    if (this.muted || !this.ctx) return;
    const root = biome === 2 ? 41 : biome === 1 ? 55 : 49;
    if (step % 2 === 0) this.tone(root, 0.07, "sine", 0.035);
    else this.blip(0.02, 0.012);
    if (step % 8 === 4) this.tone(root * 1.5, 0.05, "triangle", 0.018);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private blip(dur: number, gain: number) {
    if (!this.ctx || !this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + dur);
  }
}
