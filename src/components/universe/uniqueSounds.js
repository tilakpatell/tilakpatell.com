// The skill tree's unique weapons, heard (lib/arms's: the ship's four and
// the hand's four). Synthesised, through the site's master volume, as the
// map's own sounds are (synth.js).
//
// shipSound(id, what): the ship's, as each goes away ('fire') and at its
//   moment: the seismic charge's 'blast' (the ring's long, falling hum over a
//   shimmer, after the silence its fuse is), the cluster's 'burst' (glass),
//   the arc's 'arc' and 'fizzle'.
// handSound(gun, { soft }): a shot of the hand's (the Amban's phase pulse, a
//   tick of the particle beam, the M60's crack, the gauntlet's repulsor).
// handShowSound(gun, ev): a kill by one of them, as its show goes (lib/three/
//   gadgetFx.js's light and thrown: 'hit').

import { audioContext, output } from '../../lib/audio';
import { blip, burst, tones, whoosh } from './synth';

const HAND = ['amban', 'particle', 'm60', 'gauntlet'];
export const isUniqueGun = (gun) => HAND.includes(gun);

const ready = () => {
  const ac = audioContext();
  const out = ac ? output() : null;
  return ac && out ? { ac, out, t: ac.currentTime + 0.005 } : null;
};

export function shipSound(id, what = 'fire') {
  const a = ready();
  if (!a) return;
  const { ac, out, t } = a;
  if (id === 'seismic' && what === 'fire') {
    // the charge let go: a clunk, and a low note falling away behind
    burst(ac, out, { at: t, dur: 0.06, gain: 0.18, type: 'lowpass', f: 600 });
    blip(ac, out, { type: 'triangle', f: 180, at: t, dur: 0.4, gain: 0.08, glide: 0.4 });
  } else if (id === 'seismic' && what === 'blast') {
    // the ring: a long hum falling a couple of octaves, a shimmer over it, the air pushed out
    blip(ac, out, { type: 'sine', f: 240, at: t, dur: 1.6, gain: 0.3, glide: 0.22 });
    blip(ac, out, { type: 'sine', f: 120, at: t, dur: 1.8, gain: 0.22, glide: 0.4 });
    blip(ac, out, { type: 'sawtooth', f: 1900, at: t + 0.02, dur: 0.9, gain: 0.025, glide: 0.45, filter: 3200 });
    whoosh(1.2, 2400, 140, 0.16);
  } else if (id === 'darkmatter') {
    // a deep, wobbling whump
    blip(ac, out, { type: 'sawtooth', f: 95, at: t, dur: 0.5, gain: 0.08, glide: 0.5, filter: 700 });
    blip(ac, out, { type: 'sine', f: 48, at: t, dur: 0.6, gain: 0.22, glide: 0.7 });
    blip(ac, out, { type: 'sine', f: 620, at: t, dur: 0.3, gain: 0.03, glide: 0.3 });
  } else if (id === 'crystal' && what === 'fire') {
    whoosh(0.6, 500, 2200, 0.12);
    tones([[330, 0, 0.18]], { type: 'triangle', gain: 0.08 });
  } else if (id === 'crystal' && what === 'burst') {
    // glass going: a crack and bright tinkles thrown out
    burst(ac, out, { at: t, dur: 0.18, gain: 0.22, type: 'highpass', f: 3000 });
    for (let i = 0; i < 6; i++) blip(ac, out, { type: 'triangle', f: 2800 + Math.random() * 3400, at: t + 0.02 + Math.random() * 0.25, dur: 0.07, gain: 0.03, glide: 0.9 });
  } else if (id === 'energon' && what !== 'fire') {
    // lightning (heard as it lands, its 'arc' or its 'fizzle'): a run of crackles, and a rising buzz under them
    const k = what === 'fizzle' ? 0.4 : 1;
    for (let i = 0; i < 7; i++) burst(ac, out, { at: t + i * 0.022 + Math.random() * 0.01, dur: 0.03, gain: 0.14 * k, type: 'bandpass', f: 1800 + Math.random() * 3000, q: 3 });
    blip(ac, out, { type: 'sawtooth', f: 700, at: t, dur: 0.22, gain: 0.05 * k, glide: 3, filter: 3600 });
  }
}

export function handSound(gun, { soft = false } = {}) {
  const a = ready();
  if (!a) return;
  const { ac, out, t } = a;
  const k = soft ? 0.55 : 1;
  if (gun === 'amban') {
    // the phase pulse: a hard crack, a thrum, and a zing climbing away
    burst(ac, out, { at: t, dur: 0.08, gain: 0.5 * k, type: 'highpass', f: 1300 });
    blip(ac, out, { type: 'sine', f: 75, at: t, dur: 0.45, gain: 0.34 * k, glide: 0.45 });
    blip(ac, out, { type: 'sawtooth', f: 520, at: t + 0.01, dur: 0.22, gain: 0.05 * k, glide: 3.2, filter: 4200 });
    burst(ac, out, { at: t + 0.06, dur: 1, gain: 0.05 * k, type: 'bandpass', f: 600, q: 0.6 });
  } else if (gun === 'particle') {
    // a tick of the beam: a buzzing hum, short enough to run together held
    blip(ac, out, { type: 'square', f: 150, at: t, dur: 0.12, gain: 0.03 * k, glide: 1.04, filter: 1800 });
    blip(ac, out, { type: 'sawtooth', f: 610, at: t, dur: 0.11, gain: 0.02 * k, glide: 0.96, filter: 2600 });
  } else if (gun === 'm60') {
    // a belt-fed rifle: the crack, a heavy blast and the thump, sharper than a pistol's
    burst(ac, out, { at: t, dur: 0.05, gain: 0.48 * k, type: 'highpass', f: 1700 });
    burst(ac, out, { at: t, dur: 0.17, gain: 0.36 * k, type: 'lowpass', f: 750 });
    blip(ac, out, { type: 'sine', f: 105, at: t, dur: 0.12, gain: 0.3 * k, glide: 0.35 });
  } else if (gun === 'gauntlet') {
    // the repulsor: a whine up, the blast, the air thrown
    blip(ac, out, { type: 'sine', f: 380, at: t, dur: 0.18, gain: 0.08 * k, glide: 4 });
    burst(ac, out, { at: t + 0.05, dur: 0.22, gain: 0.3 * k, type: 'bandpass', f: 1100, q: 0.8 });
    blip(ac, out, { type: 'sine', f: 90, at: t + 0.05, dur: 0.25, gain: 0.3 * k, glide: 0.5 });
  }
}

export function handShowSound(gun, ev) {
  if (ev !== 'hit') return;
  const a = ready();
  if (!a) return;
  const { ac, out, t } = a;
  if (gun === 'amban') {
    // gone in light: a bright rising chord, thinning to nothing
    blip(ac, out, { type: 'sine', f: 880, at: t, dur: 0.7, gain: 0.06, glide: 2 });
    blip(ac, out, { type: 'sine', f: 1320, at: t + 0.04, dur: 0.6, gain: 0.04, glide: 2 });
  } else if (gun === 'particle') {
    // burnt up: a crackle, a soft roar of flame
    for (let i = 0; i < 5; i++) burst(ac, out, { at: t + i * 0.06 + Math.random() * 0.04, dur: 0.05, gain: 0.08, type: 'bandpass', f: 2000 + Math.random() * 2000, q: 3 });
    whoosh(0.8, 300, 1400, 0.08);
  } else if (gun === 'gauntlet') whoosh(0.5, 1800, 300, 0.12); // (thrown: the air going past)
}
