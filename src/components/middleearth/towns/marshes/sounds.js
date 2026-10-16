// The Emyn Muil, the Dead Marshes and the Black Gate, in sound, synthesised
// so nothing is downloaded: wind and thunder among the rocks, the marsh's
// drip and bubble, the ash-wind before the Gate; a knock on the rock,
// Gollum's gollum, a scuffle, the lights' chime, a splash, the Nazgûl's
// shriek, the Easterlings' horns and the Gate grinding open. All through
// the site's master volume.

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

// The air of each place: place('emyn') wind and rain in the rocks,
// 'marsh' still and dripping, 'gate' a hot dry wind. { place, stop }.
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
  bp.frequency.value = 400;
  bp.Q.value = 0.7;
  const wind = ac.createGain();
  wind.gain.value = 0.12;
  src.connect(bp).connect(wind).connect(master);
  src.start();
  let where = 'emyn';
  let on = true;
  const tick = () => {
    if (!on) return;
    const t = ac.currentTime + 0.05;
    if (where === 'emyn') {
      bp.frequency.setTargetAtTime(280 + Math.random() * 420, t, 1);
      // rain on rock
      for (let i = 0; i < 6; i++) hiss(ac, master, t + Math.random() * 0.8, { type: 'highpass', f: 3000 + Math.random() * 3000, gain: 0.02, attack: 0.001, length: 0.02 });
      if (Math.random() < 0.08) thunder(master, 0.5);
    } else if (where === 'marsh') {
      // a drip, a bubble rising out of the mud
      const f = 300 + Math.random() * 500;
      tone(ac, master, t, { f, to: f * 2.2, gain: 0.04, attack: 0.005, length: 0.12 });
      if (Math.random() < 0.3) tone(ac, master, t + 0.4, { type: 'triangle', f: 140, to: 120, gain: 0.03, attack: 0.05, length: 0.4 });
    } else bp.frequency.setTargetAtTime(200 + Math.random() * 250, t, 1.5);
    timer = setTimeout(tick, where === 'emyn' ? 700 : 900 + Math.random() * 1700);
  };
  let timer = setTimeout(tick, 500);
  return {
    place(z) {
      where = z;
      wind.gain.setTargetAtTime(z === 'emyn' ? 0.14 : z === 'marsh' ? 0.025 : 0.09, ac.currentTime, 1);
    },
    stop() {
      on = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
      src.stop(ac.currentTime + 1);
    },
  };
}

function thunder(out0, k = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const o = out0 ?? out;
  const t = ac.currentTime + 0.05 + Math.random() * 0.3;
  hiss(ac, o, t, { type: 'lowpass', f: 600, gain: 0.5 * k, attack: 0.02, length: 0.4, sweep: 120 });
  hiss(ac, o, t + 0.2, { type: 'lowpass', f: 220, gain: 0.45 * k, attack: 0.3, length: 2.8, sweep: 80 });
}
// thunder, rolling round the rocks
const thunderClap = () => thunder(null, 1);
export { thunderClap as thunder };
// a knock against the rock
export function knock() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(ac, out, t, { f: 90, to: 50, gain: 0.4, attack: 0.002, length: 0.25 });
  hiss(ac, out, t, { type: 'bandpass', f: 1200, q: 1, gain: 0.2, attack: 0.002, length: 0.15 });
}
// gollum, gollum: a wet swallowing click (k: louder when he's startled)
export function gollum(k = 0.5) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 2; i++) {
    tone(ac, out, t + i * 0.22, { type: 'triangle', f: 220 + i * 40, to: 140, gain: 0.05 * (0.6 + k), attack: 0.01, length: 0.14 });
    hiss(ac, out, t + i * 0.22, { type: 'bandpass', f: 1800, q: 5, gain: 0.04 * (0.6 + k), attack: 0.005, length: 0.08 });
  }
  if (k > 0.8) hiss(ac, out, t + 0.5, { type: 'bandpass', f: 2600, q: 2, gain: 0.12, attack: 0.02, length: 0.6, sweep: 3600 });
}
// a scuffle on the rock, and a scream
export function scuffle() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 5; i++) hiss(ac, out, t + i * 0.09, { type: 'lowpass', f: 900, gain: 0.2, attack: 0.002, length: 0.08 });
  hiss(ac, out, t + 0.3, { type: 'bandpass', f: 2400, q: 3, gain: 0.15, attack: 0.03, length: 0.9, sweep: 3400 });
}
// a light in the pool, near: a faint glass chime
export function wisp() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  [1568, 1976, 2349].forEach((f, i) => tone(ac, out, t + i * 0.15, { f, gain: 0.025, attack: 0.1, length: 1.6 }));
}
// into the black water
export function splash() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  hiss(ac, out, t, { type: 'bandpass', f: 700, q: 0.7, gain: 0.35, attack: 0.01, length: 0.7, sweep: 200 });
  tone(ac, out, t + 0.1, { f: 160, to: 70, gain: 0.15, attack: 0.05, length: 1.2 });
}
// the Nazgûl on its fell beast: a long rising shriek
export function shriek() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sawtooth', f: 900, to: 1700, gain: 0.07, attack: 0.15, length: 1.6 });
  tone(ac, out, t, { type: 'sawtooth', f: 1240, to: 2100, gain: 0.04, attack: 0.15, length: 1.5 });
  hiss(ac, out, t, { type: 'bandpass', f: 2600, q: 4, gain: 0.12, attack: 0.15, length: 1.7, sweep: 4200 });
  // and the wings, beating over
  for (let i = 0; i < 5; i++) hiss(ac, out, t + 1.6 + i * 0.6, { type: 'lowpass', f: 300, gain: 0.3, attack: 0.08, length: 0.4 });
}
// the Easterlings' horns
export function horn() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(ac, out, t, { type: 'sawtooth', f: 116, to: 110, gain: 0.07, attack: 0.15, length: 1.4 });
  tone(ac, out, t, { type: 'sawtooth', f: 174, to: 165, gain: 0.04, attack: 0.15, length: 1.4 });
}
// the Black Gate grinding open
export function gate() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  horn();
  hiss(ac, out, t + 1, { type: 'bandpass', f: 120, q: 2, gain: 0.45, attack: 0.8, length: 5, sweep: 70 });
  tone(ac, out, t + 1, { type: 'sawtooth', f: 38, to: 32, gain: 0.08, attack: 1, length: 5 });
  for (let i = 0; i < 6; i++) hiss(ac, out, t + 1.2 + i * 0.7, { type: 'highpass', f: 2200, gain: 0.05, attack: 0.01, length: 0.2 });
}

// ── Sméagol's safe way ──
// a hop onto a tussock: a soft squelch (Gollum's lighter)
export function squelch(k = 1) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  hiss(ac, out, t, { type: 'lowpass', f: 420 + k * 200, q: 1.5, gain: 0.12 * k, attack: 0.01, length: 0.22, sweep: 160 });
  tone(ac, out, t, { f: 120, to: 80, gain: 0.05 * k, attack: 0.01, length: 0.15 });
}
// a tussock giving way under you: the glug as you go in
export function sink() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  for (let i = 0; i < 4; i++) tone(ac, out, t + 0.12 + i * 0.13, { f: 200 - i * 25, to: 120 - i * 15, gain: 0.08, attack: 0.01, length: 0.14 });
  splash();
}
