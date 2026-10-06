// What the cockpits sound like: each ship's engine at idle (the universe
// map's, universe/sounds.js) and the RV's tired V8, rising with the
// throttle; and each launch. The jump's recorded boom is lined up to land
// on the flash; Rick's portal gun fires and the portal opens with a swirl;
// the RV's long drive has the Breaking Bad opening over it, its wings come
// out with a hydraulic whine and lock with a clunk, its jets catch and roar,
// and Hank's siren comes after it. All through the
// site's master volume, and only once the visitor has clicked or pressed
// something (browsers hold sound back until then).

import { audioContext, output, voiceOutput } from '../../lib/audio';
import { playClip } from '../../lib/clips';
import { portalSound, shipEngine } from '../universe/sounds';

// where in the hyperspace clip its boom lands (s)
const BOOM = 2.0;

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

// The RV's engine: a big old V8 at a lumpy idle (the low thrum pulses),
// opening up as it goes, with the road's rumble under it at speed; and once
// its jets are lit (`jets`, 0…1), their whine and roar over it all.
function rvEngine() {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return { set() {}, stop() {} };
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(out);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  lp.Q.value = 2;
  lp.connect(master);
  const a = ac.createOscillator();
  a.type = 'sawtooth';
  a.frequency.value = 34;
  const b = ac.createOscillator();
  b.type = 'square';
  b.frequency.value = 17;
  const bg = ac.createGain();
  bg.gain.value = 0.35;
  a.connect(lp);
  b.connect(bg).connect(lp);
  // the idle's lope: the level pulses a few times a second
  const lope = ac.createOscillator();
  lope.frequency.value = 3.1;
  const lopeG = ac.createGain();
  lopeG.gain.value = 0.25;
  const level = ac.createGain();
  level.gain.value = 0.75;
  lope.connect(lopeG).connect(level.gain);
  lp.disconnect();
  lp.connect(level).connect(master);
  // the road
  const road = ac.createBufferSource();
  road.buffer = noise(ac);
  road.loop = true;
  const roadF = ac.createBiquadFilter();
  roadF.type = 'lowpass';
  roadF.frequency.value = 400;
  const roadG = ac.createGain();
  roadG.gain.value = 0;
  road.connect(roadF).connect(roadG).connect(master);
  // the jets: a turbine's whine and a roar of air
  const whine = ac.createOscillator();
  whine.type = 'sawtooth';
  whine.frequency.value = 420;
  const whineF = ac.createBiquadFilter();
  whineF.type = 'bandpass';
  whineF.frequency.value = 1400;
  whineF.Q.value = 4;
  const roar = ac.createBufferSource();
  roar.buffer = noise(ac);
  roar.loop = true;
  const roarF = ac.createBiquadFilter();
  roarF.type = 'bandpass';
  roarF.frequency.value = 600;
  roarF.Q.value = 0.6;
  const jetG = ac.createGain();
  jetG.gain.value = 0;
  whine.connect(whineF).connect(jetG);
  roar.connect(roarF).connect(jetG);
  jetG.connect(master);
  [a, b, lope, road, whine, roar].forEach((n) => n.start(t));
  let alive = true;
  return {
    set({ speed = 0, on = true, jets = 0 }) {
      if (!alive) return;
      const now = ac.currentTime;
      a.frequency.setTargetAtTime(34 + speed * 70, now, 0.25);
      b.frequency.setTargetAtTime(17 + speed * 35, now, 0.25);
      lp.frequency.setTargetAtTime(220 + speed * 900, now, 0.3);
      lopeG.gain.setTargetAtTime(0.25 * (1 - Math.min(1, speed * 2)), now, 0.3);
      roadG.gain.setTargetAtTime(0.12 * Math.min(1, speed * 1.4), now, 0.3);
      whine.frequency.setTargetAtTime(420 + 900 * jets, now, 0.4);
      whineF.frequency.setTargetAtTime(1100 + 1800 * jets, now, 0.4);
      roarF.frequency.setTargetAtTime(400 + 900 * jets, now, 0.3);
      jetG.gain.setTargetAtTime(0.5 * jets, now, 0.3);
      master.gain.setTargetAtTime(on ? 0.16 + 0.1 * speed : 0, now, 0.2);
    },
    stop() {
      if (!alive) return;
      alive = false;
      const now = ac.currentTime;
      master.gain.setTargetAtTime(0, now, 0.25);
      [a, b, lope, road, whine, roar].forEach((n) => n.stop(now + 1.2));
      setTimeout(() => master.disconnect(), 1400);
    },
  };
}

// a metal clunk: the Falcon's levers going home
function clunk(at = 0) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  f.Q.value = 3;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.15);
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

// The RV's wings coming out: a hydraulic ram's whine, rising as it pushes,
// `dur` seconds long
function hydraulics(dur, at = 0) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(150, t);
  o.frequency.linearRampToValueAtTime(260, t + dur * 0.8);
  o.frequency.linearRampToValueAtTime(210, t + dur);
  const wobble = ac.createOscillator();
  wobble.frequency.value = 23;
  const depth = ac.createGain();
  depth.gain.value = 9;
  wobble.connect(depth).connect(o.frequency);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.12);
  g.gain.setValueAtTime(0.05, t + dur - 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out);
  [o, wobble].forEach((n) => {
    n.start(t);
    n.stop(t + dur + 0.05);
  });
}

// the RV's jets catching: a deep whump of air
function whump(at = 0) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1800, t);
  f.frequency.exponentialRampToValueAtTime(120, t + 0.7);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.85);
}

// Hank's siren coming up behind and dropping away: the wail sweeping up and
// down, `dur` seconds long
function siren(dur, at = 0) {
  const ac = audioContext();
  const out = ac ? output() : null;
  if (!ac || !out) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 900;
  const sweep = ac.createOscillator();
  sweep.type = 'triangle';
  sweep.frequency.value = 1.6;
  const depth = ac.createGain();
  depth.gain.value = 330;
  sweep.connect(depth).connect(o.frequency);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.45);
  g.gain.setValueAtTime(0.07, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  [o, sweep].forEach((n) => {
    n.start(t);
    n.stop(t + dur + 0.05);
  });
}

// Artoo: a run of quick whistles
function chirps(at = 0, n = 6, voice = false) {
  const ac = audioContext();
  const out = ac ? (voice ? voiceOutput() : output()) : null;
  if (!ac || !out) return;
  let t = ac.currentTime + at;
  for (let i = 0; i < n; i++) {
    const o = ac.createOscillator();
    const f0 = 1200 + Math.random() * 1800;
    const len = 0.05 + Math.random() * 0.1;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (0.55 + Math.random() * 1.2), t + len);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.02);
    t += len + 0.02 + Math.random() * 0.05;
  }
}

// A gear going in: a clack and a drop in the idle
function gear(at = 0) {
  clunk(at);
}

const ENGINE = { falcon: 'falcon', xwing: 'xwing', cruiser: 'cruiser' };

// The sound of one cockpit. set() every frame; launch(plan, t) when you go
// (t: ms already into the launch); skip(plan, to) when the launch is skipped
// on; stop() when you leave.
export function cockpitSound(id) {
  const engine = ENGINE[id] ? shipEngine(ENGINE[id]) : id === 'rv' ? rvEngine() : null;
  const clips = [];
  const timers = [];
  let paused = false;
  const later = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms)));
  // a beat of the launch at `at` ms into it, only if it's still to come
  const at = (ms, t, fn) => ms >= t && later(ms - t, fn);
  let rvPlan = null;
  const clip = (name, o) => playClip(name, o).then((h) => h && clips.push(h));

  // the jump's boom on the flash: the clip started so BOOM lands at `peak`
  const jump = (plan, t) => {
    const until = (plan.peak - t) / 1000;
    if (until >= BOOM) clip('hyperspaceEnter', { when: until - BOOM, keep: true });
    else clip('hyperspaceEnter', { offset: BOOM - until, keep: true });
  };

  const schedule = (plan, t) => {
    if (id === 'falcon') {
      if (t < 200) later(200 - t, () => clunk());
      jump(plan, t);
    } else if (id === 'xwing') {
      if (t < 100) chirps(0, 7);
      jump(plan, t);
    } else if (id === 'cruiser') {
      // Rick fires, the portal opens, and you're through
      if (t < 300) later(300 - t, () => clip('portalGun', { gain: 0.9, duration: 1.6, keep: true }));
      later(plan.spool - 250 - t, () => portalSound());
      later(plan.peak - 300 - t, () => portalSound());
    } else if (id === 'rv') {
      rvPlan = plan;
      if (t < 150) later(150 - t, () => gear());
      // the wings out, each locking; the jets catching
      at(plan.wings, t, () => hydraulics(1.55));
      at(plan.wings + 1150, t, () => clunk());
      at(plan.wings + 1450, t, () => clunk());
      at(plan.jets, t, () => whump());
      // Hank, from the cut outside to just past the flash
      at(plan.cut, t, () => siren((plan.end - plan.cut) / 1000));
      // the opening, over the drive (and on a little into the universe)
      clip('bbIntro', { offset: Math.max(0, t / 1000), duration: 14, keep: true, gain: 0.85 });
    }
  };

  return {
    set({ throttle = 0, launching = false, t = 0 }) {
      if (!engine || paused) return;
      if (id === 'rv') {
        const jets = launching && rvPlan ? Math.min(1, Math.max(0, (t - rvPlan.jets) / 500)) * (0.7 + 0.3 * Math.min(1, Math.max(0, (t - rvPlan.lift) / 1500))) : 0;
        engine.set({ speed: launching ? 0.15 + throttle * 0.85 : 0, on: true, jets });
      }
      else engine.set({ speed: 0.2 + throttle * 3.2, boost: throttle > 0.55, on: true });
    },
    launch(plan, t = 0) {
      schedule(plan, t);
    },
    skip(plan, to) {
      // the boom and the music, lined up again from where the launch is now
      timers.forEach(clearTimeout);
      timers.length = 0;
      clips.splice(0).forEach((h) => h.stop());
      if (id === 'falcon' || id === 'xwing') jump(plan, to);
      else if (id === 'rv') clip('bbIntro', { offset: to / 1000, duration: 6, keep: true, gain: 0.85 });
      else if (id === 'cruiser') portalSound();
    },
    pause() {
      paused = true;
      engine?.set({ speed: 0, on: false });
    },
    resume() {
      paused = false;
    },
    stop() {
      timers.forEach(clearTimeout);
      engine?.stop();
    },
  };
}

// The crew's lines that have a recording: played under their subtitles.
// (both through the voice tap, so the speaker's face moves with them)
export const sayClip = (name) => playClip(name, { keep: true, voice: true });
// Artoo has no recording: his whistles stand in.
export const artoo = () => chirps(0, 6, true);
