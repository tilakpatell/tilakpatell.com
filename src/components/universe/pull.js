// The two great portals' pulls: the Maelstrom's tractor beam at the Star
// Wars gate, and the Curve Rift's grab at the portal into the Curve. Pure
// numbers, tested in Node; pullScene.js draws them and moves the ship.
//
// The Maelstrom's beam: closing in on the gate within BEAM.reach, the beam
// catches the ship (an alarm, a blue cone from the gate) and hauls it in,
// harder the nearer. Holding the boost for BEAM.breakFree seconds while it
// only has you breaks free (the beam rests BEAM.rest seconds before it will
// catch again); inside BEAM.lock it's locked: no breaking free, dragged in
// faster and faster, the nose turned onto the gate, and into it (the gate's
// own way through to /galaxy: the scene's 'portal').
//
// The Rift's grab: closing in on the portal within RIFT.reach, it takes the
// ship: carried round it on a tightening spiral, faster and faster, squashed
// and stretched as it goes, and through (the scene's portalThrough).
//
// Neither catches a ship that isn't closing in (one parked beside, or come
// out of the far end and going on away): only one whose way is on toward it.
//
// PULLS: [{ id, kind: 'beam' | 'rift', at, reach, ... }]
// freshPull() → the state: { phase: 'free', id: null, held: 0, restUntil: 0, k: 0, t: 0 }
// pullStep(st, ship, { boost, dt, now }) → { st, ship, events: [{ type: 'caught' | 'locked' | 'broke' | 'through', id }] }
//   st.k, 0 … 1: how hard it has you (the beam's cone, the alarm, the squash)
// squashOf(st) → [across, along]: the ship's scale in the Rift's grab (1, 1 outside it)

import { POSITIONS, REACH } from './layout';
import { portalById } from './portals';

export const BEAM = Object.freeze({
  reach: 4500, // where it catches you
  lock: 1400, // and where there's no getting away
  least: 150, // how fast it hauls at its reach (a second)
  most: 1400, // and at the gate
  breakFree: 1.6, // seconds of boost to break free
  rest: 20, // seconds after that before it'll catch again
  closing: 0.5, // the least the ship's way must be onto it (a cosine), moving, to be caught
});

export const RIFT = Object.freeze({
  reach: 1600,
  through: 1.4, // the portal's radii from its middle where you're through
  turn: 1.2, // radians a second round it at its reach
  turnIn: 7, // and at its middle
  least: 60, // units a second in, at its reach
  most: 700, // and at the middle
  closing: 0.5,
});

// The two great spirals round the portals (nebula/'s vortex form, turning;
// deepspace.js adds them), each its eye clear round its portal: the
// Maelstrom a galaxy far, far away seen face on round the Star Wars gate,
// blue arms about a warm core; the Curve Rift the Central Finite Curve's
// green whorl round the portal into the Curve
export const SPIRALS = Object.freeze([
  Object.freeze({ id: 'maelstrom', at: [...POSITIONS.starwars], r: 9000, colors: ['#1d3fae', '#7fa8ff', '#ffd9a8'], seed: 'maelstrom', form: 'vortex' }),
  Object.freeze({ id: 'curve-rift', at: [...portalById('rmportal').at], r: 7000, colors: ['#0f6b3a', '#5dff8f', '#e9ffc2'], seed: 'curve-rift', form: 'rift' }),
]);

export const PULLS = Object.freeze([
  Object.freeze({ id: 'starwars', kind: 'beam', at: POSITIONS.starwars, gate: REACH.starwars, reach: BEAM.reach }),
  Object.freeze({ id: 'rmportal', kind: 'rift', at: portalById('rmportal').at, gate: portalById('rmportal').r, reach: RIFT.reach }),
]);

export const freshPull = () => ({ phase: 'free', id: null, held: 0, restUntil: 0, k: 0, t: 0 });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// the ship's way (where its nose goes, ship.js's heading and pitch), as a unit vector
function wayOf(s) {
  const cp = Math.cos(s.pitch ?? 0);
  return [-Math.sin(s.heading) * cp, Math.sin(s.pitch ?? 0), -Math.cos(s.heading) * cp];
}
// the heading and pitch that put the nose along d
const aim = (d) => {
  const l = len(d) || 1;
  return { heading: Math.atan2(-d[0], -d[2]), pitch: Math.asin(Math.max(-1, Math.min(1, d[1] / l))) };
};

// is it coming on toward p, moving?
function closing(s, p, least) {
  if (!(Math.abs(s.speed ?? 0) > 1)) return false;
  const to = sub(p.at, [s.x, s.y, s.z]);
  const l = len(to) || 1;
  const w = wayOf(s);
  return ((w[0] * to[0] + w[1] * to[1] + w[2] * to[2]) / l) * Math.sign(s.speed) >= least;
}

function catchable(st, s, now) {
  if (now < st.restUntil) return null;
  for (const p of PULLS) {
    const d = len(sub([s.x, s.y, s.z], p.at));
    if (d < p.reach && d > p.gate && closing(s, p, p.kind === 'beam' ? BEAM.closing : RIFT.closing)) return p;
  }
  return null;
}

export function pullStep(st, ship, { boost = false, dt = 1 / 60, now = 0 } = {}) {
  const events = [];
  if (!ship) return { st, ship, events };
  if (st.phase === 'free' || st.phase === 'through') {
    const p = st.phase === 'free' ? catchable(st, ship, now) : null;
    if (!p) return { st: st.phase === 'through' ? st : { ...st, k: 0 }, ship, events };
    st = { ...st, phase: p.kind === 'beam' ? 'caught' : 'grabbed', id: p.id, held: 0, t: 0 };
    events.push({ type: 'caught', id: p.id });
  }
  const p = PULLS.find((q) => q.id === st.id);
  const at = [ship.x, ship.y, ship.z];
  const to = sub(p.at, at);
  const d = len(to) || 1e-6;
  const u = [to[0] / d, to[1] / d, to[2] / d];
  const t = st.t + dt;

  if (p.kind === 'beam') {
    let { phase, held } = st;
    if (phase === 'caught') {
      held = boost ? held + dt : Math.max(0, held - dt * 0.5);
      if (held >= BEAM.breakFree) {
        events.push({ type: 'broke', id: p.id });
        return { st: { ...freshPull(), restUntil: now + BEAM.rest }, ship, events };
      }
      if (d < BEAM.lock) {
        phase = 'locked';
        events.push({ type: 'locked', id: p.id });
      }
    }
    // how hard: by how far in it's hauled you (and wound up over the first second, so it takes hold)
    const near = clamp01((BEAM.reach - d) / (BEAM.reach - p.gate));
    const k = phase === 'locked' ? 1 : Math.min(1, t) * (0.35 + 0.65 * ease(near));
    const v = BEAM.least + (BEAM.most - BEAM.least) * ease(near);
    const step = Math.min(v * dt, Math.max(0, d - p.gate * 0.5));
    let moved = { ...ship, x: ship.x + u[0] * step, y: ship.y + u[1] * step, z: ship.z + u[2] * step };
    if (phase === 'locked') {
      // the nose onto the gate, its own drive cut
      const n = aim(to);
      moved = { ...moved, heading: n.heading, pitch: n.pitch, speed: Math.min(Math.abs(moved.speed ?? 0), 5), bank: (moved.bank ?? 0) * 0.9 };
    }
    if (len(sub(p.at, [moved.x, moved.y, moved.z])) <= p.gate * 1.05) {
      events.push({ type: 'through', id: p.id });
      return { st: { ...st, phase: 'through', k: 1, t, held }, ship: moved, events };
    }
    return { st: { ...st, phase, held, k, t }, ship: moved, events };
  }

  // the Rift: round and in on a tightening spiral, level with it, nose along the way
  const near = clamp01((RIFT.reach - d) / (RIFT.reach - p.gate));
  const w = RIFT.turn + (RIFT.turnIn - RIFT.turn) * near * near;
  const inward = RIFT.least + (RIFT.most - RIFT.least) * ease(near);
  const flat = [-to[0], 0, -to[2]];
  const r = Math.hypot(flat[0], flat[2]) || 1e-6;
  const a = Math.atan2(flat[2], flat[0]) + w * dt;
  const r2 = Math.max(0, r - inward * dt);
  const y = ship.y + (p.at[1] - ship.y) * Math.min(1, dt * 2.5);
  const nx = p.at[0] + Math.cos(a) * r2;
  const nz = p.at[2] + Math.sin(a) * r2;
  // (the nose part along the way round, part onto the portal, so it's in view the whole way in)
  const n = aim([nx - ship.x + (p.at[0] - nx) * 0.04 * dt * 60, 0, nz - ship.z + (p.at[2] - nz) * 0.04 * dt * 60]);
  const moved = { ...ship, x: nx, y, z: nz, heading: n.heading, pitch: 0, speed: Math.min(Math.abs(ship.speed ?? 0), 5), bank: -0.6 * near };
  const k = Math.min(1, t * 1.5) * (0.4 + 0.6 * near);
  if (r2 <= p.gate * RIFT.through) {
    events.push({ type: 'through', id: p.id });
    return { st: { ...st, phase: 'through', k: 1, t }, ship: moved, events };
  }
  return { st: { ...st, k, t }, ship: moved, events };
}

// the ship's scale in the Rift's grab: stretched along its way and thinned
// across, wobbling (the show's portal: squash and stretch), back to 1, 1 in the beam and free
export function squashOf(st) {
  if (st.id !== 'rmportal' || st.phase === 'free') return [1, 1];
  const along = 1 + 0.9 * st.k + 0.12 * Math.sin(st.t * 17) * st.k;
  return [1 / Math.sqrt(along), along];
}

// a word for the HUD's note when it happens
export const PULL_WORDS = Object.freeze({
  starwars: { caught: 'Tractor beam! Hold boost to break free', locked: 'Locked on: it’s taking you in', broke: 'Broke free of the beam' },
  rmportal: { caught: 'The portal’s got you!' },
});
