// Soft looping tunes, one for each place. Every note is made on the spot, there are no sound files.
(function (WW) {
  const NOTE = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
  const midi = (name) => {
    const m = name.match(/^([A-G]b?)(\d)$/);
    return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
  };
  const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // A chord name as notes close together around middle C, and its bass note.
  function chordOf(name) {
    const m = name.match(/^([A-G]b?)(m?)(7?)$/);
    const root = NOTE[m[1]];
    const steps = [0, m[2] ? 3 : 4, 7].concat(m[3] ? [10] : []);
    const notes = steps.map((st) => {
      let n = 60 + root + st;
      while (n > 71) n -= 12;
      return n;
    }).sort((a, b) => a - b);
    let bass = 36 + root;
    if (bass > 47) bass -= 12;
    return { notes, bass, fifth: bass + 7 };
  }

  // Tunes are written bar by bar: note:beats, with r for a rest. All of them are original.
  const TUNES = {
    // Inside: a small cafe waltz on a music box, with a plucked accompaniment.
    in: {
      bpm: 100,
      meter: 3,
      key: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
      lead: ['musicbox', 'pluck'],
      backing: 'waltz',
      vol: 1.75,
      chords: ['F', 'Dm', 'Bb', 'C7', 'F', 'Am', 'Gm', 'C7', 'Dm', 'Am', 'Bb', 'F', 'Gm', 'C7', 'F', 'F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C7', 'F', 'Bb', 'F', 'Gm', 'Dm', 'Bb', 'C7', 'F', 'F'],
      melody: [
        'C5:1 F5:1 A5:1', 'A5:2 F5:1', 'G5:1 F5:1 D5:1', 'E5:2 C5:1',
        'C5:1 F5:1 A5:1', 'C6:2 A5:1', 'Bb5:1 A5:1 G5:1', 'E5:1 G5:2',
        'A5:1 F5:1 D5:1', 'E5:1 A5:1 C6:1', 'D6:2 Bb5:1', 'A5:2 F5:1',
        'G5:1 Bb5:1 D6:1', 'C6:1 Bb5:1 G5:1', 'A5:2 F5:1', 'F5:2 r:1',
        'A5:1 G5:1 F5:1', 'F5:2 D5:1', 'E5:1 F5:1 G5:1', 'A5:2 C5:1',
        'D5:1 F5:1 A5:1', 'Bb5:2 G5:1', 'G5:1 A5:1 Bb5:1', 'A5:3',
        'D5:1 F5:1 Bb5:1', 'A5:2 F5:1', 'G5:1 Bb5:1 A5:1', 'F5:2 D5:1',
        'D5:1 F5:1 G5:1', 'E5:1 G5:1 C6:1', 'A5:2 C6:1', 'F5:2 r:1',
      ],
    },
    // Outside: a slow flute over a harp, with long notes and room to breathe.
    out: {
      bpm: 72,
      meter: 4,
      key: ['G', 'A', 'B', 'C', 'D', 'E', 'Gb'],
      lead: ['flute', 'flute'],
      backing: 'harp',
      vol: 1.05,
      chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D', 'Em', 'C', 'G', 'D', 'C', 'G', 'Am', 'D'],
      melody: [
        'B4:1 D5:1 G5:2', 'E5:3 D5:1', 'E5:1 G5:1 E5:2', 'D5:3 r:1',
        'B4:1 D5:1 G5:1 A5:1', 'B5:2 G5:2', 'A5:1 G5:1 E5:2', 'D5:3 r:1',
        'G5:1.5 A5:0.5 B5:2', 'G5:1 E5:1 G5:2', 'D5:1 G5:1 B5:2', 'A5:3 r:1',
        'G5:1 E5:1 D5:2', 'B4:1 D5:1 E5:2', 'E5:2 C5:2', 'D5:2 r:2',
      ],
      // A bird answers from the trees where the flute rests.
      birds: [[3, 3], [7, 3.25], [11, 3], [15, 2.5]],
    },
    // The street: an easy stroll with a whistle, a ukulele on the off beats and a walking bass.
    street: {
      bpm: 104,
      meter: 4,
      key: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      lead: ['whistle', 'pluck'],
      backing: 'stroll',
      vol: 1.9,
      chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'F', 'C', 'Dm', 'G', 'Em', 'Am', 'Dm', 'C'],
      melody: [
        'E5:1 G5:0.5 E5:0.5 C5:1 D5:1', 'E5:2 C5:2', 'F5:1 A5:0.5 F5:0.5 C5:1 D5:1', 'D5:2 G4:1 r:1',
        'E5:1 G5:0.5 E5:0.5 C6:1 B5:1', 'A5:2 E5:2', 'F5:1 A5:0.5 G5:0.5 F5:1 D5:1', 'G5:3 r:1',
        'A5:1 C6:0.5 A5:0.5 F5:2', 'G5:1 E5:0.5 G5:0.5 C5:2', 'D5:1 F5:0.5 A5:0.5 C6:1 A5:1', 'B5:1 G5:1 D5:1 r:1',
        'B4:1 E5:0.5 G5:0.5 B5:2', 'A5:1 C6:0.5 A5:0.5 E5:2', 'F5:1 A5:1 F5:1 D5:1', 'C5:2 G5:1 r:1',
      ],
    },
  };

  // Turns a tune into a flat list of notes. Every second time through, another voice takes the lead and it drops an octave.
  function compile(tune) {
    const beatsPerBar = tune.meter;
    const events = [];
    const add = (beat, voice, note, len, vol, pass) => events.push({ beat, voice, note, len, vol, pass });
    tune.melody.forEach((bar, b) => {
      let at = b * beatsPerBar;
      for (const token of bar.split(' ')) {
        const [name, beats] = token.split(':');
        const len = Number(beats);
        if (name !== 'r') {
          add(at, tune.lead[0], midi(name), len, 1, 0);
          add(at, tune.lead[1], midi(name) - 12, len, 0.9, 1);
        }
        at += len;
      }
    });
    tune.chords.forEach((name, b) => {
      const c = chordOf(name);
      const at = b * beatsPerBar;
      if (tune.backing === 'waltz') {
        add(at, 'bass', c.bass, 2, 0.9);
        for (const n of c.notes.slice(0, 3)) {
          add(at + 1, 'comp', n, 0.8, 0.42);
          add(at + 2, 'comp', n, 0.8, 0.34);
        }
      } else if (tune.backing === 'harp') {
        add(at, 'pad', c.notes[0], 4, 0.5);
        add(at, 'pad', c.notes[1], 4, 0.45);
        add(at, 'pad', c.notes[2], 4, 0.45);
        add(at, 'bass', c.bass, 3, 0.7);
        const arp = [c.bass + 12, c.notes[0], c.notes[1], c.notes[2], c.notes[0] + 12, c.notes[2], c.notes[1], c.notes[0]];
        arp.forEach((n, i) => add(at + i * 0.5, 'harp', n, 1, i % 4 === 0 ? 0.7 : 0.5));
      } else {
        add(at, 'bass', c.bass, 1, 0.9);
        add(at + 2, 'bass', c.fifth > 50 ? c.fifth - 12 : c.fifth, 1, 0.75);
        for (const beat of [1, 3]) {
          c.notes.slice(0, 3).forEach((n, i) => add(at + beat + i * 0.03, 'uke', n, 0.6, beat === 1 ? 0.5 : 0.42));
        }
        for (let i = 0; i < 4; i++) add(at + i + 0.5, 'shaker', 0, 0.2, 0.5);
      }
    });
    for (const [bar, beat] of tune.birds || []) add(bar * beatsPerBar + beat, 'bird', 0, 1, 1);
    events.sort((a, b) => a.beat - b.beat);
    return { events, beats: tune.chords.length * beatsPerBar, secPerBeat: 60 / tune.bpm };
  }

  // Each voice is a few plain oscillators with a soft envelope. Everything goes through a low pass, so nothing is sharp.
  function osc(ctx, type, f, t, end, out, gain) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.value = gain;
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(end);
    return o;
  }
  function envelope(ctx, t, vol, attack, hold, release, out) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    if (hold > 0) g.gain.setValueAtTime(vol, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(out);
    return g;
  }
  const VOICES = {
    musicbox(ctx, f, t, len, vol, out) {
      const end = t + 1.7;
      const g = envelope(ctx, t, 0.15 * vol, 0.006, 0, 1.6, out);
      osc(ctx, 'sine', f, t, end, g, 1);
      osc(ctx, 'sine', f * 3, t, t + 0.5, g, 0.08);
    },
    pluck(ctx, f, t, len, vol, out) {
      const g = envelope(ctx, t, 0.13 * vol, 0.006, 0, 0.9, out);
      osc(ctx, 'triangle', f, t, t + 1, g, 1);
    },
    comp(ctx, f, t, len, vol, out) {
      const g = envelope(ctx, t, 0.09 * vol, 0.008, 0, 0.5, out);
      osc(ctx, 'triangle', f, t, t + 0.6, g, 1);
    },
    harp(ctx, f, t, len, vol, out) {
      const g = envelope(ctx, t, 0.08 * vol, 0.006, 0, 1.3, out);
      osc(ctx, 'triangle', f, t, t + 1.4, g, 0.7);
      osc(ctx, 'sine', f * 2, t, t + 0.6, g, 0.12);
    },
    flute(ctx, f, t, len, vol, out) {
      const g = envelope(ctx, t, 0.12 * vol, 0.09, Math.max(0, len - 0.25), 0.28, out);
      const end = t + len + 0.3;
      const o = osc(ctx, 'sine', f, t, end, g, 1);
      osc(ctx, 'triangle', f * 2, t, end, g, 0.05);
      // A slow vibrato that comes in on longer notes.
      if (len > 0.7) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 4.6;
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(f * 0.005, t + 0.45);
        lfo.connect(depth);
        depth.connect(o.frequency);
        lfo.start(t);
        lfo.stop(end);
      }
    },
    whistle(ctx, f, t, len, vol, out) {
      const g = envelope(ctx, t, 0.09 * vol, 0.03, Math.max(0, len * 0.5 - 0.1), 0.14, out);
      const end = t + len * 0.5 + 0.2;
      const o = osc(ctx, 'sine', f * 0.985, t, end, g, 1);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    },
    pad(ctx, f, t, len, vol, out) {
      const g = envelope(ctx, t, 0.05 * vol, 0.5, Math.max(0, len - 1), 0.9, out);
      const end = t + len + 0.5;
      osc(ctx, 'triangle', f * 0.998, t, end, g, 0.6);
      osc(ctx, 'triangle', f * 1.002, t, end, g, 0.6);
    },
    bass(ctx, f, t, len, vol, out) {
      const g = envelope(ctx, t, 0.17 * vol, 0.012, 0, Math.min(1.1, 0.5 + len * 0.25), out);
      osc(ctx, 'sine', f, t, t + 1.3, g, 1);
      osc(ctx, 'triangle', f * 2, t, t + 0.4, g, 0.12);
    },
    uke(ctx, f, t, len, vol, out) {
      const g = envelope(ctx, t, 0.085 * vol, 0.005, 0, 0.32, out);
      osc(ctx, 'triangle', f, t, t + 0.36, g, 1);
    },
    shaker(ctx, f, t, len, vol, out, noise) {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5200;
      const g = envelope(ctx, t, 0.012 * vol, 0.004, 0, 0.05, out);
      s.connect(hp);
      hp.connect(g);
      s.start(t, 0, 0.08);
    },
    bird(ctx, f, t, len, vol, out) {
      [[2350, 0], [2800, 0.11], [2500, 0.26]].forEach(([hz, at]) => {
        const g = envelope(ctx, t + at, 0.022 * vol, 0.012, 0, 0.09, out);
        const o = osc(ctx, 'sine', hz, t + at, t + at + 0.12, g, 1);
        o.frequency.exponentialRampToValueAtTime(hz * 1.14, t + at + 0.09);
      });
    },
  };

  // Builds the small mixing desk for one audio context, with a soft echo for a sense of room.
  function desk(ctx, dest) {
    const input = ctx.createGain();
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 3600;
    low.Q.value = 0.4;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.31;
    const back = ctx.createGain();
    back.gain.value = 0.26;
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    const dull = ctx.createBiquadFilter();
    dull.type = 'lowpass';
    dull.frequency.value = 1700;
    input.connect(low);
    low.connect(dest);
    low.connect(delay);
    delay.connect(dull);
    dull.connect(back);
    back.connect(delay);
    dull.connect(wet);
    wet.connect(dest);
    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    return { input, noise };
  }

  // Sends every note of a tune from one beat up to, not including, another.
  function schedule(ctx, plan, out, noise, fromBeat, toBeat, startTime, passOf) {
    const { events, beats, secPerBeat } = plan;
    for (let b = Math.floor(fromBeat / beats) * beats; b < toBeat; b += beats) {
      const pass = Math.floor(b / beats) % 2;
      for (const ev of events) {
        const at = b + ev.beat;
        if (at < fromBeat || at >= toBeat) continue;
        if (ev.pass !== undefined && ev.pass !== (passOf ? passOf(pass) : pass)) continue;
        const t = startTime + (at - fromBeat) * secPerBeat;
        VOICES[ev.voice](ctx, freq(ev.note), t, ev.len * secPerBeat, ev.vol, out, noise);
      }
    }
  }

  const FADE_IN = 1.4;
  const FADE_OUT = 0.9;
  const LOOK_AHEAD = 0.7;
  const LEVEL = 0.62;

  // Plays one tune at a time and crossfades when you change place.
  class Music {
    constructor(sound) {
      this.sound = sound;
      this.want = null;
      this.current = null;
      this.ready = false;
      this.plans = {};
    }
    setup() {
      const ctx = this.sound.ctx;
      if (!ctx || this.ready) return !!ctx;
      const d = desk(ctx, ctx.destination);
      this.ctx = ctx;
      this.input = d.input;
      this.noise = d.noise;
      this.ready = true;
      return true;
    }
    plan(name) {
      if (!this.plans[name]) this.plans[name] = compile(TUNES[name]);
      return this.plans[name];
    }
    // Asks for a tune, or for silence with null. Called often, it only acts on a change.
    play(name) {
      if (!this.setup()) return;
      if (name !== this.want) {
        this.want = name;
        this.fadeOut();
        if (name) this.begin(name);
      }
      this.pump();
    }
    begin(name) {
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.05;
      const bus = ctx.createGain();
      const level = LEVEL * TUNES[name].vol;
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(level, t + FADE_IN);
      bus.connect(this.input);
      this.current = { name, bus, level, nextBeat: 0, nextTime: t + 0.05 };
    }
    fadeOut() {
      const c = this.current;
      if (!c) return;
      const t = this.ctx.currentTime;
      c.bus.gain.cancelScheduledValues(t);
      c.bus.gain.setValueAtTime(Math.max(0.0001, c.bus.gain.value), t);
      c.bus.gain.exponentialRampToValueAtTime(0.0001, t + FADE_OUT);
      setTimeout(() => c.bus.disconnect(), (FADE_OUT + 3) * 1000);
      this.current = null;
    }
    // Keeps a little of the tune queued ahead of the clock.
    pump() {
      const c = this.current;
      if (!c || this.ctx.state !== 'running') return;
      const plan = this.plan(c.name);
      const now = this.ctx.currentTime;
      // After a long stall the notes that were missed are skipped, not rushed through.
      if (c.nextTime < now) {
        const skip = Math.ceil((now - c.nextTime) / plan.secPerBeat);
        c.nextBeat += skip;
        c.nextTime += skip * plan.secPerBeat;
      }
      while (c.nextTime < now + LOOK_AHEAD) {
        schedule(this.ctx, plan, c.bus, this.noise, c.nextBeat, c.nextBeat + 0.25, c.nextTime);
        c.nextBeat += 0.25;
        c.nextTime += 0.25 * plan.secPerBeat;
      }
    }
  }

  WW.Music = Music;
  WW.MUSIC = { TUNES, compile, schedule, desk, midi, chordOf, LEVEL };
})((globalThis.WW = globalThis.WW || {}));
