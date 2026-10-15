// Cirith Ungol, in sound, synthesised so nothing is downloaded: the
// Morgul vale's dead hum, wind on the stairs, the lair's drip and
// skitter, the Tower's shouting; the green beam going up, the Witch-king's
// cry, falling stone, the phial's ring, Shelob's hiss and scream, Sting,
// and steel. All through the site's master volume.

import { audioContext, output } from '../../../../lib/audio';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
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

// The air of each place: place('vale' | 'stairs' | 'lair' | 'tower').
// { place, stop }.
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
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 300;
  bp.Q.value = 0.8;
  const wind = ac.createGain();
  wind.gain.value = 0.08;
  src.connect(bp).connect(wind).connect(master);
  src.start();
  const hum = ac.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 41;
  const humGain = ac.createGain();
  humGain.gain.value = 0.0001;
  hum.connect(humGain).connect(master);
  hum.start();
  let where = 'vale';
  let on = true;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (where === 'lair') {
      // a drip; something skittering
      const f = 900 + Math.random() * 900;
      tone(ac, master, t, { f, to: f * 1.8, gain: 0.03, attack: 0.002, length: 0.08 });
      if (Math.random() < 0.35) for (let i = 0; i < 6; i++) hiss(ac, master, t + 0.3 + i * 0.05, { type: 'highpass', f: 3000, gain: 0.02, attack: 0.001, length: 0.02 });
    } else if (where === 'tower') {
      if (Math.random() < 0.5) hiss(ac, master, t, { type: 'bandpass', f: 600 + Math.random() * 300, q: 2, gain: 0.05, attack: 0.05, length: 0.4 });
    } else bp.frequency.setTargetAtTime(200 + Math.random() * 300, t, 1.5);
    timer = setTimeout(tick, 900 + Math.random() * 1600);
  };
  let timer = setTimeout(tick, 500);
  return {
    place(z) {
      where = z;
      const now = ac.currentTime;
      wind.gain.setTargetAtTime(z === 'stairs' ? 0.12 : z === 'vale' ? 0.06 : 0.015, now, 1);
      humGain.gain.setTargetAtTime(z === 'vale' ? 0.02 : 0.0001, now, 1);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
      hum.stop(ac.currentTime + 1);
    },
  };
}

// the green beam going up out of Minas Morgul
export function beam() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  hiss(ac, out, t, { type: 'lowpass', f: 140, gain: 0.5, attack: 0.05, length: 2.5, sweep: 60 });
  tone(ac, out, t + 0.4, { type: 'sawtooth', f: 60, to: 240, gain: 0.07, attack: 0.4, length: 3.5 });
  hiss(ac, out, t + 0.4, { type: 'bandpass', f: 400, q: 1, gain: 0.15, attack: 0.5, length: 3.5, sweep: 2400 });
}
// the Witch-king, feeling for you: a rasping cry
export function wraith() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sawtooth', f: 700, to: 1300, gain: 0.05, attack: 0.2, length: 1.4 });
  hiss(ac, out, t, { type: 'bandpass', f: 2200, q: 5, gain: 0.1, attack: 0.2, length: 1.4, sweep: 3400 });
}
// stone giving way under you
export function rocks() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 6; i++) hiss(ac, out, t + i * 0.1, { type: 'lowpass', f: 700 + Math.random() * 600, gain: 0.2, attack: 0.002, length: 0.15 });
  tone(ac, out, t, { f: 70, to: 40, gain: 0.3, attack: 0.01, length: 0.6 });
}
// the phial lit: a clear rising chord
export function phial() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  [1047, 1319, 1568, 2093].forEach((f, i) => tone(ac, out, t + i * 0.06, { f, gain: 0.05, attack: 0.05, length: 1.8 }));
}
// Shelob: a long wet hiss
function hiss2() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 2400, gain: 0.25, attack: 0.05, length: 0.9 });
  hiss(ac, out, t, { type: 'bandpass', f: 500, q: 2, gain: 0.1, attack: 0.05, length: 0.8 });
}
export { hiss2 as hiss };
// her scream, beaten
export function scream() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'sawtooth', f: 400, to: 1200, gain: 0.08, attack: 0.05, length: 1.2 });
  hiss(ac, out, t, { type: 'bandpass', f: 1800, q: 2, gain: 0.25, attack: 0.05, length: 1.3, sweep: 3000 });
}
// Sting going in
export function stab() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 4000, gain: 0.2, attack: 0.002, length: 0.12 });
  tone(ac, out, t, { type: 'triangle', f: 1600, to: 1400, gain: 0.05, attack: 0.002, length: 0.5 });
}
// a dodge
export function whoosh() {
  const [ac, out] = ready();
  if (!ac) return;
  hiss(ac, out, ac.currentTime + 0.01, { type: 'bandpass', f: 800, q: 0.8, gain: 0.15, attack: 0.03, length: 0.3, sweep: 300 });
}
// thrown against the rock
export function thud() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: 80, to: 40, gain: 0.45, attack: 0.002, length: 0.3 });
  hiss(ac, out, t, { type: 'lowpass', f: 700, gain: 0.25, attack: 0.002, length: 0.2 });
}
// an orc's shout
export function shout() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'sawtooth', f: 150, to: 110, gain: 0.08, attack: 0.03, length: 0.6 });
  hiss(ac, out, t, { type: 'bandpass', f: 700, q: 1.5, gain: 0.15, attack: 0.03, length: 0.6 });
}
// steel on steel
export function clash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'highpass', f: 3500, gain: 0.25, attack: 0.001, length: 0.2 });
  tone(ac, out, t, { type: 'triangle', f: 1480, to: 1320, gain: 0.06, attack: 0.002, length: 0.9 });
}

// ── crumbs on Sam's cloak ──
// a brush of the hand over cloth: a soft whisk, and a tick for each crumb
// flicked away (none: a rustle)
export function whisk(got = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  hiss(ac, out, t, { type: 'bandpass', f: got ? 2400 : 1200, q: 0.9, gain: got ? 0.06 : 0.1, attack: 0.02, length: got ? 0.18 : 0.35, sweep: got ? 3600 : 700 });
  for (let i = 0; i < got; i++) tone(ac, out, t + 0.06 + i * 0.05, { type: 'triangle', f: 2200 + i * 260, gain: 0.025, attack: 0.002, length: 0.06 });
}
// Frodo, murmuring in his sleep
export function murmur() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { type: 'triangle', f: 180, to: 150, gain: 0.04, attack: 0.08, length: 0.5 });
  hiss(ac, out, t, { type: 'lowpass', f: 500, gain: 0.05, attack: 0.1, length: 0.5 });
}
