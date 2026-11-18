// Where the ship parks at a generated place, and how far off. Pure (no React,
// DOM or three.js). The nav has it through its caller's lookup (resolve.js's
// lookupOf, the scene's places), not by import, so the pages that load the
// nav don't carry it. All the same it takes only the ship, the ids and the
// expanse's light face: never the generator or the resolver.
//
// A planet or moon is parked at reach + 4 (PARK_GAP.near), a system, a
// thing or a wonder at reach + 16 (PARK_GAP.deep), level with its middle
// (a planet's and a moon's a little above, at SHIP.height), facing it. Of 32
// level ways in, the one that scores best, as ship.js's parkAt scores: the
// way the ship comes from, +3 on a planet's or moon's day side, and +6 where
// every one of a planet's moons goes by no nearer than clearOf its radius
// (clearPark's margin, so a passing moon never shoves the autopilot's stop
// mid-settle). Where no way in at reach + 4 is clear of them all, it parks
// just past its furthest moon, where every way is.
//
// A system parks in a gap between its planets' orbits, not at a fixed ring:
// a giant on a small star's first orbit can sweep through any ring near the
// star. A moon's gap is worked out exactly, not sampled: 64 points round its
// circle miss up to a tenth of its orbit between them.
//
// gapRadius(system, least, margin) → the least r ≥ least with |r − orbit| ≥
//   extentOf(planet) + margin for every planet
// moonGap(offset, moon) → the least distance from a point (offset from the
//   planet's middle) to the moon's whole circle
// parkDistance(dest) → how far from the place's middle it parks (dest needs
//   only { place, reach, deep, src: { row } }, so a row round the ship does)
// parkPlace(dest, from: [x, z], t) → Park | null, where Park is { x, y, z,
//   heading, offset: [dx, dy, dz] } and offset is the park less where the
//   place is at t
// followPark(dest, park, t) → the park at t: the same offset and heading
// placeSpace(space, dest) → space with the place among its goals ({ id, at,
//   r, reach }, at its own copy of where it is, which a trip moves in place);
//   every other goal as it was, as pilotGoal.js's pilotSpace has it

import { PARK_GAP, SHIP, clearOf, headingTo } from '../ship';
import { extentOf } from '../../expanse/shared/orbits';
import { atTime } from './ids';

const WAYS = 32;
const SYSTEM_MARGIN = PARK_GAP.deep + 40; // past each planet's extent, either side of its orbit

const TAU = 2 * Math.PI;
const way = (i) => [Math.cos((i / WAYS) * TAU), Math.sin((i / WAYS) * TAU)];
const offsetOf = ([dx, dz], d, deep) => [dx * d, deep ? 0 : SHIP.height, dz * d];
const moonsOf = (dest) => (dest?.place === 'planet' ? (dest.src?.row?.moonList ?? []) : []);
const clearOfMoons = (offset, moons) => moons.every((m) => moonGap(offset, m) >= clearOf(m.radius));

export function gapRadius(system, least, margin) {
  let r = least;
  // (each planet keeps r out of its band; pushed past one, r may land in
  // another, so round again until none moves it. r only grows, so it ends)
  for (let moved = true; moved; ) {
    moved = false;
    for (const p of system.planets ?? []) {
      const need = extentOf(p) + margin;
      if (r > p.orbit - need && r < p.orbit + need) {
        r = p.orbit + need;
        moved = true;
      }
    }
  }
  return r;
}

export function moonGap(offset, moon) {
  // (the circle's normal, as moonAt lays it: the x-z plane tilted about x)
  const nx = 0;
  const ny = Math.cos(moon.tilt);
  const nz = Math.sin(moon.tilt);
  const qn = offset[0] * nx + offset[1] * ny + offset[2] * nz;
  const rho = Math.hypot(offset[0] - qn * nx, offset[1] - qn * ny, offset[2] - qn * nz);
  return Math.hypot(rho - moon.orbit, qn);
}

export function parkDistance(dest) {
  const d = dest.reach + (dest.deep ? PARK_GAP.deep : PARK_GAP.near);
  if (dest.place === 'system') return gapRadius(dest.src.row, d, SYSTEM_MARGIN);
  const moons = moonsOf(dest);
  if (!moons.length) return d;
  for (let i = 0; i < WAYS; i++) if (clearOfMoons(offsetOf(way(i), d, dest.deep), moons)) return d;
  // (no way in clear: out past the furthest moon, where the distance to each
  // circle is at least the distance to its middle less its orbit)
  return Math.max(d, ...moons.map((m) => m.orbit + clearOf(m.radius)));
}

export function parkPlace(dest, from, t) {
  const at = dest ? atTime(dest, t) : null;
  if (!at) return null;
  const d = parkDistance(dest);
  const moons = moonsOf(dest);
  const star = dest.place === 'planet' || dest.place === 'moon' ? dest.src?.system?.at : null;
  const sl = star ? Math.hypot(star[0] - at[0], star[2] - at[2]) || 1 : 1;
  const al = Math.hypot(from[0] - at[0], from[1] - at[2]) || 1;
  const ax = (from[0] - at[0]) / al;
  const az = (from[1] - at[2]) / al;
  let best = null;
  for (let i = 0; i < WAYS; i++) {
    const [dx, dz] = way(i);
    const day = star ? (dx * (star[0] - at[0]) + dz * (star[2] - at[2])) / sl : 0;
    const score = dx * ax + dz * az + (star && day >= -1e-9 ? 3 : 0) + (clearOfMoons(offsetOf([dx, dz], d, dest.deep), moons) ? 6 : 0);
    if (!best || score > best.score) best = { score, dx, dz };
  }
  const [ox, oy, oz] = offsetOf([best.dx, best.dz], d, dest.deep);
  const x = at[0] + ox;
  const y = at[1] + oy;
  const z = at[2] + oz;
  // (the offset as the park less the place, so the park is the place plus it exactly)
  return { x, y, z, heading: headingTo(-best.dx, -best.dz), offset: [x - at[0], y - at[1], z - at[2]] };
}

export function followPark(dest, park, t) {
  const at = atTime(dest, t);
  const [dx, dy, dz] = park.offset;
  return { x: at[0] + dx, y: at[1] + dy, z: at[2] + dz, heading: park.heading, offset: park.offset };
}

export function placeSpace(space, dest) {
  return { ...space, goals: { ...space.goals, [dest.id]: { id: dest.id, at: [...dest.at], r: dest.r, reach: dest.reach } } };
}
