// One sector of the one space: today's middle layer exactly as it was (legacy
// first), then systems appended in 3D, the lattice of small things, and a
// resolver for any generated id. makeSector stays as it is; this composes it.
// Pure (no React, DOM or three.js), so it runs in Node.
//
// fullSector(universe, sx, sy, sz, { things = true, lattice = things, extras = SECTOR_EXTRAS } = {}) → {
//   id: sectorKey, sx, sy, sz, seed, origin: [x, y, z],
//   systems (addBodies'd; legacy first on sy 0, then appended; systems[i].i === i),
//   wonders (today's on the middle layer, [] elsewhere),
//   stations (stations.js's, one system in three; made whether or not things is),
//   things (a ThingSet, empty when things is false), extras ({ [list]: rows }),
//   beacons (today's on the middle layer, the same rule at the sector's height elsewhere),
//   legacy: { systems, wonders } (where the appended part begins) }
//   things: false makes neither the lattice nor any list; lattice: false (things true) makes the
//   lists alone; extras is for tests. What appended systems keep out of holds whatever they are,
//   so a system's id never depends on them. arrivals (for tests) is the arrival's gargantuan
//   rows: ARRIVAL_GARGANTUANS in the shared universe's core, [] elsewhere; more than one throws.
//   The sector's gargantuan (gargantuans.js) and the arrival's are the lists `gargantuan` (w3)
//   and `arrival` (w4); appended systems keep their size + 2,000 off them, and the lattice and
//   the lists keep off their solid parts (ctx.keeps).
// wonderPlace(sector, n, extras = SECTOR_EXTRAS) → placeIn's answer for w<n>. The lists come
//   first: a high list's numbers are past the stations' base too, and the station branch would
//   read w20001 as station 10001. Then lane 3's stations, the lattice and the legacy wonders.
// placeOf(universe, id) → { kind: 'system' | 'planet' | 'moon' | 'station' | 'wonder' | 'thing' | 'extra', row, sector } | null
//   (keeps the last 8 sectors it built: its rows are shared with that cache, so treat them as
//   read-only; a cache miss builds a whole sector synchronously)
// placeIn(sector, parsed) → the same, on a sector already made (the one parseSpaceId's
//   parsed id names); it builds nothing, and a part the sector hasn't got yet (a 2D
//   sector's lattice and stations, a worker's moons before withMoons) is null, not a throw

import { parseSpaceId, sectorCentre, sectorKey } from '../../../lib/space/address.js';
import { CUBE_HALF } from './cube';
import { ARRIVAL_GARGANTUANS, ARRIVAL_MAX, GARGANTUAN, gargantuanKeeps, gargantuanOf } from './gargantuans';
import { SECTOR_EXTRAS } from './extras';
import { clearOfKeepOuts, keepOutsNear } from './keepOuts';
import { UNIVERSE, hash64, int, range, rngOf, sectorSeedOf, systemSeed } from './seed';
import { beaconsOf, makeSector } from './sector';
import { STATION_BASE, stationsOf } from './stations';
import { addBodies, localFactions, systemAt } from './systems';
import { factionBand } from './tables';
import { THING_BASE, thingRow, thingsOf } from './things';

// (appended systems stay CUBE_HALF from the middle, each way: cube.js, a leaf, since lane 4a's
// lists need it too and importing this file from them would be a cycle)
const GAP = 6000; // between systems, in 3D
const NEAR = 3000; // between a system and a wonder or beacon
const TRIES = 60; // darts a system
const KEPT = 8; // sectors placeOf remembers

const noThings = () => ({
  count: 0,
  slot: new Uint16Array(0),
  kind: new Uint8Array(0),
  at: new Float32Array(0),
  size: new Float32Array(0),
});

const near = (a, b, r) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz < r * r;
};

// A coarse grid of the systems placed so far, cells GAP wide, so "is anything
// within GAP" looks in 27 cells and not at every system.
function gridOf() {
  const cells = new Map();
  const cellOf = (at) => at.map((v) => Math.floor(v / GAP));
  const key = (x, y, z) => `${x},${y},${z}`;
  return {
    add(at) {
      const k = key(...cellOf(at));
      const list = cells.get(k);
      if (list) list.push(at);
      else cells.set(k, [at]);
    },
    clear(at) {
      const [cx, cy, cz] = cellOf(at);
      for (let x = cx - 1; x <= cx + 1; x++)
        for (let y = cy - 1; y <= cy + 1; y++)
          for (let z = cz - 1; z <= cz + 1; z++)
            for (const o of cells.get(key(x, y, z)) ?? []) if (near(at, o, GAP)) return false;
      return true;
    },
  };
}

// (reach doesn't change with where a system is, so a probe built at the
// sector's middle gives it before the dart is thrown)
const built = (sSeed, ctx, at) => addBodies({ systems: [systemAt(sSeed, { ...ctx, at })] }).systems[0];

function appendSystems(sector, outs) {
  const { id, seed, origin, sx, sy, sz } = sector;
  const rng = rngOf(hash64(seed, 'more'));
  const home = !sx && !sy && !sz;
  const attempts = home ? int(rng, 100, 150) : int(rng, 200, 300);
  const d = Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz));
  const base = { id, d, band: factionBand(d), local: localFactions(rngOf(seed), id, d) };
  const grid = gridOf();
  for (const s of sector.systems) grid.add(s.at);
  const fixed = [...sector.wonders.map((w) => w.at), ...Object.values(sector.beacons).map((b) => b.at)];

  for (let a = 0; a < attempts; a++) {
    const i = sector.systems.length;
    const sSeed = systemSeed(seed, i);
    const ctx = { ...base, i };
    let reach = -1; // (only a sector with keep-outs near it needs the system's reach before the dart)
    let at = null;
    for (let t = 0; t < TRIES && !at; t++) {
      const p = [
        origin[0] + range(rng, -CUBE_HALF, CUBE_HALF),
        origin[1] + range(rng, -CUBE_HALF, CUBE_HALF),
        origin[2] + range(rng, -CUBE_HALF, CUBE_HALF),
      ];
      if (!grid.clear(p) || fixed.some((f) => near(p, f, NEAR))) continue;
      if (outs.length) {
        if (reach < 0) reach = built(sSeed, ctx, origin).reach;
        if (!clearOfKeepOuts(p, reach, outs)) continue;
      }
      at = p;
    }
    if (!at) continue;
    grid.add(at);
    sector.systems.push(built(sSeed, ctx, at));
  }
}

export function fullSector(universe, sx, sy, sz, { things = true, lattice = things, extras = SECTOR_EXTRAS, arrivals = null } = {}) {
  const id = sectorKey(sx, sy, sz);
  const seed = sectorSeedOf(universe, sx, sy, sz);
  const origin = sectorCentre(sx, sy, sz);
  const sector = { id, sx, sy, sz, seed, origin };
  if (sy === 0) {
    const old = addBodies(makeSector(universe, sx, sz));
    sector.systems = old.systems;
    sector.wonders = old.wonders;
    sector.beacons = old.beacons;
  } else {
    sector.systems = [];
    sector.wonders = [];
    sector.beacons = beaconsOf(sx, sz, seed, sy);
  }
  sector.legacy = { systems: sector.systems.length, wonders: sector.wonders.length };
  const outs = keepOutsNear(sx, sy, sz);
  // (the gargantuan comes before the appended systems: a system appended into a black hole's
  // disc couldn't be moved after. The arrival's, lane 4c's, likewise in the shared core.)
  const g = gargantuanOf(universe, sx, sy, sz, sector);
  const core = !sx && !sy && !sz;
  const came = arrivals ?? (core && universe === UNIVERSE ? ARRIVAL_GARGANTUANS : []);
  if (came.length > ARRIVAL_MAX) throw new RangeError('at most one gargantuan a sector (spec C): the core holds the arrival’s one only');
  const big = g ? [g, ...came] : [...came];
  appendSystems(sector, big.length ? [...outs, ...big.map((b) => ({ id: 'gargantuan', at: b.at, r: b.size + GARGANTUAN.systems }))] : outs);
  sector.stations = stationsOf(sector);
  if (things) {
    const d = Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz));
    const ctx = { sx, sy, sz, origin, seed, universe, systems: sector.systems, wonders: sector.wonders, beacons: sector.beacons, stations: sector.stations, outs, d, core: !d, gargantuan: g, arrivals: came, keeps: big.flatMap(gargantuanKeeps) };
    const made = thingsOf(ctx, extras, undefined, { lattice });
    sector.things = made.things;
    sector.extras = made.extras;
  } else {
    sector.things = noThings();
    sector.extras = {};
  }
  return sector;
}

const kept = new Map();
function sectorFor(universe, p) {
  const k = `${universe}|${p.key}`;
  let s = kept.get(k);
  if (s) kept.delete(k);
  else s = fullSector(universe, p.sx, p.sy, p.sz);
  kept.set(k, s);
  if (kept.size > KEPT) kept.delete(kept.keys().next().value);
  return s;
}

// where key(list[i]) is k, in a list sorted by key: the slot a lattice wonder number
// names among the slots that hold something, or the station a system's number names
function indexOf(list, k, key = (v) => v) {
  let lo = 0;
  let hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const at = key(list[mid]);
    if (at === k) return mid;
    if (at < k) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export function wonderPlace(sector, n, extras = SECTOR_EXTRAS) {
  for (const e of extras) {
    if (n >= e.base && n < e.base + e.max) {
      const row = sector.extras?.[e.list]?.[n - e.base];
      return row ? { kind: 'extra', row, sector } : null;
    }
  }
  if (n >= STATION_BASE) {
    const list = sector.stations ?? [];
    const i = indexOf(list, n - STATION_BASE, (st) => st.i);
    return i < 0 ? null : { kind: 'station', row: list[i], sector };
  }
  if (n >= THING_BASE) {
    const i = indexOf(sector.things?.slot ?? [], n - THING_BASE);
    return i < 0 ? null : { kind: 'thing', row: thingRow(sector, i), sector };
  }
  const row = sector.wonders?.[n];
  return row ? { kind: 'wonder', row, sector } : null;
}

export function placeOf(universe, id) {
  const p = parseSpaceId(id);
  return p ? placeIn(sectorFor(universe, p), p) : null;
}

export function placeIn(sector, p) {
  if (!p) return null;
  if (p.wonder !== undefined) return wonderPlace(sector, p.wonder);
  const system = sector.systems?.[p.system];
  if (!system) return null;
  if (p.planet === undefined) return { kind: 'system', row: system, sector };
  const planet = system.planets?.[p.planet];
  if (!planet) return null;
  if (p.moon === undefined) return { kind: 'planet', row: planet, sector };
  const moon = planet.moonList?.[p.moon];
  return moon ? { kind: 'moon', row: moon, sector } : null;
}
