// Mars, landed on: rules only (./marsScene.js draws it, loaded when the
// orbit says Mark is within `RANGE.load` of the planet and let go when he
// is further). The landing site is the point of Mars that faces the Earth
// (where Thragg hangs, ../orbit.js), and everything here is in a flat frame
// on it: x and z along the ground, y up off it, the ground itself the
// sphere's own curve under the plane (`groundAt`). The Martian base, its
// ship, the four astronauts the Sequids took, the swarm (./swarm.js) and
// the host it rides, a Martian under them: the mission "The Martian
// mission" (../season2.js) is to carry each astronaut to the ship, put the
// host down, and run the gates home at speed. Plain [x, y, z] arrays,
// metres; a step is never over 0.05 s.

import { BODIES } from '../orbit';
import { SWARM, killSwarm, newSwarm, stepSwarm } from './swarm';

export const MARS = BODIES.find((b) => b.id === 'mars');
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a, b) => len(sub(a, b));
const clampDt = (dt) => Math.min(0.05, Math.max(0, dt || 0));

// the site's frame: up is away from Mars toward the Earth; x and z lie along the ground
const N = unit(MARS.c.map((v) => -v));
const E1 = unit(cross(N, [0, 1, 0]));
const E2 = cross(E1, N); // (right-handed: x × y = z, so the frame is a turn, not a mirror)
export const FRAME = { n: N, e1: E1, e2: E2 };
export const SITE = MARS.c.map((v, i) => v + N[i] * MARS.r);
export const toLocal = (p) => {
  const d = sub(p, SITE);
  return [dot(d, E1), dot(d, N), dot(d, E2)];
};
export const toWorld = (l) => SITE.map((v, i) => v + E1[i] * l[0] + N[i] * l[1] + E2[i] * l[2]);
// a world direction in the frame
export const dirLocal = (d) => [dot(d, E1), dot(d, N), dot(d, E2)];
// the ground under (x, z): the sphere's curve under the site's plane (0 at the site, falling away)
export const groundAt = (x, z) => Math.sqrt(Math.max(0, MARS.r * MARS.r - x * x - z * z)) - MARS.r;

// how near the planet before its ground is drawn, from its surface
export const RANGE = { load: 30000, drop: 32000 };
export const nearMars = (p, r = RANGE.load) => dist(p, MARS.c) - MARS.r < r;

// the base at the site, its ship, where the four were taken to
export const BASE = {
  p: [0, 0, 0],
  dome: 14,
  ship: [70, 0, 20], // the ship: an astronaut within ASTRO.aboard of it is aboard
  astronauts: [
    [-120, 0, 60],
    [160, 0, 140],
    [-40, 0, -200],
    [220, 0, -90],
  ],
};
export const ASTRO = { reach: 3, aboard: 8 };
// the host: a Martian under the swarm, by the base
export const HOST = { h: 1.9, hits: 12, reach: 3.2, every: 2, hurt: 10, speed: 4, near: 90, stagger: 0.5, p: [20, 0, -30] };
// the swarm by tier
export const SWARM_N = { low: 800, mid: 1600, high: 2400 };
// the gates home: three, 300 m up, out from the site toward the Earth's side
export const GATE_R = 150;
export const GATES = [
  [0, 300, -600],
  [0, 500, -1500],
  [0, 700, -2600],
].map(toWorld);

export function newMars(n = SWARM_N.low) {
  return {
    on: true,
    t: 0,
    astronauts: BASE.astronauts.map((p, i) => ({ id: i, p: [p[0], groundAt(p[0], p[2]), p[2]], state: 'lost' })),
    aboard: 0,
    host: { p: [HOST.p[0], groundAt(HOST.p[0], HOST.p[2]), HOST.p[2]], hits: 0, state: 'stand', cool: 1, t: 0, yaw: 0 },
    swarm: newSwarm(n, [HOST.p[0], groundAt(HOST.p[0], HOST.p[2]) + SWARM.hover, HOST.p[2]]),
  };
}

// One step. hero: his place and look in the world's frame (p, mode: 'perch'
// on the ground, look: [x, y, z]); input: { punch }. → { mars, ev, hurt }:
// `hurt` is what the swarm and the host took off him this step.
export function stepMars(prev, hero, input, rawDt) {
  const dt = clampDt(rawDt);
  const m = { ...prev, astronauts: prev.astronauts.map((a) => ({ ...a, p: [...a.p] })), host: { ...prev.host, p: [...prev.host.p] } };
  const ev = [];
  let hurt = 0;
  m.t += dt;
  const hp = toLocal(hero.p);
  const chest = [hp[0], hp[1] + 1, hp[2]];
  const look = dirLocal(hero.look ?? [0, 0, 1]);
  const punchAt = input.punch ? [chest[0] + look[0] * 2, chest[1] + look[1] * 2, chest[2] + look[2] * 2] : null;

  // the astronauts: picked up by coming to them, carried in his arms, aboard at the ship
  const carried = m.astronauts.find((a) => a.state === 'carried');
  for (const a of m.astronauts) {
    if (a.state === 'lost' && !carried && dist(chest, [a.p[0], a.p[1] + 1, a.p[2]]) < ASTRO.reach) {
      a.state = 'carried';
      ev.push({ type: 'pick', id: a.id });
    } else if (a.state === 'carried') {
      a.p = [hp[0] + look[0] * 0.4, hp[1] + 0.9, hp[2] + look[2] * 0.4];
      if (Math.hypot(a.p[0] - BASE.ship[0], a.p[2] - BASE.ship[2]) < ASTRO.aboard && hp[1] - groundAt(hp[0], hp[2]) < 6) {
        a.state = 'aboard';
        m.aboard += 1;
        ev.push({ type: 'aboard', id: a.id, n: m.aboard });
      }
    }
  }

  // the host: at him when he is near, a swing in reach; a blow in front staggers it; twelve put it down
  const h = m.host;
  if (h.state !== 'down') {
    const toMark = sub(chest, [h.p[0], h.p[1] + 1, h.p[2]]);
    const d = len(toMark);
    h.yaw = Math.atan2(toMark[0], toMark[2]);
    // (a blow: in reach, and he is looking at it: the way from him to it is his look)
    if (punchAt && d < HOST.reach + 1.5 && dot(unit(toMark), look) < -0.5) {
      h.hits += 1;
      if (h.hits >= HOST.hits) {
        h.state = 'down';
        ev.push({ type: 'hostDown', at: [...h.p] });
        m.swarm = killSwarm(m.swarm);
      } else {
        Object.assign(h, { state: 'stagger', t: HOST.stagger });
        ev.push({ type: 'hostHit', hits: h.hits, at: [h.p[0], h.p[1] + 1, h.p[2]] });
      }
    }
    if (h.state === 'stagger') {
      h.t -= dt;
      if (h.t <= 0) h.state = 'stand';
    } else if (h.state !== 'down') {
      h.cool = Math.max(0, h.cool - dt);
      const flat = Math.hypot(toMark[0], toMark[2]);
      if (d < HOST.reach) {
        if (h.cool <= 0) {
          h.cool = HOST.every;
          hurt += HOST.hurt;
          ev.push({ type: 'hostSwing', at: [h.p[0], h.p[1] + 1, h.p[2]] });
        }
      } else if (flat < HOST.near && flat > 1e-6) {
        const step = Math.min(flat - HOST.reach * 0.8, HOST.speed * dt);
        h.p[0] += (toMark[0] / flat) * step;
        h.p[2] += (toMark[2] / flat) * step;
        h.p[1] = groundAt(h.p[0], h.p[2]);
      }
    }
  }

  // the swarm: on the nearest astronaut still out there, else on him (and whoever he carries)
  const lost = m.astronauts.filter((a) => a.state === 'lost');
  let target = null;
  if (m.swarm.alive) {
    const mid = m.swarm.mid;
    const near = lost.reduce((best, a) => (!best || dist(a.p, mid) < dist(best.p, mid) ? a : best), null);
    const dh = dist(chest, mid);
    target = near && (!carried || dist(near.p, mid) < dh) && dist(near.p, mid) < dh * 1.5 ? [near.p[0], near.p[1] + 1, near.p[2]] : dh < 260 ? chest : near ? [near.p[0], near.p[1] + 1, near.p[2]] : null;
  }
  const r = stepSwarm(m.swarm, { target, punch: punchAt, ground: groundAt }, dt);
  m.swarm = r.swarm;
  ev.push(...r.ev);
  if (r.bite && target === chest) hurt += SWARM.hurt * dt;
  return { mars: m, ev, hurt };
}

// the nearest astronaut still out there, in the world's frame (the mission's marker)
export function nearestLost(m, heroP) {
  const hp = toLocal(heroP);
  const a = m.astronauts.filter((q) => q.state === 'lost').reduce((best, q) => (!best || dist(q.p, hp) < dist(best.p, hp) ? q : best), null);
  return a ? toWorld(a.p) : null;
}
