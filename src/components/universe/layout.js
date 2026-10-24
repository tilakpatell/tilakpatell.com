// Where each universe sits on the map, and how to step between them. Pure:
// the 3D scene, the SVG mini-map and the world pages' links all use it.
//
// A sun sits in the middle of the disc (x, z) with the site's own pages as
// stations on a ring round it: the home system, HOME_RADIUS across. The
// fandoms are planets far out in deep space, scattered on a golden-angle
// spiral that grows with their order, a thousand and more map units apart, each at
// its own height: getting between them is a journey (ship.js's pulse
// drive), and a fight (hunters.js). deep.js keeps them clear of its wonders.
//
// The map has sectors: the main one (all of the above, round the origin)
// and the Rick and Morty sector, a region of space of its own far past the
// main map's rim (SECTORS.rickmorty.origin), with the Citadel at its middle
// (deep.js) and the show's worlds (universes.js's MOONS) on a spiral of its
// own round it, a thousand and more units apart. Everything stays on plain
// map coordinates (a sector's body is its origin plus where it sits in it),
// so flight, landings and the autopilot work the same anywhere; what's
// per-sector is the edge the ship's turned back at (ship.js) and the chart.

import { MOONS, UNIVERSES, byId } from './universes';
import { HOME_SPREAD, SPREAD } from './scale';
import { parseSectorKey, sectorAt, sectorCentre, sectorKey } from '../../lib/space/address';

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5°
// (the first two by scale.js's SPREAD; the height stays as it was at the
// spread to four, 1,120, so the highest world stays under deep space's
// ceiling, deep.js's 1,400, and the disc only gets flatter as it widens)
const FIRST = 2000 * SPREAD; // how far out the nearest fandom is
const STEP = 330 * SPREAD; // and how much further each one after it
const HEIGHT = 1120; // how far above or below the disc they go
// (and the Rick and Morty sector's worlds round its middle, the same way)
const SECTOR_FIRST = 900;
const SECTOR_STEP = 450;
const SECTOR_HEIGHT = 300;
// the home system's sizes grow together by scale.js's HOME_SPREAD (the
// stations themselves by HOME_SCALE, universes.js); the sun and the ring
// round it more: the sun bigger than any world (r 47 to 59), and the ring
// out of the brightest of its glow (1.87 of its radius), but no further
// than keeps the stations big across the gaps between them
export const RING = 140; // the stations' ring

export const ORDER = UNIVERSES.map((u) => u.id);

// The sectors: where each one's middle is, and how far out from it the ship
// is turned back. Anything further than SECTOR_SPLIT down -z is the Rick and
// Morty sector's (the main map's edge is 54,000 out, the sector's 6,000 round
// its origin, 66,000 down: the line runs halfway between the two edges). The
// sector keeps its own layout (it's a pocket universe reached by portal);
// only its origin moved out with the main map's spread, keeping the 6,000
// between the two edges.
export const SECTORS = {
  main: { id: 'main', origin: [0, 0, 0], edge: 9000 * SPREAD, name: 'Deep space' },
  rickmorty: { id: 'rickmorty', origin: [0, 0, -66000], edge: 6000, name: 'The Central Finite Curve' },
};
const SECTOR_SPLIT = (-SECTORS.main.edge + SECTORS.rickmorty.origin[2] + SECTORS.rickmorty.edge) / 2;
// Past both edges is the Expanse (expanse/gen): a grid of generated sectors,
// each 'E:sx,sz' on the middle layer, 'E:sx,sz,sy' above or below it
// (lib/space/address.js). Inside an edge it's that edge's sector, as it
// always was; the Rick and Morty sector is its own pocket, walled from the
// Expanse round it (ship.js), so only what's inside its edge (a ball) is its own.
const RM = SECTORS.rickmorty;
export const sectorOf = (x, y, z) => {
  if (z < SECTOR_SPLIT && Math.hypot(x - RM.origin[0], y - RM.origin[1], z - RM.origin[2]) <= RM.edge + 1) return 'rickmorty';
  const at = sectorAt(x, y, z);
  if (at[0] === 0 && at[1] === 0 && at[2] === 0 && Math.hypot(x, z) <= SECTORS.main.edge + 1) return 'main';
  return sectorKey(...at);
};
export const inExpanse = (id) => typeof id === 'string' && id.startsWith('E:');
// the map's own sector for a point: the Rick and Morty pocket, or the main
// map's everywhere else (the Expanse is charted, sided and crewed as the
// main map is: what goes by sector inside the edges reads this)
export const mapSectorOf = (x, y, z) => (sectorOf(x, y, z) === 'rickmorty' ? 'rickmorty' : 'main');
// a sector by id: one of SECTORS, or an Expanse sector (no edge: it goes on);
// null for anything else, an 'E:' key nothing parses among them (ids come
// in off the network too, so junk is no sector rather than the origin's)
export const sectorById = (id) => SECTORS[id] ?? (inExpanse(id) ? expanseSector(id) : null);
function expanseSector(id) {
  const at = parseSectorKey(id);
  return at && { id, origin: sectorCentre(...at), edge: Infinity, name: id, expanse: true };
}
// a point given in a sector's own frame, in the map's
export const inSector = (sector, [x, y, z]) => {
  const o = SECTORS[sector].origin;
  return [o[0] + x, o[1] + y, o[2] + z];
};
// how far (x, z) is out from its sector's middle, level, and that sector
export function sectorOut(x, z) {
  // (sectorOf's keys are all known; only a position that isn't a number
  // keys none, and that reads as the main map's rather than throwing)
  const sec = sectorById(sectorOf(x, 0, z)) ?? SECTORS.main;
  return { sec, out: Math.hypot(x - sec.origin[0], z - sec.origin[2]) };
}

// the sun in the middle: something to fly round, not somewhere to go
export const SUN = { at: [0, 0, 0], r: 75 };

// the asteroid belt, round the outside of the stations
export const BELT = { inner: 130 * HOME_SPREAD, outer: 185 * HOME_SPREAD, height: 16 * HOME_SPREAD };
// the home system: the sun, the stations and the belt (what the overview shows)
export const HOME_RADIUS = 230 * HOME_SPREAD;
// the rim: a wide, thin ring of ice rocks right round the outside of the
// map, out past every world and wonder and short of the edge (belt.js draws
// it as a second belt; nothing's solid out there)
export const RIM = { inner: 8000 * SPREAD, outer: 8600 * SPREAD, height: 60 };

// how far a universe's moons, rings and orbiting things reach from its centre
export const REACH = Object.fromEntries([...UNIVERSES, ...MOONS].map((u) => [u.id, u.size * (u.reach ?? (u.kind === 'core' ? 2.0 : 1.9))]));

const core = UNIVERSES.filter((u) => u.kind === 'core');
const fandoms = UNIVERSES.filter((u) => u.kind !== 'core');
export const POSITIONS = Object.fromEntries([
  ...core.map((u, i) => {
    const a = (i / core.length) * Math.PI * 2 + Math.PI / 2; // Home nearest the camera
    return [u.id, [RING * Math.cos(a), 3 * Math.sin(i * 2.1), RING * Math.sin(a)]];
  }),
  ...fandoms.map((u, i) => {
    const r = FIRST + STEP * i;
    const a = i * GOLDEN + 0.32;
    return [u.id, [r * Math.cos(a), HEIGHT * Math.sin(i * 2.4 + 1), r * Math.sin(a)]];
  }),
  // the Rick and Morty sector's worlds, on its own spiral round the Citadel
  ...MOONS.map((m, i) => {
    const r = SECTOR_FIRST + SECTOR_STEP * i;
    const a = i * GOLDEN + 0.9;
    return [m.id, inSector(m.sector, [r * Math.cos(a), SECTOR_HEIGHT * Math.sin(i * 2.4 + 1), r * Math.sin(a)])];
  }),
]);
// everything the ship can set down on or dock at: the map's order, then the moons
export const BODIES = [...ORDER, ...MOONS.map((m) => m.id)];

// which sector each body is in
export const SECTOR_OF = Object.fromEntries(BODIES.map((id) => [id, byId(id).sector ?? 'main']));

// how far out the furthest fandom reaches (the main sector's)
export const MAP_RADIUS = Math.max(...ORDER.map((id) => Math.hypot(POSITIONS[id][0], POSITIONS[id][2]) + REACH[id]));
// and each sector's, round its own middle (the chart's scale in it)
export const SECTOR_RADIUS = Object.fromEntries(
  Object.values(SECTORS).map((sec) => [sec.id, sec.id === 'main' ? MAP_RADIUS : Math.max(...BODIES.filter((id) => SECTOR_OF[id] === sec.id).map((id) => Math.hypot(POSITIONS[id][0] - sec.origin[0], POSITIONS[id][2] - sec.origin[2]) + REACH[id]))]),
);

const step = (id, by) => {
  const i = ORDER.indexOf(id);
  if (i < 0) return by > 0 ? ORDER[0] : ORDER[ORDER.length - 1];
  return ORDER[(i + by + ORDER.length) % ORDER.length];
};
export const next = (id) => step(id, 1);
export const prev = (id) => step(id, -1);

// A route param to a universe id, or null (the overview) for anything else.
export const parseId = (param) => (typeof param === 'string' && byId(param) ? param : null);

// The next universe after `id` that has a world page of its own (after a
// moon of the Rick and Morty sector, the one after its crew's).
export function nextWorld(id) {
  let at = byId(id)?.crew ?? id;
  for (let n = 0; n < ORDER.length; n++) {
    at = next(at);
    if (byId(at).world) return byId(at);
  }
  return byId(ORDER[0]);
}

// A key in the map's focus group → the universe it moves to, or undefined
// when the key isn't one of ours (so it's left alone).
export function keyStep(key, id) {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return prev(id);
    case 'ArrowRight':
    case 'ArrowDown':
      return next(id);
    case 'Home':
      return ORDER[0];
    case 'End':
      return ORDER[ORDER.length - 1];
    default:
      return undefined;
  }
}
