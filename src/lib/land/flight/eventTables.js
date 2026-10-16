// What happens on each world, now and then, while you fly over it: its
// weather, its traffic's turns, its fiction's moments (docs/research/
// 2026-10-09-planet-geographies.md, “The life of each world”, the events
// column). A dead world has the weather and the dust and nothing else.
//
// EVENTS is the kinds, each with how it plays (the scene's verb: weather,
// dusk, flight, band, eruption, surge, quake, shower, portal, tentacles,
// rise, launch, fireworks), how long it lasts (`ttl`, s, always under four
// minutes) and how long before the same kind may come again (`cooldown`, never
// shorter than its ttl). A world's row names a kind, the one sentence the HUD
// says when it starts, and what of the kind it changes (the ships' model, how
// many, a tint). `night` keeps a row to the planet's night, `biome` to ground
// with one of those biomes round you, `at: 'sundown'` makes it the planet
// clock's, not a roll's (the Purge).
//
// Pure: plain data and a lookup, no three.js.
//
//   EVENTS[kind] → { play, ttl, cooldown, weight, …the play's defaults }
//   EVENT_KINDS; WEATHER (the plays a dead world keeps)
//   WORLD_EVENTS[planetId] → [{ kind, line, …overrides }]
//   eventsFor(spec, life?, { expanse }) → [{ kind, line, play, ttl, cooldown, weight, … }]

import { isDead, lifeFor, systemOf } from './lifeTables.js';

const weather = (fall, vis, tint, ttl, more = {}) => ({ play: 'weather', fall, vis, tint, ttl, ...more });

export const EVENTS = {
  // the weather: what falls, how far you see in it, the fog's colour
  storm: weather('rain', 700, '#4a5260', 120, { flash: true }),
  rain: weather('rain', 1400, '#6a7480', 120),
  blizzard: weather('snow', 400, '#dfe6ee', 90),
  sandstorm: weather('sand', 500, '#c8a070', 60),
  dust: weather('sand', 1100, '#a89070', 60),
  fog: weather('motes', 300, '#b8c0c0', 120),
  ashfall: weather('ash', 650, '#3a302c', 90),
  glassstorm: weather('spray', 450, '#c8d8dc', 60, { color: '#e8f4ff' }),
  ruststorm: weather('sand', 300, '#8a4a2a', 90, { color: '#c06a3a' }),
  // the light
  night: { play: 'dusk', depth: 0.7, ttl: 120 },
  sunset: { play: 'dusk', depth: 0.35, warm: true, ttl: 90 },
  // ships: crossing (a convoy, a flyover), or coming for you (`hostile`)
  raid: { play: 'flight', n: 4, hostile: true, ttl: 90 },
  scramble: { play: 'flight', n: 3, hostile: true, ttl: 60 },
  hunt: { play: 'flight', n: 1, hostile: true, ttl: 120 },
  patrol: { play: 'flight', n: 3, ttl: 60 },
  convoy: { play: 'flight', n: 5, speed: 70, ttl: 120 },
  pursuit: { play: 'flight', n: 2, speed: 170, ttl: 90 },
  flyover: { play: 'flight', n: 1, big: true, alt: 1800, speed: 90, ttl: 75 },
  race: { play: 'flight', n: 3, low: true, speed: 180, ttl: 120 },
  // people and beasts on the ground: crossing, or closing on you (`converge`)
  migration: { play: 'band', n: 12, speed: 6, ttl: 90 },
  assault: { play: 'band', n: 4, speed: 4, hostile: true, ttl: 120 },
  ambush: { play: 'band', n: 6, speed: 9, hostile: true, converge: true, ttl: 90 },
  rampage: { play: 'band', n: 10, speed: 8, hostile: true, converge: true, ttl: 90 },
  purge: { play: 'band', n: 12, speed: 7, hostile: true, converge: true, dusk: 0.55, at: 'sundown', ttl: 180 },
  // the ground itself, and the sky
  eruption: { play: 'eruption', ttl: 60, fall: 'ash', vis: 2200, tint: '#3a2a24' },
  surge: { play: 'surge', rise: 4, ttl: 40 },
  quake: { play: 'quake', ttl: 30 },
  shower: { play: 'shower', ttl: 45 },
  portal: { play: 'portal', ttl: 60 },
  kraken: { play: 'tentacles', ttl: 60 },
  rise: { play: 'rise', ttl: 40 },
  launch: { play: 'launch', ttl: 60 },
  festival: { play: 'fireworks', ttl: 90 },
};
for (const e of Object.values(EVENTS)) {
  e.cooldown ??= e.ttl * 2;
  e.weight ??= 1;
}
export const EVENT_KINDS = Object.keys(EVENTS);
export const WEATHER = new Set(['weather']);

// a row: its kind, its sentence, what it changes
const e = (kind, line, more = {}) => ({ kind, line, ...more });

export const WORLD_EVENTS = {
  // ── the galaxy ──
  hoth: [
    e('blizzard', 'A blizzard closes in: you can see 400 metres.', { weight: 3 }),
    e('assault', 'Imperial walkers from the north: the trench opens fire.', { model: 'atat', body: 'walker', tint: '#9aa0a8', n: 3 }),
    e('hunt', 'A probe droid has found you.', { model: 'probe', body: 'drone', tint: '#2a2a2e' }),
  ],
  tatooine: [
    e('sandstorm', 'A sandstorm blows in off the Dune Sea.', { weight: 3 }),
    e('ambush', 'Tusken Raiders at the canyon mouth.', { model: 'tusken', n: 5 }),
    e('patrol', 'An Imperial checkpoint over the road.', { model: 'tie' }),
    e('race', 'Podracers tearing past: stay out of their line.', { body: 'speeder', tint: '#c87a3a' }),
  ],
  endor: [
    e('pursuit', 'Speeder bikes, low and fast, through the trunks.', { body: 'speeder', tint: '#4a5040', low: true }),
    e('assault', 'An AT-ST patrol on the forest floor.', { model: 'atst', body: 'walker', tint: '#8a9098', n: 2 }),
    e('night', 'Drums from the village: dusk on the moon.', { night: true }),
  ],
  yavin: [
    e('scramble', 'Sirens at the temple: a flight scrambles.', { model: 'xwing', hostile: false, n: 3 }),
    e('rain', 'Rain on the jungle canopy.', { weight: 2 }),
    e('rise', 'Something big is loose in the jungle.', { tint: '#6a5a4a', size: 14 }),
  ],
  bespin: [
    e('storm', 'A storm cell: lightning over the deck.', { weight: 2 }),
    e('raid', 'The Empire arrives: TIEs sweep the deck.', { model: 'tie' }),
    e('convoy', 'A tibanna barge convoy passes.', { model: 'hauler', n: 4 }),
  ],
  dagobah: [
    e('fog', 'The mist thickens: 150 metres and closing.', { vis: 150, weight: 3 }),
    e('rise', 'A dragonsnake breaks the surface of the mere.', { tint: '#3a4a3a', size: 10, water: true }),
    e('night', 'Night on the swamp, and eyes glowing in it.'),
  ],
  mustafar: [
    e('eruption', 'An eruption: the sky goes dark with ash.', { biome: ['volcanoes'], weight: 3 }),
    e('surge', 'A lava surge: the channels rise.', { weight: 2 }),
    e('scramble', 'The fortress launches its fighters at you.', { model: 'tie' }),
  ],
  coruscant: [
    e('convoy', 'Rush hour: the lanes fill.', { model: 'shuttle', n: 8, speed: 90, weight: 2 }),
    e('pursuit', 'A police pursuit cuts across your lane.', { body: 'speeder', tint: '#3a4a8a' }),
    e('flyover', 'A Venator passes overhead.', { model: 'acclamator', alt: 2400 }),
  ],
  naboo: [
    e('assault', 'A Trade Federation landing: tanks cross the plain.', { body: 'speeder', tint: '#8a7a5a', n: 5, biome: ['plains'] }),
    e('storm', 'A storm over the lakes.', { weight: 2 }),
    e('festival', 'A festival at Theed: fireworks after dark.', { night: true }),
  ],
  kashyyyk: [
    e('raid', 'Trandoshan slavers raid a tree village.', { model: 'skiff', n: 3 }),
    e('storm', 'A storm comes in off the sea.', { weight: 2 }),
    e('migration', 'Wookiees on the move along the coast.', { model: 'wookiee', n: 8, biome: ['coast'] }),
  ],
  kamino: [
    e('storm', 'The storm front: heavy rain for a while.', { vis: 500, weight: 3 }),
    e('flyover', 'A Republic fleet arrives over Tipoca.', { model: 'acclamator' }),
    e('migration', 'A Kaminoan patrol rides by on aiwha.', { body: 'flyer', tint: '#d8e0e8', n: 6, lift: 20 }),
  ],
  geonosis: [
    e('shower', 'An asteroid shower out of the rings.', { weight: 2 }),
    e('rampage', 'The arena’s beasts are loose.', { body: 'beast', tint: '#6a4a3a', n: 4 }),
    e('assault', 'A Republic assault: gunships land at the arena.', { body: 'walker', tint: '#c8c8c0', n: 3 }),
    e('sandstorm', 'Red dust rises off the plains.', { tint: '#b46c44' }),
  ],
  scarif: [
    e('patrol', 'The shield gate’s alarm: patrols double.', { model: 'tie', n: 4 }),
    e('raid', 'A Rebel raid: U-wings put down on a beach.', { model: 'uwing', hostile: false, n: 3 }),
    e('rain', 'Squalls over the islands.'),
  ],
  nevarro: [
    e('hunt', 'A bounty’s posted: a hunter is out for you.', { model: 'razorcrest' }),
    e('surge', 'A lava river rises.'),
    e('patrol', 'A remnant patrol in the sky.', { model: 'tie', n: 2 }),
    e('ashfall', 'Ash drifts down from the vents.'),
  ],
  mandalore: [
    e('glassstorm', 'A glass storm: shards in the wind.', { weight: 3 }),
    e('rise', 'The Living Waters tremble, and something vast surfaces.', { tint: '#6a6458', size: 60, water: true, weight: 0.2 }),
    e('patrol', 'Mandalorians on jetpacks, keeping their distance.', { body: 'person', tint: '#8a9098', n: 3, alt: 120 }),
  ],
  lothal: [
    e('ambush', 'A wolf pack at dusk.', { body: 'beast', tint: '#d8d8e0', n: 5, night: true }),
    e('raid', 'An Imperial sweep: TIEs over the plains.', { model: 'tie' }),
    e('ashfall', 'Smoke from a grass fire by the factory.', { tint: '#5a4a3a' }),
  ],
  sorgan: [
    e('assault', 'Raiders bring a walker on the village.', { model: 'atst', body: 'walker', tint: '#7a7a72', n: 1 }),
    e('fog', 'Fog off the lakes.', { weight: 2 }),
    e('night', 'Night falls on the krill ponds.'),
  ],
  // ── the Rick and Morty sector ──
  gazorpazorp: [e('rampage', 'A rampage: the bands are converging.', { body: 'person', tint: '#7a8a5a', n: 10 }), e('dust', 'A dust storm.', { weight: 2 })],
  squanch: [e('festival', 'A wedding: fireworks over the venue.'), e('raid', 'A Federation raid: gunships land.', { model: 'gunship' })],
  birdworld: [e('migration', 'A great flock crosses the sky.', { body: 'flyer', tint: '#c8a060', n: 30, lift: 120, speed: 20 }), e('storm', 'A storm over the nests.')],
  gearworld: [e('convoy', 'A gear jam: the roads stop dead.', { model: 'gearship', speed: 10 }), e('festival', 'A gear parade.')],
  pluto: [e('quake', 'A quake: the ground drops under you.', { weight: 2 }), e('eruption', 'A mining blast throws rock.', { fall: 'sand', tint: '#7a7a8a' })],
  snakeplanet: [e('launch', 'A launch: a rocket climbs out of the city.'), e('raid', 'A skirmish between two snake cities.', { model: 'saucer', hostile: false })],
  nuptia: [e('rampage', 'A session breaks out: figures from someone’s mind are loose.', { body: 'person', tint: '#b080c0', n: 6 })],
  resort: [e('sunset', 'Sunset over the resort.', { weight: 2 }), e('quake', 'The death crystal flickers.', { ttl: 20 })],
  cronenberg: [e('rampage', 'A surge of the changed: they’re converging.', { body: 'beast', tint: '#c88a7a', n: 12, speed: 4 }), e('rain', 'Rain.')],
  purge: [e('purge', 'Sundown: the Purge begins.', { model: 'villager', tint: '#c84a3a' }), e('fog', 'Fog off the coast.')],
  // ── the universe map's fandom planets ──
  cybertron: [
    e('raid', 'Seekers raid Iacon.', { model: 'interceptor' }),
    e('ruststorm', 'A rust storm: you can see 300 metres.', { weight: 2 }),
    e('portal', 'A space bridge opens: a ring of light.', { tint: '#80c8ff' }),
  ],
  'middle-earth': [
    e('hunt', 'A Nazgûl on a fell beast has found you.', { body: 'flyer', tint: '#1a1a1a', size: 4 }),
    e('migration', 'The Rohirrim charge across the plain.', { body: 'beast', tint: '#6a5a4a', n: 8, speed: 14, biome: ['rohan'] }),
    e('eruption', 'Mount Doom erupts: ash falls.', { biome: ['mordor'] }),
  ],
  caribbean: [
    e('kraken', 'The kraken rises round a ship.'),
    e('convoy', 'Two galleons trade broadsides.', { body: 'craft', tint: '#6a4a2a', n: 2, low: true, speed: 12 }),
    e('storm', 'A storm at sea.', { weight: 2 }),
  ],
  albuquerque: [
    e('pursuit', 'A police chase on the highway.', { model: 'suv', low: true }),
    e('dust', 'A dust devil crosses the mesa.'),
    e('storm', 'A monsoon storm.'),
  ],
  scranton: [e('sunset', 'The leaves turn: autumn deepens.', { warm: true }), e('blizzard', 'A snowstorm.', { vis: 700 }), e('festival', 'Lights at the park: it’s the Dundies.', { night: true })],
  avengers: [e('launch', 'A quinjet launches from the compound.'), e('patrol', 'A drone drill.', { body: 'drone', tint: '#9aa0a8', n: 6, alt: 60 }), e('storm', 'A storm over the river.')],
  invincible: [e('flyover', 'A fight far off: two figures, and debris falling.', { body: 'person', tint: '#f0d040', n: 2, alt: 700, speed: 220 }), e('storm', 'A thunderstorm.')],
  'c-137': [e('portal', 'A portal opens and something comes through.', { tint: '#6ad04a' }), e('rise', 'A giant head in the sky has something to say.', { tint: '#c8a080', size: 300, sky: true, ttl: 20 }), e('rain', 'Rain.')],
  earth: [
    e('rain', 'Rain.', { biome: ['temperate', 'coast'] }),
    e('blizzard', 'Snow.', { biome: ['tundra', 'mountains'], vis: 800 }),
    e('sandstorm', 'A sandstorm.', { biome: ['desert'] }),
    e('migration', 'A flock on its way south.', { body: 'flyer', tint: '#3a3a3a', n: 20, lift: 150, speed: 18 }),
    e('sunset', 'Sunset.'),
  ],
  'dot-matrix': [e('night', 'Night: things come out of the dark.'), e('pursuit', 'A bullet crosses the sky.', { body: 'craft', tint: '#1a1a1a', n: 1, speed: 120 }), e('portal', 'A star appears over the castle.', { tint: '#ffe040' })],
};

// ── the Expanse, and a dead world's weather ──
const TYPE_WEATHER = { ice: 'blizzard', desert: 'sandstorm', forest: 'rain', ocean: 'storm', lava: 'ashfall', rock: 'dust', gas: 'storm', temperate: 'rain', city: 'fog', swamp: 'fog', metal: 'ruststorm', stylised: 'rain' };
const LINES = {
  blizzard: 'A blizzard closes in.',
  sandstorm: 'A sandstorm.',
  rain: 'Rain.',
  storm: 'A storm, and lightning in it.',
  ashfall: 'Ash falls.',
  dust: 'The dust rises.',
  fog: 'Fog.',
  ruststorm: 'A rust storm.',
};
const weatherOf = (type) => {
  const kind = TYPE_WEATHER[type] ?? 'dust';
  return [e(kind, LINES[kind], { weight: 2 }), ...(kind === 'dust' ? [] : [e('dust', LINES.dust)])];
};

function expanseEvents(spec, system) {
  const out = weatherOf(spec.type);
  if (system?.hazard === 'pirates') out.push(e('ambush', 'Pirates: an ambush from the ground.', { model: 'mercenary', n: 5 }), e('raid', 'Pirate gunboats come for you.', { model: 'gunboat', n: 2 }));
  if ((system?.traffic ?? 0) > 0.3) out.push(e('convoy', 'A convoy passes.', { model: 'freighter' }));
  return out;
}

// (the Expanse given as lifeTables' lifeFor is given it)
export function eventsFor(spec, life = null, { expanse = null } = {}) {
  if (!spec?.id) return [];
  life ??= lifeFor(spec, { expanse });
  // (a dead world: its weather, and the dust)
  const rows = isDead(life) ? weatherOf(spec.type) : (WORLD_EVENTS[spec.id] ?? expanseEvents(spec, systemOf(spec.id, { expanse })));
  return rows.map((row) => ({ ...EVENTS[row.kind], ...row }));
}
