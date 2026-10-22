// What the grounds sound like, made here on the runtime’s bus (rt.audio),
// nothing sampled from anywhere: the wind (noise through a band, a slow
// swell, louder up on the towers and in a gale), the lake lapping (low
// noise in slow swells, by how near the water you are), the rain (a high
// hiss by how hard it falls), the owls at night (a soft two-note hoot, now
// and then, somewhere off to one side), and the castle’s bell striking the
// hour (a struck bell’s inharmonic partials dying away, quieter the further
// you are from the clock tower). Nothing is asked of the browser until a
// key or a touch (`wake()`): before that a context will not start.
//
//   createAmbience(rt) → { wake(), set({ wind, rain, water, height, night, bell }), strike(n, near), update(dt), stats(), dispose() }
//   BELL: the bell’s partials [ratio, level, decay s]; bellAt(t, f0) → the struck sound at t (pure)
//   hootTimes(seed, seconds) → when the owls call over a stretch (pure)

export const BELL = [
  [0.5, 0.5, 5.5],
  [1, 1, 4.2],
  [1.19, 0.55, 3.2],
  [1.5, 0.35, 2.6],
  [2, 0.42, 2.2],
  [2.51, 0.22, 1.6],
  [3.01, 0.16, 1.2],
];
const F0 = 196; // Hz: a big bell’s strike note (G3)
const STRIKE_GAP = 2.6; // s between strokes

export function bellAt(t, f0 = F0) {
  if (t < 0) return 0;
  let v = 0;
  for (const [ratio, level, decay] of BELL) v += Math.sin(2 * Math.PI * f0 * ratio * t) * level * Math.exp(-t / decay);
  return v * Math.min(1, t * 400);
}

// mulberry32
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

export function hootTimes(seed, seconds) {
  const r = rngOf(seed);
  const out = [];
  for (let t = 6 + r() * 10; t < seconds; t += 14 + r() * 30) out.push(t);
  return out;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function createAmbience(rt) {
  let awake = false;
  let ctx = null;
  let bus = null;
  const beds = {};
  let bellBuffer = null;
  const want = { wind: 0.3, rain: 0, water: 0, height: 0, night: 0 };
  let owlIn = 9;
  let owlSeed = 3;
  let hoots = 0;
  let strikes = 0;
  const live = new Set();

  const ready = () => {
    if (bus) return true;
    if (!awake) return false;
    bus = rt?.audio?.bus?.() ?? null;
    ctx = bus?.context ?? null;
    if (!bus || !ctx) return false;
    // the beds: a noise loop each, through its own filter and gain
    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = noise.getChannelData(0);
    const r = rngOf(17);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    const bed = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.playbackRate.value = 0.9 + r() * 0.2;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(bus);
      src.start(0, r() * 3);
      return { src, f, g };
    };
    beds.wind = bed('bandpass', 420, 0.6);
    beds.water = bed('lowpass', 520, 0.7);
    beds.rain = bed('highpass', 1800, 0.5);
    // the bell, baked once: a stroke and its long ring
    const len = Math.round(ctx.sampleRate * 6);
    bellBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = bellBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) b[i] = bellAt(i / ctx.sampleRate) * 0.28;
    return true;
  };

  let t = 0;
  const level = (node, v, at = 0.6) => node.g.gain.setTargetAtTime(v, ctx.currentTime, at);

  // a hoot: a soft falling note, a breath, then two quick ones, off to one side
  const hoot = () => {
    if (!ready()) return;
    const now = ctx.currentTime;
    const pan = ctx.createStereoPanner?.() ?? null;
    const out = ctx.createGain();
    out.gain.value = 0.05;
    if (pan) {
      pan.pan.value = Math.random() * 1.6 - 0.8;
      out.connect(pan).connect(bus);
    } else out.connect(bus);
    const call = (at, dur, f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now + at);
      o.frequency.exponentialRampToValueAtTime(f * 0.86, now + at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + at);
      g.gain.linearRampToValueAtTime(1, now + at + 0.06);
      g.gain.setTargetAtTime(0, now + at + dur * 0.6, dur * 0.2);
      o.connect(g).connect(out);
      o.start(now + at);
      o.stop(now + at + dur + 0.4);
      live.add(o);
      o.onended = () => live.delete(o);
    };
    call(0, 0.7, 410);
    call(1.05, 0.22, 395);
    call(1.32, 0.5, 380);
    hoots += 1;
  };

  return {
    wake() {
      if (awake) return;
      awake = true;
      ready();
    },
    set(o = {}) {
      Object.assign(want, Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)));
    },
    // the bell strikes `n` (the hour), `near` 0…1 how close you are to the clock tower
    strike(n, near = 0.5) {
      if (!ready() || !bellBuffer) return;
      const g = ctx.createGain();
      g.gain.value = 0.15 + 0.85 * clamp01(near);
      g.connect(bus);
      for (let i = 0; i < n; i++) {
        const s = ctx.createBufferSource();
        s.buffer = bellBuffer;
        s.connect(g);
        s.start(ctx.currentTime + 0.05 + i * STRIKE_GAP);
        live.add(s);
        s.onended = () => live.delete(s);
      }
      strikes += n;
    },
    update(dt) {
      t += dt;
      if (!ready()) return;
      // (the wind gusting: two slow swells over each other; up on the towers, more)
      const gust = 0.75 + 0.25 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1);
      level(beds.wind, 0.05 * (0.4 + want.wind) * gust * (1 + clamp01(want.height / 60)));
      beds.wind.f.frequency.setTargetAtTime(320 + 260 * gust + 200 * want.wind, ctx.currentTime, 0.8);
      const lap = 0.7 + 0.3 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
      level(beds.water, 0.07 * clamp01(want.water) * lap, 0.3);
      level(beds.rain, 0.06 * clamp01(want.rain), 1.2);
      // the owls, at night
      if (want.night > 0.5 && (owlIn -= dt) <= 0) {
        hoot();
        const r = rngOf(owlSeed++);
        owlIn = 14 + r() * 32;
      }
    },
    stats: () => ({ state: ctx?.state ?? null, hoots, strikes, wind: beds.wind?.g.gain.value ?? 0, water: beds.water?.g.gain.value ?? 0, rain: beds.rain?.g.gain.value ?? 0 }),
    dispose() {
      for (const s of live)
        try {
          s.stop();
        } catch {
          /* done */
        }
      live.clear();
      for (const b of Object.values(beds))
        try {
          b.src.stop();
          b.g.disconnect();
        } catch {
          /* done */
        }
      bus = null;
    },
  };
}
