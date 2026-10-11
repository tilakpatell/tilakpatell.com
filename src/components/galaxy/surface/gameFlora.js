// The drop's own cover for the worlds with no game map that have room for
// more (the fifth design, lane O): Mandalore's mud rocks, Sorgan's
// undergrowth, Lothal's mud rocks. Each is a recipe of objects from the
// drop's library (catalog/bf2017-library.js, `game:<name>`), by world and
// biome as the design names them, written as scatter rows the placer
// already draws (instanced, its light cut far off), added after the site's
// own rows and its flora's: the recipe adds, never replaces, and so it
// draws on high and up only (placer.js), the phones keeping their budgets.
// A world near its budget wears the game's models on its own rows instead
// (Dagobah's ferns, logs and rocks, Mustafar's and Nevarro's stones:
// sites/), which costs no draw. (The drop's roots, ferns, bones and scrap
// carry no maps of their own, the game's terrain shades them: they are
// left out.) A site names a recipe in its flora block,
// `flora: { …, game: 'badlands' }`.
//
//   RECIPES: { [recipe]: [[game name, { band, n, within, scale, solid?,
//     shadow?, sink? }]…] } (`band` as flora.js's: cover, mid or trees)
//   gameRows(site, models) → the rows (kind 'game'); an object not
//     published yet (not in `models`) is skipped, so a pending import lays
//     nothing rather than a warning a frame
//   recipeNames(recipe) → the game names a recipe lays (the sites test
//     holds every one to the library's index and the published book)

import { SURFACE_MODELS } from './catalog';

const COVER = { band: 'cover', solid: false, shadow: false };
const MID = { band: 'mid', solid: true };

export const RECIPES = {
  // Mandalore's glassed badlands: the desert's mud rocks, the canyon's
  // stones, the rancor pit's boulders
  badlands: [
    ['game:objects/nature/desert/desertcanyon/_meshscattering/ms_desertcanyon_rock_03/ms_desertcanyon_rock_03_mesh', { ...COVER, n: 90, within: [8, 220], scale: [0.5, 1.1] }],
    ['game:objects/nature/desert/_desertbase/desertbase_rockmudrockmedium_01/desertbase_rockmudrockmedium_01_mesh', { ...MID, n: 60, within: [12, 420], scale: [0.8, 2.2], sink: 0.15 }],
    ['game:objects/nature/desert/jabbaspalace/rancorpit_rocks_01/rancorpit_cave_rockmedium_04_mesh', { ...MID, n: 30, within: [20, 460], scale: [0.8, 1.6], sink: 0.2 }],
  ],
  // Sorgan's woods: Yavin's small bushes and Kashyyyk's small scheffleras
  // under the built firs (its rocks are the forest's: sites/outer.js)
  woods: [
    ['game:objects/nature/yavin/_yavinbase/_meshscattering/ms_yavinbase_smallbush_07/ms_yavinbase_smallbush_07_mesh', { ...COVER, n: 120, within: [6, 160], scale: [0.8, 1.3] }],
    ['game:objects/nature/kashyyyk/_kashyyykbase/_meshscattering/ms_kashyyykbase_schefflerabush_01/ms_kashyyykbase_schefflerabush_s_01_mesh', { ...MID, n: 40, within: [10, 320], scale: [0.8, 1.3], solid: false }],
  ],
  // Lothal's prairie: the desert's mud rocks out in the grass (the Empire's
  // cargo about its towns is the game's crates: catalog/bf2017-game-for.js)
  'plains-imperial': [
    ['game:objects/nature/desert/_desertbase/desertbase_rockmudrockmedium_01/desertbase_rockmudrockmedium_01_mesh', { ...MID, n: 30, within: [16, 420], scale: [0.8, 1.8], sink: 0.15 }],
  ],
};

const SINK = (o) => (o.sink != null ? { sink: o.sink } : {});

export function gameRows(site, models = SURFACE_MODELS) {
  const recipe = RECIPES[site?.flora?.game];
  if (!recipe || site.noGround) return [];
  const density = site.flora.density ?? 1;
  return recipe
    .filter(([name]) => models[name])
    .map(([name, o]) => ({ band: o.band, kind: 'game', model: name, n: Math.round(o.n * density), within: o.within, scale: o.scale, solid: o.solid ?? true, flat: 0.86, ...(o.shadow === false ? { shadow: false } : {}), ...SINK(o) }));
}

export const recipeNames = (recipe) => (RECIPES[recipe] ?? []).map(([name]) => name);
