// How Cybertron's robots carry themselves, worked out on plain numbers:
// their stride from the ground they cover (a robot ten metres tall takes
// long, slow steps, its weight coming down on each), their legs turned to
// where they're going while the chest stays on what they're shooting at,
// how they go over when they're beaten (like a tower, slowly and then all
// at once), the gestures of their own (Bumblebee waves, Grimlock raises a
// fist, Starscream bows to his lord, Ratchet folds his arms), what the
// people standing about do when you come up or speak to them, and what a
// Decepticon's body shows of its brain: walking where it walks, aiming
// where it aims, the recoil, the flinch, a boss's taunt and the brace
// before a heavy shot. bots.js and scene.js draw it; nothing here decides
// what happens in the game, only how it looks.
//
// The figure's frame is rig.js's: +z ahead, +y up, +x its left. Yaw is the
// game's: 0 faces +z and a positive one turns toward +x.
//
//   strideLength(leg, run, amount) → the ground one stride (two steps) covers
//   createGait({ leg, height, walk, run, seed }) → { step(dt, speed) →
//     { phase, amount, run, stride } }: the phase from the ground covered
//     (backward when speed is), amount eased in and out, run eased between
//     the walk's pace and the run's
//   footPath(phase) → { reach (−1…1), lift (0…1), down }: where a foot is
//     in its stride; flat-footed and at an even pace while it's down
//   stridePose(phase, amount, run) → rig.js targets: a step whose planted
//     foot keeps still on the ground (its reach falls at an even pace)
//   standPose(t, seed, k) → rig.js targets: standing, breathing, the weight
//     shifting now and then
//   createHips({ rate, limit, back }) → { step(dt, fwd, side) → { yaw, dir,
//     ground } }: the legs turned toward where it's going (yaw, + its left),
//     walking backward (dir −1) past `back`; ground is the speed along them
//   localMotion(vx, vz, yaw) → { speed, side }: a velocity in a figure's
//     frame (side + to its right, as lib/ai/body.js has it)
//   aimAt(from, yaw, to) → [x, y, z]: the direction to `to` in the frame of
//     a figure at `from` facing `yaw`, kept in front of it
//   topple(t, dur) → the angle (0…π/2) of a robot going over, t seconds in
//   fallTime(height) → how long a robot that tall takes to go over
//   wingBeat(t, { period, seed }) → { flap (−1…1), env (0…1), lift }: a big
//     flyer's wings, beating for a while and then gliding
//   lineLength(text) → seconds a line takes to say
//   GREET, WIN, TAUNT, TALK: each robot's own way, by catalogue kind
//   GESTURES: { name: seconds } how long each lasts by itself
//   gesture(name, t, opts) → { targets, head?, brace? } | null: the arms,
//     torso and head of a gesture t seconds in (null: nothing by that name)
//   CYBER_REACTIONS: lib/ai/react.js's table for the robots
//   createPersonBody({ kind, home, seed }) → { step(dt, ctx) → { yaw,
//     stepSpeed, look, gesture } }: someone standing about in an area
//   createFoeBody({ kind, boss, seed, cooldown }) → { step(dt, ctx) →
//     { state, speed, side, aim, look, gesture, recoil, fall } }: a
//     Decepticon's body from its brain's step
//   hashSeed(text) → an integer seed from a name

import { seeded } from '../../../lib/seeded';
import { createReactions } from '../../../lib/ai/react';
import { bodyFrom } from '../../../lib/ai/body';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth01 = (k) => {
  const u = clamp(k, 0, 1);
  return u * u * (3 - 2 * u);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mod = (a, n) => a - n * Math.floor(a / n);
const toward = (v, want, by) => (v < want ? Math.min(want, v + by) : Math.max(want, v - by));
const clampDt = (dt) => (dt > 0 ? Math.min(dt, 0.1) : 0);
// eased toward, by time: the same at 30 frames a second as at 144
const ease = (v, want, dt, rate) => v + (want - v) * (1 - Math.exp(-rate * dt));

export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h | 0;
}

// ── the stride ──

const MIN_SWING = 0.12; // (a step so short its pace would run away)
export const swingOf = (run) => 0.42 + 0.5 * clamp(run, 0, 1); // how far a leg swings either way at full stride
const AMOUNT_EASE = 0.35; // seconds from standing to striding: a heavy thing gets going
const RUN_EASE = 0.5;

// A planted foot goes back under the hip from leg·sin(swing) ahead to as far
// behind while the body goes over it: half a stride.
export function strideLength(leg, run = 0, amount = 1) {
  const swing = Math.max(MIN_SWING, swingOf(run) * clamp(amount, 0, 1));
  return 4 * Math.max(1e-3, leg) * Math.sin(swing);
}

export function createGait({ leg = 1, height = 2, walk = null, run = null, seed = 0 } = {}) {
  const walkV = walk ?? 0.74 * height;
  const runV = Math.max(walkV * 1.2, run ?? 1.58 * height);
  let phase = seeded(seed)() * TAU;
  let amount = 0;
  let running = 0;
  return {
    step(dt, speed) {
      const d = clampDt(dt);
      const v = Number.isFinite(speed) ? speed : 0;
      const s = Math.abs(v);
      amount = toward(amount, clamp(s / (0.45 * walkV), 0, 1), d / AMOUNT_EASE);
      running = toward(running, smooth01((s - walkV) / (runV - walkV)), d / RUN_EASE);
      const stride = strideLength(leg, running, amount);
      phase = mod(phase + Math.sign(v) * ((s * d) / stride) * TAU, TAU);
      return { phase, amount: smooth01(amount), run: smooth01(running), stride };
    },
  };
}

// u = 0 is the foot coming through; it's furthest ahead at u = ¼ (where
// rig.js's stride has sin(phase) at its peak), comes down there and goes
// back at an even pace to u = ¾, then up and forward again
export function footPath(phase) {
  const u = mod(phase / TAU, 1);
  if (u >= 0.25 && u <= 0.75) return { reach: 1 - 4 * (u - 0.25), lift: 0, down: true };
  const k = ((u < 0.25 ? u + 1 : u) - 0.75) / 0.5;
  return { reach: -Math.cos(Math.PI * k), lift: Math.sin(Math.PI * k), down: false };
}

const at = (a, x) => [x, -Math.cos(a), Math.sin(a)];

export function stridePose(phase = 0, amount = 1, run = 0) {
  const am = clamp(amount, 0, 1);
  const r = clamp(run, 0, 1);
  const swing = swingOf(r) * am;
  const reachOf = Math.sin(swing);
  const fold = (0.7 + r * 1.3) * am;
  const out = {};
  const leg = (side, ph) => {
    const f = footPath(ph);
    // (the angle whose sine falls evenly, so the foot does on the ground)
    const a = Math.asin(clamp(f.reach * reachOf, -1, 1));
    const knee = f.lift * fold + (0.06 + r * 0.12) * am;
    const x = side === 'L' ? 1 : -1;
    out[`thigh${side}`] = at(a, x * 0.05);
    out[`calf${side}`] = at(a - knee, x * 0.03);
    out[`foot${side}`] = [0, -0.3 - f.lift * 0.4, 1];
  };
  leg('L', phase);
  leg('R', phase + Math.PI);
  const s = Math.sin(phase);
  const arm = (side, sw) => {
    const b = -sw * swing * (0.85 + r * 0.4);
    const elbow = 0.25 + r * 1.15 * am;
    const x = side === 'L' ? 1 : -1;
    out[`arm${side}`] = at(b, x * (0.2 + r * 0.08));
    out[`fore${side}`] = at(b + elbow, x * 0.1);
  };
  arm('L', s);
  arm('R', -s);
  // leaning into it, the shoulders against the hips, and the weight over
  // whichever foot is down
  out.torso = { pitch: (0.04 + r * 0.28) * am, yaw: -s * 0.14 * am, roll: Math.sin(phase) * 0.035 * am };
  return out;
}

// Standing about: the chest rising and falling, the arms easy, and now and
// then the weight onto one foot (k: 0…1, how much of it there is)
export function standPose(t = 0, seed = 0, k = 1) {
  const r = seeded(seed);
  const period = 3.6 + r() * 1.4;
  const p0 = r() * TAU;
  const a = (t / period) * TAU + p0;
  const breath = Math.sin(a + 0.3 * Math.sin(a)) * k; // (in a little quicker than out)
  const shift = Math.sin(t * 0.21 + r() * TAU) * k; // the weight from one foot to the other, slowly
  const sway = 0.03 * breath;
  return {
    armL: [0.22 + sway, -1, 0.02 + sway * 0.5],
    foreL: [0.12 + sway, -1, 0.12 + sway],
    armR: [-0.22 - sway, -1, 0.02 + sway * 0.5],
    foreR: [-0.12 - sway, -1, 0.12 + sway],
    thighL: [0.05 + shift * 0.03, -1, 0.02],
    calfL: [0.03, -1, -0.02 - Math.max(0, -shift) * 0.06],
    thighR: [-0.05 + shift * 0.03, -1, 0.02],
    calfR: [-0.03, -1, -0.02 - Math.max(0, shift) * 0.06],
    footL: [0, -0.35, 1],
    footR: [0, -0.35, 1],
    torso: { pitch: -0.015 * breath, yaw: 0, roll: shift * 0.025 },
  };
}

// ── turning and moving ──

export function createHips({ rate = 5, limit = 1.6, back = 1.9 } = {}) {
  let yaw = 0;
  let dir = 1;
  return {
    step(dt, fwd = 0, side = 0) {
      const d = clampDt(dt);
      const ground = Math.hypot(fwd, side);
      let want = 0;
      let along = 0;
      if (ground > 0.3) {
        const heading = Math.atan2(-side, fwd); // (+ toward its left)
        // (a little either way of the line before it changes its mind)
        dir = Math.abs(heading) > (dir < 0 ? back - 0.25 : back) ? -1 : 1;
        const legs = dir < 0 ? wrap(heading - Math.PI) : heading;
        want = clamp(legs, -limit, limit);
        along = ground * Math.cos(Math.min(Math.PI / 2, Math.abs(legs - want)));
      } else dir = 1;
      yaw += (want - yaw) * (1 - Math.exp(-rate * d));
      return { yaw, dir, ground: along };
    },
  };
}

export function localMotion(vx = 0, vz = 0, yaw = 0) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return { speed: vx * fx + vz * fz, side: vz * fx - vx * fz };
}

// in front of it, up to so far round either way (its arm can't aim behind it)
const AIM_SPREAD = 1.25;
export function aimAt(from, yaw, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const flat = Math.hypot(dx, dz) || 1e-6;
  const rel = clamp(wrap(Math.atan2(dx, dz) - yaw), -AIM_SPREAD, AIM_SPREAD);
  const pitch = clamp(Math.atan2((to.y ?? 0) - (from.y ?? 0), flat), -0.9, 0.9);
  return [Math.sin(rel) * Math.cos(pitch), Math.sin(pitch), Math.cos(rel) * Math.cos(pitch)];
}

// ── going over ──

export const fallTime = (height) => 0.2 + 0.35 * Math.sqrt(Math.max(1, height));

export function topple(t, dur = 1.1) {
  if (!(t > 0)) return 0;
  const k = t / Math.max(0.05, dur);
  if (k < 1) return (Math.PI / 2) * k * k;
  // down: a bounce as the weight lands, settling flat
  const after = t - dur;
  return Math.PI / 2 - 0.09 * Math.abs(Math.sin(after * 9)) * Math.exp(-after * 6);
}

// ── a flyer's wings ──

export function wingBeat(t, { period = 1.8, seed = 0 } = {}) {
  const off = seeded(seed)() * 100;
  const tt = (Number.isFinite(t) ? t : 0) + off;
  // beating for a while, then gliding on them held out
  const env = smooth01(Math.sin((tt / 18) * TAU) * 1.6 + 0.6);
  const a = (tt / period) * TAU;
  // (down quicker than up: the stroke that carries it)
  const flap = Math.sin(a + 0.35 * Math.sin(a)) * env;
  return { flap, env, lift: -Math.cos(a) * env };
}

// ── what they say and do ──

export function lineLength(text = '') {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return clamp(0.8 + words / 2.6, 1.6, 9);
}

// How each greets you when you come up: Bumblebee waves, Jazz points you
// out, Grimlock raises a fist, Zeta Prime lifts an open hand, Ratchet folds
// his arms, Arcee and Shockwave nod, Barricade puts a fist to his chest for
// his lord, Starscream bows to him; Soundwave only watches.
export const GREET = {
  'bumblebee-wfc': 'wave',
  'bumblebee-tfp': 'wave',
  jazz: 'point',
  grimlock: 'fist',
  jetfire: 'wave',
  'zeta-prime': 'raise',
  'ultra-magnus-foc': 'nod',
  ratchet: 'arms',
  bulkhead: 'wave',
  arcee: 'nod',
  'soundwave-foc': null,
  'soundwave-tfp': null,
  'shockwave-foc': 'nod',
  barricade: 'salute',
  'starscream-foc': 'bow',
};
// a mission done near them: a fist up, mostly
export const WIN = { 'soundwave-foc': null, 'shockwave-foc': 'nod', 'starscream-foc': 'bow', 'zeta-prime': 'raise', ratchet: 'nod' };
// a boss's arrival: Megatron's fist up and the chest out, Shockwave's cannon
// levelled, Zeta Prime's arms wide, Barricade jabbing a finger at you
export const TAUNT = { megatron: 'taunt.fist', 'megatron-foc': 'taunt.fist', shockwave: 'taunt.cannon', 'shockwave-foc': 'taunt.cannon', zeta: 'taunt.wide', 'zeta-prime': 'taunt.wide', barricade: 'point' };
// how they talk with their hands: Grimlock big and quick, Shockwave with his
// one hand (the other's his cannon), Soundwave barely at all, Zeta Prime
// measured, Starscream wringing his
export const TALK = {
  grimlock: { amp: 1.35, tempo: 1.3 },
  'shockwave-foc': { left: 0, right: 0.7, amp: 0.7, tempo: 0.7 },
  'soundwave-foc': { amp: 0.2, tempo: 0.6 },
  'soundwave-tfp': { amp: 0.2, tempo: 0.6 },
  'zeta-prime': { amp: 0.75, tempo: 0.75 },
  ratchet: { left: 0.35, amp: 1.1, tempo: 1.2 },
  'starscream-foc': { scheme: true, amp: 1, tempo: 1.1 },
};

export const GESTURES = {
  wave: 2.4,
  point: 1.8,
  fist: 2.2,
  raise: 2.2,
  nod: 1.3,
  arms: 3.6,
  salute: 1.9,
  bow: 2.3,
  talk: 3,
  stagger: 0.45,
  'taunt.fist': 2.6,
  'taunt.cannon': 2.4,
  'taunt.wide': 2.4,
};

const bump = (k) => (k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0);
const rise = (t, k = 0.25) => smooth01(t / k);

export function gesture(name, t = 0, { style = null, seed = 0, dir = null, hold = null } = {}) {
  const T = hold ?? GESTURES[name] ?? 1;
  const k = clamp(t / T, 0, 1);
  switch (name) {
    case 'wave': {
      // the right hand up beside the head, waving from the elbow
      const w = Math.sin(t * 8.5) * rise(t, 0.35);
      return { targets: { armR: [-0.6, 0.62, 0.3], foreR: [-0.12 + w * 0.45, 1, 0.12], torso: { pitch: -0.03, yaw: -0.08, roll: 0.04 } }, head: { pitch: 0.06 * bump(k) } };
    }
    case 'point':
      // straight at you
      return { targets: { armR: [-0.12, 0.1, 1], foreR: [-0.08, 0.12, 1], torso: { pitch: 0, yaw: -0.2, roll: 0 } } };
    case 'fist': {
      // up over the head, pumped once
      const pump = 0.12 * Math.sin(Math.min(1, t / 0.9) * Math.PI);
      return { targets: { armR: [-0.28, 1, 0.05 + pump], foreR: [-0.06, 1, 0.08], torso: { pitch: -0.1, yaw: 0, roll: 0.06 } } };
    }
    case 'raise':
      // an open hand lifted, the forearm upright: as a Prime greets
      return { targets: { armR: [-0.4, 0.15, 0.9], foreR: [-0.12, 1, 0.25], torso: { pitch: -0.04, yaw: 0, roll: 0 } } };
    case 'nod':
      return { targets: null, head: { pitch: -0.32 * bump(clamp(t / 0.55, 0, 1)) - 0.18 * bump(clamp((t - 0.5) / 0.5, 0, 1)) } };
    case 'arms':
      // folded across the chest
      return {
        targets: { armL: [0.32, -0.7, 0.62], foreL: [-0.96, 0.18, 0.28], armR: [-0.32, -0.66, 0.66], foreR: [0.96, 0.24, 0.22], torso: { pitch: -0.06, yaw: 0, roll: 0 } },
        head: { pitch: -0.08 },
      };
    case 'salute':
      // the fist to the chest, the head bowed a moment
      return { targets: { armR: [-0.34, -0.42, 0.85], foreR: [0.92, 0.32, 0.25], torso: { pitch: 0.06, yaw: 0, roll: 0 } }, head: { pitch: -0.2 * bump(clamp((t - 0.2) / 1.2, 0, 1)) } };
    case 'bow': {
      // from the waist, one arm sweeping across, the other behind
      const b = bump(clamp(t / T, 0, 1));
      return {
        targets: { armR: [-0.12, -0.55 + 0.2 * b, 0.82], foreR: [0.62, -0.25, 0.75], armL: [0.3, -0.75, -0.55], foreL: [0.2, -0.6, -0.7], torso: { pitch: 0.62 * b, yaw: 0, roll: 0 } },
        head: { pitch: -0.15 * b },
      };
    }
    case 'talk': {
      const st = style ?? {};
      const amp = (st.amp ?? 1) * rise(t, 0.4);
      const w = 1.9 * (st.tempo ?? 1);
      const r = seeded(seed);
      const p1 = r() * TAU;
      const p2 = r() * TAU;
      if (st.scheme) {
        // the hands together in front of the chest, turning over one another
        const c = Math.sin(t * w * 1.6 + p1) * 0.18 * amp;
        return {
          targets: { armL: [0.25, -0.75, 0.6], foreL: [-0.75, 0.2 + c, 0.65], armR: [-0.25, -0.75, 0.6], foreR: [0.75, 0.2 - c, 0.65], torso: { pitch: 0.12 * amp, yaw: 0.05 * Math.sin(t * 0.8 + p2), roll: 0 } },
          head: { pitch: -0.05, yaw: 0.12 * Math.sin(t * 0.7 + p2) * amp },
        };
      }
      const uL = (0.5 + 0.5 * Math.sin(t * w + p1)) * (st.left ?? 0.8) * amp;
      const uR = (0.5 + 0.5 * Math.sin(t * w * 1.23 + p2)) * (st.right ?? 1) * amp;
      return {
        targets: {
          armL: [0.3 + 0.15 * uL, -0.85 + 0.38 * uL, 0.22 + 0.38 * uL],
          foreL: [0.22 + 0.3 * uL, -0.3 + 0.75 * uL, 0.9],
          armR: [-0.3 - 0.15 * uR, -0.85 + 0.38 * uR, 0.22 + 0.38 * uR],
          foreR: [-0.22 - 0.3 * uR, -0.3 + 0.75 * uR, 0.9],
          torso: { pitch: 0.04 * Math.max(uL, uR), yaw: 0.07 * Math.sin(t * 0.9 + p1) * amp, roll: 0 },
        },
        head: { pitch: 0.05 * Math.sin(t * w * 0.5 + p2) * amp, yaw: 0.06 * Math.sin(t * 0.6 + p1) * amp },
      };
    }
    case 'stagger': {
      // thrown back from the hit (dir: the way it travels, in the figure's frame), then catching itself
      const d = dir ?? [0, 0, -1];
      const len = Math.hypot(d[0], d[2]) || 1;
      const back = -d[2] / len; // + : pushed backward
      const across = d[0] / len; // + : pushed toward its left
      const b = bump(clamp(t / T, 0, 1) * 0.85 + 0.15);
      return {
        targets: {
          armL: [0.75, 0.15, -0.35],
          foreL: [0.5, 0.45, -0.15],
          armR: [-0.75, 0.15, -0.35],
          foreR: [-0.5, 0.45, -0.15],
          torso: { pitch: -0.38 * back * b, yaw: 0.25 * across * b, roll: -0.28 * across * b },
        },
        head: { pitch: 0.25 * back * b },
      };
    }
    case 'taunt.fist': {
      // Megatron: the fist up, chest out, a beat, then down
      const up = rise(t, 0.4) * (1 - smooth01((t - T + 0.5) / 0.5));
      return { targets: { armR: [-0.3, 1, -0.05], foreR: [-0.05, 1, 0.05], armL: [0.5, -0.6, -0.2], foreL: [0.3, -0.4, 0.5], torso: { pitch: -0.16 * up, yaw: 0.1, roll: 0.05 } }, head: { pitch: 0.18 * up } };
    }
    case 'taunt.cannon':
      // Shockwave: the cannon arm (his left) levelled at you, the other held back
      return { targets: { armL: [0.1, 0.05, 1], foreL: [0.05, 0.05, 1], armR: [-0.4, -0.7, -0.2], foreR: [-0.3, -0.3, 0.6], torso: { pitch: 0.05, yaw: 0.25, roll: 0 } }, brace: rise(t, 0.4) };
    case 'taunt.wide':
      // Zeta Prime: the arms flung wide
      return { targets: { armL: [1, 0.25, 0.25], foreL: [0.9, 0.45, 0.35], armR: [-1, 0.25, 0.25], foreR: [-0.9, 0.45, 0.35], torso: { pitch: -0.12, yaw: 0, roll: 0 } }, head: { pitch: 0.12 } };
    default:
      return null;
  }
}

// lib/ai/react.js's table, for robots: what each answers with (its clip is
// a gesture's name here; `kind` in the context picks whose)
const CYBER_REACTIONS = {
  greet: { cooldown: 30, chance: 0.9, react: (ctx) => (GREET[ctx.kind] === null ? null : { clip: GREET[ctx.kind] ?? 'wave', layer: 'upper', hold: false, look: ctx.target ?? null }) },
  say: { react: (ctx) => ({ clip: 'talk', layer: 'upper', hold: ctx.hold ?? 3, look: ctx.target ?? null }) },
  hit: { cooldown: 0.35, react: () => ({ clip: 'stagger', layer: 'upper', hold: false, look: null }) },
  // (a boss shrugs off most of them: one in so many seconds)
  staggered: { cooldown: 1.8, react: () => ({ clip: 'stagger', layer: 'upper', hold: false, look: null }) },
  win: { cooldown: 8, chance: 0.85, react: (ctx) => (WIN[ctx.kind] === null ? null : { clip: WIN[ctx.kind] ?? 'fist', layer: 'upper', hold: false, look: null }) },
  taunt: { cooldown: 1e9, react: (ctx) => (TAUNT[ctx.kind] ? { clip: TAUNT[ctx.kind], layer: 'upper', hold: false, look: ctx.target ?? null } : null) },
};

// ── someone standing about ──

const WATCH = 40; // metres: within this they look at you, and turn to
const GREET_AT = 26;
const REARM = 46; // gone this far, they'll greet you again when you come back
const TURN_AT = 0.85; // radians off: past this the head and chest can't take it, so the feet do
const TURN_DONE = 0.12;
const TURN_RATE = 1.3; // radians a second: a robot that size turns slowly

export function createPersonBody({ kind = '', home = 0, seed = 0 } = {}) {
  const react = createReactions(CYBER_REACTIONS, { rand: seeded(seed ^ 0x5bd1e995) });
  let yaw = home;
  let turning = false;
  let greeted = false;
  let said = null;
  let g = null; // { name, t, hold }
  let clock = 0;
  const begin = (r, hold) => {
    if (!r?.clip) return;
    g = { name: r.clip, t: 0, hold: typeof r.hold === 'number' ? r.hold : (hold ?? GESTURES[r.clip] ?? 1.5) };
  };
  return {
    get yaw() {
      return yaw;
    },
    step(dt, { me = { x: 0, z: 0 }, you = null, say = null, win = false } = {}) {
      const d = clampDt(dt);
      clock += d;
      const dist = you ? Math.hypot(you.x - me.x, you.z - me.z) : Infinity;
      const watch = dist < WATCH;
      // the feet, once the head and chest can't turn far enough
      const want = watch ? Math.atan2(you.x - me.x, you.z - me.z) : home;
      const off = wrap(want - yaw);
      if (!turning && Math.abs(off) > (watch ? TURN_AT : 0.3)) turning = true;
      if (turning && Math.abs(off) < TURN_DONE) turning = false;
      let turned = 0;
      if (turning) {
        const step = Math.sign(off) * Math.min(Math.abs(off), TURN_RATE * d * clamp(Math.abs(off) / 0.35, 0.35, 1));
        yaw = wrap(yaw + step);
        turned = d > 0 ? step / d : 0;
      }
      // what they do: talking over anything else, then greeting you, then a mission done
      if (say?.token && say.token !== said) {
        said = say.token;
        greeted = true; // (talking to you is greeting enough)
        begin(react.on('say', { t: clock, hold: lineLength(say.line) }), lineLength(say.line));
      } else if (!say) said = null;
      if (dist > REARM) greeted = false;
      if (!greeted && dist < GREET_AT && !g) {
        greeted = true;
        begin(react.on('greet', { t: clock, kind }));
      }
      if (win && (!g || g.name !== 'talk')) begin(react.on('win', { t: clock, kind }));
      if (g) {
        g.t += d;
        if (g.t >= g.hold) g = null;
      }
      return { yaw, stepSpeed: Math.abs(turned), look: watch, gesture: g ? { ...g } : null };
    },
  };
}

// ── a Decepticon ──

const SMOOTH = 9; // how quickly the drawn motion follows the brain's (a second's share)

export function createFoeBody({ kind = '', boss = false, seed = 0, cooldown = 1 } = {}) {
  const react = createReactions(CYBER_REACTIONS, { rand: seeded(seed ^ 0x27d4eb2f) });
  const charge = boss ? Math.min(0.45, 0.4 * cooldown) : 0; // the brace before a heavy shot
  let prev = null;
  let speed = 0;
  let side = 0;
  let g = null;
  let taunted = false;
  let clock = 0;
  let fall = null;
  let last = null; // the last hit's way
  return {
    // ctx: e (the sim's enemy), you ({ x, y, z }: what it aims at), hit (the
    // way a shot that hit it this frame was going, [x, z] in the world),
    // fired (it fired this frame)
    step(dt, { e, you = null, hit = null, fired = false } = {}) {
      const d = clampDt(dt);
      clock += d;
      const now = { x: e.x, z: e.z, yaw: e.yaw };
      if (hit) last = hit;
      if (e.dead) {
        // which way it goes over: the way the last shot was going, else away from you
        if (!fall) {
          const away = last ?? (you ? [e.x - you.x, e.z - you.z] : [-Math.sin(e.yaw), -Math.cos(e.yaw)]);
          const len = Math.hypot(away[0], away[1]) || 1;
          fall = [away[0] / len, away[1] / len];
        }
        return { state: 'dead', speed: 0, side: 0, aim: null, look: null, gesture: null, recoil: false, fall };
      }
      // its motion, from where its brain has put it since the last frame (a
      // jump of more than a stride in a frame, a spawn or a bridge, isn't walking)
      if (prev && d > 0 && Math.hypot(now.x - prev.x, now.z - prev.z) < 6) {
        const m = bodyFrom(prev, now, d).motion;
        speed = ease(speed, m.speed, d, SMOOTH);
        side = ease(side, m.side, d, SMOOTH);
      }
      prev = now;
      const sees = e.state !== 'hold';
      const target = you && sees ? { x: you.x, y: you.y, z: you.z } : null;
      if (hit) {
        const local = [hit[0] * Math.cos(e.yaw) - hit[1] * Math.sin(e.yaw), 0, hit[0] * Math.sin(e.yaw) + hit[1] * Math.cos(e.yaw)];
        const r = react.on(boss ? 'staggered' : 'hit', { t: clock });
        if (r) g = { name: 'stagger', t: 0, hold: boss ? 0.6 : GESTURES.stagger, dir: local };
      }
      if (boss && !taunted && sees) {
        taunted = true;
        const r = react.on('taunt', { t: clock, kind: e.model ?? kind, target });
        if (r && !g) g = { name: r.clip, t: 0, hold: GESTURES[r.clip] ?? 2.4 };
      }
      if (g) {
        g.t += d;
        if (g.t >= g.hold) g = null;
      }
      const dist = you ? Math.hypot(you.x - e.x, you.z - e.z) : Infinity;
      const bracing = boss && sees && e.cooldown != null && e.cooldown < charge && dist < 120;
      const from = { x: e.x, y: e.y + (e.h ?? 7) * 0.62, z: e.z };
      const aim = target ? aimAt(from, e.yaw, target) : [0, -0.45, 0.9]; // (lost him: the gun held low, looking about)
      const moving = Math.hypot(speed, side) > 0.35;
      return { state: moving ? 'walk' : 'idle', speed, side, aim, look: target, gesture: g ? { ...g } : null, recoil: Boolean(fired), brace: bracing, fall: null };
    },
  };
}
