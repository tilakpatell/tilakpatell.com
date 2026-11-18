// The stations: one system in three has one, drawn from its own seed, so a
// system's stars and planets are the same whether it has one or not. It sits
// over or under its star's pole. Planets keep within 40 of their star's height
// (planetsOf), and orbitAt turns each about the part of up square to where it
// starts, so its height only goes between plus and minus the height it starts
// at: a point over the pole is clear of every planet, ring and moon at every
// t, and needs no orbit of its own. Pure (no three.js), so it runs in Node.
//
// STATION_BASE (wonder ids from here up are stations: w<STATION_BASE + i> is
//   system i's, above the lattice's THING_BASE + THING_CELLS³), STATION_SHARE,
//   STATION_SIZE: [least, most]
// poleHeight(system, size) → the least height over the star that keeps 4 sizes
//   past its own size off the star and 3 sizes past each planet's extent off
//   it, or null when that is past the system's reach less the size
// stationOf(system, { sx, sy, sz }) → { id: 'E:sx,sz:w<n>', kind: 'station', i,
//   system (its id), name: '<system name> <suffix>', at: [x, y, z], size,
//   faction (the system's), seed } | null
// stationsOf(sector) → the sector's stations, by system (ascending i)

import { spaceId } from '../../../lib/space/address.js';
import { extentOf } from './extent';
import { hash64, pick, range, rngOf } from './seed';
import { STATION_NAMES } from './tables';

export const STATION_BASE = 10000;
export const STATION_SHARE = 1 / 3;
export const STATION_SIZE = [18, 36];

const PLANE = 40; // planetsOf keeps every planet within this of its star's height

// (for h past PLANE, a planet is never nearer the pole than hypot(orbit, h - PLANE))
export function poleHeight(system, size) {
  let h = system.star.size + 4 * size;
  for (const p of system.planets) {
    const clear = extentOf(p) + 3 * size;
    if (clear > p.orbit) h = Math.max(h, PLANE + Math.sqrt(clear * clear - p.orbit * p.orbit));
  }
  return h > system.reach - size ? null : h;
}

export function stationOf(system, { sx, sy, sz }) {
  const seed = hash64(system.seed, 'station');
  const rng = rngOf(seed);
  if (!(rng() < STATION_SHARE)) return null;
  const size = range(rng, ...STATION_SIZE);
  const suffix = pick(rng, STATION_NAMES);
  const side = rng() < 0.5 ? 1 : -1;
  const h = poleHeight(system, size);
  if (h === null) return null;
  const [x, y, z] = system.at;
  return {
    id: spaceId([sx, sy, sz], { wonder: STATION_BASE + system.i }),
    kind: 'station',
    i: system.i,
    system: system.id,
    name: `${system.name} ${suffix}`,
    at: [x, y + side * h, z],
    size,
    faction: system.faction,
    seed,
  };
}

export function stationsOf(sector) {
  const out = [];
  for (const system of sector.systems) {
    const st = stationOf(system, sector);
    if (st) out.push(st);
  }
  return out;
}
