// What lives on each planet, from the fiction (docs/research/
// 2026-10-09-planet-geographies.md, “The life of each world”): which of its
// biomes are wild, settled, city, hostile or dead; what flies over it and on
// what kind of route; and who walks it, in herds, packs, patrols, bands of
// settlers or garrisons. A dead world has no rows at all, so nothing is made
// for it, no pool and no brain. Densities are per square kilometre at mid
// tier (`DENSITY` scales them); a row with `group` counts groups.
//
// A row's `model` is a ship kind (galaxy/fleet.js, universe/trafficModels.js),
// a figure (galaxy/surface/figures.js), a catalogue kind
// (galaxy/surface/catalog), or 'figure' / 'wedge': a code-built person or
// craft in the row's `tint`. `body` says how a model with no figure or ship
// of its own is built in code: 'beast', 'person', 'flyer', 'walker',
// 'speeder', 'drone', 'craft'.
//
// A row's `biome` lists the biome ids it keeps to (the note's ids and the
// flight's type ids both, as a world's ground may be either); a planet with
// none of them lets the row go anywhere living. `near: 'poi'` keeps it round
// the planet's places. `kind` on a row is the ground it needs: a row of kind
// 'hostile' is only made where a biome, or a place, is hostile.
//
// Pure: plain data and a lookup, no three.js. The Expanse's rule reads a
// planet's system from the rows it is given, as planetSpec.js is given them.
//
//   KINDS; DENSITY[tier]; LIFE[planetId] → { kinds, air: [row], ground: [row] }
//   lifeFor(spec, { expanse }) → life (a named world's row, or the Expanse's rule
//     from its system's faction, traffic and hazard; nothing for an unknown id)
//   kindAt(life, biomeId) → the kind of that biome

import { canonicalId, expanseLookup } from './expanse.js';

export const KINDS = ['wild', 'settled', 'city', 'hostile', 'dead'];
export const DENSITY = { low: 0.5, mid: 1, high: 1, ultra: 1.2 };

const NONE = { kinds: { default: 'dead' }, air: [], ground: [] };

// a hostile's fight, in hostiles.js's terms: bursts of `n`, circling at `keep`
const fights = (range, n = 3, damage = 4) => ({ range, burst: { n, gap: 0.14 }, strafe: { speed: 3, every: 2.4, keep: Math.round(range * 0.6) }, damage });

// a row drawn as a kind the site has keeps its name as its model; one built
// in code from its `body` is a 'figure', unless it names a catalogue kind
const modelOf = (name, more) => more.model ?? (more.body ? 'figure' : name);

// an air row: name, per km², altitude band (m over the ground), speed (m/s), route
const air = (name, perKm2, alt, speed, route, more = {}) => ({ name, model: modelOf(name, more), perKm2, alt, speed, route, ...more });
// a ground row: name, role, per km² (groups), group size
const gnd = (name, role, perKm2, group, more = {}) => ({ name, model: modelOf(name, more), role, perKm2, group, ...more });

// the planets' shared rows
const imperialPatrol = (perKm2, scrambleR) => air('tie', perKm2, [140, 320], 180, 'patrol', { kind: 'hostile', scramble: { r: scrambleR, n: 2 }, hostile: fights(700, 3, 6) });

export const LIFE = {
  // ── the galaxy ──
  hoth: {
    kinds: { default: 'wild', poi: 'hostile' },
    air: [
      air('snowspeeder', 0.04, [60, 140], 120, 'patrol', { model: 'snowspeeder', body: 'speeder', tint: '#d8d2c8', kind: 'hostile', near: 'poi', scramble: { r: 2400, n: 2 }, hostile: fights(600, 2, 5) }),
      air('probe', 0.03, [30, 90], 14, 'patrol', { model: 'probe', body: 'drone', tint: '#2a2a2e' }),
      air('transport', 0.01, [180, 400], 70, 'shuttle'),
    ],
    ground: [
      gnd('tauntaun', 'herd', 0.5, [6, 10], { biome: ['plains'], spread: 40 }),
      gnd('wampa', 'predator', 0.05, [1, 1], { biome: ['range', 'ridges'] }),
      gnd('rebel', 'patrol', 1.5, [3, 4], { near: 'poi', kind: 'hostile' }),
      gnd('atat', 'patrol', 0.02, [1, 2], { model: 'atat', body: 'walker', tint: '#9aa0a8', biome: ['glacier'], spread: 120 }),
      gnd('snowtrooper', 'hostile', 0.06, [4, 6], { biome: ['glacier'], hostile: fights(300) }),
    ],
  },
  tatooine: {
    kinds: { default: 'wild', jundland: 'wild', plateau: 'settled', mesas: 'settled', poi: 'settled' },
    air: [
      air('landspeeder', 0.06, [4, 12], 60, 'shuttle', { model: 'landspeeder', body: 'speeder', tint: '#c8a070' }),
      air('skiff', 0.01, [8, 20], 30, 'patrol'),
      air('shuttle', 0.015, [200, 420], 80, 'shuttle'),
      imperialPatrol(0.02, 1500),
    ],
    ground: [
      gnd('bantha', 'herd', 0.2, [4, 8], { biome: ['dunesea', 'erg'], spread: 30 }),
      gnd('tusken', 'hostile', 0.15, [3, 5], { biome: ['dunesea', 'erg', 'jundland', 'canyons'], hostile: fights(220) }),
      gnd('dewback', 'herd', 0.15, [2, 3], { kind: 'settled' }),
      gnd('sandtrooper', 'patrol', 0.2, [3, 4], { kind: 'settled' }),
      gnd('jawa', 'settler', 0.12, [4, 7], {}),
      gnd('farmer', 'settler', 0.2, [1, 3], { kind: 'settled' }),
      gnd('womprat', 'wander', 0.6, [2, 4], { model: 'womprat', body: 'beast', tint: '#7a5a42', biome: ['jundland', 'canyons', 'mesas'] }),
      gnd('krayt', 'predator', 0.01, [1, 1], { model: 'krayt', body: 'beast', tint: '#b8a888', biome: ['jundland', 'canyons'] }),
    ],
  },
  endor: {
    kinds: { default: 'wild', redwoods: 'settled', plateaus: 'hostile', range: 'hostile' },
    air: [
      air('speederbike', 0.2, [3, 8], 110, 'patrol', { model: 'speederbike', body: 'speeder', tint: '#e8e8e4', kind: 'hostile', scramble: { r: 1800, n: 2 }, hostile: fights(400, 2, 4) }),
      air('lambda', 0.01, [200, 420], 70, 'shuttle', { model: 'shuttle' }),
    ],
    ground: [
      gnd('ewok', 'settler', 0.6, [4, 8], { kind: 'settled' }),
      gnd('scouttrooper', 'hostile', 0.2, [2, 4], { kind: 'hostile', hostile: fights(260) }),
      gnd('atst', 'patrol', 0.05, [1, 1], { model: 'atst', body: 'walker', tint: '#8a8e94', kind: 'hostile', spread: 60 }),
      gnd('boar', 'herd', 0.3, [4, 7], { body: 'beast', tint: '#5a4232', biome: ['savannah', 'meadow', 'knolls'] }),
      gnd('glider', 'flock', 0.2, [3, 6], { body: 'flyer', tint: '#6a5a4a', alt: [30, 90] }),
    ],
  },
  yavin: {
    kinds: { default: 'wild', clearings: 'settled', poi: 'settled' },
    air: [
      air('xwing', 0.05, [120, 300], 160, 'patrol', { kind: 'settled' }),
      air('ywing', 0.02, [120, 300], 140, 'patrol', { kind: 'settled' }),
      air('gr75', 0.005, [300, 500], 50, 'shuttle', { model: 'transport' }),
    ],
    ground: [
      gnd('rebel', 'settler', 0.5, [3, 6], { kind: 'settled' }),
      gnd('pilot', 'settler', 0.2, [2, 3], { kind: 'settled' }),
      gnd('woolamander', 'wander', 0.4, [3, 6], { body: 'person', tint: '#8a6a9a', biome: ['jungle', 'meadow', 'plateaus'] }),
      gnd('stintaril', 'herd', 0.5, [5, 9], { body: 'beast', tint: '#6a5a3a' }),
      gnd('runyip', 'herd', 0.1, [1, 3], { body: 'beast', tint: '#7a6a5a', biome: ['rivers', 'valley'] }),
    ],
  },
  bespin: {
    // the cloud deck: no ground to walk, a city's traffic over it
    kinds: { default: 'city' },
    air: [
      air('cloudcar', 0.3, [40, 260], 90, 'patrol'),
      air('barge', 0.04, [80, 200], 30, 'lane', { model: 'hauler', lanes: 1 }),
      air('lambda', 0.02, [300, 600], 80, 'shuttle', { model: 'shuttle' }),
    ],
    ground: [],
  },
  dagobah: {
    // nothing flown, no people: only what lives in the swamp's air
    kinds: { default: 'wild' },
    air: [],
    ground: [gnd('bogwing', 'flock', 0.8, [3, 7], { model: 'bogwing', body: 'flyer', tint: '#4a5a3a', alt: [4, 30] })],
  },
  mustafar: {
    kinds: { default: 'dead', fields: 'dead', glass: 'dead', ash: 'dead', cinder: 'dead', volcanoes: 'hostile', blackrock: 'hostile', caldera: 'hostile', poi: 'hostile' },
    air: [imperialPatrol(0.06, 2000), air('mining', 0.02, [60, 160], 60, 'shuttle', { model: 'hauler', kind: 'hostile' })],
    ground: [
      gnd('lavaflea', 'wander', 0.2, [1, 3], { model: 'lavaflea', body: 'beast', tint: '#3a2a22', kind: 'hostile' }),
      gnd('stormtrooper', 'hostile', 0.15, [3, 5], { kind: 'hostile', hostile: fights(300) }),
    ],
  },
  coruscant: {
    // three lanes of traffic at three heights, and nothing wild; all over the
    // skyline, as the city's towers (planetTables.js's clutter) stand to 620 m
    // and a route's floor is the ground's, not the towers'
    kinds: { default: 'city' },
    air: [
      air('airspeeder', 40, [660, 980], 90, 'lane', { model: 'airspeeder', body: 'speeder', tint: '#c8b080', lanes: 3 }),
      air('patrol', 0.6, [700, 860], 110, 'patrol'),
      air('gunship', 0.3, [760, 1040], 120, 'lane', { lanes: 1 }),
    ],
    ground: [gnd('clone', 'patrol', 0.4, [3, 4], {})],
  },
  naboo: {
    kinds: { default: 'wild', theed: 'settled', lianorm: 'settled', poi: 'settled' },
    air: [air('n1', 0.04, [150, 320], 170, 'patrol'), air('nubian', 0.005, [300, 600], 90, 'shuttle'), air('vulture', 0.02, [120, 260], 160, 'patrol', { biome: ['plains'] })],
    ground: [
      gnd('shaak', 'herd', 0.4, [5, 9], { body: 'beast', tint: '#c8a888', biome: ['plains'] }),
      gnd('kaadu', 'herd', 0.15, [2, 4], { biome: ['lianorm'] }),
      gnd('gungan', 'patrol', 0.2, [3, 5], { biome: ['lianorm'] }),
      gnd('villager', 'settler', 0.5, [2, 5], { kind: 'settled' }),
      gnd('farmer', 'settler', 0.3, [1, 3], {}),
    ],
  },
  kashyyyk: {
    kinds: { default: 'wild', wroshyr: 'settled', shadow: 'hostile', poi: 'settled' },
    air: [air('laat', 0.02, [120, 300], 120, 'patrol', { model: 'gunship' }), air('catamaran', 0.03, [2, 6], 40, 'shuttle', { body: 'craft', tint: '#7a5a3a', biome: ['coast'] })],
    ground: [
      gnd('wookiee', 'settler', 0.5, [3, 6], { kind: 'settled' }),
      gnd('katarn', 'predator', 0.06, [1, 2], { body: 'beast', tint: '#4a3a2a' }),
      gnd('kinrath', 'predator', 0.1, [2, 4], { body: 'beast', tint: '#3a3a2a', biome: ['shadow'] }),
      gnd('trandoshan', 'hostile', 0.15, [3, 5], { body: 'person', tint: '#6a7a3a', kind: 'hostile', hostile: fights(240) }),
    ],
  },
  kamino: {
    kinds: { default: 'settled' },
    air: [air('laat', 0.03, [80, 260], 120, 'shuttle', { model: 'gunship' }), air('acclamator', 0.002, [500, 800], 40, 'lane', { lanes: 1 }), air('aiwha', 0.1, [10, 60], 30, 'patrol', { model: 'aiwha', body: 'flyer', tint: '#5a6a7a' })],
    ground: [gnd('kaminoan', 'settler', 0.05, [1, 3], { near: 'poi' }), gnd('clone', 'patrol', 0.05, [3, 4], { near: 'poi' })],
  },
  geonosis: {
    kinds: { default: 'wild', hives: 'hostile', poi: 'hostile' },
    air: [
      air('geofighter', 0.06, [100, 260], 170, 'patrol', { model: 'vulture', kind: 'hostile', scramble: { r: 3000, n: 2 }, hostile: fights(700, 3, 6) }),
      air('coreship', 0.004, [400, 900], 30, 'shuttle'),
      air('laat', 0.01, [120, 300], 120, 'shuttle', { model: 'gunship' }),
    ],
    ground: [
      gnd('geonosian', 'flock', 0.3, [4, 8], { kind: 'hostile', alt: [8, 40] }),
      gnd('massiff', 'predator', 0.15, [3, 5], { body: 'beast', tint: '#a88a5a' }),
      gnd('battledroid', 'hostile', 0.1, [6, 10], { kind: 'hostile', hostile: fights(280) }),
      gnd('acklay', 'predator', 0.01, [1, 1], { body: 'beast', tint: '#6a7a5a' }),
    ],
  },
  scarif: {
    kinds: { default: 'hostile' },
    air: [imperialPatrol(0.08, 2400), air('uwing', 0.01, [80, 200], 120, 'shuttle'), air('shuttle', 0.01, [200, 400], 80, 'shuttle')],
    ground: [
      gnd('shoretrooper', 'hostile', 0.25, [3, 5], { body: 'person', tint: '#c8c0a8', hostile: fights(300) }),
      gnd('stormtrooper', 'patrol', 0.2, [3, 4], {}),
      gnd('atact', 'patrol', 0.02, [1, 1], { body: 'walker', tint: '#8a8e94', biome: ['islands', 'coast'], spread: 80 }),
      gnd('seabird', 'flock', 0.3, [4, 9], { body: 'flyer', tint: '#e8e8e0', alt: [6, 50] }),
    ],
  },
  nevarro: {
    kinds: { default: 'wild', flats: 'settled', poi: 'settled' },
    air: [air('razorcrest', 0.002, [120, 300], 90, 'shuttle'), air('guildship', 0.01, [200, 400], 90, 'shuttle', { model: 'freighter' }), imperialPatrol(0.005, 1500)],
    ground: [
      gnd('mando', 'settler', 0.1, [1, 3], { kind: 'settled' }),
      gnd('stormtrooper', 'hostile', 0.05, [3, 4], { hostile: fights(280) }),
      gnd('reptavian', 'flock', 0.2, [3, 6], { body: 'flyer', tint: '#3a3a3a', alt: [20, 80], night: true }),
      gnd('meerkat', 'wander', 0.4, [2, 5], { body: 'beast', tint: '#5a4a3a', biome: ['fields', 'cinder'] }),
    ],
  },
  mandalore: {
    // the glass is dead; the ruins and the basin keep their alamites
    kinds: { default: 'dead', glass: 'dead', drifts: 'dead', broken: 'hostile', basin: 'hostile', range: 'dead' },
    air: [air('jetpack', 0.02, [10, 40], 30, 'patrol', { body: 'person', tint: '#9aa0a8', kind: 'hostile' })],
    ground: [
      gnd('alamite', 'hostile', 0.2, [2, 4], { body: 'beast', tint: '#6a6a72', kind: 'hostile', hostile: fights(60, 1, 6) }),
      gnd('mando', 'settler', 0.05, [2, 4], { kind: 'hostile' }),
    ],
  },
  lothal: {
    kinds: { default: 'settled', scarred: 'hostile', grass: 'wild' },
    air: [imperialPatrol(0.06, 2000), air('freighter', 0.01, [300, 600], 70, 'shuttle')],
    ground: [
      gnd('lothcat', 'wander', 1, [1, 3], { model: 'lothcat', body: 'beast', tint: '#c8a070' }),
      gnd('lothwolf', 'predator', 0.03, [3, 5], { model: 'lothwolf', body: 'beast', tint: '#e8e8f0', biome: ['hills'], night: true }),
      gnd('farmer', 'settler', 0.3, [1, 3], { kind: 'settled' }),
      gnd('stormtrooper', 'hostile', 0.15, [3, 5], { kind: 'hostile', hostile: fights(300) }),
      gnd('atdp', 'patrol', 0.03, [1, 1], { model: 'atdp', body: 'walker', tint: '#8a8e94', kind: 'hostile', spread: 60 }),
    ],
  },
  sorgan: {
    kinds: { default: 'wild', woods: 'settled', uplands: 'hostile' },
    air: [],
    ground: [
      gnd('villager', 'settler', 0.4, [3, 6], { kind: 'settled' }),
      gnd('raider', 'hostile', 0.1, [3, 5], { body: 'person', tint: '#6a4a3a', kind: 'hostile', hostile: fights(200) }),
      gnd('frog', 'wander', 0.6, [2, 5], { body: 'beast', tint: '#4a6a3a', biome: ['lakes', 'swamp'] }),
    ],
  },

  // ── the Rick and Morty sector ──
  gazorpazorp: {
    kinds: { default: 'hostile', basin: 'dead' },
    air: [air('womenship', 0.005, [200, 400], 80, 'shuttle', { model: 'saucer' })],
    ground: [gnd('gazorpian', 'hostile', 0.2, [3, 6], { body: 'person', tint: '#c87a4a', hostile: fights(80, 1, 6) }), gnd('robot', 'wander', 0.1, [1, 2], { body: 'person', tint: '#c8c8d0' })],
  },
  squanch: {
    kinds: { default: 'settled' },
    air: [air('squanchship', 0.01, [100, 300], 80, 'shuttle')],
    ground: [gnd('squancher', 'settler', 0.5, [3, 6], { body: 'person', tint: '#d87a3a' })],
  },
  birdworld: {
    kinds: { default: 'wild', stacks: 'settled', poi: 'settled' },
    air: [],
    ground: [gnd('birdperson', 'flock', 0.3, [5, 5], { body: 'flyer', tint: '#8a6a4a', alt: [30, 120] }), gnd('birdperson', 'settler', 0.2, [2, 4], { kind: 'settled' }), gnd('grazer', 'herd', 0.3, [4, 7], { body: 'beast', tint: '#9a8a5a' })],
  },
  gearworld: {
    kinds: { default: 'city' },
    air: [air('gearship', 0.1, [100, 300], 80, 'lane', { lanes: 2 })],
    ground: [gnd('gearperson', 'settler', 0.6, [2, 5], { body: 'person', tint: '#b88a3a' })],
  },
  pluto: {
    kinds: { default: 'dead', mines: 'settled', poi: 'settled' },
    air: [air('plutonian', 0.01, [80, 200], 60, 'shuttle', { model: 'saucer', kind: 'settled' })],
    ground: [gnd('plutonian', 'settler', 0.3, [2, 4], { body: 'person', tint: '#6a8ab0', kind: 'settled' })],
  },
  snakeplanet: {
    kinds: { default: 'city', plains: 'settled' },
    air: [air('snakeship', 0.08, [150, 400], 110, 'lane', { model: 'saucer', tint: '#6a9a3a', lanes: 2 })],
    ground: [gnd('snake', 'settler', 1, [3, 6], { body: 'beast', tint: '#6a9a3a' })],
  },
  nuptia: {
    kinds: { default: 'settled' },
    air: [air('shuttle', 0.01, [100, 300], 70, 'shuttle')],
    ground: [gnd('couple', 'settler', 0.4, [2, 2], { body: 'person', tint: '#c8b8d8' })],
  },
  resort: {
    kinds: { default: 'settled' },
    air: [air('shuttle', 0.02, [100, 300], 70, 'shuttle')],
    ground: [gnd('guest', 'settler', 0.6, [2, 4], { body: 'person', tint: '#e8c8a0' })],
  },
  cronenberg: {
    kinds: { default: 'hostile' },
    air: [],
    ground: [gnd('cronenberg', 'hostile', 0.5, [2, 5], { body: 'beast', tint: '#d8a0a0', hostile: fights(40, 1, 5) })],
  },
  purge: {
    kinds: { default: 'settled' },
    air: [],
    ground: [gnd('catfarmer', 'settler', 0.5, [2, 4], { body: 'person', tint: '#c89a5a' })],
  },

  // ── the universe map's fandom planets ──
  cybertron: {
    kinds: { default: 'city', rust: 'hostile', canyons: 'dead' },
    air: [air('seeker', 0.08, [150, 400], 190, 'patrol', { model: 'wedge', tint: '#7a6aa8', kind: 'hostile', scramble: { r: 2500, n: 2 }, hostile: fights(700, 3, 6) }), air('autobotshuttle', 0.02, [200, 500], 90, 'shuttle', { model: 'transport', kind: 'city' })],
    ground: [gnd('autobot', 'settler', 0.3, [2, 4], { body: 'person', tint: '#c84a3a', kind: 'city' }), gnd('decepticon', 'hostile', 0.2, [2, 4], { body: 'person', tint: '#6a5a8a', kind: 'hostile', hostile: fights(300) })],
  },
  'middle-earth': {
    kinds: { default: 'settled', misty: 'wild', marshes: 'wild', mordor: 'hostile' },
    air: [air('eagle', 0.02, [200, 500], 50, 'patrol', { body: 'flyer', tint: '#6a4a2a', biome: ['misty'] }), air('fellbeast', 0.01, [120, 300], 70, 'patrol', { body: 'flyer', tint: '#1a1a1a', kind: 'hostile', scramble: { r: 2000, n: 1 }, hostile: fights(300, 1, 8) })],
    ground: [
      gnd('hobbit', 'settler', 0.6, [2, 5], { body: 'person', tint: '#7a6a3a', biome: ['shire'] }),
      gnd('rider', 'patrol', 0.1, [8, 8], { body: 'beast', tint: '#6a5a4a', biome: ['rohan'], spread: 50 }),
      gnd('orc', 'hostile', 0.3, [4, 8], { body: 'person', tint: '#4a5a3a', kind: 'hostile', hostile: fights(200) }),
      gnd('deer', 'herd', 0.3, [3, 6], { body: 'beast', tint: '#8a6a4a' }),
    ],
  },
  caribbean: {
    kinds: { default: 'wild', poi: 'settled' },
    air: [air('gull', 0.3, [10, 60], 15, 'patrol', { body: 'flyer', tint: '#f0f0e8' })],
    ground: [gnd('pirate', 'settler', 0.3, [3, 6], { body: 'person', tint: '#6a3a2a', near: 'poi' }), gnd('turtle', 'wander', 0.2, [1, 3], { body: 'beast', tint: '#5a6a3a', biome: ['islands'] })],
  },
  albuquerque: {
    kinds: { default: 'wild', grid: 'city', bosque: 'settled' },
    air: [air('deachopper', 0.02, [100, 250], 70, 'patrol'), air('airliner', 0.01, [900, 1200], 220, 'lane', { model: 'transport', lanes: 1 })],
    ground: [gnd('coyote', 'predator', 0.1, [1, 3], { body: 'beast', tint: '#9a7a5a', biome: ['mesa'] }), gnd('roadrunner', 'wander', 0.3, [1, 2], { body: 'beast', tint: '#6a5a4a', biome: ['mesa'] }), gnd('agent', 'patrol', 0.05, [2, 3], { body: 'person', tint: '#2a3a5a' })],
  },
  scranton: {
    kinds: { default: 'wild', city: 'city', valley: 'settled' },
    air: [air('smallplane', 0.01, [300, 600], 60, 'shuttle', { model: 'wedge', tint: '#e8e8e8' }), air('geese', 0.05, [80, 200], 20, 'patrol', { body: 'flyer', tint: '#6a6a5a' })],
    ground: [gnd('deer', 'herd', 0.3, [3, 6], { body: 'beast', tint: '#8a6a4a', biome: ['ridges'] }), gnd('officeworker', 'settler', 0.3, [2, 5], { body: 'person', tint: '#5a6a8a', kind: 'city' })],
  },
  avengers: {
    kinds: { default: 'settled', woods: 'wild' },
    air: [air('quinjet', 0.01, [150, 400], 140, 'shuttle', { model: 'wedge', tint: '#3a4a5a' }), air('drone', 0.05, [20, 60], 20, 'patrol', { body: 'drone', tint: '#c8c8d0' })],
    ground: [gnd('agent', 'patrol', 0.2, [2, 4], { body: 'person', tint: '#2a2a3a', near: 'poi' }), gnd('deer', 'herd', 0.2, [3, 5], { body: 'beast', tint: '#8a6a4a', biome: ['woods'] })],
  },
  invincible: {
    kinds: { default: 'city', plains: 'settled' },
    air: [air('newscopter', 0.02, [150, 300], 50, 'patrol', { model: 'deachopper' }), air('airliner', 0.01, [900, 1200], 220, 'lane', { model: 'transport', lanes: 1 }), air('flyingfigure', 0.002, [400, 800], 200, 'patrol', { body: 'person', tint: '#f0d040' })],
    ground: [gnd('pigeon', 'flock', 0.6, [5, 9], { body: 'flyer', tint: '#7a7a82', alt: [4, 30] }), gnd('citizen', 'settler', 1, [2, 5], { body: 'person', tint: '#7a6a5a' })],
  },
  'c-137': {
    kinds: { default: 'settled', wood: 'wild', hills: 'wild' },
    air: [air('spacecruiser', 0.003, [100, 300], 90, 'shuttle', { model: 'saucer' }), air('federation', 0.002, [300, 600], 120, 'patrol')],
    ground: [gnd('neighbour', 'settler', 0.5, [1, 3], { body: 'person', tint: '#8a7a6a' }), gnd('dog', 'wander', 0.3, [1, 2], { body: 'beast', tint: '#8a6a3a' })],
  },
  earth: {
    kinds: { default: 'wild', temperate: 'settled' },
    air: [air('airliner', 0.01, [900, 1200], 220, 'lane', { model: 'transport', lanes: 1 }), air('birds', 0.1, [40, 160], 18, 'patrol', { body: 'flyer', tint: '#3a3a3a' })],
    ground: [
      gnd('cattle', 'herd', 0.3, [5, 9], { body: 'beast', tint: '#6a4a3a', biome: ['temperate'] }),
      gnd('camel', 'herd', 0.1, [3, 6], { body: 'beast', tint: '#c8a070', biome: ['desert'] }),
      gnd('goat', 'herd', 0.2, [3, 6], { body: 'beast', tint: '#e8e0d0', biome: ['mountains'] }),
      gnd('reindeer', 'herd', 0.2, [6, 10], { body: 'beast', tint: '#8a7a6a', biome: ['tundra'] }),
      gnd('villager', 'settler', 0.4, [2, 5], { kind: 'settled' }),
    ],
  },
  'dot-matrix': {
    kinds: { default: 'wild', lava: 'hostile' },
    air: [air('cloud', 0.03, [60, 160], 10, 'patrol', { body: 'drone', tint: '#ffffff' })],
    ground: [
      gnd('goomba', 'wander', 0.5, [2, 4], { body: 'beast', tint: '#8a5a2a' }),
      gnd('bobomb', 'hostile', 0.15, [2, 4], { body: 'beast', tint: '#1a1a1a', kind: 'hostile', hostile: fights(40, 1, 8) }),
      gnd('creeper', 'hostile', 0.1, [1, 3], { body: 'person', tint: '#4aa040', biome: ['terraces'], night: true, hostile: fights(30, 1, 10) }),
      gnd('sheep', 'herd', 0.3, [3, 6], { body: 'beast', tint: '#e8e8e8' }),
    ],
  },
};

// ── the Expanse: by faction, traffic and hazard (the note's last row) ──
const FAUNA = { ice: 'tauntaun', desert: 'bantha', forest: 'nerf', ocean: 'seabird' };
const PATROL = { empire: 'tie', federation: 'gunship', dea: 'deachopper' };
const TRAFFIC = { empire: ['shuttle', 'transport'], federation: ['hauler', 'saucer'], dea: ['deachopper', 'freighter'] };

export function expanseLife(type, biomes, system) {
  // gas and ringed giants have no ground, so nothing lives on them
  if (type === 'gas' || type === 'ringed' || !system) return NONE;
  const held = system.faction?.id && system.faction.id !== 'independent';
  const fauna = FAUNA[type];
  if (!held && !fauna && system.hazard !== 'pirates') return NONE;
  const ids = biomes.map((b) => b.id);
  const kinds = { default: fauna ? 'wild' : 'dead' };
  if (held) kinds[ids[0]] = 'settled';
  if (system.hazard === 'pirates') kinds[ids[ids.length - 1]] = 'hostile';
  const out = { kinds, air: [], ground: [] };
  const faction = system.faction?.id ?? 'independent';
  if (held) {
    const lanes = system.traffic > 0.5;
    for (const m of TRAFFIC[faction] ?? ['freighter', 'hauler']) out.air.push(air(m, lanes ? system.traffic * 1.5 : system.traffic * 0.05, [150, 450], 90, lanes ? 'lane' : 'shuttle', lanes ? { lanes: 2 } : {}));
    out.air.push(air(PATROL[faction] ?? 'patrol', 0.03, [150, 350], 150, 'patrol'));
    out.ground.push(gnd('colonist', 'settler', 0.4, [2, 5], { model: 'villager', kind: 'settled' }));
  }
  if (system.hazard === 'pirates') {
    out.air.push(air('gunboat', 0.04, [120, 300], 170, 'patrol', { kind: 'hostile', scramble: { r: 2500, n: 2 }, hostile: fights(700, 3, 6) }));
    out.ground.push(gnd('pirate', 'hostile', 0.1, [3, 5], { model: 'mercenary', kind: 'hostile', hostile: fights(240) }));
  }
  if (fauna === 'seabird') out.ground.push(gnd('seabird', 'flock', 0.3, [4, 8], { body: 'flyer', tint: '#e8e8e0', alt: [6, 50] }));
  else if (fauna) out.ground.push(gnd(fauna, 'herd', 0.3, [4, 8], { spread: 35, kind: 'wild' }));
  return out;
}

// the system an Expanse planet id names (its faction, traffic and hazard), or
// null: on its row, given as planetSpecOf is given it
export const systemOf = (planetId, { expanse = null } = {}) =>
  expanseLookup(expanse)(canonicalId(planetId))?.system ?? null;

export function lifeFor(spec, { expanse = null } = {}) {
  if (!spec?.id) return NONE;
  const named = LIFE[spec.id];
  const life = named ?? (canonicalId(spec.id) ? expanseLife(spec.type, spec.biomes ?? [], systemOf(spec.id, { expanse })) : NONE);
  return { kinds: life.kinds, air: life.air, ground: life.ground };
}

export const kindAt = (life, biomeId) => life.kinds[biomeId] ?? life.kinds.default ?? 'wild';

// is anything alive on this planet at all (a dead world makes no pool, no brain)
export const isDead = (life) => !life.air.length && !life.ground.length;
