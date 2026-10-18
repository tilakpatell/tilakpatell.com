// The flight's landmarks as data: which walkable site's places stand on each
// POI (planetTables.js's, from docs/research/2026-10-09-planet-geographies.md),
// what stands on the ones no site has (catalog kinds and kit models), and the
// kit models each planet's clutter is drawn as.
//
// Why here and not in the walkable sites: a site's places are a few hundred
// metres apart round a landing spot; the flight's POIs are kilometres apart
// on a planet. Each POI takes the things of the places named for it, each
// kept where it stands relative to its place's middle.
//
// A POI planetTables.js already builds (a world's `landmarks`: Mos Eisley,
// Cloud City, the Senate, drawn by the flight module from the film-made
// models) isn't listed here: one set of buildings a place.
//
// Pure: plain data and a few helpers, no three.js.
//
//   SITE_PLACES[planetId][poiId] → { site, places: [placeId…] | '*', centre?,
//     extra? } (centre: [x, z] in the site, for '*': the whole site round
//     that point; extra: rows as LANDMARKS', for a place the site keeps bare)
//   LANDMARKS[planetId][poiId] → [{ kind | kit: { kit, name }, at: [x, z]
//     (relative to the POI), yaw, scale, opts? }]
//   CLUTTER_KIT[type], CLUTTER_KIT_OF[planetId] → { [kind]: { kit, name, size } }
//     (size: the model's scale for a row of scale 1, so it stands as tall
//     as the code-built shape it replaces)
//   clutterKitOf(spec) → that planet's, its own over its type's, then its
//     flora's tree and its exotic's
//   POI_KITS[kind], FLORA_TRUNKS, EXOTIC_KIT, landmarkRowsOf(spec, poi): a
//     generated planet's places, trees and exotic clutter

export const LANDMARK_NEAR = 6000; // m: a landmark is drawn within this of its POI
export const LANDMARK_FREE = 1.3; // …and freed past this many times it
export const LANDMARK_PREFETCH = 2; // …and its files fetched from this many times it
export const LANDMARK_CAP = 4; // the nearest this many at once
export const LANDMARK_MIN = 3; // a POI stands with at least this many things…
export const LANDMARK_MAX = 80; // …and at most this many, the nearest its middle
export const DROP_Y = 3; // m: a site's thing standing this far off the flight's ground goes

// (Jabba's palace in the site is its gate and walls: the skiff and its crates are the flight's)
const JABBA_YARD = [
  { kind: 'skiff', at: [70, 40], yaw: 0.8, scale: 1 },
  { kind: 'crates', at: [60, -50], yaw: 0.2, scale: 1 },
  { kind: 'barrel', at: [66, -40], yaw: 0, scale: 1 },
];

export const SITE_PLACES = {
  hoth: {
    'echo-base': { site: 'hoth', places: ['echobase', 'shieldgen'] },
    trench: { site: 'hoth', places: ['trenches'] },
    'ion-cannon': { site: 'hoth', places: ['ioncannon'] },
  },
  tatooine: {
    lars: { site: 'tatooine', places: ['homestead'] },
    jabba: { site: 'tatooine', places: ['palace'], extra: JABBA_YARD },
  },
  endor: { bunker: { site: 'endor', places: ['bunker'] } },
  yavin: {
    'great-temple': { site: 'yavin', places: ['temple', 'hangar'] },
    'landing-field': { site: 'yavin', places: ['field'] },
    ruin: { site: 'yavin', places: ['ruin'] },
  },
  mustafar: {
    mining: { site: 'mustafar', places: ['facility'] },
    fortress: { site: 'mustafar', places: ['fortress'] },
  },
  naboo: {
    // (not the falls: they pour off a cliff the flight's Theed plateau hasn't got)
    theed: { site: 'naboo', places: ['palace', 'hangar'] },
    varykino: { site: 'naboo', places: ['varykino'], extra: [{ kind: 'statue', at: [24, 10], yaw: 2, scale: 1 }, { kind: 'lamp', at: [-20, 14], yaw: 0, scale: 1 }] },
    gungan: { site: 'naboo', places: ['sacred'] },
    battle: { site: 'naboo', places: ['battle', 'droids'] },
  },
  kashyyyk: {
    kachirho: { site: 'kashyyyk', places: ['kachirho', 'command', 'village'] },
    beach: { site: 'kashyyyk', places: ['beach', 'lagoon'] },
  },
  geonosis: {
    arena: { site: 'geonosis', places: ['arena', 'battle'] },
    foundry: { site: 'geonosis', places: ['foundry', 'hangar'], extra: [{ kind: 'battledroid', at: [30, 20], yaw: 3, scale: 1 }, { kind: 'crates', at: [-26, 18], yaw: 0.5, scale: 1 }] },
    hive: { site: 'geonosis', places: ['hive'], extra: [{ kind: 'geohive', at: [40, -30], yaw: 1, scale: 1 }] },
  },
  scarif: {
    citadel: { site: 'scarif', places: ['citadel'] },
    pads: { site: 'scarif', places: ['pad9', 'uwing'] },
    outpost: { site: 'scarif', places: ['beach'] },
  },
  nevarro: { 'lava-flats': { site: 'nevarro', places: ['lava'] } },
  mandalore: { camp: { site: 'mandalore', places: ['covert'] } },
  lothal: {
    factory: { site: 'lothal', places: ['factory'], extra: [{ kind: 'impcrate', at: [40, 24], yaw: 0.3, scale: 1 }, { kind: 'lamp', at: [-36, 20], yaw: 0, scale: 1 }] },
    tower: { site: 'lothal', places: ['tower'] },
  },
  sorgan: {
    village: { site: 'sorgan', places: ['village'] },
    raiders: { site: 'sorgan', places: ['raiders'] },
    clearing: { site: 'sorgan', places: ['woods'] },
  },
};

// ── the POIs no site has: a few shapes of place, from the catalog and the kits ──

const k = (name, pack = 'space') => ({ kit: pack, name });
const one = (thing, at = [0, 0], yaw = 0, scale = 1) => ({ ...(typeof thing === 'string' ? { kind: thing } : { kit: thing }), at, yaw, scale });
// `n` of a thing round the middle at `r` metres, each turned to face it, from `phase`
const ring = (thing, n, r, scale = 1, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return one(thing, [Math.round(Math.sin(a) * r), Math.round(Math.cos(a) * r)], a + Math.PI, scale);
  });

const TREE = k('CommonTree_2', 'naturemega');
const PINE = k('Pine_3', 'naturemega');
const BUSH = k('Bush_Common', 'naturemega');
const HOUSE = k('House_Single');
const LONG = k('House_Long');
const DOME = k('GeodesicDome');
const TOWER = k('Building_L');
const BASE = k('Base_Large');
const STRUT = k('MetalSupport');

// a town of houses round a square, its trees beyond
const town = (house, n, r, tree = TREE, scale = 3) => [one('lamp'), ...ring(house, n, r, scale, 0.3), ...ring(tree, n, r * 1.6, 1.4)];
// a camp: tents round a fire
const camp = (tents = 3) => [one('fire'), ...ring('tent', tents, 12), one('crates', [16, 4], 0.4), one('barrel', [-14, 8])];
// a base: a block in the middle, domes and panels round it
const base = (r = 40) => [one(TOWER, [0, 0], 0, 4), ...ring(DOME, 3, r, 2.5, 0.5), ...ring(k('SolarPanel_Ground'), 4, r * 1.5, 3), ...ring('lamp', 4, r * 0.7)];
// a pad: the platform, ships and lamps on it
const pad = (deck, ships = []) => [one(deck), ...ships.map((s, i) => one(s, [i % 2 ? 14 : -14, 6], 1.2)), ...ring('lamp', 2, 18)];

export const LANDMARKS = {
  bespin: { 'gas-platform': [...pad('bespinplatform', ['cloudcar']), one('crates', [-10, 8], 0.4)] },
  mustafar: { arm: [one('lavacollector', [0, 0], 0.6), one('droidplatform', [22, 8], -0.3), one(STRUT, [-18, 10], 0, 3), one(STRUT, [-18, -10], 0, 3), one('barrel', [10, -16]), one('lamp', [-6, 20])] },
  coruscant: { platform: pad('cplatform', ['airspeeder', 'airspeeder']) },
  kamino: { platform: [...pad('kpad'), one('cratecube', [12, 6], 0.3), one('barrel', [-10, 9])] },
  kashyyyk: { clearing: [one('wookieehouse'), one('fire', [14, 6]), one('log', [18, -4], 0.6), one('log', [-12, 12], 2), one('crates', [-10, -12], 0.3)] },
  nevarro: { covert: [...camp(3), one('barricade', [24, -6], 1.3), one('barricade', [-22, -10], 1.9)] },
  lothal: {
    temple: [one('lothtemple'), one('stonehead', [30, 10], 2.4), one('ruins', [-28, 16], 0.7)],
    depot: [one('commandpost'), ...ring('impcrate', 8, 60, 1, 0.2), ...ring('empirecrate', 6, 100, 1), ...ring('lamp', 6, 140)],
  },
  gazorpazorp: { gate: [one(BASE, [0, 0], 0, 4), ...ring(STRUT, 6, 40, 4), ...ring('lamp', 4, 60)], arena: [one('arena'), ...ring('lamp', 6, 90)] },
  squanch: { venue: [one(TOWER, [0, 0], 0, 5), ...ring(k('House_Cylinder'), 5, 60, 3), ...ring('lamp', 6, 35), one('stall', [20, -20])] },
  birdworld: { nest: [...ring(k('GiantPine_4', 'naturemega'), 7, 45, 2), ...ring('log', 6, 18, 2), one('fire')] },
  gearworld: { monument: [one('statue', [0, 0], 0, 3), ...ring(STRUT, 8, 50, 5), ...ring(k('Roof_Antenna'), 4, 80, 4)] },
  pluto: { hq: [one(DOME, [0, 0], 0, 6), ...ring(k('SolarPanel_Ground'), 6, 60, 3), ...ring(k('Rover_1'), 2, 40, 2)] },
  snakeplanet: { capital: town(k('House_Cylinder'), 8, 90, k('Plant_1_Big', 'naturemega'), 4) },
  nuptia: { centre: [one(BASE, [0, 0], 0, 6), ...ring(DOME, 4, 80, 4), ...ring('lamp', 8, 50)] },
  resort: { resort: [...ring(LONG, 6, 90, 4), ...ring('palm', 10, 140), one('stall', [0, 30]), ...ring('lamp', 4, 40)] },
  cronenberg: { street: [...ring(HOUSE, 6, 60, 3), ...ring(k('DeadTree_3', 'naturemega'), 5, 95, 1.4), one('barricade', [0, 0])] },
  purge: {
    village: [...town(HOUSE, 7, 70), one('barricade', [20, 10], 0.4), one('fire', [-10, -16])],
    lighthouse: [one('lothtower'), one('lamp', [14, 6]), one('crates', [-12, 10], 0.4)],
  },
  cybertron: {
    iacon: [one(TOWER, [0, 0], 0, 8), ...ring(TOWER, 6, 180, 5, 0.4), ...ring(k('Roof_Antenna'), 6, 110, 6)],
    hydrax: [one(BASE, [0, 0], 0, 8), ...ring(k('House_Cylinder'), 6, 140, 5), ...ring(STRUT, 6, 90, 6)],
    kaon: [one('fortress', [0, 0], 0, 2), ...ring(STRUT, 8, 150, 6), ...ring('smoke', 3, 80)],
  },
  'middle-earth': {
    hobbiton: [...ring('tathouse', 7, 70, 1, 0.2), ...ring(TREE, 8, 120, 1.6), ...ring(k('Flower_3_Group', 'naturemega'), 6, 45, 2), one(k('CommonTree_5', 'naturemega'), [0, 0], 0, 2.4)],
    bree: town('nevarrohouse', 8, 55, PINE, 1),
    weathertop: [one('ruins'), one('stonehead', [14, -8], 1), one('fire', [-6, 4])],
    rivendell: [one('theed', [0, 0], 0, 1), ...ring('theed', 4, 70, 1, 0.5), ...ring(k('Pine_4', 'naturemega'), 8, 110, 1.6), one('waterfall', [0, -100])],
    moria: [one('ruins'), one('statue', [-24, -10], 0, 2), one('statue', [24, -10], 0, 2), one('stonehead', [0, 20], Math.PI)],
    'amon-hen': [one('ruins'), one('statue', [-14, 0], 0, 2), one('statue', [14, 0], 0, 2)],
    'barad-dur': [one('fortress', [0, 0], 0, 2), ...ring('lavarock', 6, 70, 2), ...ring('smoke', 3, 40)],
  },
  caribbean: {
    tortuga: [...ring('stilthut', 8, 70, 1, 0.3), ...ring('palm', 8, 120), one('barrel', [10, 0]), one('crates', [-10, 6], 0.4), one('fire', [0, -12])],
    'port-royal': [...ring('nevarrohouse', 8, 70, 1), one('barrel', [0, 0]), ...ring('lamp', 4, 40), one('keelboat', [0, 110], 1.6)],
    'isla-de-muerta': [one('ruins'), ...ring('palm', 5, 40), one('crates', [8, 6], 0.7), one('barrel', [-6, 8])],
  },
  albuquerque: {
    'car-wash': [one(LONG, [0, 0], 0, 4), one('speedertruck', [20, 18], 0.3), one('landspeeder', [-18, 20], 2.6), one('lamp', [26, -10])],
    'cook-site': [one(k('Rover_1'), [0, 0], 0.8, 2), one('barrel', [10, -6]), one('tent', [-14, 8], 0.4), one(k('Rock_Large_1'), [20, 22], 0, 2)],
    lab: [one(TOWER, [0, 0], 0, 4), one(BASE, [30, 10], 0, 3), one('speedertruck', [-20, 16], 1.2), one('lamp', [14, -20])],
  },
  scranton: {
    office: [one(LONG, [0, 0], 0, 5), ...ring('speedertruck', 4, 40, 1, 0.6), ...ring(TREE, 6, 80, 1.4), ...ring('lamp', 4, 26)],
    schrute: [one(HOUSE, [0, 0], 0, 4), one('stall', [30, 10], 1.2), ...ring(k('Pine_5', 'naturemega'), 10, 70, 1.6), one('tent', [-30, -10])],
  },
  avengers: {
    compound: [one(TOWER, [0, 0], 0, 6), ...ring(LONG, 3, 120, 5, 0.5), ...ring(BASE, 2, 180, 4, 1), ...ring('lamp', 8, 70)],
    helipad: pad('pad', ['lambda']),
  },
  invincible: {
    hq: base(60),
    graysons: [one(HOUSE, [0, 0], 0, 4), ...ring(TREE, 5, 40, 1.2), ...ring(BUSH, 4, 22, 1.4)],
  },
  'c-137': {
    smiths: [one(HOUSE, [0, 0], 0, 4), one('speedertruck', [18, 10], 1.6), ...ring(TREE, 5, 40, 1.2), ...ring(BUSH, 4, 22, 1.4)],
    school: [one(LONG, [0, 0], 0, 6), ...ring(TREE, 6, 70, 1.4), ...ring('lamp', 4, 40)],
    blips: [one(k('House_Cylinder'), [0, 0], 0, 5), ...ring('lamp', 6, 40), ...ring('speedertruck', 3, 60, 1, 0.4)],
  },
  'dot-matrix': {
    castle: [one('theedpalace'), one('statue', [-30, 60], 0, 2), one('statue', [30, 60], 0, 2), ...ring(PINE, 10, 150, 2)],
    'bob-omb': [...ring(k('Rock_Large_2'), 6, 30, 3), ...ring(PINE, 6, 50, 1.6)],
  },
};

// ── a generated planet's places, trees and exotic clutter, from its variety ──
// (a POI's `kind` picks its list)
export const POI_KITS = {
  ruins: [one('ruins'), one('stonehead', [30, 10], 2.4), one('ruins', [-40, 22], 0.7), one('stonehead', [-12, -34], 0.9, 0.7)],
  wreck: [{ ...one(k('Spaceship_RaeTheRedPanda'), [0, 0], 0.6, 4), pitch: 0.35, roll: -0.5 }, one('crates', [18, 6], 0.4), one('barrel', [-14, 10]), one('fire', [8, -14])],
  outpost: base(36),
  monolith: [one(k('MetalSupport'), [0, 0], 0, 9), ...ring(k('Rock_Large_1'), 5, 26, 1.2)],
  signal: [one(k('Roof_Radar'), [0, 0], 0, 5), one(k('Roof_Antenna'), [12, 4], 0.5, 5), one(k('SolarPanel_Ground'), [-14, 6], 0.4, 3), ...ring('lamp', 3, 20)],
};

// the green trees the tables already use, one for each quarter of a flora's `pick`
export const FLORA_TRUNKS = [
  { ...k('GiantPine_2', 'naturemega'), size: 4.6 },
  { ...k('GiantPine_4', 'naturemega'), size: 4.8 },
  { ...k('GiantPine_5', 'naturemega'), size: 5 },
  { ...k('CommonTree_3', 'naturemega'), size: 5 },
];

// an exotic world's clutter (not green, on purpose; crystal is code-built)
export const EXOTIC_KIT = {
  glowing: { trunk: { ...k('Tree_Light_1'), size: 3 } },
  floating: { trunk: { ...k('Tree_Floating_1'), size: 3 } },
  spires: { spire: { ...k('Tree_Spikes_2'), size: 1.4 } },
  crystal: {},
};

export const landmarkRowsOf = (spec, poi) => LANDMARKS[spec?.id]?.[poi?.id] ?? POI_KITS[poi?.kind];

// Each kind's kit model where the planet type has one; a kind left out
// keeps its code-built shape (Hoth's ice spires, the snowspeeder debris, a
// city's towers). Sizes put a row of scale 1 at about the code shape's size
// (ground.js: a rock 7 m across, a spire 26 m tall, a trunk and its crown
// 79 m); a temperate world's trees a little under, as they're its parks' and
// gardens', not a wroshyr forest's.
export const CLUTTER_KIT = {
  ice: { rock: { ...k('Rock_Large_2'), size: 1.4 } },
  rock: { rock: { ...k('Rock_Large_1'), size: 1.5 } },
  lava: { rock: { ...k('Rock_Large_3'), size: 1.5 } },
  desert: { rock: { ...k('Rock_Big_1', 'naturemega'), size: 1 } },
  ocean: { rock: { ...k('Rock_Big_2', 'naturemega'), size: 1 } },
  forest: { rock: { ...k('Rock_Big_2', 'naturemega'), size: 1 }, trunk: { ...k('GiantPine_2', 'naturemega'), size: 4.6 } },
  temperate: { rock: { ...k('Rock_Big_1', 'naturemega'), size: 1 }, trunk: { ...k('CommonTree_3', 'naturemega'), size: 5 } },
};

// a world's own trees where its fiction has them (green ones only: the kit's
// tall thick trees are blue, its birches autumn, its twisted trees red; the
// test holds every tree here to green leaves)
export const CLUTTER_KIT_OF = {
  yavin: { trunk: { ...k('GiantPine_4', 'naturemega'), size: 4.8 } },
  kashyyyk: { trunk: { ...k('GiantPine_5', 'naturemega'), size: 5 } },
  dagobah: { spire: { ...k('DeadTree_5', 'naturemega'), size: 1.6 } },
};

export function clutterKitOf(spec) {
  const fam = spec?.flora?.family;
  const tree = fam === 'forest' || fam === 'temperate' ? { trunk: FLORA_TRUNKS[Math.min(3, Math.floor((spec.flora.pick ?? 0) * 4))] } : {};
  return { ...(CLUTTER_KIT[spec?.type] ?? {}), ...(CLUTTER_KIT_OF[spec?.id] ?? {}), ...tree, ...(EXOTIC_KIT[spec?.exotic] ?? {}) };
}
