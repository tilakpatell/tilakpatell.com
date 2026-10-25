// A generated place's card: what a star system, planet, moon, station or
// thing out in the endless universe is called, what it is, a line about it
// and its facts, in the glossary's words (words.js's PLACE), and the numbers
// it's parked and shown by. It reads the generator's rows and changes and
// stores nothing, so a card is made afresh each time it's asked for. Pure (no
// React, DOM or three.js). It is on the generator's side: a page that loads
// the nav takes places/ids.js, never this.
//
// THING_CARDS: { [kind]: { type, about, color, solid, far, move? } }, a row
//   for each kind of thing the generator makes (the lattice's and the legacy
//   wonders') and a default. far is how far off it's listed round the ship:
//   the far plane, since the far layer draws every kind as a disc out to
//   there. move(row, t) → [x, y, z] is for a kind that moves on the shared
//   clock (none yet). It's `move`, not `at`, because a destination's `at` is
//   where it is. A new kind gets a row here (cards.test.js fails without one).
// placeCard(found) → Card | null. found is placeIn's { kind, row, sector },
//   with the system for a planet, moon or station and the planet for a moon
//   (each found from the sector by the row's id when it isn't given).
// Card: { kind: 'star' | 'world' | 'station' | 'wonder', sub (the star's
//   class, the body's type, or the thing's kind), name, type, about, facts:
//   [[label, value]…], color, r (its size), reach (how far from its middle
//   it reaches), deep (parked further off), solid, dock, land, faction ({ id,
//   name } | null), system (its system's id, a system's own; null for a
//   thing), span (a system's reach, else null), move (the thing's card's, else
//   null) }
// placeLook(kind, row) → { kind, sub, name, r, reach, deep, solid, color, move }:
//   the card's own, from the row alone (kind is placeIn's), with no words
//   made and no system looked for, for a row round the ship (around.js)
// placeReach(kind, row) → the card's reach, from the row alone, making nothing
// thingCardOf(kind) → THING_CARDS' row for a thing's kind, or the default's

import { parseSpaceId } from '../../../lib/space/address.js';
import { THING_KINDS } from '../../expanse/shared/gen';
import { PLACE } from '../words';

const FAR = 45000; // the universe camera's far plane (scene.js)
const GIANTS = new Set(['gas', 'ringed']); // no ground to land on
const MOON_COLOR = { rocky: '#8a8178', icy: '#cfe3ee' };
const STATION_COLOR = '#9fd8ff'; // the nav map's blue

const look = (kind) => THING_KINDS.find((k) => k.kind === kind)?.look.color;
const thing = (kind, color, more = {}) => ({ type: PLACE.thing[kind], about: PLACE.about[kind], color, solid: true, far: FAR, ...more });

// (the legacy wonders' colours are expanse/scene/sectors.js's WONDER's)
export const THING_CARDS = {
  rock: thing('rock', look('rock')),
  ice: thing('ice', look('ice')),
  derelict: thing('derelict', look('derelict')),
  rogue: thing('rogue', look('rogue')),
  nebula: thing('nebula', '#b48cff', { solid: false }),
  pulsar: thing('pulsar', '#b8f4ff'),
  default: thing('default', '#b8c2d0'),
};

const NONE = { facts: [], solid: true, dock: false, land: false, faction: null, system: null, span: null, move: null };

function systemOf({ kind, row, sector, system }) {
  if (system) return system;
  if (kind === 'station') return sector?.systems?.[row.i];
  return sector?.systems?.[parseSpaceId(row.id)?.system];
}

// (a lattice thing, a sector's extra or a legacy wonder; a kind with no row
// of its own, or one named like an object's own key, takes the default's)
export const thingCardOf = (kind) => (Object.hasOwn(THING_CARDS, kind) ? THING_CARDS[kind] : THING_CARDS.default);

export function placeReach(kind, row) {
  if (kind === 'system') return row.star.size * 2;
  if (kind === 'planet') return Math.max(1.9 * row.radius, row.ringBand?.outer ?? 0);
  if (kind === 'moon') return 1.9 * row.radius;
  if (kind === 'station') return 1.5 * row.size;
  return thingCardOf(row.kind).solid ? 1.2 * row.size : 0;
}

export function placeLook(kind, row) {
  const reach = placeReach(kind, row);
  if (kind === 'system') return { kind: 'star', sub: row.star.class, name: row.name, r: row.star.size, reach, deep: true, solid: true, color: row.star.color, move: null };
  if (kind === 'planet') return { kind: 'world', sub: row.type, name: row.name, r: row.radius, reach, deep: false, solid: true, color: row.color, move: null };
  if (kind === 'moon') return { kind: 'world', sub: row.type, name: row.name, r: row.radius, reach, deep: false, solid: true, color: MOON_COLOR[row.type], move: null };
  if (kind === 'station') return { kind: 'station', sub: 'station', name: row.name, r: row.size, reach, deep: false, solid: true, color: STATION_COLOR, move: null };
  const c = thingCardOf(row.kind);
  return { kind: 'wonder', sub: row.kind, name: row.name ?? c.type, r: c.solid ? row.size : 0, reach, deep: true, solid: c.solid, color: c.color, move: c.move ?? null };
}

function systemCard(row, sector) {
  const star = PLACE.star[row.star.class];
  const station = Boolean(sector?.stations?.some((st) => st.i === row.i));
  const facts = [
    [PLACE.facts.planets, String(row.planets.length)],
    [PLACE.facts.held, row.faction.name],
    [PLACE.facts.traffic, PLACE.traffic(row.traffic)],
  ];
  if (row.hazard) facts.push([PLACE.facts.hazard, PLACE.hazard[row.hazard]]);
  return {
    ...NONE,
    ...placeLook('system', row),
    type: PLACE.system(star),
    about: PLACE.about.system({ star, planets: row.planets.length, station, held: PLACE.held(row.faction.name) }),
    facts,
    faction: row.faction,
    system: row.id,
    span: row.reach,
  };
}

function planetCard(row, sys) {
  const type = PLACE.planet[row.type];
  const moons = row.moonList?.length ?? row.moons;
  const rings = Boolean(row.rings);
  const facts = [
    [PLACE.facts.system, sys.name],
    [PLACE.facts.moons, String(moons)],
  ];
  if (rings) facts.push([PLACE.facts.rings, PLACE.yes]);
  return {
    ...NONE,
    ...placeLook('planet', row),
    type,
    about: PLACE.about.planet({ type, system: sys.name, moons, rings }),
    facts,
    land: !GIANTS.has(row.type),
    faction: sys.faction ?? null,
    system: sys.id,
  };
}

function moonCard(row, planet, sys) {
  const type = PLACE.moon[row.type];
  return {
    ...NONE,
    ...placeLook('moon', row),
    type,
    about: PLACE.about.moon({ type, planet: planet.name, system: sys.name }),
    facts: [
      [PLACE.facts.planet, planet.name],
      [PLACE.facts.system, sys.name],
    ],
    land: true,
    faction: sys.faction ?? null,
    system: sys.id,
  };
}

function stationCard(row, sys) {
  const faction = row.faction ?? sys.faction;
  return {
    ...NONE,
    ...placeLook('station', row),
    type: PLACE.station,
    about: PLACE.about.station({ system: sys.name, held: PLACE.held(faction.name) }),
    facts: [
      [PLACE.facts.system, sys.name],
      [PLACE.facts.held, faction.name],
      [PLACE.facts.traffic, PLACE.traffic(sys.traffic)],
    ],
    dock: true,
    faction,
    system: row.system ?? sys.id,
  };
}

function thingCard(kind, row) {
  const c = thingCardOf(row.kind);
  return {
    ...NONE,
    ...placeLook(kind, row),
    type: c.type,
    about: c.about,
    faction: row.faction ?? null,
  };
}

export function placeCard(found) {
  if (!found?.row) return null;
  const { kind, row } = found;
  if (kind === 'system') return systemCard(row, found.sector);
  if (kind !== 'planet' && kind !== 'moon' && kind !== 'station') return thingCard(kind, row);
  const sys = systemOf(found);
  if (!sys) return null;
  if (kind === 'planet') return planetCard(row, sys);
  if (kind === 'station') return stationCard(row, sys);
  const planet = found.planet ?? sys.planets[parseSpaceId(row.id)?.planet];
  return planet ? moonCard(row, planet, sys) : null;
}
