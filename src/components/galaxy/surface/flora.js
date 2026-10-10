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

import { REACH } from './terrain';
import { gameRows } from './gameFlora';

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
  },
  // (filled a phase at a time: an empty biome lays nothing)
  temperate: { near: [], cover: [], mid: [], trees: [] },
  conifer: { near: [], cover: [], mid: [], trees: [] },
  jungle: { near: [], cover: [], mid: [], trees: [] },
  swamp: { near: [], cover: [], mid: [], trees: [] },
  tropical: { near: [], cover: [], mid: [], trees: [] },
  dry: { near: [], cover: [], mid: [], trees: [] },
  ash: { near: [], cover: [], mid: [], trees: [] },
  tundra: { near: [], cover: [], mid: [], trees: [] },
  // Coruscant, Kamino, Bespin: no ground to grow on
  none: { near: [], cover: [], mid: [], trees: [] },
};

const biomeOf = (site) => (site?.flora ? (BIOMES[site.flora.biome] ?? null) : null);

export function floraRows(site) {
  const biome = biomeOf(site);
  if (!biome || site.noGround) return [];
  const density = site.flora.density ?? 1;
  const count = { ...COUNT, ...(biome.count ?? {}) };
  const reach = site.reach ?? REACH;
  const wet = site.water ? { above: ABOVE } : {};
  const rows = [];
  const lay = (band, list, count, within, more = {}) => {
    for (const [name, share, scale] of list) {
      const n = Math.round(count * share * density);
      if (n > 0) rows.push({ band, kind: kindOf(name), model: PACK + name, n, within, scale: scale ?? sizeOf(name), flat: FLAT, ...wet, ...more(name) });
    }
  };
  // (the cover too low to throw a shadow worth its draws)
  const near = biome.near?.length ? NEAR : 0;
  lay('cover', biome.near ?? [], count.cover * near, RINGS.near, () => ({ solid: false, shadow: false }));
  lay('cover', biome.cover, count.cover * (1 - near), RINGS.cover, () => ({ solid: false, shadow: false }));
  lay('mid', biome.mid, count.mid, RINGS.mid, () => ({ solid: true }));
  if (site.flora.trees !== false) {
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
  return Object.keys(tint).length ? tint : null;
}

export function floraNames(rows) {
  const names = new Set();
  for (const r of rows) if (typeof r.model === 'string' && r.model.startsWith(PACK)) names.add(r.model.slice(PACK.length));
  return names;
}
