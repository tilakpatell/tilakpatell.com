// The flight's fifty planets, each from its fiction
// (docs/research/2026-10-09-planet-geographies.md, which gives every row and
// its sources): the galaxy's 17 worlds, the Rick and Morty sector's 10, the
// universe map's 10 fandom planets, and the stacks the Expanse's generated
// planets take by type. Plain data and a few helpers, no three.js.
//
// A world: { id, name, type, seed?, biomes, pois, pits?, palette, clutter,
//   step?, soft?, ground (lib/three/groundLook.js's: a scan under a palette),
//   water? ({ kind: 'sea' | 'lake' | 'swamp' | 'lava', level }) }. A biome: { id, at: [t, m] (on the climate square), reach,
//   base, relief: lib/land/layers.js's layers (and field.js's `fnl`),
//   scatter? (islands or craters placed from the planet's seed: expand) }.
// Where the note gives no `at` (the sector's and the fandom planets'), the
// first biome sits in the middle and the rest round it (ringed). Where a
// galaxy world has a walkable site (galaxy/surface/sites), its first biome's
// relief begins with that site's own ground layers, copied here as they are
// there (the test holds them to it), so the ground round the landing site is
// the same ground; the note's other layers for that biome follow them.
//
//   WORLDS → worlds, in the roster's order (galaxy, sector, fandom)
//   TYPE_BIOMES[type] → an Expanse planet's biomes; TYPE_LOOK[type] → { palette, clutter, soft }
//   ROUND_ROUGH[family][biomeId] → its hills' multiplier on a round planet
//   roundBiomes(family) → [{ id, at, reach, base, rough, relief: [] }] (throws for gas and ringed)
//   expand(biomes, seed) → biomes with each scatter made island layers

import { seeded } from '../../seeded.js';

// ── the layers, short ──
const swell = (scale, height) => ({ type: 'swell', scale, height });
const hills = (scale, height, more = {}) => ({ type: 'hills', scale, height, ...more });
// the cartoon worlds' hills: rounder (gain 0.4, three octaves)
const soft = (scale, height) => hills(scale, height, { gain: 0.4, octaves: 3 });
const dunes = (scale, height, wind = 0) => ({ type: 'dunes', scale, height, wind });
const mesas = (scale, height, cover, cliff = 0.05) => ({ type: 'mesas', scale, height, cover, cliff });
const ridges = (scale, height, more = {}) => ({ type: 'ridges', scale, height, ...more });
// (the note writes mountains as height/scale, as the sites do)
const mountains = (height, scale, from = 0, to) => ({ type: 'mountains', height, scale, from, ...(to === undefined ? {} : { to }) });
const channels = (scale, depth, width = 0.06) => ({ type: 'channels', scale, depth, width });
const island = (at, r, height, core = 0.25, ragged = 0.35) => ({ type: 'island', at, r, height, core, ragged });
const level = (height = 0) => ({ type: 'level', height });
const blocks = (cell, gap, hMin, hMax, cover) => ({ type: 'blocks', cell, gap, hMin, hMax, cover });
// the stylised worlds' warped, folded plateaus (fnl.js's ping-pong)
const toon = (height, scale = 800) => ({ type: 'fnl', noise: { type: 'simplex', fractal: 'pingpong', frequency: 1 / scale, octaves: 3, warp: 600 }, height });
// islands or craters, seeded per planet (expand)
const scatter = (count, height, r = [150, 500], more = {}) => ({ count, height, r, spread: 14000, ...more });

// a place's buildings, the galaxy's film-made models (public/models/galaxy/surface/, at the
// sizes galaxy/surface/catalog gives them unless a part says): `count` of a part scattered
// round the place, or one in its middle (`centre`); `hq` its high-detail file, for a strong machine;
// `tint` the colour the walkable site gives it (catalog's), which the air sees in place of its scan;
// `lift` metres it floats over the place's ground (Cloud City over Bespin's deck)
const M = '/models/galaxy/surface/';
const part = (file, metres, count = 1, more = {}) => ({ url: `${M}${file}.glb`, metres, along: 'x', count, ...more });
const landmark = (id, at, parts) => ({ id, at, parts });

const biome = (id, at, base, relief, more = {}) => ({ id, at, reach: 0.3, base, relief, ...more });
// a biome placed by `ringed`
const b = (id, base, relief, more = {}) => ({ id, at: null, reach: 0.3, base, relief, ...more });
const poi = (id, name, at, r, edge, h) => ({ id, name, at, r, edge, ...(h === undefined ? {} : { h }) });

// the first biome in the middle of the climate square, the others round it
export function ringed(biomes) {
  const n = biomes.length - 1;
  return biomes.map((x, i) => {
    if (x.at) return x;
    if (i === 0) return { ...x, at: [0.5, 0.5] };
    const a = (i / n) * Math.PI * 2;
    return { ...x, at: [0.5 + Math.cos(a) * 0.32, 0.5 + Math.sin(a) * 0.32], reach: 0.28 };
  });
}

// clutter, short: [kind, perKm2, more]
const clutter = (...rows) => rows.map(([kind, perKm2, more = {}]) => ({ kind, perKm2, ...more }));
const fine = { depth: 5 }; // a kind placed on the 512 m leaves, so it's seen from further

// ── the galaxy's walkable sites' ground layers (galaxy/surface/sites), as they are there ──
export const SITE_LAYERS = {
  tatooine: [swell(420, 8), dunes(64, 9, 0.5), mesas(560, 46, 0.32, 0.045), mountains(520, 1300, 700, 3000)],
  hoth: [swell(520, 6), hills(300, 14), dunes(36, 1.1, 0.6), island([-330, 440], 300, 80, 0.35), island([-470, -350], 170, 34, 0.3), mountains(700, 1500, 680, 3200)],
  endor: [swell(420, 22), hills(130, 14), ridges(300, 8), mountains(320, 1300, 900, 3200)],
  kashyyyk: [island([-40, -560], 820, 26, 0.42, 0.25), swell(300, 3), hills(110, 6), mountains(420, 900, 1100, 3400)],
  dagobah: [swell(90, 2.2), hills(38, 1.8)],
  yavin: [swell(380, 8), hills(140, 10), channels(700, 12, 0.05), mountains(300, 1100, 1000, 3400)],
  naboo: [swell(520, 6), hills(240, 14), island([-150, 50], 450, 30, 0.9, 0.1), island([100, -560], 300, -38, 0.5, 0.25), mountains(460, 1200, 800, 3200)],
  kamino: [level(-40), island([0, 0], 14, 45, 0.85, 0)],
  geonosis: [swell(420, 7), hills(160, 6), mesas(480, 34, 0.3, 0.05), ridges(120, 4), mountains(380, 1000, 750, 3000)],
  coruscant: [level(-330)],
  mustafar: [swell(320, 7), ridges(150, 10), channels(360, 11, 0.08), ridges(38, 2.2), mountains(420, 1100, 650, 2600), island([300, 380], 60, 7), island([-390, 80], 75, 32, 0.78, 0.12)],
  scarif: [island([0, 0], 480, 9, 0.45, 0.35), island([90, 460], 230, 9, 0.5, 0.25), island([-420, 180], 190, 8, 0.4), island([380, -330], 190, 8, 0.4), swell(160, 1.4), dunes(26, 0.6, 0.6)],
  bespin: [],
  nevarro: [swell(380, 10), hills(120, 10), mountains(440, 620, 560, 1150), island([148.8, -65.4], 120, 10, 0.75, 0.18), island([-300, 205], 200, 26, 0.72, 0.15), island([283.8, -217.8], 130, 28, 0.2, 0.2), island([660, -380], 460, 300, 0.1, 0.22), island([660, -380], 70, -50, 0.35, 0.2), island([325, 245], 150, -7.5, 0.5, 0.4)],
  mandalore: [swell(420, 6), mesas(500, 30, 0.25, 0.05), mountains(400, 1200, 650, 3000)],
  lothal: [swell(460, 8), hills(160, 10), mountains(360, 1300, 700, 3000)],
  sorgan: [swell(300, 6), hills(110, 9), mountains(300, 1100, 650, 3000)],
};
const site = (id) => SITE_LAYERS[id];

// ── the galaxy's walkable sites' ground looks (galaxy/surface/sites: their ground but its layers, flats, pits, seed and base) and water, as they are there ──
export const SITE_GROUND = {
  tatooine: { detail: 'sand', detailLook: { color: 0.7, normal: 0.8, metres: 6 }, wind: 0.5, palette: { low: '#d2b083', high: '#ebd4a6', rock: '#a46a4e', accent: '#c69a6c', deep: '#b38e66', hLow: -4, hHigh: 12, rockAt: 0.36, accentCover: 0.22, ripple: { strength: 0.09, scale: 3.2, wind: 0.5 }, grain: 0.6, mark: '#b98a5a' } },
  hoth: { detail: 'snow', detailLook: { color: 0.5, normal: 0.6 }, wind: 0.6, palette: { low: '#dfe7f1', high: '#f4f8fc', rock: '#7e8fa6', accent: '#cbdaeb', deep: '#c6d6e8', hLow: -4, hHigh: 26, rockAt: 0.48, accentCover: 0.22, ripple: { strength: 0.07, scale: 2.2, wind: 0.6 }, grain: 0.45, sparkle: 0.7, mark: '#a8bcd4' } },
  endor: { detail: 'needles', detailLook: { color: 0.8, normal: 0.7 }, wind: 0.3, palette: { low: '#5e4630', high: '#4a5030', rock: '#5a5040', accent: '#4a5a2c', deep: '#2a1f14', hLow: -8, hHigh: 12, rockAt: 0.48, accentCover: 0.62, grain: 0.9, patch: 0.8 } },
  kashyyyk: { detail: 'leaves', detailLook: { color: 0.7, normal: 0.7 }, wind: -0.6, palette: { low: '#c5c4bb', high: '#3b4232', rock: '#8a8676', accent: '#5a5440', deep: '#2a3028', hLow: 1.2, hHigh: 4, rockAt: 0.5, accentCover: 0.35, grain: 0.7, wet: { level: 0, band: 1, color: '#7a6a48' } } },
  dagobah: { detail: 'mud', detailLook: { color: 0.8, normal: 0.8 }, wind: 0.2, palette: { low: '#3c3629', high: '#4a4535', rock: '#4a4436', accent: '#4c5232', deep: '#26221a', hLow: 0, hHigh: 1.8, rockAt: 0.55, accentCover: 0.4, grain: 0.9, wet: { level: 0, band: 0.5, color: '#22241a' } } },
  yavin: { detail: 'leaves', detailLook: { color: 0.8, normal: 0.7 }, wind: 0.8, palette: { low: '#4a3a26', high: '#3a4228', rock: '#6a6450', accent: '#6e5644', deep: '#2b220e', hLow: -2, hHigh: 12, rockAt: 0.5, accentCover: 0.3, grain: 0.85, wet: { level: -3, band: 1.2, color: '#3a3a26' } } },
  naboo: { detail: 'grass', detailLook: { color: 0.7, normal: 0.6 }, wind: 0.3, palette: { low: '#5f7034', high: '#7f9440', rock: '#8a8270', accent: '#8f9a48', deep: '#4a5a2e', hLow: -8, hHigh: 18, rockAt: 0.3, accentCover: 0.3, ripple: { strength: 0.03, scale: 1.6, wind: 0.3 }, grain: 0.7, wet: { level: -1.6, band: 2.5, color: '#6a6248' } } },
  kamino: { palette: { low: '#2a343c', high: '#2a343c', rock: '#22282e', hLow: -50, hHigh: -30, grain: 0.2 } },
  geonosis: { detail: 'redsoil', detailLook: { color: 0.75, normal: 0.8 }, wind: 1.1, palette: { low: '#b46c44', high: '#c98b5c', rock: '#8a4a2e', accent: '#d49c66', deep: '#9c5a36', hLow: -2, hHigh: 18, rockAt: 0.34, accentCover: 0.24, ripple: { strength: 0.06, scale: 2.6, wind: 1.1 }, grain: 0.7, mark: '#8a4a2e' } },
  coruscant: { palette: { low: '#4a3a3e', high: '#4a3a3e', rock: '#3a2e30', hLow: -340, hHigh: -320, grain: 0.2 } },
  mustafar: { detail: 'ash', detailLook: { color: 0.8, normal: 0.8 }, wind: 0.8, palette: { low: '#3a322e', high: '#564a43', rock: '#191515', accent: '#5a3424', deep: '#221c1a', hLow: -6, hHigh: 14, rockAt: 0.34, accentCover: 0.18, grain: 0.8, roughness: 0.9, wet: { level: 2.5, band: 3, color: '#8a2208' }, mark: '#120e0d' } },
  scarif: { detail: 'beach', detailLook: { color: 0.7, normal: 0.7, metres: 6 }, wind: 0.6, palette: { low: '#ece6d0', high: '#c4c39c', rock: '#8e8a78', accent: '#7f8f5a', deep: '#dccb9e', hLow: 1.1, hHigh: 4, rockAt: 0.4, accentCover: 0.38, ripple: { strength: 0.05, scale: 2.6, wind: 0.6 }, grain: 0.45, sparkle: 0.04, wet: { level: -0.92, band: 1.3, color: '#b8a682' }, mark: '#c8b896' } },
  bespin: { palette: { low: '#e8d8c8', high: '#f0e2d2', rock: '#c8b8a8' } },
  nevarro: { detail: 'ash', detailLook: { color: 0.7, normal: 0.8 }, palette: { low: '#26282e', high: '#3a3b40', rock: '#1b1f21', accent: '#6e6b62', deep: '#1b1f21', hLow: -3, hHigh: 34, rockAt: 0.36, accentCover: 0.3, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, roughness: 0.9, wet: { level: -3, band: 2.2, color: '#7a1e06' }, mark: '#18191c' } },
  mandalore: { detail: 'gravel', detailLook: { color: 0.6, normal: 0.7 }, wind: 0.8, palette: { low: '#b9ab8e', high: '#d0c6b2', rock: '#3a4344', accent: '#5f6a66', deep: '#4a4f4c', hLow: -4, hHigh: 14, rockAt: 0.4, accentCover: 0.25, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, mark: '#7a7466' } },
  lothal: { detail: 'grass', detailLook: { color: 0.7, normal: 0.6 }, palette: { low: '#a48a58', high: '#bba775', rock: '#7a7268', accent: '#b39a7e', deep: '#7a7268', hLow: -4, hHigh: 14, rockAt: 0.4, accentCover: 0.18, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, mark: '#6e5a3a' } },
  sorgan: { detail: 'needles', detailLook: { color: 0.8, normal: 0.7 }, palette: { low: '#4f4c2e', high: '#5e6034', rock: '#5a5a50', accent: '#6a5e3a', deep: '#5a5a50', hLow: -4, hHigh: 14, rockAt: 0.4, accentCover: 0.25, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, mark: '#3a3824' } },
};
export const SITE_WATER = {
  kashyyyk: { kind: 'sea', level: -0.27 },
  dagobah: { kind: 'swamp', level: 0 },
  yavin: { kind: 'swamp', level: -3 },
  naboo: { kind: 'sea', level: -2.06 },
  kamino: { kind: 'sea', level: 0 },
  mustafar: { kind: 'lava', level: 2.5 },
  scarif: { kind: 'sea', level: -0.92 },
  bespin: { kind: 'clouds', level: -380 },
  nevarro: { kind: 'lava', level: -3 },
};

// a world's ground look for lib/three/groundLook.js: a scan (public/cc0/galaxy/'s role) under its palette
const ground = (detail, palette, hLow, hHigh, more = {}) => ({
  ...(detail ? { detail, detailLook: { color: 0.7, normal: 0.7 } } : {}),
  wind: more.wind ?? 0.5,
  palette: { ...palette, hLow, hHigh, rockAt: more.rockAt ?? 0.4, accentCover: more.accentCover ?? 0.22, grain: more.grain ?? 0.6, ...(more.sparkle ? { sparkle: more.sparkle } : {}) },
});
const water = (kind, level) => ({ kind, level });


// ── the galaxy, 17 worlds ──
const GALAXY = [
  {
    id: 'tatooine', name: 'Tatooine', type: 'desert',
    biomes: [
      biome('jundland', [0.5, 0.3], 0, [...site('tatooine'), channels(700, 40, 0.07), ridges(160, 12)]),
      biome('dunesea', [0.8, 0.1], 0, [dunes(220, 42, 0.5), swell(900, 10)]),
      biome('plateau', [0.3, 0.5], 50, [level(), mesas(900, 30, 0.5)]),
      biome('chott', [0.6, 0.7], -8, [level(), swell(1200, 2)]),
      biome('wastes', [0.2, 0.85], 10, [hills(200, 14)], { scatter: scatter(14, [-12, -12], [60, 220]) }),
    ],
    pois: [poi('mos-eisley', 'Mos Eisley', [900, 600], 260, 120), poi('lars', 'The Lars homestead', [-1400, 300], 60, 40), poi('jabba', 'Jabba’s palace', [-2600, -1200], 90, 60)],
    pits: [{ id: 'carkoon', name: 'The Pit of Carkoon', at: [2800, -1900], r: 90, depth: 40 }],
    palette: { low: '#d9b47a', high: '#efd9a8', rock: '#8a5a3a', accent: '#b8864a', skyLow: '#f6dcb0', skyHigh: '#6fa6d8' },
    clutter: clutter(['rock', 40], ['debris', 10], ['spire', 4, { size: 0.4 }]),
    landmarks: [landmark('mos-eisley', 'mos-eisley', [part('moscantina.lod1', 22, 1, { centre: true, tint: '#e2c497' }), part('mosblock', 14, 34, { along: 'max', tint: '#e2c497' }), part('moshut', 8, 46, { along: 'max', tint: '#e2c497' }), part('mosspire', 20, 8, { along: 'y', tint: '#e2c497' }), part('mostower', 30, 5, { along: 'y', tint: '#e2c497' }), part('mosarch', 10, 4, { tint: '#e2c497' })])],
    ground: SITE_GROUND.tatooine,
    water: SITE_WATER.tatooine,
  },
  {
    id: 'hoth', name: 'Hoth', type: 'ice', seed: 0x48f1a2c3,
    biomes: [
      biome('plains', [0.2, 0.4], 0, site('hoth')),
      biome('shelf', [0.1, 0.8], -6, [level(), swell(1400, 4)]),
      biome('range', [0.7, 0.3], 60, [ridges(700, 220), mountains(300, 1200), hills(120, 12)]),
      biome('glacier', [0.4, 0.85], 30, [dunes(300, 18, 0.6), channels(900, 14, 0.04)]),
      biome('valley', [0.85, 0.75], -20, [channels(1600, 60, 0.18), swell(600, 10)]),
    ],
    pois: [poi('echo-base', 'Echo Base', [1200, -800], 220, 160, 12), poi('trench', 'The trench line', [1500, -1100], 90, 60), poi('ion-cannon', 'The ion cannon', [1380, -620], 40, 30)],
    palette: { low: '#dfe7f1', high: '#f4f8fc', rock: '#7e8fa6', accent: '#cbdaeb', skyLow: '#e9f0f7', skyHigh: '#9fb7d1' },
    clutter: clutter(['rock', 60], ['spire', 6, fine], ['debris', 15]),
    ground: SITE_GROUND.hoth,
    water: SITE_WATER.hoth,
  },
  {
    id: 'endor', name: 'Endor', type: 'forest',
    biomes: [
      biome('redwoods', [0.5, 0.7], 0, site('endor')),
      biome('savannah', [0.7, 0.3], 10, [swell(800, 12), hills(300, 6)]),
      biome('range', [0.3, 0.5], 80, [mountains(320, 1300), ridges(400, 60)]),
      biome('lakes', [0.4, 0.9], -10, [level()], { scatter: scatter(10, [-30, -30], [150, 500]) }),
      biome('desert', [0.9, 0.1], 5, [dunes(120, 8)]),
    ],
    pois: [poi('bunker', 'The shield generator bunker', [600, -400], 140, 90), poi('bright-tree', 'Bright Tree Village', [-900, 500], 80, 60)],
    palette: { low: '#3f5a30', high: '#7f9a52', rock: '#5a5048', accent: '#a8c070', skyLow: '#d8ecf2', skyHigh: '#5d9fd6' },
    clutter: clutter(['trunk', 30, fine], ['rock', 20], ['debris', 15]),
    landmarks: [landmark('bright-tree', 'bright-tree', [part('ewokhut', 4, 10, { tint: '#8a8068' })])],
    ground: SITE_GROUND.endor,
    water: water('lake', -8),
  },
  {
    id: 'yavin', name: 'Yavin 4', type: 'forest',
    biomes: [
      biome('jungle', [0.8, 0.8], 0, site('yavin')),
      biome('rivers', [0.7, 0.9], -4, [channels(700, 12, 0.05), swell(300, 4)]),
      biome('highlands', [0.4, 0.6], 60, [ridges(600, 120), mountains(300, 1100, 2000, 6000)]),
      biome('clearings', [0.6, 0.5], 6, [swell(500, 5)]),
    ],
    pois: [poi('great-temple', 'The Great Temple', [0, 400], 180, 120, 8), poi('landing-field', 'The landing field', [240, 420], 120, 60, 8), poi('ruin', 'A ruined temple', [-1500, -900], 60, 50)],
    palette: { low: '#2e4a2a', high: '#5a7a38', rock: '#6a6a60', accent: '#8a9a50', skyLow: '#e0e8d8', skyHigh: '#d08a5a' },
    clutter: clutter(['trunk', 25, fine], ['debris', 8], ['rock', 20]),
    ground: SITE_GROUND.yavin,
    water: SITE_WATER.yavin,
  },
  {
    id: 'bespin', name: 'Bespin', type: 'gas', soft: true,
    biomes: [
      // (the note's heights raised 200 m whole, its trough's floor at −400 under
      // the flight's −200: the deck at 0, Cloud City 200 m over it, as there)
      biome('deck', [0.5, 0.5], 0, [level(), swell(1800, 40)]),
      biome('towers', [0.7, 0.7], 20, [mesas(1200, 160, 0.3, 0.2)]),
      biome('trough', [0.3, 0.3], -120, [channels(2400, 80, 0.2)]),
    ],
    // (the places at the deck's own level, the city and the platform lifted over them: they float, as in the films)
    pois: [poi('cloud-city', 'Cloud City', [0, 0], 420, 200, 0), poi('gas-platform', 'A gas platform', [2200, 900], 60, 40, 0)],
    palette: { low: '#e8d8c8', high: '#f0e2d2', rock: '#c8b8a8', accent: '#f0a888', skyLow: '#fbe3cf', skyHigh: '#e09a78' },
    clutter: clutter(['spire', 4, fine], ['debris', 3]),
    landmarks: [landmark('cloud-city', 'cloud-city', [part('cloudplaza', 300, 1, { centre: true, lift: 200 }), part('cloudcity', 160, 1, { centre: true, along: 'y', lift: 200 }), part('cloudtower', 110, 10, { along: 'y', lift: 200, outer: 0.4 })])],
    ground: SITE_GROUND.bespin,
  },
  {
    id: 'dagobah', name: 'Dagobah', type: 'swamp',
    biomes: [
      biome('swamp', [0.6, 0.9], 0, site('dagobah')),
      biome('bog', [0.5, 0.7], -1, [level()], { scatter: scatter(14, [3, 3], [40, 160]) }),
      biome('hummocks', [0.4, 0.5], 6, [hills(120, 9)], { scatter: scatter(10, [-6, -6], [20, 60]) }),
      biome('mere', [0.7, 0.95], -6, [level()]),
    ],
    pois: [poi('yoda', 'Yoda’s hut', [120, -80], 30, 24, 3)],
    pits: [{ id: 'cave', name: 'The cave', at: [-300, 200], r: 20, depth: 8 }],
    palette: { low: '#2a3a26', high: '#4a5a34', rock: '#3a3a30', accent: '#6a7a40', skyLow: '#9aa48a', skyHigh: '#5a6a52' },
    clutter: clutter(['spire', 20, { size: 0.4 }], ['debris', 20], ['rock', 20]),
    landmarks: [landmark('yoda', 'yoda', [part('yodahut.lod1', 10, 1, { centre: true })])],
    ground: SITE_GROUND.dagobah,
    water: SITE_WATER.dagobah,
  },
  {
    id: 'mustafar', name: 'Mustafar', type: 'lava',
    biomes: [
      biome('fields', [0.9, 0.3], 0, site('mustafar')),
      biome('volcanoes', [0.95, 0.6], 40, [mountains(420, 1100, 1800, 5000)], { scatter: scatter(6, [180, 180], [300, 700], { rim: 0, crater: -40 }) }),
      biome('ash', [0.7, 0.2], 10, [dunes(140, 9, 0.3), swell(600, 6)]),
      biome('glass', [0.8, 0.5], -4, [level()]),
    ],
    pois: [poi('mining', 'The mining facility', [300, 380], 70, 40), poi('fortress', 'Vader’s fortress crag', [-390, 80], 80, 50, 32), poi('arm', 'A collection arm', [1600, -600], 40, 30)],
    palette: { low: '#1a1612', high: '#3a3230', rock: '#2a2422', accent: '#ff5a1a', skyLow: '#8a3a22', skyHigh: '#2a1410' },
    clutter: clutter(['spire', 8, fine], ['rock', 50], ['debris', 10]),
    ground: SITE_GROUND.mustafar,
    water: SITE_WATER.mustafar,
  },
  {
    id: 'coruscant', name: 'Coruscant', type: 'city',
    // An ecumenopolis: the whole planet one city. The ground is its floor
    // (decks at a few levels, the Works' trenches cut through), and the city
    // stands on it as towers on a lot grid out to the haze (the clutter): the
    // film-made tower close up, three code-built silhouettes beyond, the
    // Senate and the Jedi Temple at their places
    biomes: [
      biome('core', [0.5, 0.5], 300, [...site('coruscant'), swell(600, 3)]),
      biome('works', [0.8, 0.3], -40, [level(), channels(900, 60, 0.1)]),
      biome('plateau', [0.3, 0.7], 0, [level(), mesas(1200, 30, 0.5, 0.02)]),
    ],
    pois: [poi('senate', 'The Senate', [0, 0], 300, 120, -30), poi('jedi-temple', 'The Jedi Temple', [1400, -600], 260, 100, 50), poi('platform', 'A landing platform', [-800, 500], 60, 30, 100)],
    palette: { low: '#4a3a3e', high: '#6a5a5e', rock: '#3a2e30', accent: '#ff9a50', skyLow: '#f0a070', skyHigh: '#4a3a5a' },
    fog: { near: 600, far: 13000 },
    clutter: [{ kinds: ['tower', 'slab', 'needle'], grid: 150, cover: 0.82, scale: [1.6, 6.2], depth: 3 }],
    // the galaxy's film-made models (galaxy/surface/catalog), standing at their places; `hq` is the
    // high-detail file the site carries too, for a strong machine
    landmarks: [
      landmark('senate', 'senate', [part('senate.lod1', 460, 1, { centre: true, hq: 'models/galaxy/surface/senate.ultra.glb' })]),
      landmark('jedi-temple', 'jedi-temple', [part('jeditemple.lod1', 420, 1, { centre: true, yaw: Math.PI, hq: 'models/galaxy/surface/jeditemple.glb' })]),
    ],
    // the city's nearest towers (lib/three's instanced pools: one draw)
    hero: { url: '/models/galaxy/surface/corutower.glb' },
    // (the site's flat colours, and the plazas' concrete underfoot, which the walkable square has none of)
    ground: { ...SITE_GROUND.coruscant, detail: 'concrete', detailLook: { color: 0.7, normal: 0.7 }, palette: { ...SITE_GROUND.coruscant.palette, hLow: -40, hHigh: 40 } },
  },
  {
    id: 'naboo', name: 'Naboo', type: 'temperate',
    biomes: [
      biome('plains', [0.5, 0.5], 0, site('naboo')),
      biome('gallo', [0.3, 0.4], 90, [mountains(460, 1200), ridges(500, 80)]),
      biome('lakecountry', [0.4, 0.8], 20, [hills(200, 12), mountains(300, 900, 2200, 5000)], { scatter: scatter(10, [-40, -40], [150, 500]) }),
      biome('lianorm', [0.7, 0.9], -6, [swell(120, 2), level()]),
      biome('theed', [0.5, 0.3], 40, [level(), mesas(1400, 40, 0.6, 0.02)]),
    ],
    pois: [poi('theed', 'Theed', [0, -1200], 400, 160, 40), poi('varykino', 'Varykino', [1800, 900], 50, 30), poi('gungan', 'The Gungan sacred place', [-1600, 1400], 80, 60), poi('battle', 'The battle plain', [-600, 300], 300, 200)],
    palette: { low: '#4a7a3a', high: '#8ab860', rock: '#8a8070', accent: '#5a9ad0', skyLow: '#e4f0f4', skyHigh: '#5a9ad0' },
    clutter: clutter(['trunk', 15, { ...fine, size: 0.3 }], ['rock', 20], ['spire', 10, { size: 0.2 }]),
    ground: SITE_GROUND.naboo,
    water: SITE_WATER.naboo,
  },
  {
    id: 'kashyyyk', name: 'Kashyyyk', type: 'forest',
    biomes: [
      biome('wroshyr', [0.6, 0.8], 0, site('kashyyyk')),
      biome('coast', [0.7, 0.6], 0, [level(-12)], { scatter: scatter(14, [26, 26], [150, 600], { ragged: 0.25 }) }),
      biome('plains', [0.5, 0.4], 10, [swell(700, 10)]),
      biome('shadow', [0.3, 0.9], -30, [channels(500, 30, 0.12)]),
      biome('range', [0.2, 0.5], 100, [mountains(420, 900)]),
    ],
    pois: [poi('kachirho', 'Kachirho', [-40, -560], 180, 120), poi('beach', 'The beach landing', [200, -300], 80, 50), poi('clearing', 'A Shadowlands clearing', [-2200, 800], 60, 40, -30)],
    palette: { low: '#2a4a28', high: '#5a8a3a', rock: '#6a5a40', accent: '#3ac8c0', skyLow: '#e0eee8', skyHigh: '#5aa0c8' },
    clutter: clutter(['trunk', 20, { ...fine, size: 3.5 }], ['rock', 10], ['debris', 10]),
    ground: SITE_GROUND.kashyyyk,
    water: SITE_WATER.kashyyyk,
  },
  {
    id: 'kamino', name: 'Kamino', type: 'ocean',
    biomes: [
      biome('sea', [0.5, 0.5], 0, site('kamino')),
      biome('shoals', [0.3, 0.3], -46, [swell(600, 4)]),
      biome('swell', [0.7, 0.7], -40, [level()]),
    ],
    pois: [poi('tipoca', 'Tipoca City', [0, 0], 240, 0, 5), poi('platform', 'A landing platform', [900, 400], 40, 0, 5)],
    palette: { low: '#2a343c', high: '#3a4650', rock: '#22282e', accent: '#e8eef4', skyLow: '#8a949c', skyHigh: '#4a545c' },
    clutter: [],
    landmarks: [landmark('tipoca', 'tipoca', [part('tipocadome.lod1', 120, 1, { centre: true, hq: 'models/galaxy/surface/tipocadome.ultra.glb' }), part('tipocadome.lod1', 70, 5)])],
    ground: SITE_GROUND.kamino,
    water: SITE_WATER.kamino,
  },
  {
    id: 'geonosis', name: 'Geonosis', type: 'desert',
    biomes: [
      biome('plains', [0.8, 0.2], 0, site('geonosis')),
      biome('mesas', [0.6, 0.3], 20, [mesas(480, 60, 0.3, 0.05)]),
      biome('badlands', [0.9, 0.4], 10, [channels(500, 26, 0.1), ridges(200, 18)], { scatter: scatter(12, [-14, -14], [40, 160]) }),
      biome('hives', [0.7, 0.6], 15, [hills(300, 10)]),
    ],
    pois: [poi('arena', 'The Petranaki arena', [400, -200], 160, 80, 20), poi('foundry', 'The droid foundry', [-1100, 700], 120, 80), poi('hive', 'The Stalgasin hive', [1600, 900], 100, 80)],
    palette: { low: '#9a4a30', high: '#c87a50', rock: '#6a3020', accent: '#e8a070', skyLow: '#f0b088', skyHigh: '#c86a48' },
    clutter: clutter(['hive', 4, fine], ['rock', 40], ['debris', 15]),
    ground: SITE_GROUND.geonosis,
  },
  {
    id: 'scarif', name: 'Scarif', type: 'ocean',
    biomes: [
      biome('islands', [0.8, 0.8], 0, [...site('scarif'), level(-10)], { scatter: scatter(16, [9, 14], [150, 500], { ragged: 0.35 }) }),
      biome('volcano', [0.7, 0.6], -10, [island([3000, -2000], 1200, 260, 0.15)], { scatter: scatter(8, [12, 12], [100, 300]) }),
      biome('reef', [0.9, 0.9], -14, [level(), swell(300, 2)]),
      biome('deep', [0.5, 0.5], -40, [level()]),
    ],
    pois: [poi('citadel', 'The Citadel', [0, 0], 220, 120, 9), poi('pads', 'The landing pads', [90, 460], 120, 60, 9), poi('outpost', 'A beach outpost', [-420, 180], 60, 40, 8)],
    palette: { low: '#f0e6c8', high: '#ffffff', rock: '#6a7a60', accent: '#3ad0c8', skyLow: '#e8f6f8', skyHigh: '#3a9ad8' },
    clutter: clutter(['spire', 15, { size: 0.5 }], ['rock', 20], ['debris', 8]),
    ground: SITE_GROUND.scarif,
    water: SITE_WATER.scarif,
  },
  {
    id: 'nevarro', name: 'Nevarro', type: 'lava',
    biomes: [
      biome('fields', [0.9, 0.3], 0, [...site('nevarro'), channels(420, 12, 0.07)]),
      biome('flats', [0.7, 0.2], -6, [level(), swell(900, 3)]),
      biome('hills', [0.6, 0.4], 20, [hills(200, 26)], { scatter: scatter(10, [60, 60], [150, 400]) }),
      biome('sands', [0.8, 0.1], 4, [dunes(90, 6, 0.4)]),
    ],
    pois: [poi('city', 'Nevarro City', [0, 0], 150, 100, 10), poi('covert', 'The covert', [-300, 205], 60, 40, 26), poi('lava-flats', 'The lava flats', [325, 245], 150, 80, -7.5)],
    palette: { low: '#1c1a1a', high: '#4a4644', rock: '#2a2626', accent: '#ff4a0a', skyLow: '#c8865a', skyHigh: '#4a3a3a' },
    clutter: clutter(['rock', 50], ['spire', 6, fine], ['debris', 10]),
    landmarks: [landmark('city', 'city', [part('nevarrocantina', 18.5, 1, { centre: true }), part('nevarrodome', 11, 12, { tint: '#b8a48a' }), part('nevarrodomehouse.lod1', 10, 12, { tint: '#b8a48a' })])],
    ground: SITE_GROUND.nevarro,
    water: SITE_WATER.nevarro,
  },
  {
    id: 'mandalore', name: 'Mandalore', type: 'desert',
    biomes: [
      biome('glass', [0.8, 0.2], 0, [...site('mandalore'), level()]),
      biome('drifts', [0.9, 0.1], 4, [dunes(180, 16, 0.8)]),
      biome('broken', [0.6, 0.4], 30, [mesas(500, 60, 0.25, 0.05), ridges(220, 14)]),
      biome('basin', [0.5, 0.6], -20, [island([0, 0], 1400, -80, 0.6, 0.1), hills(160, 8)]),
      biome('range', [0.3, 0.5], 90, [mountains(400, 1200)]),
    ],
    pois: [poi('sundari', 'Sundari’s dome', [0, 0], 500, 200, -20), poi('camp', 'A camp', [1800, -700], 60, 40)],
    pits: [{ id: 'mine', name: 'The mine mouth', at: [60, -40], r: 30, depth: 20 }],
    palette: { low: '#b9ab8e', high: '#d0c6b2', rock: '#3a4344', accent: '#5f6a66', skyLow: '#e0d6c4', skyHigh: '#8a9298' },
    clutter: clutter(['spire', 10, { size: 0.3 }], ['debris', 20], ['rock', 20]),
    landmarks: [landmark('sundari', 'sundari', [part('sundaridome.lod1', 420, 1, { centre: true, tint: '#9d9890', hq: 'models/galaxy/surface/sundaridome.ultra.glb' })])],
    ground: SITE_GROUND.mandalore,
  },
  {
    id: 'lothal', name: 'Lothal', type: 'temperate',
    biomes: [
      biome('grass', [0.5, 0.5], 0, site('lothal')),
      biome('lakebed', [0.6, 0.3], -4, [level()]),
      biome('scarred', [0.8, 0.4], 2, [hills(120, 6)], { scatter: scatter(10, [-18, -18], [60, 200]) }),
      biome('hills', [0.3, 0.6], 40, [hills(400, 50), mountains(360, 1300, 3000, 8000)]),
    ],
    pois: [poi('capital', 'Capital City', [260, -60], 200, 100), poi('factory', 'The Imperial factory', [-220, -200], 120, 60), poi('tower', 'The old tower', [-320, 60], 40, 30), poi('temple', 'The Jedi temple', [-140, 230], 60, 40), poi('depot', 'The Lothal Depot', [1800, 400], 300, 120, -4)],
    palette: { low: '#a48a58', high: '#c6ad72', rock: '#7a7268', accent: '#b39a7e', skyLow: '#f0e4cc', skyHigh: '#7aa8d0' },
    clutter: clutter(['spire', 8, fine], ['rock', 15], ['debris', 6]),
    landmarks: [landmark('capital', 'capital', [part('lothtower', 40, 2, { along: 'y' }), part('lothdome', 11, 14, { tint: '#e2d3b2' })])],
    ground: SITE_GROUND.lothal,
  },
  {
    id: 'sorgan', name: 'Sorgan', type: 'forest',
    biomes: [
      biome('woods', [0.4, 0.7], 0, site('sorgan')),
      biome('lakes', [0.5, 0.9], -2, [swell(200, 3)], { scatter: scatter(10, [-20, -20], [100, 400]) }),
      biome('swamp', [0.6, 0.95], -3, [level()]),
      biome('uplands', [0.3, 0.5], 60, [hills(300, 40), mountains(300, 1100, 2500, 7000)]),
    ],
    pois: [poi('village', 'The village', [180, 120], 70, 50), poi('raiders', 'The raiders’ camp', [-240, -160], 50, 30), poi('clearing', 'The landing clearing', [0, 0], 60, 40)],
    palette: { low: '#4f4c2e', high: '#5e6034', rock: '#5a5a50', accent: '#6a5e3a', skyLow: '#c8ccbc', skyHigh: '#7a8a8a' },
    clutter: clutter(['spire', 20, { size: 0.6 }], ['debris', 10], ['rock', 15]),
    ground: SITE_GROUND.sorgan,
    water: water('lake', -10),
  },
];

// ── the Rick and Morty sector, 10 moons (cartoon: rounder hills, folded plateaus) ──
const SECTOR = [
  {
    id: 'gazorpazorp', name: 'Gazorpazorp', type: 'desert',
    biomes: ringed([b('dunes', 0, [dunes(160, 22, 0.2)]), b('cliffs', 40, [mesas(420, 90, 0.3, 0.03)]), b('mountains', 80, [mountains(300, 900)]), b('basin', -10, [level(), island([2500, 1500], 900, -30, 0.5, 0.2)])]),
    pois: [poi('gate', 'The women’s gate', [0, -300], 90, 60), poi('arena', 'The men’s arena', [400, 200], 120, 60)],
    palette: { low: '#b84a2a', high: '#e08a5a', rock: '#6a2a1a', accent: '#ff9a6a', skyLow: '#f4b890', skyHigh: '#c8604a' },
    clutter: clutter(['rock', 40], ['debris', 20]),
    ground: ground('redsoil', { low: '#b84a2a', high: '#e08a5a', rock: '#6a2a1a', accent: '#ff9a6a' }, 0, 90, { rockAt: 0.34 }),
  },
  {
    id: 'squanch', name: 'Squanch', type: 'stylised',
    biomes: ringed([b('hills', 0, [soft(220, 18)]), b('plateaus', 30, [toon(40, 600)]), b('lake', -8, [level()])]),
    pois: [poi('venue', 'The wedding venue', [0, 0], 120, 80)],
    palette: { low: '#b83a3a', high: '#d85a4a', rock: '#7a2a2a', accent: '#7ad2c8', skyLow: '#f8d0c8', skyHigh: '#d07a8a' },
    clutter: clutter(['spire', 10], ['rock', 20]),
    ground: ground('redsoil', { low: '#b83a3a', high: '#d85a4a', rock: '#7a2a2a', accent: '#7ad2c8' }, 0, 50),
    water: water('lake', -6),
  },
  {
    id: 'birdworld', name: 'Bird World', type: 'stylised',
    biomes: ringed([b('meadows', 0, [soft(260, 14)]), b('stacks', 20, [mesas(300, 120, 0.15, 0.02)]), b('crags', 60, [ridges(400, 80)])]),
    pois: [poi('nest', 'The nest', [0, 0], 80, 60, 20)],
    palette: { low: '#4a8a3a', high: '#6aa84a', rock: '#2a5a2a', accent: '#bfe4ff', skyLow: '#e8f6ff', skyHigh: '#7ac0f0' },
    clutter: clutter(['spire', 10], ['debris', 10], ['rock', 20]),
    ground: ground('grass', { low: '#4a8a3a', high: '#6aa84a', rock: '#2a5a2a', accent: '#bfe4ff' }, 0, 80, { rockAt: 0.36 }),
  },
  {
    id: 'gearworld', name: 'Gear World', type: 'stylised',
    biomes: ringed([b('plates', 0, [level(), blocks(60, 10, 2, 12, 0.5)]), b('cogs', 10, [toon(30, 240)]), b('pits', -10, [level()], { scatter: scatter(10, [-40, -40], [100, 300]) })]),
    pois: [poi('monument', 'The gear monument', [0, 0], 100, 60)],
    palette: { low: '#b88a3a', high: '#d8aa5a', rock: '#6a4a2a', accent: '#ffe0a0', skyLow: '#f8e8c0', skyHigh: '#c89850' },
    clutter: clutter(['debris', 20], ['spire', 6, fine]),
    ground: ground('metal', { low: '#b88a3a', high: '#d8aa5a', rock: '#6a4a2a', accent: '#ffe0a0' }, 0, 30),
  },
  {
    id: 'pluto', name: 'Pluto', type: 'ice',
    biomes: ringed([b('plains', 0, [swell(500, 8)]), b('craters', 10, [hills(200, 10)], { scatter: scatter(14, [-30, -30], [80, 300], { ragged: 0.1 }) }), b('mines', -20, [channels(300, 10), island([1500, -1000], 400, -60, 0.4)])]),
    pois: [poi('hq', 'The mining headquarters', [0, 0], 120, 60)],
    palette: { low: '#8a8a90', high: '#c8c8d0', rock: '#4a4a52', accent: '#6a8ab0', skyLow: '#5a5a6a', skyHigh: '#14141c' },
    clutter: clutter(['rock', 40], ['spire', 4, fine], ['debris', 10]),
    ground: ground('gravel', { low: '#8a8a90', high: '#c8c8d0', rock: '#4a4a52', accent: '#6a8ab0' }, 0, 30, { sparkle: 0.3 }),
  },
  {
    id: 'snakeplanet', name: 'Snake Planet', type: 'temperate',
    biomes: ringed([b('plains', 0, [swell(400, 10), soft(180, 8)]), b('valleys', -6, [channels(600, 16, 0.1)]), b('city', 2, [blocks(50, 12, 6, 40, 0.6)])]),
    pois: [poi('capital', 'The capital', [0, 0], 200, 80)],
    palette: { low: '#5a7a3a', high: '#8aa858', rock: '#6a6a5a', accent: '#c8d070', skyLow: '#eef4d8', skyHigh: '#8ab0a0' },
    clutter: clutter(['trunk', 10, { size: 0.3 }], ['spire', 6], ['rock', 15]),
    ground: ground('grass', { low: '#5a7a3a', high: '#8aa858', rock: '#6a6a5a', accent: '#c8d070' }, 0, 30),
  },
  {
    id: 'nuptia', name: 'Nuptia 4', type: 'stylised',
    biomes: ringed([b('plateau', 40, [level(), swell(400, 4)]), b('cliffs', 40, [level(-50), mesas(1200, 40, 0.7, 0.01)]), b('hills', 50, [soft(200, 12)])]),
    pois: [poi('centre', 'The counselling centre', [0, 0], 160, 60, 40)],
    palette: { low: '#7a9a8a', high: '#e8f0ec', rock: '#5a6a62', accent: '#ffffff', skyLow: '#f4f8f8', skyHigh: '#8ac0d8' },
    clutter: clutter(['rock', 20], ['spire', 6, { size: 0.2 }]),
    ground: ground('grass', { low: '#7a9a8a', high: '#e8f0ec', rock: '#5a6a62', accent: '#ffffff' }, 30, 60),
    water: water('sea', 0),
  },
  {
    id: 'resort', name: 'The Immortality Field Resort', type: 'stylised',
    biomes: ringed([b('beach', 0, [dunes(40, 1), level(-3)]), b('terraces', 8, [mesas(300, 10, 0.5)]), b('hills', 20, [soft(200, 14)])]),
    pois: [poi('resort', 'The resort', [0, 0], 200, 80, 8)],
    palette: { low: '#e8d8a8', high: '#fff4d8', rock: '#7a7a70', accent: '#4ad0e0', skyLow: '#f4fcff', skyHigh: '#4ab0e8' },
    clutter: clutter(['spire', 10, { size: 0.3 }], ['debris', 10]),
    ground: ground('beach', { low: '#e8d8a8', high: '#fff4d8', rock: '#7a7a70', accent: '#4ad0e0' }, 0, 20),
    water: water('sea', 0),
  },
  {
    id: 'cronenberg', name: 'Cronenberg World', type: 'temperate',
    biomes: ringed([b('suburb', 0, [swell(300, 4), blocks(40, 16, 4, 9, 0.5)]), b('hills', 20, [hills(240, 16)]), b('river', -4, [channels(800, 10, 0.08)])]),
    pois: [poi('street', 'The Smiths’ street', [0, 0], 120, 60)],
    palette: { low: '#5a6a4a', high: '#8a9a6a', rock: '#6a5a5a', accent: '#d8a0a0', skyLow: '#e8d8c8', skyHigh: '#9a7a8a' },
    clutter: clutter(['debris', 15], ['trunk', 8, { size: 0.3 }], ['spire', 6, { size: 0.3 }]),
    ground: ground('grass', { low: '#5a6a4a', high: '#8a9a6a', rock: '#6a5a5a', accent: '#d8a0a0' }, 0, 30),
  },
  {
    id: 'purge', name: 'The Purge Planet', type: 'temperate',
    biomes: ringed([b('farmland', 0, [swell(400, 5)]), b('hills', 10, [soft(220, 14)]), b('coast', 20, [level(-28), mesas(1400, 30, 0.6, 0.01)])]),
    pois: [poi('village', 'The village', [0, 0], 140, 60), poi('lighthouse', 'The lighthouse', [900, -600], 40, 30, 24)],
    palette: { low: '#5a7a3a', high: '#a8b860', rock: '#6a6a62', accent: '#ffb050', skyLow: '#fbe8c8', skyHigh: '#e0905a' },
    clutter: clutter(['debris', 10], ['spire', 6, { size: 0.2 }], ['trunk', 10, { size: 0.3 }]),
    ground: ground('grass', { low: '#5a7a3a', high: '#a8b860', rock: '#6a6a62', accent: '#ffb050' }, 0, 30),
    water: water('sea', -2),
  },
];

// ── the universe map's fandom planets, 10 worlds ──
const FANDOM = [
  {
    id: 'cybertron', name: 'Cybertron', type: 'metal',
    biomes: ringed([b('rust', 0, [dunes(200, 18, 0.9), level()]), b('plates', 10, [level(), blocks(90, 20, 3, 30, 0.6)]), b('canyons', 20, [channels(500, 90, 0.06), ridges(200, 20)]), b('manganese', 80, [ridges(600, 160), mountains(300, 1000)]), b('iacon', 30, [blocks(140, 30, 60, 320, 0.85)])]),
    pois: [poi('iacon', 'Iacon', [0, -2000], 400, 160, 30), poi('hydrax', 'The Hydrax Plateau', [0, 0], 300, 100, 40), poi('kaon', 'Kaon', [0, 2400], 300, 120, 20)],
    palette: { low: '#5a6270', high: '#9aa4b0', rock: '#3a4048', accent: '#ff8a30', skyLow: '#d8a070', skyHigh: '#3a4058' },
    clutter: clutter(['crystal', 8, fine], ['debris', 15], ['spire', 4]),
    ground: ground('metal', { low: '#5a6270', high: '#9aa4b0', rock: '#3a4048', accent: '#ff8a30' }, 0, 120),
  },
  {
    id: 'middle-earth', name: 'Middle-earth', type: 'temperate',
    biomes: ringed([
      b('shire', 0, [soft(220, 18), swell(600, 8)]),
      b('misty', 120, [mountains(900, 1600), ridges(500, 160)]),
      b('rohan', 10, [swell(900, 10), hills(300, 4)]),
      b('marshes', -4, [level()], { scatter: scatter(14, [2, 2], [30, 120]) }),
      b('mordor', 20, [ridges(300, 30), dunes(120, 6), island([6000, -4000], 2400, 700, 0.1), island([6000, -4000], 260, -60, 0.4, 0.1), channels(600, 16)]),
    ]),
    pois: [poi('hobbiton', 'Hobbiton', [-3000, 1800], 200, 120), poi('bree', 'Bree', [-2200, 1600], 120, 60), poi('weathertop', 'Weathertop', [-1500, 1400], 40, 50, 90), poi('rivendell', 'Rivendell', [-600, 1200], 120, 80, 60), poi('moria', 'Moria’s gate', [0, 900], 60, 40, 120), poi('amon-hen', 'Amon Hen', [600, -200], 40, 40, 70), poi('barad-dur', 'Barad-dûr', [2800, -1400], 120, 80, 20)],
    palette: { low: '#4a7a3a', high: '#a0c060', rock: '#8e9086', accent: '#2a2420', skyLow: '#eef2e4', skyHigh: '#7aa8c8' },
    clutter: clutter(['trunk', 15, { size: 0.3 }], ['spire', 3, fine], ['rock', 20]),
    ground: ground('grass', { low: '#4a7a3a', high: '#a0c060', rock: '#8e9086', accent: '#2a2420' }, 0, 140, { rockAt: 0.36 }),
    water: water('swamp', -2),
  },
  {
    id: 'caribbean', name: 'The Caribbean', type: 'ocean',
    biomes: ringed([b('islands', -8, [level()], { scatter: scatter(18, [12, 40], [150, 600], { ragged: 0.3 }) }), b('reef', -12, [level(), swell(200, 2)]), b('peaks', -8, [island([2400, 1600], 900, 180, 0.2)]), b('deep', -40, [level()])]),
    pois: [poi('tortuga', 'Tortuga', [0, 0], 160, 80, 6), poi('port-royal', 'Port Royal', [1600, -900], 140, 60, 30), poi('isla-de-muerta', 'Isla de Muerta', [-1800, 600], 60, 40, 10)],
    palette: { low: '#e8d8b0', high: '#fff0d0', rock: '#5a6a50', accent: '#30c0c8', skyLow: '#f0faf8', skyHigh: '#3aa0d8' },
    clutter: clutter(['spire', 12, { size: 0.5 }], ['rock', 15], ['debris', 6]),
    ground: ground('beach', { low: '#e8d8b0', high: '#fff0d0', rock: '#5a6a50', accent: '#30c0c8' }, 0, 40, { accentCover: 0.1 }),
    water: water('sea', 0),
  },
  {
    id: 'albuquerque', name: 'Albuquerque', type: 'desert',
    biomes: ringed([b('mesa', 0, [swell(500, 8), mesas(700, 40, 0.35, 0.04)]), b('bosque', -6, [channels(1200, 14, 0.06), swell(300, 3)]), b('sandia', 100, [mountains(900, 1400)]), b('grid', 2, [blocks(60, 20, 4, 16, 0.5)]), b('whitesands', 4, [dunes(90, 9, 0.4)])]),
    pois: [poi('car-wash', 'The car wash', [0, 0], 80, 50), poi('cook-site', 'The RV’s cook site', [2400, -800], 60, 50), poi('lab', 'The lab', [-1200, 400], 70, 40)],
    palette: { low: '#c8a878', high: '#e8d0a0', rock: '#8a6a50', accent: '#c87a7a', skyLow: '#f4ead8', skyHigh: '#5a9ad8' },
    clutter: clutter(['spire', 10, { size: 0.2 }], ['rock', 30], ['debris', 8]),
    ground: ground('sand', { low: '#c8a878', high: '#e8d0a0', rock: '#8a6a50', accent: '#c87a7a' }, 0, 80, { rockAt: 0.36 }),
  },
  {
    id: 'scranton', name: 'Scranton', type: 'temperate',
    biomes: ringed([b('valley', 0, [swell(500, 6), channels(900, 8)]), b('ridges', 40, [ridges(1200, 120, { wind: 0.5 }), hills(200, 10)]), b('culm', 5, [mesas(200, 22, 0.2)]), b('lake', -4, [island([1500, 2400], 300, -20, 0.5)]), b('city', 2, [blocks(50, 14, 5, 30, 0.6)])]),
    pois: [poi('office', 'The office park', [0, 0], 120, 60), poi('schrute', 'Schrute Farms', [1800, 900], 140, 60)],
    palette: { low: '#4a6a3a', high: '#a0a860', rock: '#6a6a62', accent: '#c87038', skyLow: '#eae6dc', skyHigh: '#8aa0b8' },
    clutter: clutter(['trunk', 15, { size: 0.3 }], ['debris', 8], ['spire', 3, fine]),
    ground: ground('grass', { low: '#4a6a3a', high: '#a0a860', rock: '#6a6a62', accent: '#c87038' }, 0, 120),
    water: water('lake', -12),
  },
  {
    id: 'avengers', name: 'Avengers HQ', type: 'temperate',
    biomes: ringed([b('lawns', 0, [swell(400, 4)]), b('woods', 6, [hills(180, 12)]), b('river', -6, [channels(1000, 12, 0.07)]), b('hills', 30, [hills(500, 40)])]),
    pois: [poi('compound', 'The compound', [0, 0], 300, 120), poi('helipad', 'The helipad', [260, 80], 40, 20)],
    palette: { low: '#3f6a38', high: '#8ab860', rock: '#6a6a62', accent: '#4a8ad0', skyLow: '#e8f0f4', skyHigh: '#5a90d0' },
    clutter: clutter(['trunk', 15, { size: 0.3 }], ['rock', 15]),
    ground: ground('grass', { low: '#3f6a38', high: '#8ab860', rock: '#6a6a62', accent: '#4a8ad0' }, 0, 50),
    water: water('lake', -8),
  },
  {
    id: 'invincible', name: 'Invincible', type: 'temperate',
    biomes: ringed([b('suburb', 0, [swell(300, 4), blocks(40, 16, 4, 10, 0.45)]), b('downtown', 2, [blocks(80, 20, 40, 220, 0.8)]), b('lake', -6, [level()]), b('plains', 4, [swell(800, 8)])]),
    pois: [poi('hq', 'The Guardians’ HQ', [0, 0], 160, 60), poi('graysons', 'The Graysons’ street', [1200, 800], 100, 50)],
    palette: { low: '#5a6a5a', high: '#a8b0a0', rock: '#4a4a50', accent: '#f0d040', skyLow: '#eaf0f4', skyHigh: '#5a8ad0' },
    clutter: clutter(['spire', 4], ['debris', 10], ['trunk', 8, { size: 0.3 }]),
    ground: ground('grass', { low: '#5a6a5a', high: '#a8b0a0', rock: '#4a4a50', accent: '#f0d040' }, 0, 30),
    water: water('lake', -4),
  },
  {
    id: 'c-137', name: 'Dimension C-137', type: 'temperate',
    biomes: ringed([b('suburb', 0, [swell(300, 4), blocks(40, 16, 4, 9, 0.5)]), b('hills', 20, [hills(240, 18)]), b('wood', 10, [hills(150, 8)]), b('river', -4, [channels(800, 10, 0.08)])]),
    pois: [poi('smiths', 'The Smith house', [0, 0], 80, 40), poi('school', 'The school', [600, 300], 90, 40), poi('blips', 'Blips and Chitz', [-900, 500], 100, 40)],
    palette: { low: '#5a7a4a', high: '#9ab870', rock: '#6a6a62', accent: '#78d0c0', skyLow: '#eef6f0', skyHigh: '#6ab0d8' },
    clutter: clutter(['trunk', 12, { size: 0.3 }], ['debris', 8], ['spire', 2, fine]),
    ground: ground('grass', { low: '#5a7a4a', high: '#9ab870', rock: '#6a6a62', accent: '#78d0c0' }, 0, 30),
    water: water('lake', -8),
  },
  {
    id: 'earth', name: 'Earth', type: 'temperate',
    biomes: ringed([b('temperate', 0, [swell(500, 10), hills(200, 12)]), b('desert', 5, [dunes(150, 18)]), b('mountains', 120, [mountains(800, 1500)]), b('tundra', 10, [swell(900, 6)]), b('coast', -6, [level(-8)], { scatter: scatter(14, [20, 60], [200, 800]) })]),
    pois: [],
    palette: { low: '#4a7a3a', high: '#c8b890', rock: '#6a6a62', accent: '#3a8ad0', skyLow: '#e8f2f8', skyHigh: '#4a8ad0' },
    clutter: clutter(['trunk', 10, { size: 0.3 }], ['rock', 20]),
    ground: ground('grass', { low: '#4a7a3a', high: '#c8b890', rock: '#6a6a62', accent: '#3a8ad0' }, 0, 200),
    water: water('sea', 0),
  },
  {
    id: 'dot-matrix', name: 'Dot Matrix', type: 'stylised', step: 4,
    biomes: ringed([b('lawn', 0, [level()]), b('terraces', 0, [hills(180, 24)]), b('peaks', 20, [ridges(300, 80)]), b('lava', -8, [level()], { scatter: scatter(12, [-16, -16], [40, 140]) })]),
    pois: [poi('castle', 'The castle grounds', [0, 0], 200, 0, 0), poi('bob-omb', 'Bob-omb Ridge', [1200, -800], 60, 0, 60)],
    palette: { low: '#3ab040', high: '#8ae060', rock: '#7a5a30', accent: '#ff4040', skyLow: '#d8f4ff', skyHigh: '#4aa0f0' },
    clutter: clutter(['block', 20], ['spire', 6, { size: 0.2 }]),
    ground: ground(null, { low: '#3ab040', high: '#8ae060', rock: '#7a5a30', accent: '#ff4040' }, 0, 40, { grain: 0.2 }),
    water: water('lava', -12),
  },
];

export const WORLDS = [...GALAXY, ...SECTOR, ...FANDOM];

// ── the Expanse's generated planets, by type: the galaxy's worlds as templates, the names stripped ──
const template = (id) => GALAXY.find((w) => w.id === id);
const look = (id, more = {}) => ({ palette: template(id).palette, clutter: template(id).clutter, soft: Boolean(template(id).soft), ground: template(id).ground, water: template(id).water ?? null, ...more });
const geonosis = template('geonosis').biomes;
export const TYPE_BIOMES = {
  ice: template('hoth').biomes,
  desert: template('tatooine').biomes,
  forest: template('endor').biomes,
  lava: template('mustafar').biomes,
  ocean: template('scarif').biomes,
  gas: template('bespin').biomes,
  ringed: template('bespin').biomes,
  // Geonosis's, the hives swapped for craters
  rock: geonosis.map((x) => (x.id === 'hives' ? { ...x, id: 'craters', scatter: scatter(16, [-120, -40], [200, 700], { core: 0.55, ragged: 0.15, rim: 0.3 }) } : x)),
};
export const TYPE_LOOK = {
  ice: look('hoth'),
  desert: look('tatooine'),
  forest: look('endor'),
  lava: look('mustafar'),
  ocean: look('scarif'),
  gas: look('bespin'),
  ringed: look('bespin'),
  rock: look('geonosis', { clutter: clutter(['rock', 60], ['debris', 15]) }),
};

// A generated planet's round ground (sphereField.js) keeps its family's
// biomes for their places on the climate square and their base heights, and
// trades their relief for one hilly noise, scaled per biome by these: a
// range rougher than the plains, a shelf or a chott near flat. By family,
// then by the template's biome id (two families each have a `plains`).
export const ROUND_ROUGH = {
  ice: { plains: 0.7, shelf: 0.3, range: 2.2, glacier: 0.8, valley: 0.6 },
  desert: { jundland: 1.2, dunesea: 0.8, plateau: 0.6, chott: 0.25, wastes: 0.9 },
  forest: { redwoods: 1, savannah: 0.6, range: 2.2, lakes: 0.4, desert: 0.7 },
  lava: { fields: 1, volcanoes: 2, ash: 0.6, glass: 0.3 },
  ocean: { islands: 1, volcano: 1.6, reef: 0.3, deep: 0.5 },
  rock: { plains: 0.6, mesas: 1.2, badlands: 1.6, craters: 1 },
};

// the family's biomes with no relief and no scatter (their islands and
// craters are placed on a plane), each with its roughness
export function roundBiomes(family) {
  const rough = ROUND_ROUGH[family];
  if (!rough) throw new Error(`No round ground for ${family}.`);
  return TYPE_BIOMES[family].map(({ id, at, reach, base }) => ({ id, at: [...at], reach, base, rough: rough[id], relief: [] }));
}

const between = (rnd, [a, b]) => a + rnd() * (b - a);

export function expand(biomes, seed) {
  return biomes.map((x, i) => {
    if (!x.scatter) return x;
    const { count, spread, r, height, core = 0.25, ragged = 0.35, rim = 0, crater = 0 } = x.scatter;
    const rnd = seeded((seed | 0) ^ Math.imul(i + 1, 0x9e3779b1));
    const relief = [...x.relief];
    for (let k = 0; k < count; k++) {
      const at = [Math.round((rnd() * 2 - 1) * spread), Math.round((rnd() * 2 - 1) * spread)];
      const rk = Math.round(between(rnd, r));
      const h = Math.round(between(rnd, height));
      // (a crater's lip first: a plateau a third wider, the pit cut into it)
      if (rim) relief.push({ type: 'island', at, r: Math.round(rk * 1.35), height: Math.round(Math.abs(h) * rim), core: 0.7, ragged });
      relief.push({ type: 'island', at, r: rk, height: h, core, ragged });
      // (a volcano's summit crater)
      if (crater) relief.push({ type: 'island', at, r: Math.round(rk * 0.2), height: crater, core: 0.4, ragged: 0.1 });
    }
    const out = { ...x, relief };
    delete out.scatter;
    return out;
  });
}
