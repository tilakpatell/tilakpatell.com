// The few voices the site's synthesised sounds are made of (the universe
// map's in sounds.js, the unique weapons' in uniqueSounds.js): white noise,
// a tone that glides, a run of tones, a filtered rush, a gunshot's crack.
// All through the site's master volume (lib/audio's output).

import { audioContext, output } from '../../lib/audio';

let noiseBuf = null;
export function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function blip(ac, out, { type, f, at, dur, gain, glide = 1, filter = 0 }) {
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

export function tones(list, { type = 'square', gain = 0.05 } = {}) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + 0.02;
  for (const [f, at, dur] of list) blip(ac, out, { type, f, at: t + at, dur, gain });
}

export function whoosh(dur, from, to, gain) {
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

// A burst of noise through a filter: the crack and the tail of a gunshot
export function burst(ac, out, { at, dur, gain, type = 'highpass', f = 1500, q = 0.7, decay = 1 }) {
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
