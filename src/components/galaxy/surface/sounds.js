// A world's sound, made rather than recorded (Web Audio, through the site's
// one context and its sound setting, lib/audio): the air (wind over the
// sand or the snow, gusting; rain; the sea's swell; lava's low roar; a
// city's hum; frogs and insects in a swamp or a jungle), your footsteps on
// whatever's underfoot, and a speeder's whine rising with its speed.
//
// site.sound: { wind 0…1, rain, sea, lava, city, critters (0…1 each),
// ground: 'sand' | 'snow' | 'grass' | 'stone' | 'metal' | 'mud' }
//
// And somewhere's band (music(name): a tune of the site's own, played on
// made-up instruments: a cantina's swing, a Hutt's court's slow groove), a
// rancor's roar, a Hutt's laugh, a gate crashing down.

// the tunes: bpm, swing (how late the off-beat eighths come), and its
// voices, each a loop of [beat, note (midi), length in beats] (an original
// tune each, in the spirit of a jizz band, not anyone's)
const D = 62;
const TUNES = {
  cantina: {
    bpm: 172,
    swing: 0.62,
    bars: 16,
    // D minor, then up to F and back: a walking bass on the roots
    chords: [D, D, D + 5, D, D + 7, D, D + 2, D + 7, D + 3, D + 10, D + 3, D, D + 5, D, D + 7, D],
    seventh: [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0],
    lead: [
      // A: bouncing round the chord, a turn at the end of each bar
      [0, 74, 0.5], [0.5, 77, 0.5], [1, 81, 0.5], [1.5, 82, 0.5], [2, 81, 0.5], [2.5, 77, 0.5], [3, 76, 0.5], [3.5, 74, 0.5],
      [4, 72, 0.5], [4.5, 74, 1], [6, 77, 0.5], [6.5, 76, 0.5], [7, 74, 1],
      [8, 79, 0.5], [8.5, 82, 0.5], [9, 86, 0.5], [9.5, 84, 0.5], [10, 82, 0.5], [10.5, 79, 0.5], [11, 77, 1],
      [12, 74, 0.5], [12.5, 77, 0.5], [13, 81, 1.5], [15, 80, 0.5], [15.5, 81, 0.5],
      [16, 85, 0.5], [16.5, 81, 0.5], [17, 79, 0.5], [17.5, 76, 0.5], [18, 73, 1], [19.5, 76, 0.5],
      [20, 74, 0.5], [20.5, 77, 0.5], [21, 81, 0.5], [21.5, 77, 0.5], [22, 74, 1.5],
      [24, 76, 0.5], [24.5, 80, 0.5], [25, 83, 0.5], [25.5, 80, 0.5], [26, 76, 1], [27, 74, 0.5], [27.5, 76, 0.5],
      [28, 73, 0.5], [28.5, 76, 0.5], [29, 79, 0.5], [29.5, 81, 0.5], [30, 79, 0.5], [30.5, 76, 0.5], [31, 73, 1],
      // B: up into F, long notes, then a run back down
      [32, 77, 1.5], [33.5, 81, 0.5], [34, 84, 2],
      [36, 82, 0.5], [36.5, 81, 0.5], [37, 79, 0.5], [37.5, 76, 0.5], [38, 79, 2],
      [40, 77, 0.5], [40.5, 79, 0.5], [41, 81, 0.5], [41.5, 84, 0.5], [42, 89, 1.5], [43.5, 88, 0.5],
      [44, 86, 0.5], [44.5, 84, 0.5], [45, 81, 0.5], [45.5, 78, 0.5], [46, 81, 2],
      [48, 79, 0.5], [48.5, 82, 0.5], [49, 86, 1], [50, 84, 0.5], [50.5, 82, 0.5], [51, 79, 1],
      [52, 77, 0.5], [52.5, 81, 0.5], [53, 86, 1], [54, 84, 0.5], [54.5, 81, 0.5], [55, 77, 1],
      [56, 76, 0.5], [56.5, 79, 0.5], [57, 82, 0.5], [57.5, 85, 0.5], [58, 88, 0.5], [58.5, 85, 0.5], [59, 82, 0.5], [59.5, 79, 0.5],
      [60, 74, 1], [61, 81, 0.5], [61.5, 77, 0.5], [62, 74, 1.5],
    ],
    lead_voice: 'reed',
  },
  palace: {
    bpm: 96,
    swing: 0.56,
    bars: 8,
    // E minor, low and lazy: an organ on the chords, a fat bass
    chords: [52, 52, 57, 52, 59, 57, 52, 59],
    seventh: [1, 1, 1, 1, 1, 1, 1, 1],
    lead: [
      [0, 76, 1.5], [1.5, 79, 0.5], [2, 76, 0.5], [2.5, 74, 0.5], [3, 71, 1],
      [4, 74, 0.5], [4.5, 76, 1], [6, 79, 0.5], [6.5, 81, 1.5],
      [8, 81, 1], [9, 79, 0.5], [9.5, 76, 0.5], [10, 81, 1], [11, 84, 1],
      [12, 83, 1.5], [13.5, 79, 0.5], [14, 76, 2],
      [16, 83, 1], [17, 86, 0.5], [17.5, 83, 0.5], [18, 81, 1], [19, 78, 1],
      [20, 81, 0.5], [20.5, 79, 0.5], [21, 76, 1], [22, 74, 2],
      [24, 76, 0.5], [24.5, 79, 0.5], [25, 76, 0.5], [25.5, 74, 0.5], [26, 71, 1], [27, 74, 1],
      [28, 75, 1], [29, 78, 1], [30, 71, 2],
    ],
    lead_voice: 'organ',
  },
};
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

import { audioContext, output } from '../../../lib/audio';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const len = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  // (brown-ish: each sample a step from the last, so it rumbles rather than hisses)
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.04 * white) / 1.04;
    d[i] = last * 3.5 + white * 0.15;
  }
  return noiseBuf;
}

function loop(ac, out, { type = 'lowpass', freq = 500, q = 0.7, gain = 0.1 }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(out);
  src.start();
  g.gain.setTargetAtTime(gain, ac.currentTime, 1.2);
  return { src, f, g, base: gain };
}

const STEP = { sand: [900, 0.06, 0.05], snow: [1800, 0.09, 0.07], grass: [1200, 0.05, 0.05], stone: [2500, 0.04, 0.03], metal: [3200, 0.05, 0.02], mud: [500, 0.07, 0.09] };

export function createSounds(site) {
  const s = site.sound ?? {};
  let ac = null;
  let out = null;
  let layers = [];
  let hum = null;
  let started = false;
  let t = 0;
  let nextCritter = 2;
  let tune = null; // { name, song, beat (the next to schedule), at (when beat 0 was), bus }
  let wanted = null; // a tune asked for before the sound could start

  const start = () => {
    if (started) return;
    ac = audioContext();
    out = ac && output();
    if (!ac || !out) return;
    started = true;
    const bus = ac.createGain();
    bus.gain.value = 0.9;
    bus.connect(out);
    out = bus;
    if (s.wind) layers.push({ kind: 'wind', ...loop(ac, out, { type: 'bandpass', freq: 420, q: 0.6, gain: 0.07 * s.wind }) });
    if (s.rain) layers.push({ kind: 'rain', ...loop(ac, out, { type: 'highpass', freq: 2400, q: 0.3, gain: 0.05 * s.rain }) });
    if (s.sea) layers.push({ kind: 'sea', ...loop(ac, out, { type: 'lowpass', freq: 700, q: 0.4, gain: 0.08 * s.sea }) });
    if (s.lava) layers.push({ kind: 'lava', ...loop(ac, out, { type: 'lowpass', freq: 160, q: 1.2, gain: 0.16 * s.lava }) });
    if (s.city) layers.push({ kind: 'city', ...loop(ac, out, { type: 'bandpass', freq: 240, q: 2, gain: 0.05 * s.city }) });
    if (wanted) music(wanted);
  };

  // ── The band ──

  // a note on one of the band's instruments, at `when`, for `len` seconds
  const play = (bus, voice, midi, when, len, loud = 1) => {
    const f0 = hz(midi);
    const g = ac.createGain();
    g.connect(bus);
    const env = (a, peak, rel) => {
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak * loud, when + a);
      g.gain.setTargetAtTime(0.0001, when + Math.max(a, len - rel), rel / 3);
    };
    const osc = (type, f, detune = 0) => {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.start(when);
      o.stop(when + len + 0.4);
      return o;
    };
    if (voice === 'reed') {
      // a reedy horn: two squares, a little apart, through a wah, with vibrato
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(900, when);
      f.frequency.linearRampToValueAtTime(1700, when + Math.min(0.12, len));
      f.connect(g);
      const vib = ac.createOscillator();
      vib.frequency.value = 5.5;
      const depth = ac.createGain();
      depth.gain.value = 9;
      vib.connect(depth);
      vib.start(when);
      vib.stop(when + len + 0.4);
      for (const d of [-6, 7]) {
        const o = osc('square', f0, d);
        depth.connect(o.detune);
        o.connect(f);
      }
      env(0.02, 0.05, 0.06);
    } else if (voice === 'organ') {
      // a Hutt's court organ: drawbars of sines and a buzz, a slow swell
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1800;
      f.connect(g);
      for (const [mul, type] of [[1, 'sine'], [2, 'sine'], [3, 'triangle'], [0.5, 'sawtooth']]) osc(type, f0 * mul).connect(f);
      env(0.06, 0.03, 0.2);
    } else if (voice === 'bass') {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 520;
      f.connect(g);
      osc('triangle', f0).connect(f);
      osc('sawtooth', f0, 4).connect(f);
      env(0.01, 0.07, 0.08);
    } else if (voice === 'comp') {
      // a stab of the chord, a bright bell-ish pluck (a string drum's)
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3200, when);
      f.frequency.exponentialRampToValueAtTime(600, when + 0.18);
      f.connect(g);
      osc('square', f0).connect(f);
      env(0.005, 0.022, 0.05);
    } else if (voice === 'hat' || voice === 'snare' || voice === 'kick') {
      if (voice === 'kick') {
        const o = osc('sine', 120);
        o.frequency.setValueAtTime(120, when);
        o.frequency.exponentialRampToValueAtTime(42, when + 0.15);
        o.connect(g);
        env(0.004, 0.12, 0.12);
        return;
      }
      const src = ac.createBufferSource();
      src.buffer = noise(ac);
      const f = ac.createBiquadFilter();
      f.type = voice === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = voice === 'hat' ? 7000 : 1800;
      src.connect(f).connect(g);
      src.start(when, Math.random());
      src.stop(when + len + 0.1);
      env(0.002, voice === 'hat' ? 0.025 : 0.05, voice === 'hat' ? 0.03 : 0.09);
    }
  };

  // the beats from `from` to `to` (a few tenths of a second ahead), scheduled
  const schedule = () => {
    const { song, bus } = tune;
    const spb = 60 / song.bpm;
    const lenBeats = song.bars * 4;
    // a beat's time, its off-beat eighths swung late
    const timeOf = (b) => {
      const whole = Math.floor(b);
      const frac = b - whole;
      return tune.at + (whole + (frac === 0.5 ? song.swing : frac)) * spb;
    };
    const until = ac.currentTime + 0.35;
    while (timeOf(tune.beat) < until) {
      const b = tune.beat;
      const when = timeOf(b);
      const inSong = b % lenBeats;
      const bar = Math.floor(inSong / 4);
      const beat = inSong % 4;
      const root = song.chords[bar];
      const third = song.seventh[bar] ? 4 : 3;
      if (Number.isInteger(b)) {
        // a walking bass: root, fifth, a passing note, the octave
        const walkUp = [0, 7, beat === 2 ? 10 : 9, 12][beat];
        play(bus, 'bass', root - 24 + walkUp, when, spb * 0.9);
        play(bus, beat % 2 ? 'snare' : 'kick', 0, when, 0.12);
      }
      // the off-beats: the hat, and a stab of the chord on 2-and and 4-and
      if (!Number.isInteger(b)) {
        play(bus, 'hat', 0, when, 0.05);
        if (beat === 1 || beat === 3) for (const iv of [0, third, 7, song.seventh[bar] ? 10 : 12]) play(bus, 'comp', root + iv, when, spb * 0.3);
      } else play(bus, 'hat', 0, when, 0.04, 0.6);
      for (const [nb, note, len] of song.lead) if (nb === inSong) play(bus, song.lead_voice, note, when, len * spb * 0.92);
      tune.beat += 0.5;
    }
  };

  function music(name) {
    wanted = name;
    if (!started) return;
    if (tune?.name === name) return;
    if (tune) {
      const old = tune.bus;
      old.gain.setTargetAtTime(0, ac.currentTime, 0.3);
      setTimeout(() => old.disconnect(), 2000);
      tune = null;
    }
    const song = name && TUNES[name];
    if (!song) return;
    const bus = ac.createGain();
    bus.gain.value = 0;
    bus.gain.setTargetAtTime(0.8, ac.currentTime, 0.4);
    bus.connect(out);
    tune = { name, song, beat: 0, at: ac.currentTime + 0.15, bus };
  }

  // a rancor's roar: a growl that rises and falls, rough with noise
  const roar = () => {
    if (!started) return;
    const now = ac.currentTime;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, now);
    f.frequency.linearRampToValueAtTime(900, now + 0.4);
    f.frequency.linearRampToValueAtTime(250, now + 1.3);
    f.connect(g).connect(out);
    for (const [type, base] of [['sawtooth', 62], ['sawtooth', 93], ['square', 47]]) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(base, now);
      o.frequency.linearRampToValueAtTime(base * 1.4, now + 0.4);
      o.frequency.linearRampToValueAtTime(base * 0.8, now + 1.3);
      o.connect(f);
      o.start(now);
      o.stop(now + 1.4);
    }
    const src = ac.createBufferSource();
    src.buffer = noise(ac);
    src.connect(f);
    src.start(now, Math.random());
    src.stop(now + 1.4);
  };

  // a Hutt's laugh: three deep, wet ho's
  const laugh = () => {
    if (!started) return;
    const now = ac.currentTime;
    for (let i = 0; i < 4; i++) {
      const at = now + i * 0.32;
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(78 - i * 3, at);
      o.frequency.exponentialRampToValueAtTime(58, at + 0.26);
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 420;
      f.Q.value = 2.5;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.2, at + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      o.connect(f).connect(g).connect(out);
      o.start(at);
      o.stop(at + 0.3);
    }
  };

  // something heavy coming down: a thump, and the clang of it
  const crash = () => {
    if (!started) return;
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise(ac);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    src.connect(f).connect(g).connect(out);
    src.start(now, Math.random());
    src.stop(now + 1);
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, now);
    o.frequency.exponentialRampToValueAtTime(35, now + 0.4);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    o.connect(g2).connect(out);
    o.start(now);
    o.stop(now + 0.7);
  };

  // a footstep: a short burst of filtered noise, its colour the ground's
  const step = (loud = 1) => {
    if (!started) return;
    const [freq, len, gain] = STEP[s.ground ?? 'sand'] ?? STEP.sand;
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise(ac);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq * (0.85 + Math.random() * 0.3);
    f.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain * loud, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + len);
    src.connect(f).connect(g).connect(out);
    src.start(now, Math.random());
    src.stop(now + len + 0.05);
  };

  // a burn: lava's hiss, a bite of high noise falling to a crackle
  const sizzle = () => {
    if (!started) return;
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise(ac);
    const f = ac.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(5200, now);
    f.frequency.exponentialRampToValueAtTime(1400, now + 0.3);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.09, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    src.connect(f).connect(g).connect(out);
    src.start(now, Math.random());
    src.stop(now + 0.36);
  };

  // a chirp or a croak (a jungle's, a swamp's), now and then
  const critter = () => {
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const frog = Math.random() < 0.4;
    o.type = frog ? 'sawtooth' : 'sine';
    const f0 = frog ? 90 + Math.random() * 60 : 2200 + Math.random() * 2400;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f0 * (frog ? 0.8 : 1.4), now + (frog ? 0.25 : 0.08));
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.02 * s.critters, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (frog ? 0.3 : 0.12));
    o.connect(g).connect(out);
    o.start(now);
    o.stop(now + 0.35);
  };

  // a blaster shot: a falling zap, with a crack of noise under it
  const blast = () => {
    if (!started) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1800, now);
    o.frequency.exponentialRampToValueAtTime(140, now + 0.18);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200;
    f.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.09, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(f).connect(g).connect(out);
    o.start(now);
    o.stop(now + 0.25);
  };

  // a lightsaber: a low hum while it's lit (two detuned saws, wavering),
  // the snap-hiss of it lighting, a swing's whoosh, the crack of a clash
  let blade = null;
  const saber = (what) => {
    if (!started) return;
    const now = ac.currentTime;
    if (what === 'ignite' || what === 'off') {
      if (what === 'ignite' && !blade) {
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.035, now + 0.25);
        const oscs = [86, 88.5].map((f) => {
          const o = ac.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.connect(g);
          o.start(now);
          return o;
        });
        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;
        g.connect(lp).connect(out);
        blade = { g, oscs, lp };
      } else if (what === 'off' && blade) {
        const h = blade;
        blade = null;
        h.g.gain.cancelScheduledValues(now);
        h.g.gain.setValueAtTime(h.g.gain.value, now);
        h.g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        h.oscs.forEach((o) => o.stop(now + 0.35));
      }
      // the snap-hiss either way: noise through a sweeping filter
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(what === 'ignite' ? 180 : 600, now);
      o.frequency.exponentialRampToValueAtTime(what === 'ignite' ? 900 : 120, now + 0.3);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700;
      f.Q.value = 2;
      o.connect(f).connect(g).connect(out);
      o.start(now);
      o.stop(now + 0.4);
      return;
    }
    if (what === 'swing' || what === 'throw') {
      // the hum swept up and back: the blade through the air
      if (blade) {
        for (const o of blade.oscs) {
          o.frequency.cancelScheduledValues(now);
          o.frequency.setValueAtTime(o.frequency.value, now);
          o.frequency.exponentialRampToValueAtTime(o.frequency.value * 2.2, now + 0.12);
          o.frequency.exponentialRampToValueAtTime(o.frequency.value, now + 0.4);
        }
        blade.g.gain.cancelScheduledValues(now);
        blade.g.gain.setValueAtTime(blade.g.gain.value, now);
        blade.g.gain.linearRampToValueAtTime(0.08, now + 0.1);
        blade.g.gain.linearRampToValueAtTime(0.035, now + 0.4);
      }
      return;
    }
    if (what === 'clash' || what === 'deflect') {
      // a crack, bright, with a ring after it
      const o = ac.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(what === 'clash' ? 2400 : 3200, now);
      o.frequency.exponentialRampToValueAtTime(300, now + 0.12);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      const f = ac.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 900;
      o.connect(f).connect(g).connect(out);
      o.start(now);
      o.stop(now + 0.2);
    }
  };

  // the rest of a fight: the heavy stroke's wind-up, a parry's ring, the
  // Force's rush, a gun's vent hiss (and its lock-out buzz), a blast, and
  // the hit marker's tick
  const combat = (what) => {
    if (!started) return;
    const now = ac.currentTime;
    const tone = (type, f0, f1, dur, gain, filter = null) => {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, now);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.02, dur * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      if (filter) {
        const f = ac.createBiquadFilter();
        f.type = filter.type;
        f.frequency.value = filter.f;
        f.Q.value = filter.q ?? 1;
        o.connect(f).connect(g).connect(out);
      } else o.connect(g).connect(out);
      o.start(now);
      o.stop(now + dur + 0.05);
    };
    if (what === 'heavy') tone('sawtooth', 60, 420, 0.5, 0.05, { type: 'lowpass', f: 900 });
    else if (what === 'parry') {
      tone('square', 3200, 400, 0.25, 0.09, { type: 'highpass', f: 1200 });
      tone('sine', 1800, 1750, 0.5, 0.04);
    } else if (what === 'force') {
      tone('sawtooth', 90, 30, 0.6, 0.08, { type: 'lowpass', f: 600 });
      tone('sawtooth', 1200, 200, 0.35, 0.04, { type: 'bandpass', f: 800, q: 2 });
    } else if (what === 'vent') tone('sawtooth', 3000, 600, 0.4, 0.04, { type: 'bandpass', f: 2200, q: 1.5 });
    else if (what === 'perfect') {
      tone('sine', 900, 1800, 0.12, 0.06);
      tone('sine', 1800, 1800, 0.2, 0.04);
    } else if (what === 'lock') tone('square', 180, 150, 0.3, 0.035, { type: 'lowpass', f: 700 });
    else if (what === 'boom') {
      tone('sawtooth', 120, 25, 0.9, 0.16, { type: 'lowpass', f: 400 });
      tone('square', 2200, 300, 0.2, 0.06, { type: 'highpass', f: 900 });
    } else if (what === 'hit') tone('square', 2600, 2400, 0.05, 0.03, { type: 'highpass', f: 1800 });
    else if (what === 'kill') {
      tone('square', 1200, 2400, 0.08, 0.04, { type: 'highpass', f: 900 });
      tone('sine', 600, 1200, 0.14, 0.03);
    } else if (what === 'dodge') tone('sawtooth', 400, 120, 0.25, 0.03, { type: 'bandpass', f: 500, q: 1 });
    else if (what === 'broken') tone('sawtooth', 500, 80, 0.5, 0.06, { type: 'lowpass', f: 800 });
  };

  return {
    start,
    step,
    sizzle,
    blast,
    saber,
    combat,
    music,
    roar,
    laugh,
    crash,
    // each frame: the wind gusting, the sea swelling, the speeder's whine
    update(dt, { riding = 0, wind = 1 } = {}) {
      if (!started) return;
      t += dt;
      if (tune) schedule();
      for (const l of layers) {
        if (l.kind === 'wind') {
          const gust = 0.55 + 0.45 * Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1);
          l.g.gain.setTargetAtTime(l.base * gust * wind, ac.currentTime, 0.4);
          l.f.frequency.setTargetAtTime(300 + gust * 400, ac.currentTime, 0.5);
        } else if (l.kind === 'sea') l.g.gain.setTargetAtTime(l.base * (0.45 + 0.55 * Math.max(0, Math.sin(t * 0.5))), ac.currentTime, 0.6);
      }
      if (s.critters && t > nextCritter) {
        critter();
        nextCritter = t + 0.3 + Math.random() * 3;
      }
      // the speeder: a saw through a filter, up with the speed
      if (riding > 0.5 && !hum) {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        const f = ac.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 3;
        const g = ac.createGain();
        g.gain.value = 0;
        o.connect(f).connect(g).connect(out);
        o.start();
        hum = { o, f, g };
      }
      if (hum) {
        const k = Math.min(1, riding / 40);
        hum.o.frequency.setTargetAtTime(60 + k * 160, ac.currentTime, 0.1);
        hum.f.frequency.setTargetAtTime(400 + k * 1800, ac.currentTime, 0.1);
        hum.g.gain.setTargetAtTime(riding > 0.5 ? 0.03 + k * 0.04 : 0, ac.currentTime, 0.2);
      }
    },
    dispose() {
      blade?.oscs.forEach((o) => o.stop());
      blade = null;
      if (!started) return;
      if (tune) tune.bus.gain.setTargetAtTime(0, ac.currentTime, 0.1);
      tune = null;
      for (const l of layers) {
        l.g.gain.setTargetAtTime(0, ac.currentTime, 0.2);
        l.src.stop(ac.currentTime + 1);
      }
      layers = [];
      if (hum) {
        hum.g.gain.setTargetAtTime(0, ac.currentTime, 0.1);
        hum.o.stop(ac.currentTime + 0.5);
        hum = null;
      }
    },
  };
}
