// The Road’s ambient sources, made on the site’s one Web Audio context the
// way lib/sfx.js makes its sounds (lib/audio gives the context and the
// outputs, no instruments): wind, water and rain as noise through filters
// with a slow swell; the rest as loops baked once, in plain JavaScript, so
// they are the same every ride and tested without a context: the birds’
// chirps, a fire’s crackle, a far drum’s “doom, doom”, struck bells, a
// fiddle’s jig, a harp’s plucks, a brass’s swells. The held elven note and
// the sub-bass are oscillators.
//
//   SOURCES                 every name a layer may use
//   BAKED                   the baked ones
//   bake(name, rate) → { data: Float32Array, rate }   (pure; a loop of whole seconds)
//   makeSource(ctx, name, out) → { node, set(level, at), stop() }

export const BAKED = ['birds', 'fire', 'drum', 'bell', 'jig', 'harp', 'brass'];
const LIVE = ['wind', 'water', 'rain', 'held', 'sub'];
export const SOURCES = [...LIVE, ...BAKED];

function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TAU = Math.PI * 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// a note into `d` from `t0` seconds: its wave by phase, its envelope by age
function note(d, rate, t0, dur, f, wave, env, gain = 1) {
  const i0 = Math.floor(t0 * rate);
  const n = Math.floor(dur * rate);
  let ph = 0;
  // (a note past the loop’s end wraps to its start, so the loop has no seam)
  for (let k = 0; k < n; k++) {
    const age = k / rate;
    ph += (f(age) * TAU) / rate;
    d[(i0 + k) % d.length] += wave(ph) * env(age, dur) * gain;
  }
}
const sine = (p) => Math.sin(p);
const saw = (p) => ((p / TAU) % 1) * 2 - 1;
const pluck = (age) => Math.exp(-age * 5) * Math.min(1, age * 400);
const struck = (age) => Math.exp(-age * 1.2) * Math.min(1, age * 300);
const bowed = (age, dur) => Math.min(1, age * 30) * Math.min(1, (dur - age) * 20);

const BAKERS = {
  // chirps: quick rising whistles, two or three at a time, over an 8 s loop
  birds(d, rate, rnd) {
    for (let k = 0; k < 26; k++) {
      const t = rnd() * 8;
      const f0 = 2600 + rnd() * 1800;
      const up = 600 + rnd() * 900;
      for (let r = 0, n = 1 + Math.floor(rnd() * 3); r < n; r++) note(d, rate, t + r * 0.11, 0.08, (a) => f0 + up * (a / 0.08), sine, (a, dur) => Math.sin((Math.PI * a) / dur), 0.18);
    }
  },
  // a fire: a soft roar of low noise, crackles as single decaying clicks
  fire(d, rate, rnd) {
    let lp = 0;
    for (let i = 0; i < d.length; i++) {
      lp += (rnd() * 2 - 1 - lp) * 0.02;
      d[i] += lp * 0.9;
    }
    for (let k = 0; k < 90; k++) {
      const i0 = Math.floor(rnd() * d.length);
      const a = 0.2 + rnd() * 0.5;
      for (let j = 0; j < rate * 0.012; j++) d[(i0 + j) % d.length] += (rnd() * 2 - 1) * a * Math.exp(-j / (rate * 0.002));
    }
  },
  // the drums in the deep: a low sine falling in pitch, doom… doom, every 1.5 s
  drum(d, rate) {
    for (let t = 0; t < 6; t += 1.5) note(d, rate, t, 1.2, (a) => 38 + 40 * Math.exp(-a * 12), sine, (a) => Math.exp(-a * 3.2) * Math.min(1, a * 200), 0.9);
  },
  // bells: inharmonic partials struck, a peal every few seconds
  bell(d, rate, rnd) {
    for (let t = 0.2; t < 10; t += 2.4 + rnd() * 1.2) {
      const f = [523, 659, 784][Math.floor(rnd() * 3)];
      for (const [m, g] of [[0.5, 0.3], [1, 0.4], [1.19, 0.2], [1.56, 0.15], [2.0, 0.12], [2.74, 0.08]]) note(d, rate, t, 3.5, () => f * m, sine, struck, g * 0.5);
    }
  },
  // a fiddle’s jig in 6/8: a bowed sawtooth with a little vibrato
  jig(d, rate) {
    const tune = [74, 72, 71, 72, 74, 76, 74, 71, 67, 69, 71, 72, 74, 72, 71, 69, 67, 69, 71, 67, 66, 67, 69, 71];
    const beat = 8 / 48; // 48 quavers in the 8 s loop
    for (let k = 0; k < 48; k++) {
      const m = tune[k % tune.length];
      note(d, rate, k * beat, beat * 0.95, (a) => hz(m) * (1 + 0.004 * Math.sin(a * 36)), saw, bowed, 0.16);
    }
  },
  // a harp: plucked arpeggios over two chords
  harp(d, rate) {
    const chords = [[62, 66, 69, 74, 78], [59, 62, 66, 71, 74]];
    for (let k = 0; k < 32; k++) {
      const c = chords[Math.floor(k / 16) % 2];
      note(d, rate, k * 0.25, 1.4, () => hz(c[k % c.length]), (p) => Math.sin(p) + 0.3 * Math.sin(2 * p), pluck, 0.18);
    }
  },
  // trumpets: a fifth swelling and falling, twice in 8 s
  brass(d, rate) {
    for (const t of [0.3, 4.3])
      for (const m of [50, 57])
        note(d, rate, t, 2.8, () => hz(m), (p) => saw(p) * 0.7 + Math.sin(p) * 0.3, (a, dur) => Math.sin((Math.PI * a) / dur) ** 0.7, 0.2);
  },
};
const LENGTH = { birds: 8, fire: 4, drum: 6, bell: 10, jig: 8, harp: 8, brass: 8 };

export function bake(name, rate = 44100) {
  const d = new Float32Array(LENGTH[name] * rate);
  BAKERS[name](d, rate, rngOf(7 + BAKED.indexOf(name)));
  let peak = 0;
  for (const v of d) peak = Math.max(peak, Math.abs(v));
  // (held under 0.9, so a loop never clips on the bus)
  if (peak > 0.9) for (let i = 0; i < d.length; i++) d[i] *= 0.9 / peak;
  return { data: d, rate };
}

const noises = new WeakMap();
function noiseOf(ctx) {
  if (!noises.has(ctx)) {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    const rnd = rngOf(3);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    noises.set(ctx, b);
  }
  return noises.get(ctx);
}
const baked = new WeakMap();
function bakedOf(ctx, name) {
  if (!baked.has(ctx)) baked.set(ctx, new Map());
  const m = baked.get(ctx);
  if (!m.has(name)) {
    const { data, rate } = bake(name, ctx.sampleRate);
    const b = ctx.createBuffer(1, data.length, rate);
    b.copyToChannel(data, 0);
    m.set(name, b);
  }
  return m.get(name);
}

// the noises’ filters: [type, frequency, Q], and how far a slow swell moves them
const NOISE = { wind: ['bandpass', 420, 0.6, 0.5], water: ['bandpass', 950, 0.9, 0.15], rain: ['highpass', 2600, 0.5, 0.1] };

export function makeSource(ctx, name, out) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(out);
  const started = [];
  const play = (node) => {
    node.start();
    started.push(node);
    return node;
  };
  if (NOISE[name]) {
    const [type, f, q, swell] = NOISE[name];
    const src = play(Object.assign(ctx.createBufferSource(), { buffer: noiseOf(ctx), loop: true }));
    const filter = Object.assign(ctx.createBiquadFilter(), { type });
    filter.frequency.value = f;
    filter.Q.value = q;
    const lfo = play(ctx.createOscillator());
    lfo.frequency.value = 0.07 + 0.05 * SOURCES.indexOf(name);
    const depth = ctx.createGain();
    depth.gain.value = f * swell;
    lfo.connect(depth).connect(filter.frequency);
    src.connect(filter).connect(gain);
  } else if (name === 'held') {
    // an elven voice held: a soft chord of sines, each with its own slow vibrato
    const lp = Object.assign(ctx.createBiquadFilter(), { type: 'lowpass' });
    lp.frequency.value = 1800;
    lp.connect(gain);
    for (const [m, g] of [[69, 0.3], [76, 0.2], [81, 0.12]]) {
      const o = play(ctx.createOscillator());
      o.frequency.value = hz(m);
      const v = play(ctx.createOscillator());
      v.frequency.value = 4.5 + m / 40;
      const vd = ctx.createGain();
      vd.gain.value = hz(m) * 0.006;
      v.connect(vd).connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(lp);
    }
  } else if (name === 'sub') {
    // the Eye’s pressure and the mûmak’s tread: a low hum that breathes
    const o = play(ctx.createOscillator());
    o.frequency.value = 36;
    const og = ctx.createGain();
    og.gain.value = 0.6;
    const lfo = play(ctx.createOscillator());
    lfo.frequency.value = 0.18;
    const ld = ctx.createGain();
    ld.gain.value = 0.35;
    lfo.connect(ld).connect(og.gain);
    o.connect(og).connect(gain);
  } else {
    play(Object.assign(ctx.createBufferSource(), { buffer: bakedOf(ctx, name), loop: true })).connect(gain);
  }
  return {
    node: gain,
    // (eased, never stepped: a level change is a fade, never a click)
    set(level, at = ctx.currentTime) {
      gain.gain.setTargetAtTime(level, at, 0.25);
    },
    stop() {
      for (const n of started) {
        try {
          n.stop();
        } catch {
          /* never started */
        }
      }
      gain.disconnect();
    },
  };
}
