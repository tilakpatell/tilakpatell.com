// The Sequids, as a swarm: rules only (../offworld/marsScene.js draws them
// as one instanced draw). Hundreds of bodies that flock to a host: the
// swarm's own heading is steered on lib/ai/steer.js (an interest in the
// target, a danger where a punch landed, hysteresis between frames), and
// each body follows that heading with a pull toward the swarm's middle and
// a push off its neighbours, so the cloud holds together and still boils.
// A punch into it scatters it for `SWARM.scatter` s: every body flees the
// blow, then they gather again. Plain [x, y, z] arrays in a flat local
// frame (../offworld/mars.js's, y up); a step is never over 0.05 s.

import { clear, createContext, flee, resolve, seek } from '../../../../lib/ai/steer';

export const SWARM = {
  speed: 18, // m/s, the cloud's
  body: 26, // m/s, a body's most
  spread: 9, // m: how wide the cloud rests
  cohesion: 1.4, // the pull to the middle, per m off it, a second
  apart: 1.8, // m: closer than this, two bodies push off
  scatter: 3, // s after a punch
  flee: 30, // m/s, scattering
  hover: 4, // m over the ground, the cloud's middle
  reach: 6, // m: a punch within this of the middle scatters it
  bite: 4, // m: the middle within this of its prey bites
  hurt: 6, // of his 100, a second, bitten
};

const clampDt = (dt) => Math.min(0.05, Math.max(0, dt || 0));
const rnd = (s) => {
  let x = s;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
};

// `n` bodies round `at`
export function newSwarm(n, at = [0, SWARM.hover, 0], seed = 5) {
  const r = rnd(seed);
  const bodies = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * SWARM.spread;
    bodies.push({ p: [at[0] + Math.cos(a) * d, at[1] + (r() - 0.5) * 4, at[2] + Math.sin(a) * d], v: [0, 0, 0], j: r() * Math.PI * 2 });
  }
  return { n, bodies, mid: [...at], v: [0, 0, 0], ctx: createContext(16), scatter: 0, scatterAt: null, alive: true, t: 0 };
}

const mid = (bodies) => {
  const m = [0, 0, 0];
  for (const b of bodies) for (let a = 0; a < 3; a++) m[a] += b.p[a];
  return m.map((c) => c / Math.max(1, bodies.length));
};

// sense: { target: [x, y, z] | null (what it hunts), punch: [x, y, z] | null
// (a blow landed this step), ground: (x, z) → y }
export function stepSwarm(prev, sense, rawDt) {
  const dt = clampDt(rawDt);
  const s = { ...prev, bodies: prev.bodies.map((b) => ({ ...b, p: [...b.p], v: [...b.v] })), mid: [...prev.mid], v: [...prev.v] };
  const ev = [];
  s.t += dt;
  if (!s.alive) {
    // the host down: the bodies fall and are still
    for (const b of s.bodies) {
      b.v[1] -= 9 * dt;
      for (let a = 0; a < 3; a++) b.p[a] += b.v[a] * dt;
      const g = sense.ground?.(b.p[0], b.p[2]) ?? 0;
      if (b.p[1] < g) {
        b.p[1] = g;
        b.v = [0, 0, 0];
      }
    }
    s.mid = mid(s.bodies);
    return { swarm: s, ev, bite: false };
  }
  // a punch into it: scattered for a while
  if (sense.punch && Math.hypot(sense.punch[0] - s.mid[0], sense.punch[1] - s.mid[1], sense.punch[2] - s.mid[2]) < SWARM.reach) {
    s.scatter = SWARM.scatter;
    s.scatterAt = [...sense.punch];
    ev.push({ type: 'scatter', at: [...sense.punch] });
  }
  s.scatter = Math.max(0, s.scatter - dt);
  // the cloud's heading: to its prey, away from the blow (steer.js, level)
  const ctx = s.ctx;
  clear(ctx);
  const from = { x: s.mid[0], z: s.mid[2] };
  if (sense.target) seek(ctx, from, { x: sense.target[0], z: sense.target[2] }, 1);
  if (s.scatter > 0 && s.scatterAt) flee(ctx, from, { x: s.scatterAt[0], z: s.scatterAt[2] }, 2, 60);
  const { dir, strength } = resolve(ctx, { blend: 0.3 });
  const speed = s.scatter > 0 ? SWARM.flee : SWARM.speed * Math.min(1, strength);
  const wantY = (sense.ground?.(s.mid[0], s.mid[2]) ?? 0) + SWARM.hover + (sense.target ? Math.max(0, sense.target[1] - (sense.ground?.(s.mid[0], s.mid[2]) ?? 0) - SWARM.hover) * 0.8 : 0);
  s.v = [dir.x * speed, (wantY - s.mid[1]) * 1.5, dir.z * speed];
  // (at its prey: it stays on it)
  if (sense.target && !s.scatter) {
    const d = Math.hypot(sense.target[0] - s.mid[0], sense.target[2] - s.mid[2]);
    if (d < 2) s.v = [0, s.v[1], 0];
  }
  for (let a = 0; a < 3; a++) s.mid[a] += s.v[a] * dt;
  // each body: with the cloud, pulled to its middle, pushed off a neighbour, boiling
  const n = s.bodies.length;
  for (let i = 0; i < n; i++) {
    const b = s.bodies[i];
    b.j += dt * 3;
    const to = [s.mid[0] - b.p[0], s.mid[1] - b.p[1], s.mid[2] - b.p[2]];
    const far = Math.hypot(...to);
    const pull = far > SWARM.spread ? SWARM.cohesion * (far - SWARM.spread) : 0.3;
    const o = s.bodies[(i * 7 + 3) % n]; // (one neighbour a frame is enough to keep them apart)
    const off = [b.p[0] - o.p[0], b.p[1] - o.p[1], b.p[2] - o.p[2]];
    const ol = Math.hypot(...off) || 1;
    const push = ol < SWARM.apart ? (SWARM.apart - ol) * 8 : 0;
    let vx = s.v[0] + (to[0] / (far || 1)) * pull + (off[0] / ol) * push + Math.sin(b.j) * 2;
    let vy = s.v[1] + (to[1] / (far || 1)) * pull + (off[1] / ol) * push + Math.cos(b.j * 1.3) * 1.5;
    let vz = s.v[2] + (to[2] / (far || 1)) * pull + (off[2] / ol) * push + Math.sin(b.j * 0.7 + 1) * 2;
    if (s.scatter > 0 && s.scatterAt) {
      const away = [b.p[0] - s.scatterAt[0], b.p[1] - s.scatterAt[1], b.p[2] - s.scatterAt[2]];
      const al = Math.hypot(...away) || 1;
      vx += (away[0] / al) * SWARM.flee;
      vy += (away[1] / al) * SWARM.flee * 0.5;
      vz += (away[2] / al) * SWARM.flee;
    }
    const vl = Math.hypot(vx, vy, vz);
    const cap = s.scatter > 0 ? SWARM.flee + SWARM.body : SWARM.body;
    if (vl > cap) {
      vx = (vx / vl) * cap;
      vy = (vy / vl) * cap;
      vz = (vz / vl) * cap;
    }
    b.v = [vx, vy, vz];
    for (let a = 0; a < 3; a++) b.p[a] += b.v[a] * dt;
    const g = (sense.ground?.(b.p[0], b.p[2]) ?? 0) + 0.4;
    if (b.p[1] < g) b.p[1] = g;
  }
  const bite = Boolean(sense.target && !s.scatter && Math.hypot(sense.target[0] - s.mid[0], sense.target[1] - s.mid[1], sense.target[2] - s.mid[2]) < SWARM.bite);
  return { swarm: s, ev, bite };
}

// the host down: the swarm dies with it
export const killSwarm = (s) => ({ ...s, alive: false, scatter: 0 });
