// The places to find out in a star system's open space (Phase 6 of the
// galaxy's expansion): three to six a system, between the moment from the
// films round the planet and the system's edge, the same for every pilot
// every time (seeded from the system's id, as the rocks are). A derelict
// hull, a comet, a knot of asteroids, a navigation beacon, a small outpost,
// a pocket of nebula: somewhere to fly to, found when you get there, and
// kept found (createFinds, in localStorage). Pure numbers, tested in Node:
// placesDraw.js draws them, world.js makes them solid and the autopilot's
// goals, the scene says when one's found.
//
// PLACES: where they sit; PLACE_KINDS: each kind's size and its names
// placesOf(sys) → [{ id, kind, name, hint, at: [x, y, z], r, reach, goal: true, place: true }]
//   r: solid to here (0: the nebula, flown through); reach: at it within this
// createFinds({ store }) → { found(sysId), has(sysId, id), mark(sysId, id) → new?, count(sysId) → { found, of }, total() }
// readFound(string) → { sysId: [ids] }, believed only in shape
//
// And the game's space levels (lane Q: scripts/bf2017-space.mjs), set
// pieces of a system that has one: SB_Endor_01's fleet over Endor, the
// Fondor dry docks, SB_Kamino_01's Republic fleet, the droid battleship's
// blockade at Naboo. SPACE_LEVELS: where each level's middle sits, set
// clear of the places (which are as they were: a system without a level
// keeps its set pieces as they are). Its hulls are backdrop, never the war's
// ships: drawn by galaxy/spacePieces.js, not models.js's slots.
// piecesFor(sysId) → Promise<[{ model, kind, at (the system's), quaternion,
//   scale, track?, url, far, size, as }]> ([] where there's no level)
// spaceGoals(sysId) → [{ id, name, hint, at, r: 0, reach, goal: true }]

import { SYSTEMS, hazardsOf } from './systems';

export const PLACES = {
  inner: 700, // from the planet: the moment round it is all within about 400
  outer: 2000, // and short of the edge (space.js's EDGE, 2,400), so there's open space past them
  height: 180, // above or below the planet's plane, at most
  apart: 420, // from each other, at least
  clear: 60, // past a hazard's reach and the place's own, at least
};

// what a place is: how big it's solid (r), how close counts as at it
// (reach), and its names (one picked by the seed)
export const PLACE_KINDS = {
  // (sizes in map units, a Star Destroyer's 1,600 m being 16: a frigate's hull is 3 or 4 long)
  wreck: { r: 3, reach: 10, hint: 'A derelict', names: ['The hulk of a Nebulon-B frigate', 'A gutted Corellian corvette', 'A derelict bulk freighter', 'A burnt-out Dreadnought, adrift and dark'] },
  comet: { r: 4, reach: 14, hint: 'A comet', names: ['A long-period comet', 'A comet, its tail streaming sunward', 'An old comet, half spent'] },
  rocks: { r: 10, reach: 26, hint: 'Asteroids', names: ['A knot of asteroids', 'A smugglers’ rock cache', 'An asteroid with a mine in it'] },
  beacon: { r: 0.8, reach: 8, hint: 'A beacon', names: ['A navigation beacon', 'A hyperspace marker buoy', 'A smugglers’ beacon'] },
  outpost: { r: 5, reach: 14, hint: 'An outpost', names: ['A refuelling outpost', 'A listening post', 'An abandoned mining platform'] },
  nebula: { r: 0, reach: 40, hint: 'A nebula', names: ['A pocket of nebula', 'A drift of glowing gas', 'The remains of a nova'] },
  // (a space level's, never drawn by placesOf: SPACE_LEVELS's)
  capital: { r: 0, reach: 30, hint: 'A fleet', names: ['A fleet at anchor'], level: true },
  dock: { r: 0, reach: 40, hint: 'A shipyard', names: ['An orbital dry dock'], level: true },
  platform: { r: 0, reach: 40, hint: 'A platform', names: ['A platform in orbit'], level: true },
  backdrop: { r: 0, reach: 60, hint: 'A battlefield', names: ['What a battle left'], level: true },
};
const KINDS = Object.keys(PLACE_KINDS).filter((k) => !PLACE_KINDS[k].level);

// a seeded random sequence (rocks.js's)
const rng = (seed) => {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const seedOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const cache = new Map();
export function placesOf(sys) {
  if (cache.has(sys.id)) return cache.get(sys.id);
  const rand = rng(seedOf(sys.id));
  const n = 3 + Math.floor(rand() * 4);
  // the kinds, shuffled by the seed, the first n of them
  const kinds = [...KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const keep = [...hazardsOf(sys), ...(sys.parent ? [{ at: sys.parent.at, r: sys.parent.r * 1.6 }] : [])];
  const out = [];
  for (const kind of kinds.slice(0, n)) {
    const k = PLACE_KINDS[kind];
    for (let tries = 0; tries < 200; tries++) {
      const a = rand() * Math.PI * 2;
      const d = PLACES.inner + rand() * (PLACES.outer - PLACES.inner);
      const at = [Math.cos(a) * d, (rand() * 2 - 1) * PLACES.height, Math.sin(a) * d];
      const roomy = out.every((o) => dist(o.at, at) >= PLACES.apart) && keep.every((h) => dist(h.at, at) > h.r + k.reach + PLACES.clear);
      if (!roomy) continue;
      const name = k.names[Math.floor(rand() * k.names.length)];
      out.push({ id: `place-${kind}`, kind, name, hint: k.hint, at: at.map((v) => Math.round(v * 10) / 10), r: k.r, reach: k.reach, goal: true, place: true });
      break;
    }
  }
  cache.set(sys.id, out);
  return out;
}

// the game's space levels: each one's middle in its system (clear of the
// system's places, its moment and its planet: places.test.js holds it), how
// far its pieces reach about it, and what it's called
export const SPACE_LEVELS = {
  endor: { at: [-1000, 60, 500], r: 65, name: 'The Imperial fleet over Endor, as Battlefront II has it' },
  fondor: { at: [1000, 0, -800], r: 47, name: 'The Fondor shipyards’ dry docks' },
  kamino: { at: [1000, 40, 600], r: 65, name: 'The Republic fleet over Kamino, as Battlefront II has it' },
  naboo: { at: [-1150, 0, -750], r: 267, name: 'The Separatist blockade, its droid control ship and the Republic come for it' },
};
// (where the files are: published, src/data/galaxyAssets.json)
export const SPACE_DIR = '/models/galaxy/space/';
const PACKS = import.meta.glob('../../data/galaxy/space/*.json', { import: 'default' });

export async function piecesFor(sysId) {
  const level = SPACE_LEVELS[sysId];
  const load = level && PACKS[`../../data/galaxy/space/${sysId}.json`];
  if (!load) return [];
  const pack = await load();
  return pack.pieces
    .filter((p) => pack.models[p.model])
    .map((p) => {
      const m = pack.models[p.model];
      return { ...p, at: p.at.map((v, k) => v + level.at[k]), url: m.url, far: m.far ?? null, size: m.size, as: m.as };
    });
}

export const spaceGoals = (sysId) => {
  const level = SPACE_LEVELS[sysId];
  return level ? [{ id: 'space-level', name: level.name, hint: 'Battlefront II', kind: 'level', at: [...level.at], r: 0, reach: Math.min(60, level.r * 0.6), goal: true }] : [];
};

// what's been found, read from the store (its JSON, or what that parsed
// to, as lib/hooks's local.get gives it): { sysId: [ids] }, or nothing
export function readFound(s) {
  let v = s;
  if (typeof s === 'string') {
    if (!s) return {};
    try {
      v = JSON.parse(s);
    } catch {
      return {};
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const [id, ids] of Object.entries(v)) if (Array.isArray(ids)) out[id] = ids.filter((x) => typeof x === 'string');
  return out;
}

export function createFinds({ store = null } = {}) {
  const read = () => {
    try {
      return store?.get() ?? null;
    } catch {
      return null;
    }
  };
  const write = (v) => {
    try {
      store?.set(JSON.stringify(v));
    } catch {
      /* no store (private mode, say): the finds live for the page */
    }
  };
  const found = readFound(read());
  const of = (sysId) => {
    const sys = SYSTEMS.find((s) => s.id === sysId);
    return sys ? placesOf(sys).length : 0;
  };
  return {
    found: (sysId) => [...(found[sysId] ?? [])],
    has: (sysId, id) => Boolean(found[sysId]?.includes(id)),
    mark(sysId, id) {
      if (found[sysId]?.includes(id)) return false;
      (found[sysId] ??= []).push(id);
      write(found);
      return true;
    },
    count: (sysId) => ({ found: (found[sysId] ?? []).length, of: of(sysId) }),
    total: () => ({ found: Object.values(found).reduce((n, ids) => n + ids.length, 0), of: SYSTEMS.reduce((n, s) => n + placesOf(s).length, 0) }),
  };
}
