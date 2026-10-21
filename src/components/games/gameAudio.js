// Sounds for the 3D games that the shared effects (lib/sfx.js) don't have:
// an engine that follows the speed, and a few short cues. All synthesised,
// all through the site's master volume, so the sound setting mutes them.

import { audioContext, output } from '../../lib/audio';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = (b + 0.04 * (Math.random() * 2 - 1)) / 1.04;
    d[i] = b * 3;
  }
  return noiseBuf;
}

// A running engine: a low sawtooth with a sub under it, a filtered rumble of
// tyres on the road, and a servo whine when standing as a robot.
// set({ speed, robot, boost, on }) every frame; stop() to end it.
export function engine({ diesel = true } = {}) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return { set() {}, stop() {} };
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(out);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  lp.Q.value = 2;
  lp.connect(master);
  const a = ac.createOscillator();
  a.type = 'sawtooth';
  const b = ac.createOscillator();
  b.type = 'square';
  const ga = ac.createGain();
  ga.gain.value = 0.16;
  const gb = ac.createGain();
  gb.gain.value = 0.1;
  a.connect(ga).connect(lp);
  b.connect(gb).connect(lp);
  const road = ac.createBufferSource();
  road.buffer = noise(ac);
  road.loop = true;
  const roadF = ac.createBiquadFilter();
  roadF.type = 'bandpass';
  roadF.frequency.value = 300;
  roadF.Q.value = 0.6;
  const roadG = ac.createGain();
  roadG.gain.value = 0;
  road.connect(roadF).connect(roadG).connect(master);
  const servo = ac.createOscillator();
  servo.type = 'triangle';
  const servoG = ac.createGain();
  servoG.gain.value = 0;
  servo.connect(servoG).connect(master);
  [a, b, road, servo].forEach((n) => n.start(t));
  let alive = true;
  return {
    set({ speed = 0, robot = 0, boost = false, on = true }) {
      if (!alive) return;
      const now = ac.currentTime;
      const rev = (diesel ? 38 : 58) + speed * (diesel ? 2.1 : 3.4) + (boost ? 30 : 0);
      a.frequency.setTargetAtTime(rev, now, 0.08);
      b.frequency.setTargetAtTime(rev / 2, now, 0.08);
      lp.frequency.setTargetAtTime(400 + speed * 22 + (boost ? 900 : 0), now, 0.1);
      roadG.gain.setTargetAtTime((1 - robot) * Math.min(1, speed / 30) * 0.35, now, 0.1);
      servoG.gain.setTargetAtTime(robot * 0.025, now, 0.1);
      servo.frequency.setTargetAtTime(420 + Math.sin(now * 7) * 40, now, 0.05);
      ga.gain.setTargetAtTime((1 - robot * 0.8) * 0.16, now, 0.1);
      master.gain.setTargetAtTime(on ? 0.5 : 0, now, 0.15);
    },
    stop() {
      if (!alive) return;
      alive = false;
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0, now, 0.08);
      [a, b, road, servo].forEach((n) => n.stop(now + 0.5));
      setTimeout(() => master.disconnect(), 700);
    },
  };
}

function tone(freqs, { type = 'sine', dur = 0.25, gain = 0.2, glide = 1, delay = 0.06 } = {}) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime;
  freqs.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t + i * delay);
    o.frequency.exponentialRampToValueAtTime(f * glide, t + i * delay + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t + i * delay);
    g.gain.exponentialRampToValueAtTime(gain, t + i * delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * delay + dur);
    o.connect(g).connect(out);
    o.start(t + i * delay);
    o.stop(t + i * delay + dur + 0.05);
  });
}

function whoosh(dur = 0.6, from = 300, to = 3000, gain = 0.25) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
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

// an energon cube: a bright little chime
export const energon = () => tone([1320, 1760, 2640], { type: 'triangle', dur: 0.22, gain: 0.08, delay: 0.035 });
// a robot's legs firing: a servo chirp up
export const servoJump = () => tone([180], { type: 'square', dur: 0.18, gain: 0.05, glide: 2.6 });
// the boost kicking in
export const boost = () => whoosh(0.7, 200, 2400, 0.22);
// a close call
export const nearMiss = () => whoosh(0.35, 1800, 500, 0.16);
// out of energon: a power-down
export const powerDown = () => tone([520], { type: 'sawtooth', dur: 0.5, gain: 0.06, glide: 0.25 });
// the boss arrives
export const bossSting = () => tone([110, 104, 98], { type: 'sawtooth', dur: 0.9, gain: 0.09, delay: 0.18, glide: 0.98 });

// Portal panic
// the portal gun: a wet little zap
export const zap = () => tone([880], { type: 'square', dur: 0.09, gain: 0.035, glide: 0.45 });
// a portal opening: a rising swirl
export const portalOpen = () => {
  whoosh(0.8, 250, 1800, 0.14);
  tone([220, 330], { type: 'sine', dur: 0.6, gain: 0.05, delay: 0.08, glide: 1.8 });
};
// a portal dash: through and out
export const portalHop = () => whoosh(0.28, 2200, 600, 0.16);
// something squishy goes
export const splat = () => tone([140], { type: 'sawtooth', dur: 0.16, gain: 0.07, glide: 0.4 });
// a Mega Seed
export const seed = () => tone([1568, 2093], { type: 'triangle', dur: 0.12, gain: 0.05, delay: 0.04 });
// a gadget from the workbench
export const gadget = () => tone([523, 659, 784, 1047], { type: 'triangle', dur: 0.2, gain: 0.07, delay: 0.06 });
// hurt
export const ouch = () => tone([300], { type: 'sawtooth', dur: 0.25, gain: 0.08, glide: 0.5 });
// the dial's places (rickmorty/world/RmWorld.jsx): seen by one of them
export const alarm = () => tone([660, 990], { type: 'square', dur: 0.14, gain: 0.045, delay: 0.1, glide: 1.15 });
// the clock starts for the portal home: a siren's rise and fall
export const siren = () => {
  tone([440], { type: 'sawtooth', dur: 0.45, gain: 0.05, glide: 1.8 });
  setTimeout(() => tone([792], { type: 'sawtooth', dur: 0.45, gain: 0.05, glide: 0.55 }), 420);
};
// the clock's last seconds, one each
export const tick = () => tone([1800], { type: 'square', dur: 0.03, gain: 0.03, glide: 0.8 });
// the clock run out
export const timeUp = () => tone([330, 262, 196], { type: 'sawtooth', dur: 0.4, gain: 0.06, delay: 0.16, glide: 0.9 });
// a blow landing in a duel
export const thud = () => {
  whoosh(0.12, 600, 120, 0.2);
  tone([110], { type: 'sine', dur: 0.18, gain: 0.1, glide: 0.5 });
};
// grabbed by one of them
export const grab = () => {
  whoosh(0.3, 1600, 300, 0.18);
  setTimeout(() => tone([300], { type: 'sawtooth', dur: 0.25, gain: 0.08, glide: 0.5 }), 120);
};
// the soundboard on /c-137: a plumbus's squelch, the Cromulon's verdict, a
// bassline to get schwifty to
export const plumbus = () => {
  tone([90], { type: 'sawtooth', dur: 0.3, gain: 0.08, glide: 2.4 });
  whoosh(0.25, 400, 120, 0.12);
};
export const showMe = () => tone([196, 247, 294, 392], { type: 'sawtooth', dur: 1.2, gain: 0.045, delay: 0.03 });
// Get Schwifty's show (rickmorty/world/games/Schwifty.jsx): a lane's note, as
// the bassline below plays them, and the kick on the beat
const SCHWIFTY_NOTES = [110, 131, 147, 165];
export const schwiftyNote = (lane) => {
  const f = SCHWIFTY_NOTES[lane] ?? SCHWIFTY_NOTES[0];
  tone([f, f * 2], { type: 'square', dur: 0.16, gain: 0.05, delay: 0 });
};
export const kick = () => tone([90], { type: 'sine', dur: 0.14, gain: 0.12, glide: 0.4 });
export const schwifty = () => {
  [110, 110, 131, 110, 147, 131, 110, 98, 110, 110, 165, 147].forEach((f, i) => setTimeout(() => tone([f, f * 2], { type: 'square', dur: 0.16, gain: 0.05, delay: 0 }), i * 190));
};
