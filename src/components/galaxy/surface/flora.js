// A world's cover, its middle layer and (where no built species stands)
// its trees, from the nature kit (public/kit/naturemega/, Quaternius's
// Stylized Nature MegaKit), by a recipe and not a hand list. A site says
// what it is in a `flora` block:
//
//   flora: { biome: 'plains', tint: { Grass: '#c6ad72' }, density: 1, trees: true }
//
// and the recipe writes the scatter rows the placer already draws (its
// own shape: { kind, n, within, scale, solid, model: 'kit:naturemega/
// <Name>', flat, above?, clear?, canopy? }), so nothing downstream changes:
// instanced, its LOD1 far off, its shadow only near you (near.js), the
// tier's `amounts.scatter` scaling every n. The recipe adds and never
// replaces: a site's own rows, its landmarks and its places stay as they
// are, and the scene keeps every row off the places as it always has
// (`clear` on a tree row: 25 m, so a toy-like crown never stands beside a
// scanned wall). (docs/superpowers/specs/2026-10-09-galaxy-surfaces-
// living-layer-design.md, 1)
//
//   BIOMES: { [biome]: { near, cover, mid, trees: [[Name, share, scale?]…],
//     count?: { cover?, mid?, trees? }, tint? } } (a share is the model's
//     part of its list's count, `count` a band's own where it isn't the
//     usual; a list's shares sum to one; `near` is the cover laid only
//     inside 60 m)
//   floraRows(site) → the rows, none for a world with no ground or no flora
//   floraTint(site) → { [material name]: colour | { recolour } } | null: the
//     biome's defaults under the site's own, for the placer's kit (kitTint:
//     lib/three/kit's tint, a multiplier or a recolour)
//   floraNames(rows) → the kit models a row list names (the sites test
//     holds every one to the manifest)
//   `flora.game`: a recipe of the drop's own objects (gameFlora.js), laid
//     after the kit's (biome 'none' for a world that wants only those)
//   livingOn(site), livingRows(site) → { near, cover, mid, trees } | null: a
//     biome's `living` recipe ([Name, per100, more?] a band), streamed
//     round you a tile at a time (living.js), in place of the cover, the
//     kit's bushes and the trees floraRows would lay once
//     (docs/superpowers/specs/2026-10-20-galaxy-living-free-roam-design.md, 1)
//   airOf(site) → { weather, song, flocks }: a biome's `air`, its flocks
//     ([{ at, count, size, colour, height, radius, speed, seed }]), its
//     birdsong and its pollen

import { REACH } from './terrain';
import { gameRows } from './gameFlora';
import { NATURE } from './nature';

const PACK = 'kit:naturemega/';

// How many a band lays at density 1 (spec 1: cover about one every 12 m²
// inside 60 m, thinning to one every 60 m² by 160 m; mid one every 400 m²;
// trees one every 2,000 m²). The scene's scatter is even over a row's
// ring, so the cover thins by what it is: the small things (flowers,
// petals, toadstools) only inside 60 m, 45% of the count, and the rest
// out to 160 m. Each model is one row, as each row is its own draws.
const COUNT = { cover: 2200, mid: 300, trees: 120 };
const NEAR = 0.45;
const RINGS = { near: [4, 60], cover: [4, 160], mid: [20, 320], trees: [60, 560] };
const FLAT = 0.86; // (the ground's normal at least this upright: never on a cliff)
const ABOVE = 0.4; // (metres over the water, where the world has some)
const CLEAR = 25; // (metres a tree keeps from a place's flat)
// The band round a place: 90 m wide past its flat, its cover one an 70 m²
// and its mid one an 500 m², for the first four places past 150 m of the
// landing (nearer, the landing's own rings reach it)
const PLACE = { band: 90, cover: 70, mid: 500, skip: 150, most: 4 };

// The kit's sizes, by family. Quaternius made its plants big (a flower
// two metres tall, a clover a metre): scaled here so a grass clump comes to
// the knee and a flower below the hip of someone 1.8 m tall. A row may say
// its own as the third item of its entry.
const SIZE = [
  ['Grass_', [0.35, 0.6]],
  ['Clover_', [0.25, 0.4]],
  ['Flower_', [0.3, 0.45]],
  ['Petal_', [0.8, 1.2]],
  ['Pebble_', [0.8, 1.8]],
  ['RockPath_', [0.8, 1.2]],
  ['Fern_', [0.8, 1.4]],
  ['Plant_', [0.5, 0.9]],
  ['Mushroom_', [0.4, 0.8]],
  ['Bush_Large', [0.6, 1]],
  ['Bush_', [0.8, 1.3]],
  ['Rock_Big', [0.6, 1.3]],
  ['Rock_', [0.5, 1.2]],
  ['CommonTree_', [1.1, 1.6]],
  ['Birch_', [0.8, 1.2]],
  ['Pine_', [1.2, 1.9]],
  ['DeadTree_', [0.8, 1.3]],
  ['TwistedTree_', [0.8, 1.2]],
];
// (the game's rocks, a metre or so as they come: knee-high to a man's height)
const GAME_ROCK = [0.8, 2.4];
const sizeOf = (name) => SIZE.find(([p]) => name.startsWith(p))?.[1] ?? [1, 1];

// The kind a row stands in for when the kit won't load (the placer builds
// it, if SCATTER has it): a fern, a rock, a bush, a plant, the stones; else
// the model's family, which builds nothing.
const BUILT = [
  ['Fern_', 'fern'],
  ['Rock_', 'rock'],
  ['Bush_', 'bush'],
  ['Plant_', 'plant'],
  ['Pebble_', 'stones'],
  ['Grass_', 'grassclump'],
];
const kindOf = (name) => BUILT.find(([p]) => name.startsWith(p))?.[1] ?? name.replace(/_.*$/, '').toLowerCase();

// The ground map's shade under a tree's crown (groundPaint.js), metres at
// scale 1; a dead tree has no crown.
const CANOPY = { CommonTree: 3.5, Birch: 3, Pine: 2.5, DeadTree: 0, TwistedTree: 3.5 };

export const BIOMES = {
  // Naboo's lake country, Lothal's prairie: grass clumps, clover and
  // flowers, bushes and the odd rock, groves of broad trees
  plains: {
    // (fourteen kinds, not twenty: each kind is its own draws, a part a
    // band and its near shadows, and Naboo's townsfolk already spend most
    // of its calls; the count is the same, spread over fewer kinds)
    near: [
      ['Grass_Wide_Short', 0.34],
      ['Clover_1', 0.22],
      ['Flower_2_Single', 0.16],
      ['Flower_7_Single', 0.14],
      ['Petal_3', 0.14],
    ],
    cover: [
      ['Grass_Wispy_Tall', 0.45],
      ['Grass_Common_Short', 0.4],
      ['Pebble_Round_2', 0.15],
    ],
    mid: [
      ['Bush_Common', 0.45],
      ['Bush_Common_Flowers', 0.3],
      ['Rock_Medium_1', 0.25],
    ],
    trees: [
      ['CommonTree_1', 0.35],
      ['CommonTree_2', 0.35],
      ['CommonTree_5', 0.3],
    ],
    // (the kit painted its common bush's leaves autumn red: a meadow's are green)
    tint: { Leaves_TwistedTree: { recolour: '#587a34' } },
    // (the air: flocks over the places, birdsong, pollen over the meadows)
    air: { flocks: { n: 3, count: 12 }, song: 0.6, pollen: '#fff1c4' },
    // (streamed round you, living.js: per 100 m²)
    living: {
      near: [
        ['Grass_Common_Short', 14.4, { clump: 8, scale: [0.45, 0.75] }],
        ['Grass_Wide_Short', 3.6],
        ['Petal_3', 5.4],
        ['Flower_2_Single', 2.7],
        ['Clover_1', 2.2],
      ],
      cover: [
        ['Grass_Common_Short', 1.6],
        ['Grass_Wide_Short', 1],
        ['Grass_Wispy_Tall', 0.6],
        ['Clover_1', 0.9],
        ['Flower_2_Single', 0.7],
        ['Flower_7_Single', 0.5],
        ['Petal_3', 0.6],
        ['Pebble_Round_2', 0.3],
      ],
      mid: [
        ['Bush_Common', 0.2],
        ['Bush_Common_Flowers', 0.12],
        ['Bush_Large', 0.03],
      ],
      trees: [
        ['CommonTree_1', 0.05],
        ['CommonTree_2', 0.05],
        ['CommonTree_5', 0.04],
      ],
    },
  },
  // (the rest as the living layer's design lists them, its table at
  // docs/superpowers/specs/2026-10-09-galaxy-surfaces-living-layer-design.md:
  // what each lays, band by band; a world tints them to its own ground. Their
  // rocks are the game's scanned ones, nature.js, not the kit's faceted
  // boulders: up close one of those beside a scanned wall shows the style
  // clash the design warns of)
  // Sorgan's woods, Tython's and Lah'mu's grass: ferns, clover and toadstools
  // in the grass, big bushes and rocks, birches and pines
  temperate: {
    near: [
      ['Clover_1', 0.35],
      ['Fern_1', 0.35],
      ['Mushroom_Common', 0.3],
    ],
    cover: [
      ['Grass_Common_Short', 0.45],
      ['Grass_Common_Tall', 0.35],
      ['Pebble_Round_3', 0.2],
    ],
    mid: [
      ['Bush_Large', 0.55],
      [NATURE.rock, 0.45],
    ],
    trees: [
      ['Birch_2', 0.5],
      ['Pine_4', 0.5],
    ],
    air: { flocks: { n: 3, count: 10 }, song: 0.7, pollen: '#f4f0d4' },
    living: {
      near: [
        ['Grass_Common_Short', 12.6, { clump: 8, scale: [0.45, 0.75] }],
        ['Clover_1', 3.6],
        ['Fern_2', 3.6],
        ['Petal_3', 2.7],
        ['Mushroom_Common', 0.5],
      ],
      cover: [
        ['Grass_Common_Short', 1.5],
        ['Grass_Common_Tall', 0.9],
        ['Clover_1', 0.8],
        ['Fern_1', 0.6],
        ['Flower_2_Single', 0.4],
        ['Mushroom_Common', 0.25],
        ['Pebble_Round_3', 0.3],
      ],
      mid: [
        ['Bush_Large', 0.1],
        ['Bush_Long_1', 0.12],
      ],
      trees: [
        ['Birch_2', 0.04],
        ['Pine_4', 0.06],
      ],
    },
  },
  // Endor's floor: ferns and toadstools, a dead tree here and there under the
  // built redwoods
  conifer: {
    near: [
      ['Mushroom_Common', 0.35],
      ['Mushroom_RedCap', 0.25],
      ['Plant_3', 0.4],
    ],
    cover: [
      ['Fern_1', 0.5],
      ['Fern_2', 0.3],
      ['Pebble_Round_1', 0.2],
    ],
    mid: [
      ['Bush_Large', 0.5],
      [NATURE.rock, 0.5, [1, 2.8]],
    ],
    trees: [['DeadTree_3', 1]],
    count: { trees: 40 },
    air: { flocks: { n: 2, count: 8 }, song: 0.6 },
    living: {
      near: [
        ['Fern_2', 7.2],
        ['Fern_1', 3.6],
        ['Plant_3', 1.8],
        ['Mushroom_RedCap', 0.7],
      ],
      cover: [
        ['Fern_1', 1.2],
        ['Fern_2', 0.8],
        ['Plant_3', 0.5],
        ['Mushroom_Common', 0.3],
        ['Mushroom_RedCap', 0.2],
        ['Pebble_Round_1', 0.3],
      ],
      mid: [['Bush_Large', 0.15]],
      trees: [['DeadTree_3', 0.015]],
    },
  },
  // Yavin's and Morak's undergrowth: ferns and broad plants, long bushes,
  // mossed rocks, a few twisted trees
  jungle: {
    near: [
      ['Clover_2', 0.35],
      ['Mushroom_Oyster', 0.25],
      ['Plant_5', 0.4],
    ],
    cover: [
      ['Fern_1', 0.3],
      ['Plant_1_Big', 0.25],
      ['Plant_2_Big', 0.25],
      ['Plant_4', 0.2],
    ],
    mid: [
      ['Bush_Long_1', 0.6],
      [NATURE.rock, 0.4, [1, 2.8]],
    ],
    trees: [
      ['TwistedTree_1', 0.5],
      ['TwistedTree_3', 0.5],
    ],
    count: { trees: 60 },
    air: { flocks: { n: 2, count: 14, colour: '#3a2e24' }, song: 0.45, pollen: '#dcf5a8' },
    living: {
      near: [
        ['Fern_2', 7.2],
        ['Clover_2', 3.6],
        ['Plant_5', 2.7],
        ['Plant_4', 1.8],
      ],
      cover: [
        ['Fern_1', 1.2],
        ['Clover_2', 0.6],
        ['Plant_4', 0.5],
        ['Plant_5', 0.5],
        ['Plant_1_Big', 0.4],
        ['Plant_2_Big', 0.4],
        ['Mushroom_Oyster', 0.15],
      ],
      mid: [
        ['Bush_Long_1', 0.3],
        ['Bush_Large', 0.12],
      ],
      trees: [
        ['TwistedTree_1', 0.025],
        ['TwistedTree_3', 0.025],
      ],
    },
  },
  // Dagobah's: fungus on the roots, low plants, dead and twisted trees
  swamp: {
    near: [
      ['Mushroom_Laetiporus', 0.4],
      ['Mushroom_Oyster', 0.6],
    ],
    cover: [
      ['Plant_2', 0.4],
      ['Plant_6', 0.3],
      ['Fern_2', 0.3],
    ],
    mid: [[NATURE.stone, 1]],
    trees: [
      ['DeadTree_1', 0.5],
      ['TwistedTree_2', 0.5],
    ],
    count: { trees: 60 },
    air: { flocks: { n: 1, count: 6 }, song: 0.15 },
    living: {
      near: [
        ['Plant_2', 3.6],
        ['Plant_6', 3.6],
        ['Fern_2', 3.6],
      ],
      cover: [
        ['Plant_2', 0.6],
        ['Plant_6', 0.5],
        ['Fern_2', 0.6],
        ['Mushroom_Oyster', 0.15],
      ],
      mid: [],
      trees: [
        ['DeadTree_1', 0.02],
        ['TwistedTree_2', 0.02],
      ],
    },
  },
  // Scarif's and Pillio's shore: wispy grass, flowers, broad plants and
  // flowering bushes (its palms are its trees)
  tropical: {
    near: [
      ['Flower_7_Single', 0.5],
      ['Pebble_Round_4', 0.5],
    ],
    cover: [
      ['Grass_Wispy_Tall', 0.5],
      ['Grass_Wispy_Short', 0.3],
      ['Plant_1_Big', 0.2],
    ],
    mid: [['Bush_Common_Flowers', 1]],
    trees: [],
    // (gulls, white over the shore)
    air: { flocks: { n: 3, count: 10, colour: '#e8e4dc', size: 0.7 }, song: 0.3 },
    living: {
      near: [
        ['Grass_Wispy_Short', 7.2],
        ['Grass_Common_Short', 7.2, { clump: 8, scale: [0.45, 0.75] }],
        ['Flower_7_Single', 2.7],
      ],
      cover: [
        ['Grass_Wispy_Tall', 1],
        ['Grass_Wispy_Short', 0.8],
        ['Flower_7_Single', 0.5],
        ['Plant_1_Big', 0.3],
        ['Pebble_Round_4', 0.3],
      ],
      mid: [['Bush_Common_Flowers', 0.15]],
      trees: [],
    },
  },
  // Tatooine's and Saleucami's scrub: pebbles, low scrub and dry tufts,
  // rocks and boulders, no trees
  dry: {
    near: [
      ['Pebble_Round_5', 0.4, [3, 6]],
      ['Plant_7', 0.6, [2.5, 4]],
    ],
    cover: [
      ['Plant_7_Big', 0.45, [2, 3.5]],
      ['Grass_Wispy_Short', 0.35],
      ['Pebble_Square_1', 0.2, [3, 6]],
    ],
    // (a scrub bush and the desert's mud rocks)
    mid: [
      ['Bush_Long_1', 0.55, [0.5, 0.9]],
      [NATURE.mudrock, 0.45, [1, 2.8]],
    ],
    trees: [],
    count: { cover: 1800 },
    // (the scrub bush is the kit's long bush, its leaves the broad trees')
    tint: { Leaves: { recolour: '#8a7c4e' }, Leaves_NormalTree: { recolour: '#7a6e44' }, Grass: { recolour: '#b4a070' }, PathRocks: { recolour: '#9a8a6a' } },
    // (a few big birds circling high over the scrub)
    air: { flocks: { n: 1, count: 4, size: 1.1, height: 70, radius: 70 }, song: 0.12 },
    living: {
      near: [
        ['Plant_7', 7.2, { scale: [2.5, 4] }],
        ['Pebble_Round_5', 3.6, { scale: [3, 6] }],
        ['Grass_Wispy_Short', 2.7, { on: 'any' }],
      ],
      cover: [
        ['Plant_7', 1, { scale: [2.5, 4] }],
        ['Plant_7_Big', 0.5, { scale: [2, 3.5] }],
        ['Grass_Wispy_Short', 0.6, { on: 'any' }],
        ['Pebble_Round_5', 0.5, { scale: [3, 6] }],
        ['Pebble_Square_1', 0.3, { scale: [3, 6] }],
      ],
      mid: [['Bush_Long_1', 0.08, { scale: [0.5, 0.9] }]],
      trees: [],
    },
  },
  // Mustafar's and Sullust's: stones near black, the volcano's dark rocks,
  // no plants
  ash: {
    near: [
      ['Pebble_Square_2', 0.5, [3, 6]],
      ['Pebble_Square_4', 0.5, [3, 6]],
    ],
    cover: [
      ['Pebble_Square_1', 0.5, [3, 6]],
      ['Pebble_Square_3', 0.5, [3, 6]],
    ],
    mid: [[NATURE.crater, 1]],
    trees: [],
    count: { cover: 900 },
    tint: { PathRocks: { recolour: '#2c2926' } },
    living: {
      near: [
        ['Pebble_Square_2', 5.4, { scale: [3, 6] }],
        ['Pebble_Square_4', 5.4, { scale: [3, 6] }],
      ],
      cover: [
        ['Pebble_Square_2', 0.6, { scale: [3, 6] }],
        ['Pebble_Square_4', 0.6, { scale: [3, 6] }],
        ['Pebble_Square_1', 0.4, { scale: [3, 6] }],
        ['Pebble_Square_3', 0.4, { scale: [3, 6] }],
      ],
      mid: [],
      trees: [],
    },
  },
  // Hoth's and Mygeeto's, and the grey yards, camps and burnt woods of
  // Corellia, Fondor, Wobani, Eadu and Corvus: nothing green, outcrops of
  // grey rock
  // (no pebbles: on snow they read as dirt, and the design lays none where
  // no ground shows)
  tundra: {
    near: [],
    cover: [],
    mid: [[NATURE.rock, 1, [1, 3]]],
    trees: [],
  },
  // Coruscant, Kamino, Bespin: no ground to grow on
  none: { near: [], cover: [], mid: [], trees: [] },
};

const biomeOf = (site) => (site?.flora ? (BIOMES[site.flora.biome] ?? null) : null);

// How a streamed row of each family lies (living.js, lib/land/cover.js): how
// many stand together and how far apart, whether it keeps to the grass, to
// the woods (1) or to the glades (-1), and the trunk a walker stops at
// (metres at scale 1). A recipe's entry may say its own.
const LIVE = [
  ['Grass_', { clump: 7, spread: 3, on: 'grass' }],
  ['Clover_', { clump: 5, spread: 2.5, on: 'grass' }],
  ['Flower_', { clump: 6, spread: 2.5, on: 'grass', woods: -0.6 }],
  ['Petal_', { clump: 4, spread: 2, on: 'grass' }],
  ['Pebble_', { clump: 3, spread: 2.5 }],
  ['Fern_', { clump: 5, spread: 3, woods: 0.5 }],
  ['Mushroom_', { clump: 4, spread: 1.5, woods: 0.8 }],
  ['Plant_', { clump: 4, spread: 3, woods: 0.3 }],
  ['Bush_Large', { clump: 2, spread: 5, solid: 1 }],
  ['Bush_', { clump: 3, spread: 4, woods: 0.4 }],
  ['', { clump: 3, spread: 10, woods: 1, solid: 0.45 }],
];
const liveOf = (name) => LIVE.find(([p]) => name.startsWith(p))[1];

// What's in a world's air from its biome: its flocks, over its places and
// off the landing (lib/three/birds, two draws a flock: flocks.js), its
// birdsong (sounds.js's `song`, 0…1) and its pollen (weather.js's), unless
// the sky is already busy with sand, snow, rain, ash or motes.
const FLOCK = { count: 10, size: 0.5, colour: '#2a2622', height: 34, radius: 45, speed: 9 };
const BUSY = new Set(['sand', 'snow', 'rain', 'ash', 'motes', 'pollen']);

export function airOf(site) {
  const air = biomeOf(site)?.air;
  if (!air || site.noGround) return { weather: [], song: 0, flocks: [] };
  const busy = (site.weather ?? []).some((w) => BUSY.has(w.kind));
  const land = site.land?.at ?? [0, 0];
  // (the first off the landing, the rest over the places, each a little off its middle)
  const spots = [[land[0] + 70, land[1] - 50], ...(site.places ?? []).map((p, i) => [p.at[0] + (i % 2 ? 30 : -30), p.at[1] + 25])];
  const { n = 0, ...look } = air.flocks ?? {};
  const seed = site.ground?.seed ?? 1;
  const flocks = spots.slice(0, n).map((at, i) => ({ ...FLOCK, ...look, at, height: (look.height ?? FLOCK.height) + (i % 3) * 6, seed: seed * 31 + i * 7 }));
  return { weather: air.pollen && !busy ? [{ kind: 'pollen', color: air.pollen }] : [], song: air.song ?? 0, flocks };
}

// whether a world's cover, bushes and trees stream round you (living.js) in
// place of the rings the scene lays once: a biome with a living recipe, on
// ground of its own (a world on the game's level has the game's own
// scatter, and `flora.living: false` keeps the rings)
export const livingOn = (site) => {
  const biome = biomeOf(site);
  return Boolean(biome?.living && site.flora.living !== false && !site.noGround && !site.level);
};

// the streamed rows, band by band: { near, cover, mid, trees } of { model, kind,
// per100, clump, spread, scale, on?, woods?, solid?, canopy?, above?,
// clear? } (null where nothing streams); a site's `flora.density` scales
// every per100, and `trees: false` lays none
export function livingRows(site) {
  if (!livingOn(site)) return null;
  const { living } = biomeOf(site);
  const density = site.flora.density ?? 1;
  const wet = site.water ? { above: ABOVE } : {};
  const rows = (band, list) =>
    list.map(([name, per100, more = {}]) => {
      const canopy = band === 'trees' ? CANOPY[name.replace(/_.*$/, '')] : 0;
      return { band, kind: kindOf(name), model: PACK + name, per100: per100 * density, scale: sizeOf(name), ...liveOf(name), ...(canopy ? { canopy } : {}), ...(band === 'trees' ? { clear: CLEAR } : {}), ...wet, ...more };
    });
  return { near: rows('near', living.near ?? []), cover: rows('cover', living.cover), mid: rows('mid', living.mid), trees: site.flora.trees === false ? [] : rows('trees', living.trees) };
}

export function floraRows(site) {
  const biome = biomeOf(site);
  if (!biome || site.noGround) return [];
  // (streamed instead: the cover, the kit's bushes and the trees; the game's
  // rocks and the drop's own stay rows)
  const live = livingOn(site);
  const density = site.flora.density ?? 1;
  const count = { ...COUNT, ...(biome.count ?? {}) };
  const reach = site.reach ?? REACH;
  const wet = site.water ? { above: ABOVE } : {};
  const rows = [];
  const lay = (band, list, count, within, more = {}) => {
    for (const [name, share, scale] of list) {
      const n = Math.round(count * share * density);
      // (a game's rock as it is, over the built rock: nature.js)
      const game = name.startsWith('game:');
      if (n > 0) rows.push({ band, kind: game ? 'rock' : kindOf(name), model: game ? name : PACK + name, n, within, scale: scale ?? (game ? GAME_ROCK : sizeOf(name)), flat: FLAT, ...wet, ...more(name) });
    }
  };
  // (the cover too low to throw a shadow worth its draws)
  const near = biome.near?.length ? NEAR : 0;
  // (each of the game's rocks its count as it was)
  const mid = live ? biome.mid.filter(([name]) => name.startsWith('game:')) : biome.mid;
  if (!live) lay('cover', biome.near ?? [], count.cover * near, RINGS.near, () => ({ solid: false, shadow: false }));
  if (!live) lay('cover', biome.cover, count.cover * (1 - near), RINGS.cover, () => ({ solid: false, shadow: false }));
  lay('mid', mid, count.mid, RINGS.mid, () => ({ solid: true }));
  // (and round each place out past the landing's rings, where its landmark
  // stands: a band of the cover and the mid outside its flat, which the
  // scene keeps clear, so a building stands in its world's ground and not
  // on a bare patch)
  for (const p of (site.places ?? []).filter((p) => Math.hypot(...p.at) > PLACE.skip).slice(0, PLACE.most)) {
    const r0 = p.flat?.r ?? p.r * 0.6;
    const within = [r0, r0 + PLACE.band];
    const area = Math.PI * (within[1] ** 2 - r0 ** 2);
    const at = { at: p.at };
    if (!live) lay('cover', biome.cover, area / PLACE.cover, within, () => ({ ...at, solid: false, shadow: false }));
    lay('mid', mid, area / PLACE.mid, within, () => ({ ...at, solid: true }));
  }
  if (site.flora.trees !== false && !(live && biome.living.trees.length)) {
    const within = [RINGS.trees[0], Math.min(RINGS.trees[1], reach)];
    lay('trees', biome.trees, count.trees, within, (name) => {
      const canopy = CANOPY[name.replace(/_.*$/, '')];
      return { solid: true, clear: CLEAR, ...(canopy ? { canopy } : {}) };
    });
  }
  // (and the drop's own, by the site's `game` recipe: gameFlora.js)
  return [...rows, ...gameRows(site).map((r) => ({ ...r, ...wet, ...(r.band === 'trees' ? { clear: CLEAR } : {}) }))];
}

export function floraTint(site) {
  const biome = biomeOf(site);
  if (!biome) return null;
  const tint = { ...(biome.tint ?? {}), ...(site.flora.tint ?? {}) };
  // (the pebbles, the kit's path stones, take a world's rock colour unless
  // it gives them their own)
  if (site.flora.tint?.Rocks && !site.flora.tint.PathRocks) tint.PathRocks = site.flora.tint.Rocks;
  return Object.keys(tint).length ? tint : null;
}

export function floraNames(rows) {
  const names = new Set();
  for (const r of rows) if (typeof r.model === 'string' && r.model.startsWith(PACK)) names.add(r.model.slice(PACK.length));
  return names;
}
