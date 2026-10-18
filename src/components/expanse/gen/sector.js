// A sector of the expanse, made from the universe's seed and where it is:
// the same sector every time, built alone, nothing stored. Up to two dozen
// star systems, each with its planets, who holds it, how busy and how
// dangerous it is; a few wonders between them; and a beacon in the middle
// of each side, facing the next sector. Sector (0, 0) is the authored map:
// it has no generated systems, and its beacons are the home system's four
// (waypoints.js's). Further out the names get
// stranger, the space less held and the hazards worse. Pure (no three.js).
// (the systems themselves are built by systems.js)
// Sides: n is -z, s +z, e +x, w -x. Everything is in plain map coordinates.
//
// SECTOR (grid.js's)
// makeSector(universe: bigint, sx, sz) → { id: 'E:sx,sz', sx, sz, seed,
//   origin: [x, 0, z], systems, wonders, beacons: { n, e, s, w } }
//   a system: { id: 'E:sx,sz:i', i, name, designation, at, seed, culture,
//     star: { class, color, size }, planets, faction: { id, name },
//     traffic: 0..1, hazard: null | 'storm' | 'pirates' | 'minefield' }
//   a planet: { id: '<system id>:j', name, type, radius, color, at (where it
//     is round its orbit at t = 0), orbit, moons, rings, seed }
//   a wonder: { id: 'E:sx,sz:w<k>', kind, name, at, size, seed }
//   a beacon: { id: 'beacon:E:sx,sz:<side>', at (the point), side }
// beaconsOf(sx, sz, seed, sy = 0) → { n, e, s, w }: makeSector's beacons on the middle layer, the
//   same rule at the sector's height elsewhere
// neighbours(sx, sz) → [[sx, sz]…] the four edge neighbours, n e s w
// facing(a, b) → the side of a ([sx, sz]) that faces b, an edge neighbour

import { sectorKey } from "../../../lib/space/address.js";
import { MAP_RADIUS, SECTORS, SECTOR_RADIUS } from "../../universe/layout";
import { REGIONS } from "../../universe/regions";
import { SECTOR, sectorId } from "./grid";
import { nameOf } from "./names";
import {
  hash64,
  int,
  range,
  rngOf,
  sectorSeed,
  systemSeed,
  weighted,
} from "./seed";
import { cultureOf, localFactions, systemAt } from "./systems";
import { WONDERS, factionBand } from "./tables";

export { SECTOR };

const DISC = SECTOR / 2 - 2000; // systems stay inside this round the middle
const EDGE = SECTOR / 2 - 2000; // a beacon's this far out from the middle
const GAP = 6000; // between systems, level
const WONDER_GAP = 3000; // between a wonder and any system
const BEACON_GAP = 3000; // between a beacon and any system
const TRIES = 60; // darts a system
const SIDES = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

const level = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// the home system's four beacons, as waypoints.js makes them (s is the
// one the ship starts at, 'home'); not imported, waypoints.js is busy
const HOME_OUT = Math.hypot(REGIONS[0].hub[0], REGIONS[0].hub[2]);
const homeAt = (a) => [
  Math.sin(a) * HOME_OUT,
  REGIONS[0].hub[1],
  Math.cos(a) * HOME_OUT,
];
const HOME_ANGLES = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

export const neighbours = (sx, sz) =>
  Object.values(SIDES).map(([dx, dz]) => [sx + dx, sz + dz]);
export function facing(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  for (const [side, [x, z]] of Object.entries(SIDES))
    if (x === dx && z === dz) return side;
  throw new Error(`sectors ${a} and ${b} don't share an edge`);
}

// where nothing generated may go: round the authored map, for its neighbours
function keepOuts(sx, sz) {
  if (Math.max(Math.abs(sx), Math.abs(sz)) !== 1) return [];
  return [
    { at: [0, 0, 0], r: MAP_RADIUS + 4000 },
    { at: SECTORS.rickmorty.origin, r: SECTOR_RADIUS.rickmorty + 4000 },
  ];
}

// (sy lifts the generic rule to a sector's own height; the home beacons are
// only the middle layer's 0,0)
export function beaconsOf(sx, sz, seed, sy = 0) {
  const [cx, cz] = [sx * SECTOR, sz * SECTOR];
  const cy = sy * SECTOR;
  const id = sectorKey(sx, sy, sz);
  const make = (side, at) => ({ id: `beacon:${id}:${side}`, at, side });
  if (!sx && !sz && !sy)
    return Object.fromEntries(
      Object.entries(HOME_ANGLES).map(([side, a]) => [
        side,
        make(side, homeAt(a)),
      ]),
    );
  const rng = rngOf(hash64(seed, "beacons"));
  const off = () => range(rng, -3000, 3000);
  const y = () => cy + range(rng, -200, 200);
  return {
    n: make("n", [cx + off(), y(), cz - EDGE]),
    e: make("e", [cx + EDGE, y(), cz + off()]),
    s: make("s", [cx + off(), y(), cz + EDGE]),
    w: make("w", [cx - EDGE, y(), cz + off()]),
  };
}

// a point in the sector's disc, clear of everything in `clear` ([{ at, r }])
function dart(rng, cx, cz, clear) {
  for (let t = 0; t < TRIES; t++) {
    const a = rng() * Math.PI * 2,
      r = DISC * Math.sqrt(rng());
    const at = [cx + Math.sin(a) * r, 0, cz + Math.cos(a) * r];
    if (clear.every((c) => level(at, c.at) >= c.r)) return at;
  }
  return null;
}

export function makeSector(universe, sx, sz) {
  const id = sectorId(sx, sz);
  const seed = sectorSeed(universe, sx, sz);
  const origin = [sx * SECTOR, 0, sz * SECTOR];
  const beacons = beaconsOf(sx, sz, seed);
  const sector = {
    id,
    sx,
    sz,
    seed,
    origin,
    systems: [],
    wonders: [],
    beacons,
  };
  if (!sx && !sz) return sector;

  const rng = rngOf(seed);
  const d = Math.max(Math.abs(sx), Math.abs(sz));
  const [cx, , cz] = origin;
  const outs = keepOuts(sx, sz);
  const near = Object.values(beacons).map((b) => ({ at: b.at, r: BEACON_GAP }));

  // the factions of its own a sector this far out has, named here
  const local = localFactions(rng, id, d);
  const band = factionBand(d);

  const count = int(rng, 8, 24);
  const clear = [...outs, ...near];
  for (let i = 0; i < count; i++) {
    const at = dart(rng, cx, cz, clear);
    if (!at) continue;
    at[1] = range(rng, -500, 500);
    clear.push({ at, r: GAP });
    const i2 = sector.systems.length;
    sector.systems.push(
      systemAt(systemSeed(seed, i2), { id, i: i2, at, d, band, local }),
    );
  }

  // the wonders, clear of every system and beacon
  const wclear = [
    ...outs,
    ...near,
    ...sector.systems.map((s) => ({ at: s.at, r: WONDER_GAP })),
  ];
  const wonders = int(rng, 0, 3);
  for (let k = 0; k < wonders; k++) {
    const at = dart(rng, cx, cz, wclear);
    if (!at) continue;
    const wSeed = hash64(seed, "wonder", k);
    const wr = rngOf(wSeed);
    at[1] = range(wr, -800, 800);
    const kind = weighted(wr, WONDERS);
    wclear.push({ at, r: WONDER_GAP });
    sector.wonders.push({
      id: `${id}:w${sector.wonders.length}`,
      kind: kind.kind,
      name: nameOf(wr, cultureOf(wr, d)),
      at,
      size: Math.round(range(wr, ...kind.size)),
      seed: wSeed,
    });
  }
  return sector;
}
