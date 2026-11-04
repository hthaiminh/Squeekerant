// Small synthesized sounds, started only after the player touches something.
(function (WW) {
  class Sound {
    constructor() {
      this.on = true;
      this.ctx = null;
    }
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) {
        this.ctx = null;
      }
    }
    tone(freq, dur, type = 'square', vol = 0.1, when = 0, slide = 0) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    play(name) {
      switch (name) {
        case 'coin':
          this.tone(988, 0.07, 'square', 0.05);
          this.tone(1319, 0.14, 'square', 0.05, 0.06);
          break;
        case 'bank':
          this.tone(659, 0.08, 'triangle', 0.1);
          this.tone(880, 0.08, 'triangle', 0.1, 0.07);
          this.tone(1319, 0.2, 'triangle', 0.1, 0.14);
          break;
        case 'plate':
          this.tone(1800, 0.04, 'triangle', 0.05);
          this.tone(2400, 0.05, 'triangle', 0.03, 0.03);
          break;
        case 'tap':
          this.tone(520, 0.04, 'square', 0.04);
          break;
        case 'cook':
          this.tone(220, 0.12, 'sawtooth', 0.05, 0, 140);
          this.tone(330, 0.1, 'triangle', 0.06, 0.09);
          break;
        case 'tick':
          this.tone(1500, 0.012, 'square', 0.018);
          break;
        case 'serve':
          this.tone(784, 0.06, 'square', 0.07);
          this.tone(1175, 0.1, 'square', 0.07, 0.05);
          break;
        case 'miss':
          this.tone(180, 0.16, 'sawtooth', 0.07, 0, -60);
          break;
        case 'new':
          [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.08, i * 0.08));
          break;
        case 'level':
          [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'square', 0.06, i * 0.09));
          break;
        case 'dream':
          [392, 523, 659, 784, 659, 523].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.08, i * 0.22));
          break;
        case 'wake':
          [523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, i * 0.1));
          break;
        case 'bad':
          this.tone(150, 0.14, 'square', 0.05);
          break;
        default:
          break;
      }
    }
    // Plays flavours as a chord, used when tasting.
    chord(flavours) {
      flavours.forEach((f, i) => {
        const def = WW.FLAVOURS[f];
        if (def) this.tone(def.note, 0.9, 'triangle', 0.08, i * 0.14);
      });
    }
  }
  WW.Sound = Sound;
})((globalThis.WW = globalThis.WW || {}));
