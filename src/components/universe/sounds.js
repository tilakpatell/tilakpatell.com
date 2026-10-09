// The universe map's sounds: each ship's engine, which follows its speed;
// a voice for each of the crew under the lines that have no recording of
// their own (Chewie's real roars and laughs; blips in the rhythm of the line
// for the rest, and Artoo's chirps); each ship's shot (Han's DL-44, the
// portal gun, the X-wing's laser, the RV's popping cork); and a sound bite
// when you reach a world, from the site's own clips where it has one. All
// through the site's master volume, so the sound setting mutes them. Plain
// functions: the scene drives the engine each frame and the comms box calls
// the rest.

import { audioContext, loadBuffer, output, voiceOutput, voicesOn } from '../../lib/audio';
import { playClip } from '../../lib/clips';
import { speech } from '../../lib/speech';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

// Each ship's engine is a recording, looped (public/audio/engines, credited
// in the README there): the X-wing's and the Falcon's from the films, a
// garage-built hum for the cruiser and an old engine for the RV. Each file
// holds three identical periods of its loop and plays the middle one over
// and over, so the encoder's padding at either end never lands in it. The
// pitch rises a little with the speed (`rate`, slowest to flat out), the
// tone opens up (`tone`, a lowpass in Hz) and it gets louder.
const ENGINES = {
  xwing: { src: '/audio/engines/xwing.mp3', period: 0.85, gain: 0.55, rate: [0.86, 1.18], tone: [2200, 12000] },
  falcon: { src: '/audio/engines/falcon.mp3', period: 3.45, gain: 0.7, rate: [0.84, 1.1], tone: [900, 5500] },
  cruiser: { src: '/audio/engines/cruiser.mp3', period: 4.1, gain: 0.4, rate: [0.88, 1.22], tone: [1400, 7000] },
  rv: { src: '/audio/engines/rv.mp3', period: 6.4, gain: 0.5, rate: [0.8, 1.45], tone: [800, 5000] },
};
const FLAT_OUT = 12; // the speed (map units a second) where an engine is at its highest

// A running engine: set({ speed, boost, on }) every frame, stop() at the end.
// It's silent for the moment its recording takes to load.
export function shipEngine(kind) {
  const spec = ENGINES[kind];
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!spec || !ac || !out) return { set() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0;
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = spec.tone[0];
  tone.Q.value = 0.5;
  tone.connect(master).connect(out);
  let src = null;
  let alive = true;
  let last = { speed: 0, boost: false, on: false };
  const apply = ({ speed, boost, on }, ease = 0.15) => {
    const now = ac.currentTime;
    const n = Math.min(1, Math.abs(speed) / FLAT_OUT);
    if (src) src.playbackRate.setTargetAtTime(spec.rate[0] + (spec.rate[1] - spec.rate[0]) * Math.sqrt(n) + (boost ? 0.04 : 0), now, ease);
    tone.frequency.setTargetAtTime(spec.tone[0] + (spec.tone[1] - spec.tone[0]) * n, now, ease);
    // a low idle when parked, louder as she goes
    master.gain.setTargetAtTime(on ? spec.gain * (0.35 + 0.65 * Math.min(1, Math.abs(speed) / 3)) * (boost ? 1.15 : 1) : 0, now, 0.2);
  };
  loadBuffer(spec.src)
    .then((buf) => {
      if (!alive || !buf) return;
      src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = spec.period;
      src.loopEnd = spec.period * 2;
      src.connect(tone);
      src.start(ac.currentTime, spec.period);
      apply(last, 0.01);
    })
    .catch(() => {});
  return {
    set({ speed = 0, boost = false, on = true }) {
      if (!alive) return;
      // (only when it's changed enough to hear: three new targets for the
      // audio thread every frame pile up for nothing)
      if (Math.abs(speed - last.speed) < 0.05 && boost === last.boost && on === last.on) return;
      last = { speed, boost, on };
      apply(last);
    },
    stop() {
      if (!alive) return;
      alive = false;
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0, now, 0.08);
      src?.stop(now + 0.5);
      setTimeout(() => master.disconnect(), 700);
    },
  };
}

function blip(ac, out, { type, f, at, dur, gain, glide = 1, filter = 0 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f * glide), at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.015, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let node = o.connect(g);
  if (filter) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    node = node.connect(lp);
  }
  node.connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

const VOICES = {
  rick: { type: 'sawtooth', f: 125, spread: 0.3, syl: 0.075, gain: 0.05, filter: 900 },
  morty: { type: 'square', f: 255, spread: 0.4, syl: 0.06, gain: 0.03, filter: 1800 },
  luke: { type: 'triangle', f: 215, spread: 0.18, syl: 0.075, gain: 0.07 },
  han: { type: 'sawtooth', f: 150, spread: 0.16, syl: 0.085, gain: 0.045, filter: 1100 },
  // Walt low and measured, Jesse quicker and higher
  walt: { type: 'triangle', f: 118, spread: 0.12, syl: 0.095, gain: 0.08 },
  jesse: { type: 'square', f: 200, spread: 0.36, syl: 0.062, gain: 0.03, filter: 1500 },
  // Hank, on his loudhailer in the cockpit's chase: big and gruff
  hank: { type: 'sawtooth', f: 98, spread: 0.2, syl: 0.08, gain: 0.05, filter: 800 },
};

// Someone says a line. Returns about how long it takes, in ms. Not over
// someone else's voice (lib/speech.js), and not with the voices off.
export function speak(voice, text) {
  const ac = audioContext();
  const out = ac ? voiceOutput() : null; // through the voice tap, so the speaker's mouth moves with it
  const words = text.replace(/\[|\]/g, '').split(/\s+/).filter(Boolean).length;
  if (!ac || !out || speech.busy() || !voicesOn()) return 600 + words * 260;
  const t = ac.currentTime + 0.02;
  if (voice === 'r2') {
    // Artoo: a run of whistles and chirps
    const n = 6 + Math.floor(Math.random() * 6);
    let at = t;
    for (let i = 0; i < n; i++) {
      const dur = 0.04 + Math.random() * 0.1;
      const f = 900 + Math.random() * 1900;
      blip(ac, out, { type: 'sine', f, at, dur, gain: 0.06, glide: 0.6 + Math.random() * 1.2 });
      at += dur + Math.random() * 0.05;
    }
    return (at - t) * 1000 + 300;
  }
  if (voice === 'chewie') {
    // Chewie himself: a laugh when it's a laugh, a roar the rest of the time
    const laugh = /laugh/i.test(text);
    playClip(laugh ? 'chewieLaugh' : 'chewieRoar', { voice: true }).then((h) => h || speech.busy() || growl(ac, out, t));
    return laugh ? 2700 : 1700;
  }
  const v = VOICES[voice];
  if (!v) return 600 + words * 260;
  // a blip a syllable (roughly), pitched up at a question
  const n = Math.min(22, Math.max(3, Math.round(text.length / 4)));
  const ask = /\?\s*$/.test(text);
  let at = t;
  for (let i = 0; i < n; i++) {
    const rise = ask && i > n - 3 ? 1.25 : 1;
    const f = v.f * rise * (1 + (Math.random() - 0.5) * v.spread);
    blip(ac, out, { type: v.type, f, at, dur: v.syl * (0.8 + Math.random() * 0.5), gain: v.gain, glide: 0.92, filter: v.filter });
    at += v.syl * (1 + Math.random() * 0.4) + (i % 4 === 3 ? 0.06 : 0);
  }
  return (at - t) * 1000 + 450;
}

// Chewie's growl, made up: in case his recording won't play
function growl(ac, out, t) {
  const dur = 0.9;
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, t);
  o.frequency.linearRampToValueAtTime(190, t + dur * 0.35);
  o.frequency.linearRampToValueAtTime(95, t + dur);
  const vib = ac.createOscillator();
  vib.frequency.value = 22;
  const vibG = ac.createGain();
  vibG.gain.value = 14;
  vib.connect(vibG).connect(o.frequency);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700;
  bp.Q.value = 1.6;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const breath = ac.createBufferSource();
  breath.buffer = noise(ac);
  const bg = ac.createGain();
  bg.gain.value = 0.25;
  breath.connect(bg).connect(bp);
  o.connect(bp).connect(g).connect(out);
  [o, vib, breath].forEach((n) => {
    n.start(t);
    n.stop(t + dur + 0.05);
  });
}

function tones(list, { type = 'square', gain = 0.05 } = {}) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + 0.02;
  for (const [f, at, dur] of list) blip(ac, out, { type, f, at: t + at, dur, gain });
}

function whoosh(dur, from, to, gain) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// A portal opening: a rising swirl
export function portalSound() {
  whoosh(0.8, 250, 1800, 0.14);
  tones(
    [
      [220, 0, 0.6],
      [330, 0.08, 0.6],
    ],
    { type: 'sine', gain: 0.05 },
  );
}

// Reaching a world: its sound bite. The site's clip where there is one,
// otherwise something made for it. Resolves when it has played (roughly),
// so the crew can talk after it.
const ARRIVE = {
  starwars: { clip: 'vader' },
  music: { clip: 'tanpura', duration: 3 },
  middleearth: { clip: 'lotr', duration: 5 },
  transformers: { clip: 'transform' },
  marvel: { clip: 'snap' },
  breakingbad: { clip: 'sayMyName' },
  office: { clip: 'twss' },
  rickmorty: { clip: 'pickleRick' },
  gaming: {
    // the Game Boy's startup ding
    play: () =>
      tones([
        [1047, 0, 0.09],
        [2093, 0.09, 0.5],
      ]),
    ms: 700,
  },
  travel: {
    // an airport chime
    play: () =>
      tones(
        [
          [784, 0, 0.5],
          [988, 0.35, 0.5],
          [1175, 0.7, 0.8],
        ],
        { type: 'sine', gain: 0.07 },
      ),
    ms: 1400,
  },
  caribbean: { clip: 'pirates', duration: 6 },
  invincible: {
    // something going past at the speed of sound, then a punch landing
    play: () => {
      whoosh(0.7, 1800, 180, 0.24);
      tones(
        [
          [82, 0.62, 0.35],
          [55, 0.66, 0.5],
        ],
        { type: 'sine', gain: 0.16 },
      );
    },
    ms: 1300,
  },
};

// docking at one of the stations: two soft tones, up
const DOCK = {
  play: () =>
    tones(
      [
        [659, 0, 0.35],
        [988, 0.16, 0.6],
      ],
      { type: 'sine', gain: 0.06 },
    ),
  ms: 700,
};

export async function arrivalSound(id) {
  const a = ARRIVE[id] ?? DOCK;
  if (a.play) {
    a.play();
    await new Promise((r) => setTimeout(r, a.ms));
    return;
  }
  const h = await playClip(a.clip, a.duration ? { duration: a.duration } : undefined);
  if (h) await Promise.race([h.ended, new Promise((r) => setTimeout(r, (a.duration ?? 6) * 1000))]);
}

// A burst of speed, each ship its own way (the RV's jets roar over its
// engine)
// recorded, each ship's own where there is one (the X-wing's pass and the
// Falcon's roar from the films), a thruster's burst for the other two
const BOOST = { xwing: 'xwingPass', falcon: 'falconPass', cruiser: 'thruster', rv: 'thruster' };
export function boostSound(kind, first) {
  if (kind === 'falcon' && first) playClip('hyperspaceEnter', { duration: 2.6 });
  else if (BOOST[kind]) playClip(BOOST[kind], { gain: 0.8 });
}

// A shot: Han's DL-44 from the Falcon, the portal gun from the cruiser, a
// laser from the X-wing, a cork popping out of a flask from the RV
export function fireSound(kind) {
  if (kind === 'falcon') playClip('dl44', { gain: 0.8 });
  else if (kind === 'cruiser') playClip('portalGun', { gain: 0.8, duration: 1.4 });
  else {
    const ac = audioContext();
    const out = ac ? output() : null;
    if (!ac || !out) return;
    const t = ac.currentTime + 0.01;
    if (kind === 'rv') {
      blip(ac, out, { type: 'sine', f: 1100, at: t, dur: 0.09, gain: 0.14, glide: 0.3 });
      blip(ac, out, { type: 'triangle', f: 380, at: t + 0.01, dur: 0.12, gain: 0.08, glide: 0.5 });
      return;
    }
    blip(ac, out, { type: 'sawtooth', f: 1800, at: t, dur: 0.16, gain: 0.07, glide: 0.25, filter: 3000 });
    blip(ac, out, { type: 'square', f: 1200, at: t + 0.02, dur: 0.12, gain: 0.04, glide: 0.3, filter: 2500 });
  }
}

// Into a planet too fast: a deep boom, the blast and the bits coming down
// k: how loud, 0…1 (ship.js's crashLoud, by the speed it went in at); 1 as it always was
export function crashSound(k = 1) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out || !(k > 0)) return;
  const v = Math.min(1, k);
  const t = ac.currentTime + 0.01;
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(32, t + 1.1);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 1.4);
  whoosh(1.4, 1600, 90, 0.32 * v);
  tones(
    [
      [180, 0.05, 0.12],
      [120, 0.2, 0.1],
      [210, 0.38, 0.08],
    ],
    { type: 'square', gain: 0.03 * v },
  );
}

// The Maw's hold on you: a low hum under a rumble, both swelling and
// rising as it pulls harder. set(k) every frame it has you (0 … 1, 0 to let
// it die away), stop() at the end
export function wellSound() {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return { set() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(out);
  const hum = [38, 57.4].map((f) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(master);
    o.start();
    return o;
  });
  // the rumble: noise, low and slowly breathing
  const rumble = ac.createBufferSource();
  rumble.buffer = noise(ac);
  rumble.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 90;
  lp.Q.value = 2.5;
  const rg = ac.createGain();
  rg.gain.value = 0.9;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.35;
  const lg = ac.createGain();
  lg.gain.value = 0.35;
  lfo.connect(lg).connect(rg.gain);
  rumble.connect(lp).connect(rg).connect(master);
  rumble.start();
  lfo.start();
  let alive = true;
  return {
    set(k) {
      if (!alive) return;
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0.32 * k ** 1.4, now, 0.25);
      lp.frequency.setTargetAtTime(90 + 260 * k * k, now, 0.3);
      hum.forEach((o, i) => o.frequency.setTargetAtTime((i ? 57.4 : 38) * (1 + 0.35 * k * k), now, 0.4));
    },
    stop() {
      if (!alive) return;
      alive = false;
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0, now, 0.15);
      for (const n of [...hum, rumble, lfo]) n.stop(now + 0.8);
      setTimeout(() => master.disconnect(), 1000);
    },
  };
}

// Into the black hole, the long way down: a deep swell, a tone that slides
// down and down, slower as it goes (time running slow at the edge, seen
// from outside), and the rush of the disk going round
export function fallSound() {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + 0.02;
  const swell = ac.createOscillator();
  swell.type = 'sine';
  swell.frequency.setValueAtTime(52, t);
  swell.frequency.exponentialRampToValueAtTime(24, t + 4.4);
  const sg = ac.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.5, t + 1.6);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
  swell.connect(sg).connect(out);
  const tone = ac.createOscillator();
  tone.type = 'sawtooth';
  tone.frequency.setValueAtTime(760, t);
  tone.frequency.setTargetAtTime(70, t, 1.15);
  const tl = ac.createBiquadFilter();
  tl.type = 'lowpass';
  tl.frequency.setValueAtTime(2400, t);
  tl.frequency.setTargetAtTime(260, t, 1.3);
  const tg = ac.createGain();
  tg.gain.setValueAtTime(0.0001, t);
  tg.gain.exponentialRampToValueAtTime(0.06, t + 0.3);
  tg.gain.setTargetAtTime(0.0001, t + 2.6, 0.45);
  tone.connect(tl).connect(tg).connect(out);
  for (const o of [swell, tone]) {
    o.start(t);
    o.stop(t + 5);
  }
  whoosh(2.8, 260, 2600, 0.15);
}

// Something going past you: a TIE fighter's scream (falling as it passes),
// or the rush of anything else
export function flybySound(kind) {
  if (kind === 'meeseeks') return; // he says it himself
  if (kind !== 'tie' && kind !== 'interceptor') {
    whoosh(1.1, 400, 1400, 0.12);
    return;
  }
  // a TIE's own scream, or one made like it
  playClip('tieScream', { duration: 2.4, gain: 0.7 }).then((h) => h || tieScream());
}

function tieScream() {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + 0.01;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 4;
  f.frequency.setValueAtTime(1300, t);
  f.frequency.exponentialRampToValueAtTime(520, t + 1.3);
  for (const detune of [0, 14]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(980 + detune, t);
    o.frequency.exponentialRampToValueAtTime(430 + detune, t + 1.3);
    o.connect(f);
    o.start(t);
    o.stop(t + 1.45);
  }
  f.connect(g).connect(out);
  whoosh(1.2, 2600, 500, 0.1);
}

// A ship shot down: a small, sharp blast
export function popSound() {
  whoosh(0.6, 2000, 200, 0.22);
  tones([[90, 0, 0.25]], { type: 'sine', gain: 0.18 });
}

// Back after a crash: out of a portal (the cruiser) or out of hyperspace
export function respawnSound(kind) {
  if (kind === 'cruiser') portalSound();
  else playClip('hyperspaceExit', { duration: 2 });
}

// Off the side of a planet
export const bumpSound = () => {
  tones([[140, 0, 0.18]], { type: 'sawtooth', gain: 0.08 });
  whoosh(0.2, 300, 120, 0.12);
};

// A laser hitting your shields: a crackle and a thump
export function hitSound() {
  whoosh(0.35, 3000, 600, 0.2);
  tones([[70, 0, 0.18]], { type: 'sine', gain: 0.2 });
  tones(
    [
      [880, 0, 0.04],
      [660, 0.05, 0.05],
    ],
    { type: 'sawtooth', gain: 0.025 },
  );
}

// Shields nearly gone: two falling alarm tones
export function alarmSound() {
  tones(
    [
      [740, 0, 0.16],
      [520, 0.2, 0.22],
      [740, 0.5, 0.16],
      [520, 0.7, 0.22],
    ],
    { type: 'square', gain: 0.035 },
  );
}

// The guns locking on to a hunter: two quick ticks, the second higher
export function lockSound() {
  tones(
    [
      [1180, 0, 0.05],
      [1560, 0.07, 0.07],
    ],
    { type: 'triangle', gain: 0.035 },
  );
}

// A hunter's shot going past: a short, thin zap
export function enemyFireSound() {
  tones([[1400, 0, 0.07]], { type: 'sawtooth', gain: 0.012 });
}

// Something big dropping out of hyperspace (or into it)
export function jumpSound(out = false) {
  playClip(out ? 'hyperspaceEnter' : 'hyperspaceExit', { duration: 2.2 });
}

// Pulled out of the pulse drive: the drive's whine dropping away, and a thud
export function interdictSound() {
  whoosh(0.9, 2400, 120, 0.3);
  tones([[60, 0.05, 0.3]], { type: 'sine', gain: 0.28 });
  tones(
    [
      [520, 0.1, 0.1],
      [390, 0.25, 0.14],
    ],
    { type: 'square', gain: 0.03 },
  );
}

// A star flaring: a low rumble that rises, and a deep note under it
export function flareSound() {
  whoosh(2.4, 60, 220, 0.2);
  tones([[48, 0, 1.6]], { type: 'sine', gain: 0.22 });
}

// A rift opening: a hum of two notes, and a rising rush
export function riftSound() {
  tones(
    [
      [110, 0, 2.5],
      [165, 0, 2.5],
    ],
    { type: 'sine', gain: 0.05 },
  );
  whoosh(1.2, 400, 1600, 0.08);
}

// ── the weapons (weapons.js) and the Citadel's siege ──

// changing weapons: a click and a rising chirp
export function switchSound() {
  tones(
    [
      [520, 0, 0.04],
      [880, 0.05, 0.06],
    ],
    { type: 'square', gain: 0.04 },
  );
}

// a heavy round away: a thump and a long rush (the cruiser's grenade, a portal's swirl)
export function launchSound(kind) {
  if (kind === 'cruiser') {
    whoosh(0.5, 400, 2400, 0.16);
    tones([[160, 0, 0.3]], { type: 'sine', gain: 0.12 });
    return;
  }
  whoosh(0.9, 1800, 260, 0.2);
  tones([[110, 0, 0.22]], { type: 'triangle', gain: 0.16 });
}

// the trigger on an empty rack
export function drySound() {
  tones([[220, 0, 0.03]], { type: 'square', gain: 0.03 });
}

// a heavy round going off (big: a generator going with it)
export function boomSound(big = false) {
  whoosh(big ? 1.4 : 0.8, 1600, 90, big ? 0.32 : 0.24);
  tones([[big ? 55 : 75, 0, big ? 0.7 : 0.35]], { type: 'sine', gain: big ? 0.3 : 0.2 });
}

// ── the ships' powers (shipPowers.js) ──
// Each power's own sound as it goes on, and the moments in it (a torpedo
// away, a shot from Chewie's turret, the crystal going off); the big one
// charged is a rising chime, a power that won't go the empty trigger. The
// words are the crew's (crews.js), on the comms.
export function powerSound(id, what) {
  if (what === 'denied') return drySound();
  if (what === 'ready') {
    tones(
      [
        [660, 0, 0.12],
        [990, 0.1, 0.12],
        [1320, 0.2, 0.32],
      ],
      { type: 'sine', gain: 0.05 },
    );
    return;
  }
  if (what === 'launch') return launchSound(id === 'heisenberg' ? 'rv' : 'xwing');
  if (what === 'blast') return boomSound(true);
  if (what === 'shot') {
    // a quad laser: a quick falling zap, a little lower than an X-wing's
    const ac = audioContext();
    const out = ac ? output() : null;
    if (!ac || !out) return;
    const t = ac.currentTime + 0.01;
    blip(ac, out, { type: 'sawtooth', f: 1300, at: t, dur: 0.13, gain: 0.045, glide: 0.3, filter: 2600 });
    return;
  }
  if (what !== 'use') return;
  if (id === 'focus') {
    // the Force: a low swell, time going thick
    whoosh(1.6, 180, 900, 0.09);
    tones(
      [
        [98, 0, 1.6],
        [147, 0.06, 1.5],
      ],
      { type: 'sine', gain: 0.08 },
    );
  } else if (id === 'odds') boostSound('falcon', false);
  else if (id === 'portal') portalSound();
  else if (id === 'wubba') {
    // the death ray: a crackling hum for as long as it's on
    tones(
      Array.from({ length: 14 }, (_, i) => [70 + (i % 2) * 6, i * 0.25, 0.3]),
      { type: 'sawtooth', gain: 0.05 },
    );
    whoosh(3.5, 2400, 900, 0.05);
  } else if (id === 'magnets') {
    // the magnet winding up: a rising electric whine
    const ac = audioContext();
    const out = ac ? output() : null;
    if (!ac || !out) return;
    const t = ac.currentTime + 0.01;
    blip(ac, out, { type: 'square', f: 180, at: t, dur: 1.1, gain: 0.03, glide: 5, filter: 2200 });
    blip(ac, out, { type: 'sine', f: 360, at: t + 0.05, dur: 1.1, gain: 0.05, glide: 4 });
  } else if (id === 'heisenberg') whoosh(0.6, 500, 2200, 0.12); // (the crystal thrown)
}

// a shot into the Citadel's shield: a fizzing hum
export function shieldSound() {
  tones(
    [
      [1240, 0, 0.05],
      [930, 0.03, 0.08],
    ],
    { type: 'sawtooth', gain: 0.025 },
  );
  whoosh(0.25, 4200, 1800, 0.08);
}

// ── Guns on foot ──
// A burst of noise through a filter: the crack and the tail of a gunshot
function burst(ac, out, { at, dur, gain, type = 'highpass', f = 1500, q = 0.7, decay = 1 }) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const flt = ac.createBiquadFilter();
  flt.type = type;
  flt.frequency.value = f;
  flt.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.setTargetAtTime(0.0001, at + 0.004, dur / (4 * decay));
  src.connect(flt).connect(g).connect(out);
  src.start(at, Math.random() * 1.5);
  src.stop(at + dur + 0.1);
}

// A shot from a gun on foot (gunplay.js's kinds), `soft` for your crewmate's
// (a little further off): a powder gun's crack, its thump and the street
// throwing it back, and the pistol's brass landing; the blasters' recorded
// shot (Han's DL-44), heavier for Chewie's bowcaster; the portal gun's; and
// Morty's laser, a quick falling zap.
export function gunSound(gun, { soft = false } = {}) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const k = soft ? 0.55 : 1;
  const t = ac.currentTime + 0.005;
  if (gun === 'revolver' || gun === 'pistol') {
    burst(ac, out, { at: t, dur: 0.07, gain: 0.5 * k, type: 'highpass', f: 1800 }); // the crack
    burst(ac, out, { at: t, dur: 0.22, gain: 0.32 * k, type: 'lowpass', f: 900 }); // the blast
    blip(ac, out, { type: 'sine', f: 140, at: t, dur: 0.16, gain: 0.32 * k, glide: 0.35 }); // the thump
    burst(ac, out, { at: t + 0.05, dur: 0.6, gain: 0.05 * k, type: 'bandpass', f: 700, q: 0.6 }); // the echo
    if (gun === 'pistol' && !soft) {
      // the case landing: two light ticks
      for (const [f, at] of [
        [5200, 0.42],
        [6100, 0.53],
        [5600, 0.6],
      ])
        blip(ac, out, { type: 'triangle', f, at: t + at, dur: 0.05, gain: 0.012, glide: 0.92 });
    }
    return;
  }
  if (gun === 'shotgun' || gun === 'sniper' || gun === 'smg') {
    // powder guns of other worlds: a scattergun's boom, a long rifle's crack and its echo, a machine pistol's snap
    const big = gun === 'shotgun' ? 1.4 : gun === 'sniper' ? 1.2 : 0.6;
    burst(ac, out, { at: t, dur: 0.06, gain: 0.5 * k * Math.min(1, big), type: 'highpass', f: gun === 'smg' ? 2400 : 1500 });
    burst(ac, out, { at: t, dur: 0.18 * big, gain: 0.34 * k * big, type: 'lowpass', f: gun === 'shotgun' ? 500 : 800 });
    blip(ac, out, { type: 'sine', f: gun === 'shotgun' ? 70 : 120, at: t, dur: 0.14 * big, gain: 0.3 * k * big, glide: 0.35 });
    if (gun !== 'smg') burst(ac, out, { at: t + 0.06, dur: 0.9 * big, gain: 0.05 * k, type: 'bandpass', f: 600, q: 0.6 }); // the echo off the hills
    return;
  }
  if (gun === 'blaster' || gun === 'bowcaster' || gun === 'a280' || gun === 'dlt19' || gun === 'ee3' || gun === 'westar') {
    // the galaxy's blasters: the DL-44's clip, lighter and higher for the small fast ones
    const light = gun === 'dlt19' || gun === 'westar';
    playClip('dl44', { gain: (light ? 0.5 : 0.8) * k });
    if (light) blip(ac, out, { type: 'sawtooth', f: 2600, at: t, dur: 0.08, gain: 0.05 * k, glide: 0.3, filter: 4000 });
    if (gun === 'bowcaster') blip(ac, out, { type: 'sine', f: 95, at: t, dur: 0.25, gain: 0.28 * k, glide: 0.5 }); // a quarrel's weight
    return;
  }
  if (gun === 'portal') {
    playClip('portalGun', { gain: 0.8 * k, duration: 1.4 });
    return;
  }
  if (gun === 'freeze') {
    // the freeze ray: a cold hiss out of the nozzle, a glassy ring over it
    burst(ac, out, { at: t, dur: 0.32, gain: 0.12 * k, type: 'highpass', f: 5200 });
    blip(ac, out, { type: 'sine', f: 3400, at: t, dur: 0.3, gain: 0.05 * k, glide: 0.6 });
    blip(ac, out, { type: 'triangle', f: 5100, at: t + 0.03, dur: 0.22, gain: 0.03 * k, glide: 0.8 });
    return;
  }
  if (gun === 'shrink') {
    // the shrink ray: the old ray gun's warble, falling away
    blip(ac, out, { type: 'sawtooth', f: 1300, at: t, dur: 0.22, gain: 0.05 * k, glide: 0.25, filter: 2600 });
    blip(ac, out, { type: 'sine', f: 900, at: t, dur: 0.24, gain: 0.08 * k, glide: 2.2 });
    return;
  }
  // a laser: a bright zap falling away, a little fizz
  blip(ac, out, { type: 'sawtooth', f: 2400, at: t, dur: 0.13, gain: 0.06 * k, glide: 0.22, filter: 4200 });
  blip(ac, out, { type: 'square', f: 1600, at: t + 0.01, dur: 0.1, gain: 0.03 * k, glide: 0.3, filter: 3000 });
  burst(ac, out, { at: t, dur: 0.08, gain: 0.05 * k, type: 'highpass', f: 4000 });
}

// What Rick's gadgets do to the one they kill (lib/three/gadgetFx.js), by
// the kill's moment: the freeze ray's 'hit' (the ice cracking over them) and
// 'shatter'; the shrink ray's 'hit' (a falling whistle), 'squeak' and 'pop'
export function gadgetSound(gun, ev) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + 0.005;
  if (gun === 'freeze' && ev === 'hit') {
    for (let i = 0; i < 6; i++) burst(ac, out, { at: t + i * 0.05 + Math.random() * 0.03, dur: 0.04, gain: 0.08, type: 'bandpass', f: 2500 + Math.random() * 2500, q: 4 });
    blip(ac, out, { type: 'sine', f: 220, at: t, dur: 0.5, gain: 0.06, glide: 0.5 });
  } else if (gun === 'freeze' && ev === 'shatter') {
    burst(ac, out, { at: t, dur: 0.35, gain: 0.32, type: 'highpass', f: 2800 });
    burst(ac, out, { at: t, dur: 0.15, gain: 0.2, type: 'lowpass', f: 700 });
    // the shards landing: tinkles, scattered
    for (let i = 0; i < 9; i++) blip(ac, out, { type: 'triangle', f: 2600 + Math.random() * 3600, at: t + 0.08 + Math.random() * 0.6, dur: 0.07, gain: 0.025, glide: 0.9 });
  } else if (gun === 'shrink' && ev === 'hit') {
    blip(ac, out, { type: 'sine', f: 260, at: t, dur: 0.5, gain: 0.1, glide: 7 });
    blip(ac, out, { type: 'square', f: 130, at: t, dur: 0.45, gain: 0.02, glide: 7, filter: 2400 });
  } else if (gun === 'shrink' && ev === 'squeak') {
    blip(ac, out, { type: 'sine', f: 2400, at: t, dur: 0.08, gain: 0.07, glide: 1.4 });
    blip(ac, out, { type: 'sine', f: 2900, at: t + 0.1, dur: 0.1, gain: 0.07, glide: 1.25 });
  } else if (gun === 'shrink' && ev === 'pop') {
    burst(ac, out, { at: t, dur: 0.05, gain: 0.22, type: 'bandpass', f: 1800, q: 1.4 });
    blip(ac, out, { type: 'sine', f: 600, at: t, dur: 0.08, gain: 0.12, glide: 0.3 });
  }
}

// A shot landing near you on foot: a sharp crack of something hit
export function impactSound(near = 1) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + 0.005;
  burst(ac, out, { at: t, dur: 0.12, gain: 0.14 * near, type: 'bandpass', f: 2400, q: 0.9 });
  blip(ac, out, { type: 'sine', f: 110, at: t, dur: 0.1, gain: 0.08 * near, glide: 0.5 });
}

// The crackle of the plasma on the way in: two seconds of sparse clicks,
// each a sharp tick dying away, louder or softer at random (made once, and
// looped)
let crackleBuf = null;
function crackle(ac) {
  if (crackleBuf) return crackleBuf;
  const n = ac.sampleRate * 2;
  crackleBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = crackleBuf.getChannelData(0);
  const tick = Math.round(ac.sampleRate * 0.004);
  for (let k = 0; k < 70; k++) {
    const at = Math.floor(Math.random() * (n - tick));
    const level = 0.3 + Math.random() * 0.7;
    for (let i = 0; i < tick; i++) d[at + i] += (Math.random() * 2 - 1) * level * (1 - i / tick) ** 2;
  }
  return crackleBuf;
}

// Into a planet's air (an entry): the roar of it, noise through a band
// that climbs as it gets hotter, a low rumble under it, and the plasma's
// crackle when it's at its hottest. set(k) every frame of the entry (0 … 1,
// the burn), stop() at the end
export function entrySound() {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return { set() {}, stop() {} };
  const master = ac.createGain();
  master.gain.value = 1;
  master.connect(out);
  // the roar: noise through a band, higher and brighter the hotter it is
  const roar = ac.createBufferSource();
  roar.buffer = noise(ac);
  roar.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 220;
  band.Q.value = 0.7;
  const roarG = ac.createGain();
  roarG.gain.value = 0;
  roar.connect(band).connect(roarG).connect(master);
  // the rumble: the same noise, low (from elsewhere in it, so the two don't
  // move together)
  const rumble = ac.createBufferSource();
  rumble.buffer = noise(ac);
  rumble.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 85;
  lp.Q.value = 1.8;
  const rumbleG = ac.createGain();
  rumbleG.gain.value = 0;
  rumble.connect(lp).connect(rumbleG).connect(master);
  // the crackle, only near the top
  const clicks = ac.createBufferSource();
  clicks.buffer = crackle(ac);
  clicks.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const clickG = ac.createGain();
  clickG.gain.value = 0;
  clicks.connect(hp).connect(clickG).connect(master);
  const sources = [roar, rumble, clicks];
  roar.start(0, Math.random() * 1.5);
  rumble.start(0, Math.random() * 1.5);
  clicks.start(0, Math.random() * 1.5);
  let alive = true;
  let last = -1;
  return {
    set(k) {
      if (!alive) return;
      // (only when it's changed enough to hear)
      if (Math.abs(k - last) < 0.005) return;
      last = k;
      const now = ac.currentTime;
      roarG.gain.setTargetAtTime(0.28 * k ** 1.2, now, 0.15);
      band.frequency.setTargetAtTime(220 + 1500 * k ** 1.5, now, 0.2);
      rumbleG.gain.setTargetAtTime(0.7 * k, now, 0.25);
      const hot = Math.min(1, Math.max(0, (k - 0.6) / 0.4));
      clickG.gain.setTargetAtTime(0.3 * hot * hot, now, 0.1);
    },
    stop() {
      if (!alive) return;
      alive = false;
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0, now, 0.1);
      for (const n of sources) n.stop(now + 0.4);
      setTimeout(() => {
        for (const n of [...sources, band, lp, hp, roarG, rumbleG, clickG, master]) n.disconnect();
      }, 500);
    },
  };
}
