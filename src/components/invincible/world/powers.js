// The heroes' powers (./heroes.js names whose is whose), as rules: the power
// key held a quarter of a second in the air (on the ground too, for
// Thragg's shout) uses it, once a hold.
//
// - transmute (Atom Eve): a pink wall 12 m wide where she looks, for 6 s,
//   that stops a thrown car or a bolt; aimed at a damaged tower within
//   120 m, 0.3 of its damage mended instead (./demolish.js's mendTower).
// - linebreak (Omni-Man): 2 s at Mach 2 in a straight line (./flight.js's
//   dive at its speed); every tower within 60 m of the line takes 0.05,
//   whoever's within 60 m of it is floored (nearLine), and Cecil calls.
// - shout (Thragg): a ring to 40 m that throws every foe and car (./foes.js
//   does it), 8 s between.
//
// stepPower(p, heroId, { power }, mark: { p, look, mode }, world: { towers:
// [{ id, x, z, w, d, h, damage }] }, dt) → { p, out }. A step is never longer
// than a twentieth of a second.

import { hero } from './heroes';

const MACH = 343;
export const POWERS = {
  transmute: { hold: 0.25, wide: 12, life: 6, mend: 0.3, reach: 120, ahead: 10, cool: 1 },
  linebreak: { hold: 0.25, time: 2, speed: MACH * 2, near: 60, damage: 0.05, cool: 6 },
  shout: { hold: 0.25, r: 40, cool: 8 },
};

export const newPower = () => ({ held: 0, fired: false, cool: 0 });

// which of `points` ([x, y, z]) are within `r` of the line from a to b, flat
export function nearLine(points, a, b, r) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const dd = dx * dx + dz * dz || 1;
  const out = [];
  points.forEach((q, i) => {
    const k = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / dd));
    if (Math.hypot(a[0] + dx * k - q[0], a[2] + dz * k - q[2]) <= r) out.push(i);
  });
  return out;
}

// the first damaged tower along his look within reach (a flat ray against its box, under its top)
function aimedAt(m, towers, reach) {
  const fl = Math.hypot(m.look[0], m.look[2]) || 1;
  const dir = [m.look[0] / fl, m.look[2] / fl];
  let best = null;
  for (const t of towers) {
    if (!(t.damage > 0)) continue;
    let t0 = 0;
    let t1 = reach;
    for (const [o, d, lo, hi] of [[m.p[0], dir[0], t.x - t.w / 2, t.x + t.w / 2], [m.p[2], dir[1], t.z - t.d / 2, t.z + t.d / 2]]) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) t0 = Infinity;
        continue;
      }
      const a = (lo - o) / d;
      const b = (hi - o) / d;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    const y = m.p[1] + (m.look[1] / fl) * t0;
    if (t0 <= t1 && y <= t.h && (!best || t0 < best.t)) best = { t: t0, id: t.id };
  }
  return best?.id ?? null;
}

export function stepPower(prev, heroId, input = {}, m, world = {}, rawDt) {
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  const p = { ...prev, cool: Math.max(0, prev.cool - dt) };
  const out = [];
  const power = hero(heroId).power;
  const P = POWERS[power];
  if (!P || !input.power) return { p: { ...p, held: 0, fired: false }, out };
  p.held += dt;
  const ready = !p.fired && p.held >= P.hold && p.cool <= 0;
  if (!ready || (power !== 'shout' && m.mode !== 'air')) return { p, out };
  p.fired = true;
  p.cool = P.cool;
  if (power === 'transmute') {
    const id = aimedAt(m, world.towers ?? [], P.reach);
    if (id != null) out.push({ kind: 'mend', id, amount: P.mend });
    else out.push({ kind: 'construct', at: m.p.map((v, i) => v + m.look[i] * P.ahead), yaw: Math.atan2(m.look[0], m.look[2]), wide: P.wide, life: P.life });
  } else if (power === 'linebreak') {
    const l = Math.hypot(...m.look) || 1;
    const to = m.p.map((v, i) => v + (m.look[i] / l) * P.speed * P.time);
    const towers = world.towers ?? [];
    const crossed = nearLine(towers.map((t) => [t.x, 0, t.z]), m.p, to, P.near).map((i) => towers[i].id);
    out.push({ kind: 'linebreak', from: [...m.p], to, speed: P.speed, time: P.time, towers: crossed, damage: P.damage, near: P.near });
  } else if (power === 'shout') out.push({ kind: 'shout', at: [...m.p], r: P.r });
  return { p, out };
}
