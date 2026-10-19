// What the unique weapons do past a bolt, as numbers and pure steps (the
// design: docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md,
// Part 6). The scenes only draw them and land what these say: the ship's
// four through universe/uniqueArms.js (the map and the galaxy) and the C-137
// street's fight, the hand's four through galaxy/surface/handArms.js. Tested
// in Node: no three.js, no React.
//
// A point is { x, y, z }; a direction is a unit [x, y, z], as the flight's
// are (universe/targeting.js's nose). A target is anything with an `at` and
// a `size` (the hunters' and the war's targets, as the guns lock on to them).
//
//   SHIP_FX, HAND_FX                 the numbers
//   dropAt(at, dir, speed, fx)       where a seismic charge leaves the ship, and its drift: { at, v }
//   inRing(at, list, radius, slab)   the targets in a flat ring about `at`
//   pierce(from, to, list, hit)      the targets a segment meets that aren't in `hit`, nearest first
//   punchAfter(punch, n, falloff)    a bolt's punch after `n` ships
//   burstDirs(dir, n, cone, rand)    `n` unit directions round `dir`, `cone` radians out
//   firstFor(from, dir, list, { lock, reach, cone })   the arc's first target: the lock, or the nearest ahead
//   chain(first, list, { jumps, hop, falloff, punch })  [{ t, punch }]: on from each to the nearest not yet reached
//   jagged(from, to, n, rand, rough)   the lightning's points, from → to
//   beamTicks(beam, dt, every)       the hits a held beam lands this frame ({ acc } kept between)
//   climbOf(w, run, ads)             radians the aim walks up on the `run`th shot of a run
//   chargeOf(held, w)                0…1 of the gauntlet's charge
//   blastOf(w, k)                    the palm blast at charge k: { damage, push, lift, scale }
//   throwOf(from, to, push, lift)    the throw it gives someone: { vx, vz, vy }

export const SHIP_FX = {
  // dropped `back` behind the ship, keeping `drift` of its way; `fuse`
  // seconds on, a ring `radius` out and `slab` up and down, swelling over `grow`
  seismic: { back: 1.2, drift: 0.35, fuse: 1.2, radius: 7, slab: 2.5, grow: 0.35 },
  // each ship it goes through takes a third off what it has left
  darkmatter: { falloff: 2 / 3 },
  // goes off `near` of its target, `shards` of `punch` each, `cone` radians out at `speed`, `reach` long
  crystal: { near: 4, shards: 6, punch: 2, cone: 0.32, speed: 42, reach: 9 },
  // reaches `reach` for the first (the lock, or the nearest within `cone` of
  // the nose), then `hop` on each time, `falloff` of the punch a jump; drawn `show` seconds
  energon: { reach: 40, cone: 0.5, hop: 12, falloff: 0.7, show: 0.22 },
};

export const HAND_FX = {
  // a run of shots is one with less than `gap` seconds between; each walks
  // the aim up a little more than the last, to `most` times the first
  m60: { gap: 0.3, grow: 0.08, most: 2.2, ads: 0.6 },
  // at a full charge: the damage `damage` times, the throw and the lift and
  // the blast's size from the first of each pair to the second
  gauntlet: { damage: 3, push: [5, 13], lift: [2, 4.5], scale: [1, 2.4] },
};

const clamp01 = (k) => Math.min(1, Math.max(0, k));
const lerp = ([a, b], k) => a + (b - a) * k;
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function dropAt(at, dir, speed, fx = SHIP_FX.seismic) {
  const v = Math.max(0, speed) * fx.drift;
  return {
    at: { x: at.x - dir[0] * fx.back, y: at.y - dir[1] * fx.back, z: at.z - dir[2] * fx.back },
    v: [dir[0] * v, dir[1] * v, dir[2] * v],
  };
}

export function inRing(at, list, radius, slab) {
  return list.filter((t) => Math.hypot(t.at.x - at.x, t.at.z - at.z) <= radius + (t.size ?? 0) / 2 && Math.abs(t.at.y - at.y) <= slab + (t.size ?? 0) / 2);
}

// how far along a → b (0…1) a point comes nearest, and how near
function nearest(a, b, p) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const l2 = dx * dx + dy * dy + dz * dz;
  const k = l2 > 0 ? clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l2) : 0;
  return { k, d: Math.hypot(a.x + dx * k - p.x, a.y + dy * k - p.y, a.z + dz * k - p.z) };
}

export function pierce(from, to, list, hit) {
  const out = [];
  for (const t of list) {
    if (hit.has(t.id ?? t)) continue;
    const n = nearest(from, to, t.at);
    if (n.d <= (t.size ?? 1) / 2) out.push({ t, k: n.k });
  }
  return out.sort((a, b) => a.k - b.k).map((o) => o.t);
}

export const punchAfter = (punch, n, falloff = SHIP_FX.darkmatter.falloff) => punch * falloff ** n;

export function burstDirs(dir, n, cone, rand = Math.random) {
  // two directions across `dir`, then each shard round it at `cone` out, the ring turned at random
  let sx = -dir[2];
  let sz = dir[0];
  let sy = 0;
  if (Math.hypot(sx, sz) < 1e-6) [sx, sy, sz] = [1, 0, 0];
  const sl = Math.hypot(sx, sy, sz);
  sx /= sl;
  sy /= sl;
  sz /= sl;
  const ux = dir[1] * sz - dir[2] * sy;
  const uy = dir[2] * sx - dir[0] * sz;
  const uz = dir[0] * sy - dir[1] * sx;
  const turn = rand() * Math.PI * 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2;
    const c = Math.cos(a) * Math.tan(cone);
    const s = Math.sin(a) * Math.tan(cone);
    const x = dir[0] + sx * c + ux * s;
    const y = dir[1] + sy * c + uy * s;
    const z = dir[2] + sz * c + uz * s;
    const l = Math.hypot(x, y, z) || 1;
    out.push([x / l, y / l, z / l]);
  }
  return out;
}

export function firstFor(from, dir, list, { lock = null, reach = SHIP_FX.energon.reach, cone = SHIP_FX.energon.cone } = {}) {
  if (lock && list.includes(lock) && apart(from, lock.at) <= reach) return lock;
  let best = null;
  let bestD = Infinity;
  for (const t of list) {
    const d = apart(from, t.at);
    if (d > reach || d < 1e-6) continue;
    const off = Math.acos(Math.max(-1, Math.min(1, ((t.at.x - from.x) * dir[0] + (t.at.y - from.y) * dir[1] + (t.at.z - from.z) * dir[2]) / d)));
    if (off <= cone && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

export function chain(first, list, { jumps = 3, hop = SHIP_FX.energon.hop, falloff = SHIP_FX.energon.falloff, punch = 1 } = {}) {
  if (!first) return [];
  const out = [{ t: first, punch }];
  const seen = new Set([first]);
  let last = first;
  for (let i = 0; i < jumps; i++) {
    let next = null;
    let nextD = Infinity;
    for (const t of list) {
      if (seen.has(t)) continue;
      const d = apart(last.at, t.at);
      if (d <= hop && d < nextD) {
        next = t;
        nextD = d;
      }
    }
    if (!next) break;
    seen.add(next);
    out.push({ t: next, punch: punch * falloff ** (i + 1) });
    last = next;
  }
  return out;
}

export function jagged(from, to, n, rand = Math.random, rough = 0.12) {
  const len = apart(from, to);
  const out = [{ ...from }];
  for (let i = 1; i < n; i++) {
    const k = i / n;
    // (out from the line by a share of its length, least at the ends)
    const w = len * rough * Math.sin(k * Math.PI);
    out.push({ x: from.x + (to.x - from.x) * k + (rand() - 0.5) * w, y: from.y + (to.y - from.y) * k + (rand() - 0.5) * w, z: from.z + (to.z - from.z) * k + (rand() - 0.5) * w });
  }
  out.push({ ...to });
  return out;
}

export function beamTicks(beam, dt, every) {
  beam.acc += dt;
  const n = Math.floor(beam.acc / every + 1e-9);
  beam.acc -= n * every;
  return n;
}

export function climbOf(w, run, ads, fx = HAND_FX.m60) {
  if (!w?.climb) return 0;
  return w.climb * Math.min(fx.most, 1 + Math.max(0, run) * fx.grow) * (ads ? fx.ads : 1);
}

export const chargeOf = (held, w) => (w?.charge ? clamp01(held / w.charge) : 0);

export function blastOf(w, k, fx = HAND_FX.gauntlet) {
  const c = clamp01(k);
  return { damage: Math.max(1, Math.round(w.damage * (1 + (fx.damage - 1) * c))), push: lerp(fx.push, c), lift: lerp(fx.lift, c), scale: lerp(fx.scale, c) };
}

export function throwOf(from, to, push, lift) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  return { vx: (dx / d) * push, vz: (dz / d) * push, vy: lift };
}
