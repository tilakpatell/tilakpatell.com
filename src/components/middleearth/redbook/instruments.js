// The Red Book’s instruments, on the site’s one Web Audio context, cheap:
// each note a handful of nodes, started and stopped at its own times. A
// whistle (a soft wave with breath through a band), a harp (Karplus–Strong
// plucks, baked once a pitch), a fiddle and a cello (bowed saws through a
// body), a pad of strings, a choir (saws through two vowel formants), a
// horn (a saw whose filter opens as it speaks), the deep drum and a frame
// drum, and bells (inharmonic partials). Then the one-off sounds of the
// book: a page turning, the pop-up standing, the cover, the Ring, the
// stone. The bakers are pure, so they are tested without a context.
//
//   hz(midi), rng(seed)
//   pluck(freq, rate, { seconds, bright, seed }) → { data, tune }   (pure; tune corrects the integer delay)
//   impulse(rate, { seconds, decay, seed }) → [left, right]          (pure; a hall’s tail)
//   crackle(rate, seconds, seed), patter(rate, seconds, seed), noise(rate, seconds, seed)   (pure loops)
//   createKit(ctx) → { noise, pluck(midi), wave }      (the buffers a context’s notes share)
//   note(ctx, kit, { inst, t, midi, dur, vel, grace }, out) → voice
//   cue(ctx, kit, name, t, out, send) → voice | null
//   voice: { end (the context’s time when it is silent), sources, nodes }

export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A plucked string (Karplus–Strong): a burst of noise round a delay as long
// as one period, softened a little each time round. `bright` keeps more of
// the burst’s highs; the high strings die sooner, as a harp’s do. The delay
// is a whole number of samples, so `tune` is the playback rate that puts
// the note back in tune.
export function pluck(freq, rate = 44100, { seconds = 2.4, bright = 0.55, seed = 1 } = {}) {
  const n = Math.max(2, Math.round(rate / freq - 0.5));
  const buf = new Float32Array(n);
  const r = rng(seed);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += (r() * 2 - 1 - lp) * (0.25 + bright * 0.75);
    buf[i] = lp;
  }
  // (a long string keeps its ring; a short one is damped harder)
  const keep = Math.min(0.9995, 0.996 + 0.0035 * Math.min(1, 220 / freq));
  const data = new Float32Array(Math.floor(seconds * rate));
  let k = 0;
  for (let i = 0; i < data.length; i++) {
    const a = buf[k];
    const b = buf[(k + 1) % n];
    data[i] = a;
    buf[k] = keep * 0.5 * (a + b);
    k = (k + 1) % n;
  }
  // a short fade at the very end, so a buffer cut never clicks
  const tail = Math.min(data.length, Math.floor(rate * 0.05));
  for (let i = 0; i < tail; i++) data[data.length - 1 - i] *= i / tail;
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= 0.9 / peak;
  return { data, tune: (freq * (n + 0.5)) / rate };
}

// A hall’s tail for the reverb: stereo noise dying away, a little darker
// as it goes, after a short gap before the first reflections
export function impulse(rate = 44100, { seconds = 2.6, decay = 3.4, seed = 9 } = {}) {
  const len = Math.floor(seconds * rate);
  const gap = Math.floor(rate * 0.012);
  const out = [new Float32Array(len), new Float32Array(len)];
  out.forEach((d, ch) => {
    const r = rng(seed + ch * 101);
    let lp = 0;
    for (let i = gap; i < len; i++) {
      const age = (i - gap) / (len - gap);
      // (the highs go first: the smoothing grows with age)
      lp += (r() * 2 - 1 - lp) * (0.9 - age * 0.7);
      const fadeIn = Math.min(1, (i - gap) / (rate * 0.004));
      d[i] = lp * Math.exp(-decay * age * 2.2) * fadeIn * 0.5;
    }
  });
  return out;
}

export function noise(rate = 44100, seconds = 2, seed = 3) {
  const d = new Float32Array(Math.floor(rate * seconds));
  const r = rng(seed);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return d;
}

// a fire in the hearth: a low soft roar, and crackles as single dying clicks
export function crackle(rate = 44100, seconds = 6, seed = 17) {
  const d = new Float32Array(Math.floor(rate * seconds));
  const r = rng(seed);
  let lp = 0;
  for (let i = 0; i < d.length; i++) {
    lp += (r() * 2 - 1 - lp) * 0.015;
    d[i] = lp * 1.6;
  }
  const pops = Math.round(seconds * 14);
  for (let k = 0; k < pops; k++) {
    const i0 = Math.floor(r() * d.length);
    const a = 0.15 + r() * r() * 0.8;
    const len = Math.floor(rate * (0.004 + r() * 0.01));
    for (let j = 0; j < len; j++) d[(i0 + j) % d.length] += (r() * 2 - 1) * a * Math.exp((-j / len) * 4);
  }
  return normal(d, 0.85);
}

// rain on the round window: drops ticking on the glass, more and softer
// than the fire’s crackles, each a tiny ring
export function patter(rate = 44100, seconds = 4, seed = 23) {
  const d = new Float32Array(Math.floor(rate * seconds));
  const r = rng(seed);
  const drops = Math.round(seconds * 70);
  for (let k = 0; k < drops; k++) {
    const i0 = Math.floor(r() * d.length);
    const f = 2400 + r() * 3600;
    const a = 0.05 + r() * r() * 0.5;
    const len = Math.floor(rate * 0.012);
    for (let j = 0; j < len; j++) d[(i0 + j) % d.length] += Math.sin((j / rate) * f * Math.PI * 2) * a * Math.exp((-j / len) * 5);
  }
  return normal(d, 0.8);
}

function normal(d, to) {
  let peak = 0;
  for (const v of d) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < d.length; i++) d[i] *= to / peak;
  return d;
}

// ── On a context ────────────────────────────────────────────────────────

const bufferOf = (ctx, data, rate = ctx.sampleRate) => {
  const b = ctx.createBuffer(1, data.length, rate);
  b.copyToChannel(data, 0);
  return b;
};

export function createKit(ctx) {
  const plucks = new Map();
  let wave = null;
  if (typeof ctx.createPeriodicWave === 'function') {
    // (the whistle’s tone: the fundamental and a breath of its next two)
    const real = new Float32Array([0, 0, 0, 0]);
    const imag = new Float32Array([0, 1, 0.16, 0.05]);
    wave = ctx.createPeriodicWave(real, imag);
  }
  return {
    noise: bufferOf(ctx, noise(ctx.sampleRate, 2, 5)),
    wave,
    pluck(midi) {
      if (!plucks.has(midi)) {
        const { data, tune } = pluck(hz(midi), ctx.sampleRate, { bright: midi > 72 ? 0.4 : 0.6, seed: midi });
        plucks.set(midi, { buffer: bufferOf(ctx, data), tune });
      }
      return plucks.get(midi);
    },
    get plucked() {
      return plucks.size;
    },
  };
}

// a voice’s nodes, kept so they can be stopped and let go of together
function voiceOf() {
  const v = { end: 0, sources: [], nodes: [] };
  v.node = (n) => (v.nodes.push(n), n);
  v.src = (n) => (v.sources.push(n), v.nodes.push(n), n);
  return v;
}
const gainOf = (ctx, v, value = 0) => {
  const g = v.node(ctx.createGain());
  g.gain.value = value;
  return g;
};
const filterOf = (ctx, v, type, f, q = 0.7) => {
  const b = v.node(ctx.createBiquadFilter());
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
};
const oscOf = (ctx, v, type, f, t) => {
  const o = v.src(ctx.createOscillator());
  // (a periodic wave sets its own type: 'custom' may not be set by hand)
  if (type !== 'custom') o.type = type;
  o.frequency.setValueAtTime(f, t);
  return o;
};
const noiseOf = (ctx, v, kit, t) => {
  const s = v.src(ctx.createBufferSource());
  s.buffer = kit.noise;
  s.loop = true;
  s.playbackRate.value = 0.85 + ((t * 7.3) % 1) * 0.3;
  return s;
};
// rise to `peak` in `attack`, hold while the note lasts, die away in `release`
function shape(g, t, { attack, peak, hold, release }) {
  const top = t + Math.max(attack, hold);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, top);
  g.gain.setTargetAtTime(0, top, release / 3);
  return top + release * 1.3;
}
// a slow vibrato that comes in after the note has spoken
function vibrato(ctx, v, target, t, { rate, depth, after }) {
  const lfo = oscOf(ctx, v, 'sine', rate, t);
  const d = gainOf(ctx, v, 0);
  d.gain.setValueAtTime(0, t);
  d.gain.linearRampToValueAtTime(depth, t + after);
  lfo.connect(d).connect(target);
}
const startAll = (v, t) => v.sources.forEach((s) => s.start(t));
const stopAll = (v) => v.sources.forEach((s) => s.stop(v.end + 0.02));

const NOTES = {
  whistle(ctx, kit, v, { t, midi, dur, vel, grace }, out) {
    const f = hz(midi);
    const o = oscOf(ctx, v, kit.wave ? 'custom' : 'sine', grace ? hz(midi + 2) : f, t);
    if (kit.wave) o.setPeriodicWave(kit.wave);
    if (grace) o.frequency.setValueAtTime(f, t + 0.06);
    if (dur > 0.3) vibrato(ctx, v, o.frequency, t, { rate: 5.2, depth: f * 0.007, after: Math.min(0.4, dur * 0.6) });
    const g = gainOf(ctx, v);
    v.end = shape(g, t, { attack: 0.05, peak: vel * 0.2, hold: dur * 0.94, release: 0.1 });
    o.connect(g).connect(out);
    // the breath across the fipple
    const n = noiseOf(ctx, v, kit, t);
    const band = filterOf(ctx, v, 'bandpass', f * 2, 1.4);
    const bg = gainOf(ctx, v);
    shape(bg, t, { attack: 0.03, peak: vel * 0.035, hold: dur * 0.8, release: 0.08 });
    n.connect(band).connect(bg).connect(out);
  },
  harp(ctx, kit, v, { t, midi, dur, vel }, out) {
    const { buffer, tune } = kit.pluck(midi);
    const s = v.src(ctx.createBufferSource());
    s.buffer = buffer;
    s.playbackRate.value = tune;
    const g = gainOf(ctx, v, vel * 0.4);
    // (it rings on past its note, as a string does, then is damped)
    const ring = Math.min(2.3, dur + 1.6);
    g.gain.setValueAtTime(vel * 0.4, t);
    g.gain.setTargetAtTime(0, t + ring - 0.3, 0.1);
    v.end = t + ring;
    s.connect(g).connect(out);
  },
  fiddle(ctx, kit, v, { t, midi, dur, vel, grace }, out) {
    const f = hz(midi);
    const o = oscOf(ctx, v, 'sawtooth', grace ? hz(midi + 2) : f, t);
    if (grace) o.frequency.setValueAtTime(f, t + 0.05);
    if (dur > 0.25) vibrato(ctx, v, o.frequency, t, { rate: 5.6, depth: f * 0.005, after: 0.25 });
    const body = filterOf(ctx, v, 'bandpass', 1100, 0.7);
    const top = filterOf(ctx, v, 'lowpass', 3200, 0.5);
    const g = gainOf(ctx, v);
    v.end = shape(g, t, { attack: 0.07, peak: vel * 0.24, hold: dur * 0.92, release: 0.12 });
    o.connect(body).connect(top).connect(g).connect(out);
  },
  cello(ctx, kit, v, { t, midi, dur, vel }, out) {
    const f = hz(midi);
    const o = oscOf(ctx, v, 'sawtooth', f, t);
    if (dur > 0.6) vibrato(ctx, v, o.frequency, t, { rate: 5, depth: f * 0.004, after: 0.35 });
    const lp = filterOf(ctx, v, 'lowpass', Math.min(2400, f * 6), 0.6);
    const g = gainOf(ctx, v);
    v.end = shape(g, t, { attack: 0.1, peak: vel * 0.16, hold: dur * 0.95, release: 0.35 });
    o.connect(lp).connect(g).connect(out);
  },
  strings(ctx, kit, v, { t, midi, dur, vel }, out) {
    const f = hz(midi);
    const lp = filterOf(ctx, v, 'lowpass', 1500, 0.5);
    const g = gainOf(ctx, v);
    v.end = shape(g, t, { attack: Math.min(0.8, dur * 0.4), peak: vel * 0.09, hold: dur, release: 1.4 });
    for (const cents of [-8, 8]) {
      const o = oscOf(ctx, v, 'sawtooth', f, t);
      o.detune.value = cents;
      o.connect(lp);
    }
    lp.connect(g).connect(out);
  },
  choir(ctx, kit, v, { t, midi, dur, vel }, out) {
    const f = hz(midi);
    const low = midi < 60;
    const g = gainOf(ctx, v);
    v.end = shape(g, t, { attack: Math.min(0.6, dur * 0.4), peak: vel * 0.8, hold: dur, release: 0.9 });
    // (“oh” for the men below middle C, “ah” above it)
    const f1 = filterOf(ctx, v, 'bandpass', low ? 450 : 700, 4);
    const f2 = filterOf(ctx, v, 'bandpass', low ? 800 : 1150, 5);
    const g2 = gainOf(ctx, v, 0.6);
    for (const cents of [-10, 10]) {
      const o = oscOf(ctx, v, 'sawtooth', f, t);
      o.detune.value = cents;
      vibrato(ctx, v, o.frequency, t, { rate: 4.8 + cents * 0.01, depth: f * 0.006, after: 0.5 });
      o.connect(f1);
      o.connect(f2);
    }
    f1.connect(g);
    f2.connect(g2).connect(g);
    g.connect(out);
  },
  horn(ctx, kit, v, { t, midi, dur, vel, grace }, out) {
    const f = hz(midi);
    const o = oscOf(ctx, v, 'sawtooth', grace ? hz(midi + 2) : f, t);
    if (grace) o.frequency.setValueAtTime(f, t + 0.07);
    const lp = filterOf(ctx, v, 'lowpass', 250, 0.8);
    // (the bell of a horn opens as it speaks, then settles)
    const open = Math.min(2600, 250 + f * 5);
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.linearRampToValueAtTime(open, t + 0.09);
    lp.frequency.setTargetAtTime(Math.min(1600, 250 + f * 2.5), t + 0.1, 0.3);
    const g = gainOf(ctx, v);
    v.end = shape(g, t, { attack: 0.07, peak: vel * 0.17, hold: dur * 0.95, release: 0.3 });
    o.connect(lp).connect(g).connect(out);
  },
  drum(ctx, kit, v, { t, midi, vel }, out) {
    const f = hz(midi);
    const o = oscOf(ctx, v, 'sine', f * 2.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    const g = gainOf(ctx, v);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.008);
    g.gain.setTargetAtTime(0, t + 0.01, 0.38);
    o.connect(g).connect(out);
    const n = noiseOf(ctx, v, kit, t);
    const lp = filterOf(ctx, v, 'lowpass', 180, 0.7);
    const ng = gainOf(ctx, v);
    ng.gain.setValueAtTime(vel * 0.3, t);
    ng.gain.setTargetAtTime(0, t, 0.05);
    n.connect(lp).connect(ng).connect(out);
    v.end = t + 1.8;
  },
  frame(ctx, kit, v, { t, midi, vel }, out) {
    // a low note is the drum’s middle (a boom), a high one its rim (a tick)
    if (midi < 52) {
      const f = hz(midi);
      const o = oscOf(ctx, v, 'sine', f * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const g = gainOf(ctx, v);
      g.gain.setValueAtTime(vel * 0.5, t);
      g.gain.setTargetAtTime(0, t, 0.12);
      o.connect(g).connect(out);
    }
    const n = noiseOf(ctx, v, kit, t);
    const band = filterOf(ctx, v, 'bandpass', midi < 52 ? 1800 : 2600, 0.8);
    const ng = gainOf(ctx, v);
    ng.gain.setValueAtTime(vel * (midi < 52 ? 0.12 : 0.2), t);
    ng.gain.setTargetAtTime(0, t, 0.025);
    n.connect(band).connect(ng).connect(out);
    v.end = t + 0.7;
  },
  bell(ctx, kit, v, { t, midi, vel }, out) {
    const f = hz(midi);
    // (a bell’s partials are not a string’s: they ring apart, the high ones briefly)
    for (const [ratio, level, decay] of [[1, 1, 2.8], [2.76, 0.45, 1.2], [5.4, 0.25, 0.6], [8.93, 0.12, 0.35]]) {
      const o = oscOf(ctx, v, 'sine', f * ratio, t);
      const g = gainOf(ctx, v);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * 0.07 * level, t + 0.004);
      g.gain.setTargetAtTime(0, t + 0.005, decay / 3);
      o.connect(g).connect(out);
    }
    v.end = t + 3.2;
  },
};

export const INSTRUMENTS = Object.keys(NOTES);

export function note(ctx, kit, n, out) {
  const v = voiceOf();
  NOTES[n.inst](ctx, kit, v, n, out);
  startAll(v, n.t);
  stopAll(v);
  return v;
}

// ── The book’s one-off sounds ───────────────────────────────────────────

// filtered noise, swept, in an envelope
function swish(ctx, kit, v, t, { type = 'bandpass', f, to = f, q = 0.8, peak, attack, len }, out) {
  const n = noiseOf(ctx, v, kit, t);
  const flt = filterOf(ctx, v, type, f, q);
  flt.frequency.setValueAtTime(f, t);
  flt.frequency.exponentialRampToValueAtTime(to, t + len);
  const g = gainOf(ctx, v);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0, t + attack, Math.max(0.01, (len - attack) / 3));
  n.connect(flt).connect(g).connect(out);
  n.start(t);
  v.end = Math.max(v.end, t + len * 1.4);
}
// a sine (or another wave), swept, struck and dying
function ping(ctx, v, t, { type = 'sine', f, to = f, peak, attack = 0.005, decay, sweep = 0.1 }, out) {
  const o = oscOf(ctx, v, type, f, t);
  if (to !== f) o.frequency.exponentialRampToValueAtTime(to, t + sweep);
  const g = gainOf(ctx, v);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0, t + attack, decay / 3);
  o.connect(g).connect(out);
  o.start(t);
  v.end = Math.max(v.end, t + attack + decay * 1.3);
}

const CUES = {
  // a page turning: a dry swish across the paper, and the soft flap of it landing
  turn(ctx, kit, v, t, out) {
    swish(ctx, kit, v, t, { f: 1400, to: 4200, q: 0.6, peak: 0.16, attack: 0.08, len: 0.32 }, out);
    swish(ctx, kit, v, t + 0.3, { type: 'lowpass', f: 900, to: 300, peak: 0.2, attack: 0.01, len: 0.14 }, out);
  },
  // the pop-up standing: a lighter swish, rising
  rise(ctx, kit, v, t, out) {
    swish(ctx, kit, v, t, { type: 'highpass', f: 1800, to: 5200, q: 0.5, peak: 0.07, attack: 0.15, len: 0.45 }, out);
  },
  // the cover: a soft thump of leather, and the creak of the old spine
  cover(ctx, kit, v, t, out) {
    ping(ctx, v, t, { f: 120, to: 70, peak: 0.3, decay: 0.3, sweep: 0.08 }, out);
    swish(ctx, kit, v, t, { type: 'lowpass', f: 600, to: 200, peak: 0.16, attack: 0.01, len: 0.18 }, out);
    const o = oscOf(ctx, v, 'sawtooth', 92, t + 0.08);
    o.frequency.linearRampToValueAtTime(70, t + 0.5);
    const band = filterOf(ctx, v, 'bandpass', 900, 3);
    const g = gainOf(ctx, v);
    g.gain.setValueAtTime(0, t + 0.08);
    g.gain.linearRampToValueAtTime(0.05, t + 0.2);
    g.gain.setTargetAtTime(0, t + 0.35, 0.06);
    o.connect(band).connect(g).connect(out);
    o.start(t + 0.08);
    v.end = Math.max(v.end, t + 0.7);
  },
  // the Ring going on: a breath drawn in, and a deep boom as the world goes
  'ring-on'(ctx, kit, v, t, out) {
    const n = noiseOf(ctx, v, kit, t);
    const lp = filterOf(ctx, v, 'lowpass', 300, 1.2);
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(6000, t + 0.6);
    const g = gainOf(ctx, v);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.6);
    g.gain.setTargetAtTime(0, t + 0.62, 0.03);
    n.connect(lp).connect(g).connect(out);
    n.start(t);
    ping(ctx, v, t + 0.62, { f: 70, to: 34, peak: 0.55, decay: 2.2, sweep: 0.4 }, out);
    ping(ctx, v, t + 0.62, { type: 'triangle', f: 104, to: 52, peak: 0.12, decay: 1.4, sweep: 0.5 }, out);
  },
  // and off: the world let go of, falling back
  'ring-off'(ctx, kit, v, t, out) {
    swish(ctx, kit, v, t, { type: 'lowpass', f: 5000, to: 260, q: 1, peak: 0.16, attack: 0.04, len: 0.9 }, out);
    ping(ctx, v, t, { f: 330, to: 440, peak: 0.05, attack: 0.2, decay: 1.2, sweep: 0.6 }, out);
  },
  // the Palantír taken up: a glass swell, three notes that hang
  'stone-up'(ctx, kit, v, t, out) {
    for (const [m, k] of [[76, 0], [83, 0.08], [92, 0.16]]) ping(ctx, v, t + k, { f: hz(m), peak: 0.05, attack: 0.5, decay: 2.4 }, out);
  },
  'stone-down'(ctx, kit, v, t, out) {
    for (const [m, k] of [[88, 0], [81, 0.1], [76, 0.2]]) ping(ctx, v, t + k, { f: hz(m), peak: 0.035, attack: 0.02, decay: 0.9 }, out);
  },
  // the stone turned to another place: smoke rushing past, and a glint
  look(ctx, kit, v, t, out) {
    swish(ctx, kit, v, t, { f: 400, to: 2000, q: 1.2, peak: 0.12, attack: 0.25, len: 0.7 }, out);
    ping(ctx, v, t + 0.45, { f: 2637, peak: 0.035, decay: 0.8 }, out);
    ping(ctx, v, t + 0.5, { f: 3951, peak: 0.018, decay: 0.5 }, out);
  },
  // a thing found under the Ring: a little sparkle of bells, rising
  find(ctx, kit, v, t, out) {
    [81, 85, 88, 93].forEach((m, i) => NOTES.bell(ctx, kit, v, { t: t + i * 0.07, midi: m, vel: 0.9 - i * 0.12 }, out));
    v.sources.forEach((s) => s.start(t));
    v.end = Math.max(v.end, t + 3.4);
  },
  // someone met: a short phrase on the harp
  met(ctx, kit, v, t, out) {
    [62, 66, 69, 74].forEach((m, i) => NOTES.harp(ctx, kit, v, { t: t + i * 0.12, midi: m, dur: 0.4, vel: 0.7 }, out));
    v.sources.forEach((s, i) => s.start(t + i * 0.12));
    v.end = t + 0.36 + 2;
  },
  // the Eye: a stab of low brass and a blow
  eye(ctx, kit, v, t, out) {
    for (const f of [55, 58.3, 82.4]) {
      const o = oscOf(ctx, v, 'sawtooth', f, t);
      const lp = filterOf(ctx, v, 'lowpass', 900, 1);
      lp.frequency.setValueAtTime(1400, t);
      lp.frequency.setTargetAtTime(200, t + 0.05, 0.3);
      const g = gainOf(ctx, v);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.setTargetAtTime(0, t + 0.1, 0.4);
      o.connect(lp).connect(g).connect(out);
      o.start(t);
    }
    swish(ctx, kit, v, t, { type: 'lowpass', f: 1200, to: 90, peak: 0.25, attack: 0.005, len: 0.6 }, out);
    v.end = Math.max(v.end, t + 1.8);
  },
};

export const CUE_NAMES = Object.keys(CUES);

// (a cue starts its sources where it makes them; they all stop at its end)
export function cue(ctx, kit, name, t, out) {
  if (!CUES[name]) return null;
  const v = voiceOf();
  CUES[name](ctx, kit, v, t, out);
  stopAll(v);
  return v;
}
