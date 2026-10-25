// Today's player targeting as the two scenes wrote it before the sight
// (universe/scene.js's lock block, nudge and fire's aim; the galaxy's
// trackable line), word for word bar the scene's own names, and a 30 s fight
// that drives it and the sight side by side and wants them to agree frame
// for frame. sight.test.js runs the fight; sight.fixes.test.js leans on the
// helpers.
import { expect } from 'vitest';
import { AIM, assist, assistAmount, dirTo, intercept, nose, track, trackNudge } from '../targeting';
import { createSight } from '../sight';

const TRACK_AFTER_SHOT = 1500;

// the lock block; `env` stands for what the scene reads round it (its
// hunters, the clock, the assist setting, reduced motion; the galaxy's war)
export function todayLock(state, ship, cands, dt, env) {
  const was = state.lock?.id ?? null;
  // (the T ring as the sight keeps it, from Task 11 on)
  if (state.lock !== env.mine) env.ring.length = 0;
  state.lock = cands.length || state.lock ? track(ship, cands, state.lock, dt, { cycle: state.cycle, ring: env.ring }) : null;
  env.mine = state.lock;
  if (!state.lock) env.ring.length = 0;
  state.cycle = 0;
  const tgt = state.lock ? (cands.find((c) => c.id === state.lock.id) ?? null) : null;
  state.lockTarget = tgt;
  if (env.map === 'galaxy') state.trackable = Boolean(tgt && (env.hunters?.includes(tgt) || env.war.includes(tgt) || state.lock?.manual || env.now - state.lastShot < TRACK_AFTER_SHOT));
  else state.trackable = Boolean(tgt && (env.hunters?.includes(tgt) || state.lock?.manual || env.now - state.lastShot < TRACK_AFTER_SHOT));
  const ticked = Boolean(tgt && tgt.id !== was);
  state.lead = tgt ? intercept(ship, AIM.bolt + Math.max(0, ship.speed), tgt.at, tgt.vel) : null;
  state.hot = Boolean(state.lead && state.lead.t <= AIM.life && assistAmount(nose(ship), dirTo(ship, state.lead), env.assist) >= 1);
  let bx = 0;
  let by = 0;
  let bz = 0;
  if (tgt && !env.reduced) {
    const vx = tgt.at.x - ship.x;
    const vy = tgt.at.y - ship.y;
    const vz = tgt.at.z - ship.z;
    const l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    const k = Math.min(0.3, l * 0.08) / l;
    bx = vx * k;
    by = vy * k;
    bz = vz * k;
  }
  const ease = 1 - Math.exp(-dt * 3);
  state.bias[0] += (bx - state.bias[0]) * ease;
  state.bias[1] += (by - state.bias[1]) * ease;
  state.bias[2] += (bz - state.bias[2]) * ease;
  return ticked;
}

// the nose's nudge toward the lead (the galaxy's; the map's also waits on its view)
export const todayNudge = (state, ship, strength, stick) => (state.trackable && state.lead && state.lead.t <= AIM.life ? trackNudge(ship, state.lead, strength, stick) : null);

// fire's aim
export function todayAim(state, s, strength) {
  let dir = nose(s);
  if (state.lead && state.lead.t <= AIM.life) dir = assist(dir, dirTo(s, state.lead), strength);
  return dir;
}

export const DT = 1 / 60;
export const v = (x, y, z) => ({ x, y, z });
export const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, bank: 0, speed: 0 }; // (nose along −z)
export const T = (id, x, y, z, vel = v(0, 0, 0)) => ({ id, at: v(x, y, z), vel, size: 0.3 });
export const fresh = () => ({ lock: null, lockTarget: null, lead: null, hot: false, cycle: 0, bias: [0, 0, 0], lastShot: -1e9 });
// (A5's inputs: the blaster's speed and life, the raw setting)
export const feed = (more = {}) => ({ speed: AIM.bolt, life: AIM.life, help: () => ({ assist: 1 }), tracks: () => true, ...more });

export function fight(map) {
  const [a, b] = [fresh(), fresh()];
  const sight = createSight(b);
  const bias = b.bias;
  const H = ['h1', 'h2', 'h3'].map((id) => T(id, 0, 0, 0));
  H[1].threat = 1;
  const W = [T('w1', 0, 0, 0)];
  const env = { map, hunters: H, war: W, now: 0, assist: 1, reduced: false, ring: [], mine: null };
  const tracks = (t) => H.includes(t) || (map === 'galaxy' && W.includes(t)) || env.now - b.lastShot < TRACK_AFTER_SHOT;
  const o = feed({ help: () => ({ assist: env.assist }), tracks });
  const seen = { ticks: 0, hot: 0, nudges: 0, followed: 0, unfollowed: 0 };
  for (let f = 0; f < 1800; f++) {
    const t = f * DT;
    const s = { x: Math.sin(t * 0.3) * 20, y: Math.sin(t * 0.7) * 3, z: -t * 6, heading: Math.sin(t * 0.4) * 1.2, pitch: Math.sin(t * 0.9) * 0.3, speed: 8 * Math.sin(t * 0.5) };
    H.forEach((h, i) => {
      h.at = v(s.x + Math.sin(t * (0.5 + i * 0.3) + i) * 25, s.y + Math.cos(t * 0.8 + i) * 6, s.z - 30 + Math.cos(t * (0.4 + i * 0.2)) * 40);
      h.vel = v(Math.cos(t + i) * 12, 0, Math.sin(t * 0.7 + i) * 15);
    });
    const n0 = nose(s);
    if (f % 300 >= 150 && f % 300 < 250) Object.assign(H[0], { at: v(s.x + n0[0] * 20 + 0.5, s.y + n0[1] * 20, s.z + n0[2] * 20), vel: v(1, 0, 0) });
    W[0].at = v(s.x + 10, s.y, s.z - 50 + Math.sin(t) * 20);
    const pilot = T('p1', s.x + Math.sin(t * 2) * 8, s.y, s.z - 25, v(5, 0, 0)); // (afresh each frame, as pilots.targets are)
    const rock = T('r1', s.x - 5, s.y + 1, s.z - 15);
    env.now = f * (1000 / 60);
    env.assist = [1, 0, 2.5, 0.4][Math.floor(f / 150) % 4];
    env.reduced = f > 1650 && f < 1750;
    if (f % 97 === 0) a.lastShot = b.lastShot = env.now;
    if ([30, 31, 400, 405, 200, 700].includes(f)) a.cycle = b.cycle = f === 200 || f === 700 ? -1 : 1;
    if (f === 1000) for (const st of [a, b]) st.lock = { id: 'p1', out: 0, manual: true };
    if (f === 1200) for (const st of [a, b]) Object.assign(st, { lock: null, lockTarget: null, lead: null });
    const cands = f % 300 < 100 ? H : map === 'universe' ? [...H, pilot, rock] : [...H, ...W, pilot];
    const stick = { turn: Math.sin(t * 3) * 0.5, climb: Math.cos(t * 2) * 0.3 };
    const strength = [1, 0.5, 0, 2][f % 4];
    const n = todayNudge(a, s, strength, stick);
    expect(sight.nudge(s, stick, strength)).toEqual(n);
    expect(sight.aim(n0, s, strength)).toEqual(todayAim(a, s, strength));
    const ticked = todayLock(a, s, cands, DT, env);
    o.speed = AIM.bolt + Math.max(0, s.speed);
    expect(sight.update(s, cands, DT, o)).toBe(ticked);
    sight.lean(b.bias, s, DT, env.reduced);
    for (const k of ['lock', 'cycle', 'trackable', 'lead', 'hot', 'bias']) expect(b[k]).toEqual(a[k]);
    expect(b.lockTarget).toBe(a.lockTarget);
    seen.ticks += ticked;
    seen.hot += a.hot;
    seen.nudges += Boolean(n);
    if (a.lockTarget && !H.includes(a.lockTarget)) seen[a.trackable ? 'followed' : 'unfollowed'] += 1;
  }
  // (its records kept: the same bias array, no key today's code didn't write)
  expect(b.bias).toBe(bias);
  expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
  return seen;
}
