// Edoras, in sound, synthesised so nothing is downloaded: the air of each
// place (the wind over the hill and the banners cracking in it, the hall's
// hearth and murmur, the feast with its fiddle and its laughter, the night
// wind and a cricket, the muster's horses and harness, the birds at dawn);
// hooves, one horse's or a whole host's; and the one-shots: the great doors,
// the weapons laid down, the crack of Saruman's hold breaking, a cudgel and
// a man going down, Gandalf's light, a flower picked and laid, the drinking
// game (a gulp, a spill, a burp, a dwarf meeting the floor), the horn of
// Rohan, a cheer, and the beacon seen far off. All through the site's
// master volume, at the levels ../minastirith/sounds.js keeps.

import { audioContext, output } from '../../../../lib/audio';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  const n = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
const ready = () => {
  const ac = audioContext();
  const out = ac ? output() : null;
  return ac && out ? [ac, out] : [null, null];
};
const env = (param, t, points) => {
  param.cancelScheduledValues(t);
  param.setValueAtTime(points[0][1], t + points[0][0]);
  for (let i = 1; i < points.length; i++) param.exponentialRampToValueAtTime(Math.max(points[i][1], 0.0001), t + points[i][0]);
};
const rnd = (a, b) => a + Math.random() * (b - a);

function hiss(ac, out, t, { type = 'bandpass', f = 1000, q = 1, gain = 0.3, attack = 0.005, length = 0.2, sweep = null }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const flt = ac.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f, t);
  if (sweep) flt.frequency.exponentialRampToValueAtTime(sweep, t + length);
  flt.Q.value = q;
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
  src.connect(flt).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + length + 0.05);
}
function tone(ac, out, t, { type = 'sine', f = 440, to = null, gain = 0.2, attack = 0.005, length = 0.3 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + length);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [length, 0.0001]]);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + length + 0.05);
}
// A bell (or a chime): the strike tone and its partials, each dying at its own rate.
const PARTIALS = [[0.5, 0.45, 1.5], [1, 1, 1], [1.19, 0.45, 0.75], [1.5, 0.32, 0.55], [2, 0.3, 0.45], [2.52, 0.16, 0.32], [3.01, 0.12, 0.25], [4.16, 0.07, 0.16]];
function bell(ac, out, t, { f = 600, gain = 0.05, length = 2.4 }) {
  for (const [r, a, d] of PARTIALS) tone(ac, out, t, { f: f * r * rnd(0.998, 1.002), gain: gain * a, attack: 0.003, length: length * d });
}
// Metal struck: a few clanging, inharmonic partials, quickly gone.
function clink(ac, out, t, { f = 1800, gain = 0.04, length = 0.35 }) {
  for (const [r, a] of [[1, 1], [2.76, 0.5], [5.4, 0.3], [8.9, 0.15]]) if (f * r < ac.sampleRate * 0.45) tone(ac, out, t, { type: 'sine', f: f * r * rnd(0.99, 1.01), gain: gain * a, attack: 0.001, length: length / Math.sqrt(r) });
  hiss(ac, out, t, { type: 'highpass', f: 3500, gain: gain * 0.8, attack: 0.001, length: 0.03 });
}
// Brass: two saws a hair apart through a filter opening as the note speaks.
function brass(ac, out, t, { f = 440, length = 0.5, gain = 0.06, bright = 2400, attack = 0.05, scoop = 0.96, vib = 0.006 }) {
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [Math.max(attack + 0.02, length - 0.3), gain * 0.85], [length, 0.0001]]);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.4;
  lp.frequency.setValueAtTime(f * 1.4, t);
  lp.frequency.exponentialRampToValueAtTime(bright, t + attack * 1.6);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, bright * 0.55), t + length);
  const lfo = ac.createOscillator();
  lfo.frequency.value = rnd(4.5, 5.8);
  const depth = ac.createGain();
  depth.gain.value = f * vib;
  lfo.connect(depth);
  for (const d of [0, 6]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * scoop, t);
    o.frequency.exponentialRampToValueAtTime(f, t + attack * 1.3);
    o.detune.value = d;
    depth.connect(o.frequency);
    o.connect(lp);
    o.start(t);
    o.stop(t + length + 0.05);
  }
  lfo.start(t);
  lfo.stop(t + length + 0.05);
  lp.connect(g).connect(out);
}
// Something like a voice: a buzz through two formants gliding from one
// vowel to the next, the pitch along `f`, a rasp (`rough`, Hz) for a throat.
function voice(ac, out, t, { f = [140, 180, 120], formants = [[570, 840], [300, 2200]], length = 0.4, gain = 0.3, attack = 0.03, rough = 0 }) {
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f[0], t);
  for (let i = 1; i < f.length; i++) o.frequency.linearRampToValueAtTime(f[i], t + (length * i) / (f.length - 1));
  const sum = ac.createGain();
  for (let k = 0; k < 2; k++) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = k ? 9 : 5;
    bp.frequency.setValueAtTime(formants[0][k], t);
    bp.frequency.linearRampToValueAtTime(formants[formants.length - 1][k], t + length * 0.75);
    const lv = ac.createGain();
    lv.gain.value = k ? 0.7 : 1;
    o.connect(bp).connect(lv).connect(sum);
  }
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [attack, gain], [length * 0.7, gain * 0.75], [length, 0.0001]]);
  if (rough) {
    const am = ac.createGain();
    am.gain.value = 0.6;
    const lfo = ac.createOscillator();
    lfo.frequency.value = rough;
    const depth = ac.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(am.gain);
    lfo.start(t);
    lfo.stop(t + length + 0.05);
    sum.connect(am).connect(g);
  } else sum.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + length + 0.05);
}
// Wood creaking: a slow buzz of little catches, through the ring of the timber.
function creakAt(ac, out, t, { rate = [30, 55], length = 0.5, f = 1100, q = 8, gain = 0.2 }) {
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(rate[0], t);
  o.frequency.linearRampToValueAtTime(rate[1], t + length);
  const g = ac.createGain();
  env(g.gain, t, [[0, 0.0001], [length * 0.2, gain], [length * 0.8, gain * 0.7], [length, 0.0001]]);
  for (const [k, lv] of [[1, 1], [1.9, 0.5]]) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * k;
    bp.Q.value = q;
    const l = ac.createGain();
    l.gain.value = lv;
    o.connect(bp).connect(l).connect(g);
  }
  g.connect(out);
  o.start(t);
  o.stop(t + length + 0.05);
}
// wood knocking on wood
function clack(ac, out, t, { f = 500, gain = 0.06 }) {
  tone(ac, out, t, { type: 'triangle', f, to: f * 0.82, gain, attack: 0.001, length: 0.07 });
  hiss(ac, out, t, { type: 'bandpass', f: f * 2.6, q: 5, gain: gain * 1.2, attack: 0.001, length: 0.05 });
}
const crackle = (ac, out, t, gain = 0.02) => hiss(ac, out, t, { type: 'highpass', f: rnd(2400, 4800), gain, attack: 0.001, length: rnd(0.015, 0.04) });
const drip = (ac, out, t, gain = 0.02) => {
  const f = rnd(700, 1500);
  tone(ac, out, t, { f, to: f * 1.9, gain, attack: 0.002, length: 0.05 });
};
// a bird: a few quick notes, up and down
function chirp(ac, out, t, gain = 0.012) {
  let at = t;
  const base = rnd(2400, 4200);
  for (let i = 0, n = 2 + Math.floor(Math.random() * 4); i < n; i++) {
    const f = base * rnd(0.85, 1.2);
    tone(ac, out, at, { f, to: f * rnd(0.7, 1.4), gain, attack: 0.004, length: rnd(0.05, 0.11) });
    at += rnd(0.07, 0.14);
  }
}
// a cricket: a burst of quick high pulses
function cricket(ac, out, t, gain = 0.006) {
  const f = rnd(4200, 4800);
  for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) tone(ac, out, t + i * 0.045, { f, gain, attack: 0.004, length: 0.03 });
}
// a horse whinnying far off: a voice that shakes and falls
function neigh(ac, out, t, gain = 0.03) {
  const f0 = rnd(520, 700);
  voice(ac, out, t, { f: [f0 * 0.8, f0, f0 * 1.04, f0 * 0.9, f0 * 0.6, f0 * 0.45], formants: [[900, 1800], [700, 1400], [500, 1100]], length: rnd(0.9, 1.3), gain, attack: 0.05, rough: rnd(9, 13) });
}
// a horse blowing through its nose
function snort(ac, out, t, gain = 0.03) {
  hiss(ac, out, t, { type: 'bandpass', f: rnd(500, 800), q: 1.5, gain, attack: 0.02, length: 0.3, sweep: 300 });
  hiss(ac, out, t + 0.02, { type: 'lowpass', f: 300, gain: gain * 0.7, attack: 0.01, length: 0.25 });
}
// harness: little rings of metal shaken together
function jingle(ac, out, t, gain = 0.006) {
  for (let i = 0; i < 4; i++) tone(ac, out, t + rnd(0, 0.18), { type: 'triangle', f: rnd(2600, 4200), gain, attack: 0.001, length: rnd(0.08, 0.18) });
}
// someone laughing: ha-ha-ha
function laugh(ac, out, t, gain = 0.03) {
  const f = rnd(140, 260);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) voice(ac, out, t + i * rnd(0.13, 0.17), { f: [f * 1.1, f], formants: [[700, 1200], [650, 1100]], length: 0.12, gain: gain * (1 - i * 0.12), attack: 0.01 });
}
// A short echo for far-off sounds: what's connected to the returned node
// comes out dry and again, softer and duller, and again. Undone after `life`.
function echo(ac, out, { time = 0.3, feedback = 0.32, cut = 1600, wet = 0.5, life = 5 } = {}) {
  const input = ac.createGain();
  const d = ac.createDelay(1);
  d.delayTime.value = time;
  const fb = ac.createGain();
  fb.gain.value = feedback;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cut;
  const w = ac.createGain();
  w.gain.value = wet;
  input.connect(out);
  input.connect(d);
  d.connect(lp);
  lp.connect(fb);
  fb.connect(d);
  lp.connect(w);
  w.connect(out);
  setTimeout(() => [input, d, fb, lp, w].forEach((n) => n.disconnect()), life * 1000);
  return input;
}

// ── the air ──

// The level of each layer of the air, in each place: the wind and its
// whistle, the banners flapping, a crowd, the hearth, horses far off.
const LAYERS = {
  hill: { wind: 0.12, whistle: 0.02, flap: 0.05, murmur: 0.0001, fire: 0.0001, herd: 0.0001, fiddle: 0.0001 },
  hall: { wind: 0.016, whistle: 0.003, flap: 0.0001, murmur: 0.018, fire: 0.03, herd: 0.0001, fiddle: 0.0001 },
  feast: { wind: 0.008, whistle: 0.0001, flap: 0.0001, murmur: 0.07, fire: 0.022, herd: 0.0001, fiddle: 0.035 },
  night: { wind: 0.07, whistle: 0.012, flap: 0.012, murmur: 0.0001, fire: 0.0001, herd: 0.0001, fiddle: 0.0001 },
  muster: { wind: 0.09, whistle: 0.01, flap: 0.04, murmur: 0.012, fire: 0.0001, herd: 0.05, fiddle: 0.0001 },
  dawn: { wind: 0.06, whistle: 0.006, flap: 0.015, murmur: 0.0001, fire: 0.0001, herd: 0.0001, fiddle: 0.0001 },
};
// a fiddler's tune for the feast, in D: [scale step, beats]
const D_SCALE = [293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3, 659.3];
const TUNE = [[4, 1], [3, 0.5], [2, 0.5], [0, 1], [2, 1], [4, 1], [5, 0.5], [4, 0.5], [3, 1], [1, 1], [3, 1], [2, 0.5], [1, 0.5], [0, 2], [4, 1], [7, 1], [6, 0.5], [5, 0.5], [4, 1], [5, 1], [4, 0.5], [3, 0.5], [2, 1], [0, 2]];
// The air of each place: place('hill' | 'hall' | 'feast' | 'night' |
// 'muster' | 'dawn'). { place, stop }.
export function air() {
  const [ac, out] = ready();
  if (!ac) return { place() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.42, ac.currentTime, 1.5);
  master.connect(out);
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const layer = (type, f, q, into = master) => {
    const flt = ac.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    flt.Q.value = q;
    const g = ac.createGain();
    g.gain.value = 0.0001;
    src.connect(flt).connect(g).connect(into);
    return { flt, g };
  };
  // the banners: noise beaten by a quick flutter, as cloth cracks in the wind
  const flapAm = ac.createGain();
  flapAm.gain.value = 0.5;
  const flapLfo = ac.createOscillator();
  flapLfo.type = 'square';
  flapLfo.frequency.value = 7;
  const flapDepth = ac.createGain();
  flapDepth.gain.value = 0.5;
  flapLfo.connect(flapDepth).connect(flapAm.gain);
  flapAm.connect(master);
  const L = {
    wind: layer('bandpass', 380, 1.1),
    whistle: layer('bandpass', 1200, 9),
    flap: layer('bandpass', 900, 0.9, flapAm),
    murmur: layer('bandpass', 520, 1.3),
    fire: layer('lowpass', 1400, 0.7),
    herd: layer('lowpass', 180, 0.8),
  };
  // the fiddle: a drone on D and A, and the tune over it, bowed
  const fiddle = ac.createGain();
  fiddle.gain.value = 0.0001;
  const body = ac.createBiquadFilter();
  body.type = 'bandpass';
  body.frequency.value = 1100;
  body.Q.value = 0.8;
  fiddle.connect(body).connect(master);
  const drones = [146.8, 220].map((f) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = 0.18;
    o.connect(g).connect(fiddle);
    o.start();
    return o;
  });
  const bow = ac.createOscillator();
  bow.type = 'sawtooth';
  bow.frequency.value = D_SCALE[4];
  const bowG = ac.createGain();
  bowG.gain.value = 0.0001;
  const vib = ac.createOscillator();
  vib.frequency.value = 5.5;
  const vibD = ac.createGain();
  vibD.gain.value = 4;
  vib.connect(vibD).connect(bow.frequency);
  bow.connect(bowG).connect(fiddle);
  bow.start();
  vib.start();
  flapLfo.start();
  src.start();
  let where = 'hill';
  let on = true;
  const level = (k) => (LAYERS[where] ?? LAYERS.hill)[k];
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    // the wind wanders and gusts; the banners crack harder in the gusts
    const gust = rnd(0.55, 1.45);
    L.wind.flt.frequency.setTargetAtTime(where === 'hill' || where === 'muster' ? rnd(260, 820) : rnd(220, 560), t, 1);
    L.wind.g.gain.setTargetAtTime(level('wind') * gust, t, 0.9);
    L.whistle.flt.frequency.setTargetAtTime(rnd(900, 1700), t, 1.5);
    L.whistle.g.gain.setTargetAtTime(level('whistle') * rnd(0.3, 1.5), t, 1.2);
    L.flap.g.gain.setTargetAtTime(level('flap') * gust * gust, t, 0.5);
    flapLfo.frequency.setTargetAtTime(rnd(5, 9) * (0.7 + gust * 0.4), t, 0.4);
    L.murmur.flt.frequency.setTargetAtTime(rnd(420, where === 'feast' ? 950 : 700), t, 0.3);
    L.murmur.g.gain.setTargetAtTime(level('murmur') * rnd(0.6, 1.3), t, 0.4);
    L.fire.g.gain.setTargetAtTime(level('fire') * rnd(0.7, 1.3), t, 0.6);
    L.herd.g.gain.setTargetAtTime(level('herd') * rnd(0.7, 1.3), t, 0.8);
    if (where === 'hill') {
      if (Math.random() < 0.06) neigh(ac, echo(ac, master, { time: 0.35, feedback: 0.25, cut: 1200, wet: 0.4, life: 4 }), t + rnd(0, 0.5), 0.012);
    } else if (where === 'hall') {
      for (let i = 0; i < 3; i++) crackle(ac, master, t + rnd(0, 0.6), 0.016);
    } else if (where === 'feast') {
      for (let i = 0; i < 2; i++) crackle(ac, master, t + rnd(0, 0.6), 0.01);
      if (Math.random() < 0.35) laugh(ac, master, t + rnd(0, 0.4), rnd(0.015, 0.03));
      if (Math.random() < 0.5) for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) clink(ac, master, t + rnd(0, 0.6), { f: rnd(1500, 2600), gain: 0.008, length: 0.25 });
    } else if (where === 'night') {
      if (Math.random() < 0.7) cricket(ac, master, t + rnd(0, 0.5));
      if (Math.random() < 0.25) cricket(ac, master, t + rnd(0.3, 0.8), 0.004);
    } else if (where === 'muster') {
      if (Math.random() < 0.5) jingle(ac, master, t + rnd(0, 0.5));
      if (Math.random() < 0.3) snort(ac, master, t + rnd(0, 0.5), 0.016);
      if (Math.random() < 0.1) neigh(ac, master, t + rnd(0, 0.5), 0.012);
      for (let i = 0; i < 3; i++) clack(ac, master, t + rnd(0, 0.8), { f: rnd(260, 420), gain: 0.008 });
    } else if (where === 'dawn') {
      if (Math.random() < 0.7) chirp(ac, master, t + rnd(0, 0.4));
      if (Math.random() < 0.25) chirp(ac, master, t + rnd(0.3, 0.8), 0.008);
    }
    timer = setTimeout(tick, 500 + Math.random() * 900);
  };
  let timer = setTimeout(tick, 300);
  // the tune, kept in time, only heard at the feast
  const BEAT = 60 / 132;
  let step = 0;
  let next = ac.currentTime + 0.3;
  const play = () => {
    if (!on) return;
    const now = ac.currentTime;
    if (next < now) next = now + 0.05;
    while (next < now + 0.35) {
      const [k, beats] = TUNE[step % TUNE.length];
      const len = beats * BEAT;
      bow.frequency.setTargetAtTime(D_SCALE[k], next, 0.012);
      bowG.gain.setTargetAtTime(0.3, next, 0.02);
      bowG.gain.setTargetAtTime(0.12, next + len * 0.6, 0.05);
      step += 1;
      next += len;
    }
    tuneTimer = setTimeout(play, 120);
  };
  let tuneTimer = setTimeout(play, 100);
  const api = {
    place(z) {
      where = LAYERS[z] ? z : 'hill';
      const now = ac.currentTime;
      for (const k of Object.keys(L)) L[k].g.gain.setTargetAtTime(level(k), now, 1);
      fiddle.gain.setTargetAtTime(level('fiddle'), now, 0.8);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      clearTimeout(tuneTimer);
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0.0001, now, 0.3);
      for (const o of [src, bow, vib, flapLfo, ...drones]) o.stop(now + 1);
    },
  };
  api.place(where);
  return api;
}

// ── hooves ──

// One horse's hooves (four beats a stride, in time with ../weathertop/props
// gallop's strides a second), or, by default, a host's: many horses out of
// step with each other over the rumble of them all; louder and quicker as
// they go faster, nothing at all when they stand. set(speed 0..1+), stop().
export function gallop({ many = true } = {}) {
  const [ac, out] = ready();
  if (!ac) return { set() {}, stop() {} };
  const bus = ac.createGain();
  bus.gain.value = 0.9;
  bus.connect(out);
  // the rumble of a host on turf
  let rumble = null;
  let rumbleG = null;
  if (many) {
    rumble = ac.createBufferSource();
    rumble.buffer = noise(ac);
    rumble.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    rumbleG = ac.createGain();
    rumbleG.gain.value = 0.0001;
    rumble.connect(lp).connect(rumbleG).connect(bus);
    rumble.start();
  }
  let speed = 0;
  let on = true;
  let next = ac.currentTime + 0.05;
  const horses = many ? Array.from({ length: 7 }, () => ({ off: Math.random(), k: rnd(0.35, 0.7) })) : [{ off: 0, k: 1 }];
  const hoof = (t, k) => {
    tone(ac, bus, t, { f: rnd(95, 125), to: 52, gain: 0.12 * k, attack: 0.002, length: 0.09 });
    hiss(ac, bus, t, { type: 'lowpass', f: rnd(420, 620), gain: 0.07 * k, attack: 0.002, length: 0.07 });
    if (!many) hiss(ac, bus, t, { type: 'bandpass', f: rnd(1500, 2400), q: 3, gain: 0.04 * k, attack: 0.001, length: 0.04 });
  };
  const BEATS = [[0, 0.85], [0.1, 1], [0.45, 0.8], [0.55, 0.95]];
  const pump = () => {
    if (!on) return;
    const now = ac.currentTime;
    if (next < now) next = now + 0.02;
    if (speed <= 0.03) {
      // standing: nothing, and nothing piled up for when they go
      next = now + 0.05;
    } else {
      const stride = 1 / Math.min(2.8, 1.5 + 0.75 * speed);
      const k = Math.min(1, 0.4 + speed * 0.6);
      // a stride at a time, a little ahead (and never more than a few)
      for (let n = 0; next < now + 0.25 && n < 4; n++) {
        for (const h of horses) for (const [o, a] of BEATS) hoof(next + ((o + h.off) % 1) * stride + rnd(-0.008, 0.008), k * a * h.k);
        next += stride;
      }
    }
    if (rumbleG) rumbleG.gain.setTargetAtTime(speed > 0.03 ? Math.min(0.22, 0.08 + speed * 0.12) : 0.0001, now, 0.25);
    timer = setTimeout(pump, 80);
  };
  let timer = setTimeout(pump, 0);
  return {
    set(s) {
      speed = Math.max(0, Number(s) || 0);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      const now = ac.currentTime;
      bus.gain.setTargetAtTime(0.0001, now, 0.1);
      if (rumble) rumble.stop(now + 0.6);
    },
  };
}

// ── one-shots ──

// the great doors of Meduseld swung open: a long groan of the hinges, the
// boom of them against their stops, and that down the hall
export function door() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  creakAt(ac, out, t, { rate: [16, 24], length: 1.1, f: 300, q: 6, gain: 0.13 });
  creakAt(ac, out, t + 0.15, { rate: [22, 14], length: 0.9, f: 520, q: 7, gain: 0.06 });
  tone(ac, out, t + 1.05, { f: 58, to: 32, gain: 0.45, attack: 0.005, length: 1.5 });
  hiss(ac, out, t + 1.05, { type: 'lowpass', f: 420, gain: 0.28, attack: 0.005, length: 0.5 });
  tone(ac, out, t + 1.45, { f: 50, to: 32, gain: 0.14, attack: 0.03, length: 1.4 });
  tone(ac, out, t + 1.9, { f: 46, to: 30, gain: 0.06, attack: 0.04, length: 1.4 });
}
// weapons handed over and laid on the pile: steel on steel, a clatter, a thud
export function clank() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: 120, to: 70, gain: 0.12, attack: 0.002, length: 0.15 });
  for (let i = 0; i < 6; i++) clink(ac, out, t + i * rnd(0.04, 0.08) + rnd(0, 0.02), { f: rnd(900, 2400), gain: rnd(0.03, 0.06), length: rnd(0.25, 0.5) });
  for (let i = 0; i < 3; i++) clack(ac, out, t + 0.05 + rnd(0, 0.3), { f: rnd(300, 600), gain: 0.04 });
}
// the crack as Saruman's hold on the king breaks: a split of thunder in the
// hall, and its roll dying away
export function thunder() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 1800, gain: 0.26, attack: 0.001, length: 0.12 });
  hiss(ac, out, t, { type: 'bandpass', f: 900, q: 0.6, gain: 0.28, attack: 0.002, length: 0.35, sweep: 200 });
  tone(ac, out, t, { f: 70, to: 30, gain: 0.42, attack: 0.004, length: 1.4 });
  const far = echo(ac, out, { time: 0.31, feedback: 0.4, cut: 700, wet: 0.6, life: 6 });
  hiss(ac, far, t + 0.08, { type: 'lowpass', f: 380, gain: 0.4, attack: 0.08, length: 2.6, sweep: 90 });
  for (let i = 0; i < 4; i++) hiss(ac, far, t + 0.3 + i * rnd(0.25, 0.45), { type: 'lowpass', f: rnd(200, 320), gain: 0.2 * (1 - i * 0.2), attack: 0.06, length: 0.7 });
}
// a cudgel (or a fist) landing
export function bash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: rnd(130, 160), to: 60, gain: 0.4, attack: 0.002, length: 0.16 });
  hiss(ac, out, t, { type: 'lowpass', f: 1200, gain: 0.3, attack: 0.001, length: 0.09 });
  hiss(ac, out, t, { type: 'bandpass', f: 2500, q: 2, gain: 0.08, attack: 0.001, length: 0.04 });
}
// a man knocked down: "oof", and him hitting the floor
export function grunt() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  const f = rnd(105, 135);
  voice(ac, out, t, { f: [f * 1.25, f, f * 0.8], formants: [[450, 800], [380, 700]], length: 0.28, gain: 0.32, attack: 0.012, rough: 34 });
  hiss(ac, out, t, { type: 'bandpass', f: 700, q: 1, gain: 0.05, attack: 0.01, length: 0.2 });
  tone(ac, out, t + 0.3, { f: 80, to: 40, gain: 0.32, attack: 0.003, length: 0.3 });
  hiss(ac, out, t + 0.3, { type: 'lowpass', f: 600, gain: 0.2, attack: 0.003, length: 0.2 });
  clink(ac, out, t + 0.34, { f: rnd(1100, 1500), gain: 0.02, length: 0.3 });
}
// Gandalf's power: a rising whoosh and a bright shimmer over it
export function flash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 300, q: 1.2, gain: 0.3, attack: 0.25, length: 0.9, sweep: 3600 });
  hiss(ac, out, t + 0.2, { type: 'highpass', f: 5000, gain: 0.05, attack: 0.3, length: 1.4 });
  const shimmer = ac.createGain();
  shimmer.connect(out);
  const lfo = ac.createOscillator();
  lfo.frequency.value = 9;
  const d = ac.createGain();
  d.gain.value = 0.5;
  lfo.connect(d).connect(shimmer.gain);
  lfo.start(t);
  lfo.stop(t + 2);
  for (const [f, g] of [[1318.5, 0.03], [1975.5, 0.022], [2637, 0.016], [3951, 0.01]]) tone(ac, shimmer, t + 0.25, { f, to: f * 1.01, gain: g, attack: 0.2, length: 1.6 });
  tone(ac, out, t + 0.25, { f: 110, to: 98, gain: 0.12, attack: 0.15, length: 1.4 });
}
// a flower picked: a little snap of a stem, a rustle of leaves
export function pick() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 3000, gain: 0.1, attack: 0.001, length: 0.025 });
  tone(ac, out, t, { type: 'triangle', f: 1400, to: 900, gain: 0.05, attack: 0.001, length: 0.04 });
  hiss(ac, out, t + 0.04, { type: 'bandpass', f: 4200, q: 1.2, gain: 0.07, attack: 0.03, length: 0.25 });
}
// the flowers laid down: a gentle chime, two notes
export function lay() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  bell(ac, out, t, { f: 1046.5, gain: 0.03, length: 2.6 });
  bell(ac, out, t + 0.35, { f: 1318.5, gain: 0.025, length: 3 });
  hiss(ac, out, t, { type: 'bandpass', f: 3000, q: 1, gain: 0.02, attack: 0.05, length: 0.3 });
}
// a long pull at a tankard: glug, glug, glug, and a swallow
export function gulp() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 3; i++) {
    const at = t + i * rnd(0.2, 0.26);
    const f = rnd(160, 220);
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, at + 0.08);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 2;
    const g = ac.createGain();
    env(g.gain, at, [[0, 0.0001], [0.01, 0.4], [0.11, 0.0001]]);
    o.connect(g).connect(bp).connect(out);
    o.start(at);
    o.stop(at + 0.15);
    hiss(ac, out, at, { type: 'bandpass', f: 600, q: 3, gain: 0.04, attack: 0.01, length: 0.1 });
  }
  tone(ac, out, t + 0.78, { f: 260, to: 120, gain: 0.08, attack: 0.01, length: 0.12 });
}
// it goes down his beard instead: a splash and its drops
export function spill() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 1600, q: 0.7, gain: 0.22, attack: 0.005, length: 0.35, sweep: 700 });
  hiss(ac, out, t + 0.02, { type: 'highpass', f: 3500, gain: 0.06, attack: 0.005, length: 0.25 });
  for (let i = 0; i < 6; i++) drip(ac, out, t + 0.15 + rnd(0, 0.5), 0.022);
}
// a Dwarf's burp: low, long, ragged, well satisfied
export function burp() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  const f = rnd(78, 92);
  voice(ac, out, t, { f: [f * 1.2, f, f * 0.92, f * 1.05, f * 0.8], formants: [[500, 850], [420, 760], [380, 700]], length: rnd(0.55, 0.7), gain: 0.32, attack: 0.03, rough: rnd(24, 30) });
  hiss(ac, out, t, { type: 'lowpass', f: 400, gain: 0.04, attack: 0.03, length: 0.5 });
}
// Gimli going down under the table: a chair scraped, a tankard rolling,
// a heavy, happy thump on the boards
export function thudFloor() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 900, q: 2, gain: 0.07, attack: 0.03, length: 0.3, sweep: 500 });
  tone(ac, out, t + 0.32, { f: 72, to: 36, gain: 0.5, attack: 0.003, length: 0.5 });
  hiss(ac, out, t + 0.32, { type: 'lowpass', f: 700, gain: 0.32, attack: 0.003, length: 0.28 });
  for (let i = 0; i < 4; i++) clack(ac, out, t + 0.42 + i * rnd(0.09, 0.15), { f: rnd(380, 560) * (1 - i * 0.05), gain: 0.05 * (1 - i * 0.18) });
  clink(ac, out, t + 0.4, { f: 1300, gain: 0.025, length: 0.3 });
}
// the horn of Rohan: a long low call on a great horn, rising a fourth and
// held, rolling back off the mountains
export function horn() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  const far = echo(ac, out, { time: 0.45, feedback: 0.38, cut: 800, wet: 0.55, life: 10 });
  const dull = ac.createBiquadFilter();
  dull.type = 'lowpass';
  dull.frequency.value = 1500;
  dull.connect(far);
  setTimeout(() => dull.disconnect(), 10000);
  [[98, 0, 2.2], [130.8, 2.05, 3.4]].forEach(([f, dt, len]) => {
    brass(ac, dull, t + dt, { f, length: len, gain: 0.075, bright: 950, attack: 0.35, scoop: 0.9, vib: 0.003 });
    brass(ac, dull, t + dt + 0.02, { f: f * 2, length: len * 0.92, gain: 0.02, bright: 1200, attack: 0.4, scoop: 0.93, vib: 0.003 });
    tone(ac, dull, t + dt, { f: f / 2, gain: 0.05, attack: 0.4, length: len });
  });
}
// a cheer from many throats
export function cheer() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  hiss(ac, out, t, { type: 'bandpass', f: 900, q: 0.6, gain: 0.2, attack: 0.35, length: 2.4 });
  hiss(ac, out, t + 0.1, { type: 'bandpass', f: 2400, q: 1, gain: 0.06, attack: 0.4, length: 2 });
  for (let i = 0; i < 12; i++) {
    const f = rnd(150, 300);
    const len = rnd(0.8, 1.6);
    const a = rnd(500, 800);
    voice(ac, out, t + rnd(0, 0.6), { f: [f, f * 1.3, f * 1.15, f * 0.85], formants: [[a, rnd(1100, 1500)], [a * 0.9, rnd(1500, 2000)]], length: len, gain: 0.05, attack: 0.12 });
  }
}
// the beacon seen on a far peak: a great fire catching, very far off — a
// soft whoomph, and the rush of it, carried on the wind
export function fire() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  const far = echo(ac, out, { time: 0.6, feedback: 0.3, cut: 600, wet: 0.5, life: 7 });
  tone(ac, far, t, { f: 55, to: 34, gain: 0.32, attack: 0.03, length: 1.2 });
  hiss(ac, far, t, { type: 'lowpass', f: 260, gain: 0.3, attack: 0.12, length: 1.6, sweep: 500 });
  hiss(ac, far, t + 0.1, { type: 'bandpass', f: 400, q: 0.8, gain: 0.08, attack: 0.4, length: 2.2 });
  for (let i = 0; i < 8; i++) crackle(ac, far, t + 0.5 + rnd(0, 1.6), 0.012);
}
