// The catalogue of things in space: the spec's 23 entries (section B), in its
// order, and the 32 kinds they are drawn as. For each kind it says the look,
// what's solid and where it may go, once, so the generator, the near and far
// layers and the cards read the same row. Pure (no three.js), so it runs in
// Node and in the worker.
//
// CATALOGUE: [{ n, name, kinds: string[] }], 23 rows; name is for tests and docs, never shown
// KINDS: { [kind]: { kind, n, body, disc, lit, tint: [paletteName, k], color: '#rrggbb', near, core } }
//   body: what's solid as one sphere, a share of the row's size, or null for no one sphere
//   disc: the far layer's disc, a share of size, or 0 for none
//   lit: whether the sun lights it (false for a lamp, a glow or a cloud of light)
//   near: false for the kinds others draw (systems, stations, nebulae, pockets, remnants, gargantuans)
//   core: whether it may sit in the core sector
// lookOf(kind) → { color, lit, disc }; an unknown kind reads as a rock: its colour, lit, disc 1
// solidOf(row, at = row.at) → { id, at, r, reach } | null: r = body × size, reach = 1.2 × r;
//   null where body is null, and for a kind the catalogue doesn't know (no wall nobody drew)
// rowSolids(row, at = row.at) → [{ id, at, r, reach }]: everything solid a row adds to the
//   solids, [solidOf(row, at)] or [] where that's null. Read this, never solidOf alone: a
//   fleet is solid ship by ship, not as one sphere, and its ships come in here.
// discRadius(kind, size, { core = false } = {}) → the far layer's disc radius, size × disc,
//   but a beacon's in the core sector is its own size: the core is lighter and holds the
//   hand-made places, and some 75 beacons lie within the far plane of a core pose
// hexOf([r, g, b]) → '#rrggbb', from linear light (the inverse of palette.js's linearOf)
// PLANET_SIZE: the weighted mean of PLANET_TYPES' radius midpoints, what "a planet's size" means
//
// Colours. Every kind is tinted from the palette's nine names, tint(name, k), so a frame
// holds one art. Lane 2's four lattice kinds (rock, ice, derelict, rogue) keep the colours
// they were drawn in before this catalogue: a lane doesn't recolour another's on the way
// past. Their tint is the palette's nearest, kept for the record; their color is lane 2's.
//
// What's solid. The lattice kinds are solid at their size; a comet's nucleus at its size,
// a pulsar or magnetar at a quarter, a forming star's core at 0.12, a rig at 0.6 and a
// shipyard at half. A station's solid is lane 3's, a gargantuan's parts their own.
// Passable on purpose:
// - a storm: you fly in, and its drain is the point
// - a herd and a swarm: they are animals, and the site's leviathans aren't solid either.
//   They swim, so a solid at a frame or two a second would shove the ship through itself,
//   and their drawn count is cut by the tier, so a solid creature would be an invisible
//   wall on a phone
// - battle debris: hull plates and girders a few units across, drawn for salvage
// - a field: its rocks join the rock fields' registry when it's near, so the hull and the
//   bolts meet them as they meet the belt's
// - a pocket and a remnant: clouds
// - a wormhole: its throat is the way through

import { PALETTE, tint } from '../../universe/shared/space';
import { PLANET_TYPES } from './tables';

export const CATALOGUE = Object.freeze(
  [
    [1, 'star systems', ['system']],
    [2, 'rogue planets', ['rogue']],
    [3, 'comets', ['comet']],
    [4, 'asteroid and ice fields', ['field', 'icefield', 'rock', 'ice']],
    [5, 'nebula pockets', ['pocket', 'nebula']],
    [6, 'pulsars and magnetars', ['pulsar', 'magnetar']],
    [7, 'supernova remnants', ['remnant']],
    [8, 'forming stars', ['protostar']],
    [9, 'ion storms', ['storm']],
    [10, 'wormholes', ['wormhole']],
    [11, 'stations', ['station']],
    [12, 'outposts', ['outpost']],
    [13, 'derelicts', ['derelict']],
    [14, 'debris fields', ['debris']],
    [15, 'fleets at anchor', ['fleet']],
    [16, 'mining rigs', ['rig']],
    [17, 'beacons', ['beacon']],
    [18, 'relay arrays', ['relay']],
    [19, 'monoliths', ['monolith']],
    [20, 'shipyards', ['shipyard']],
    [21, 'herds', ['herd']],
    [22, 'swarms', ['swarm']],
    [23, 'gargantuans', ['hole', 'arc', 'hulk', 'giant', 'dyson']],
  ].map(([n, name, kinds]) => Object.freeze({ n, name, kinds: Object.freeze(kinds) })),
);

const LANE2 = { rock: '#8a8178', ice: '#cfe3ee', derelict: '#6d727c', rogue: '#4a3f38' };
const LATTICE = ['rock', 'ice', 'derelict', 'rogue', 'outpost', 'beacon', 'relay', 'monolith'];
const OTHERS_DRAW = ['system', 'station', 'nebula', 'pocket', 'remnant', 'hole', 'arc', 'hulk', 'giant', 'dyson'];
const UNLIT = ['beacon', 'comet', 'pulsar', 'magnetar', 'protostar', 'storm', 'wormhole', 'swarm'];
const CORE = [...LATTICE, 'field', 'icefield', 'comet', 'rig', 'system', 'station', 'nebula'];

// kind: [tint, body, disc]
const ROWS = {
  system: [['star', 0], null, 0],
  rogue: [['sky', 0.05], 1, 1],
  comet: [['star', 0], 1, 4],
  field: [['grey', 0.25], null, 0],
  icefield: [['engine', 0.6], null, 0],
  rock: [['grey', 0.15], 1, 1],
  ice: [['engine', 0.45], 1, 1],
  pocket: [['nebula', 0.15], null, 0],
  nebula: [['star', 0], null, 0],
  pulsar: [['engine', 0.5], 0.25, 0.5],
  magnetar: [['nebula', 0.5], 0.25, 0.5],
  remnant: [['engine', 0.2], null, 0],
  protostar: [['sun', 0.2], 0.12, 0.6],
  storm: [['engine', 0], null, 0],
  wormhole: [['nebula', 0.3], null, 0.6],
  station: [['star', 0], null, 0],
  outpost: [['bone', 0], 1, 1],
  derelict: [['grey', 0.1], 1, 1],
  debris: [['grey', 0.1], null, 0],
  fleet: [['bone', 0.2], null, 0.4],
  rig: [['sun', 0], 0.6, 1],
  beacon: [['shot', 0], 1, 3],
  relay: [['ink', 0.3], 1, 1],
  monolith: [['sky', 0.05], 1, 1],
  shipyard: [['bone', 0.3], 0.5, 0.8],
  herd: [['nebula', 0.4], null, 0],
  swarm: [['engine', 0.3], null, 0],
  hole: [['sun', 0], null, 0],
  arc: [['bone', 0], null, 0],
  hulk: [['grey', 0], null, 0],
  giant: [['sun', 0.3], null, 0],
  dyson: [['star', 0], null, 0],
};

const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const byte = (c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255);

export function hexOf(linear) {
  return `#${linear.map((c) => byte(c).toString(16).padStart(2, '0')).join('')}`;
}

const N = Object.fromEntries(CATALOGUE.flatMap((c) => c.kinds.map((k) => [k, c.n])));

export const KINDS = Object.freeze(
  Object.fromEntries(
    Object.entries(ROWS).map(([kind, [t, body, disc]]) => {
      if (!PALETTE[t[0]]) throw new Error(`${kind}'s tint ${t[0]} isn't one of the palette's names`);
      return [
        kind,
        Object.freeze({
          kind,
          n: N[kind],
          body,
          disc,
          lit: !UNLIT.includes(kind),
          tint: Object.freeze(t),
          color: LANE2[kind] ?? hexOf(tint(...t)),
          near: !OTHERS_DRAW.includes(kind),
          core: CORE.includes(kind),
        }),
      ];
    }),
  ),
);

const LOOKS = Object.fromEntries(
  Object.values(KINDS).map((k) => [k.kind, Object.freeze({ color: k.color, lit: k.lit, disc: k.disc })]),
);

export function lookOf(kind) {
  return Object.hasOwn(LOOKS, kind) ? LOOKS[kind] : LOOKS.rock;
}

export function solidOf(row, at = row.at) {
  const body = Object.hasOwn(KINDS, row.kind) ? KINDS[row.kind].body : null;
  if (body == null) return null;
  const r = body * row.size;
  return { id: row.id, at, r, reach: 1.2 * r };
}

export function rowSolids(row, at = row.at) {
  const s = solidOf(row, at);
  return s ? [s] : [];
}

export function discRadius(kind, size, { core = false } = {}) {
  if (kind === 'beacon' && core) return size;
  return size * lookOf(kind).disc;
}

const PLANET_WEIGHT = PLANET_TYPES.reduce((s, p) => s + p.weight, 0);
export const PLANET_SIZE =
  PLANET_TYPES.reduce((s, p) => s + (p.weight * (p.radius[0] + p.radius[1])) / 2, 0) / PLANET_WEIGHT;
