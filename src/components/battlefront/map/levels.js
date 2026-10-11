// The game's levels as the game world loads them (lane G2): each level key
// (the game's own, `hoth_01`) to its world, the map it was built from and
// the folder of its whole pack (scripts/bf2017-level.mjs --whole:
// levels/<world>/game/<key>/), and which of a whole pack's mode layers a
// mode draws. A whole pack lists the meshes only a mode layer places
// (level.json's `modeOnly`); a mode hides the other modes' own props, and
// the actors and vehicles they stand. Pure.
//
//   LEVELS: { [key]: { world, map } }
//   levelKeyOf(levelOrWorld) → a level key ('hoth' → 'hoth_01'); null for none
//   wholePackOf(key) → 'hoth/game/hoth_01' | null
//   layerShown(layer, mode) → whether a mode draws that layer's own things
//   hiddenFor(pack, mode) → the mesh indices a mode hides (none for no mode,
//     or a pack that is not whole)

export const LEVELS = {
  // the nine Galactic Assault levels
  hoth_01: { world: 'hoth', map: 'levels/mp/hoth_01' },
  endor_01: { world: 'endor', map: 'levels/mp/endor_01' },
  tatooine_01: { world: 'tatooine', map: 'levels/mp/tatooine_01' },
  yavin_01: { world: 'yavin', map: 'levels/mp/yavin_01' },
  kashyyyk_01: { world: 'kashyyyk', map: 'levels/mp/kashyyyk_01' },
  kamino_01: { world: 'kamino', map: 'levels/mp/kamino_01' },
  naboo_01: { world: 'naboo', map: 'levels/mp/naboo_01' },
  geonosis_01: { world: 'geonosis', map: 's5_1/levels/mp/geonosis_01' },
  deathstar02_01: { world: 'deathstar', map: 'levels/mp/deathstar02_01' },
  // the small modes'
  naboo_02: { world: 'naboo', map: 'levels/mp/naboo_02' },
  cloudcity_01: { world: 'bespin', map: 's2/levels/cloudcity_01' },
  jabbaspalace_01: { world: 'tatooine', map: 's2_2/levels/jabbaspalace_01' },
  kessel_01: { world: 'kessel', map: 's3/levels/kessel_01' },
  endor_02: { world: 'endor', map: 's2_1/levels/endor_02' },
  endor_04: { world: 'endor', map: 's8_1/endor_04' },
  // Supremacy's and Co-op's
  hoth_02: { world: 'hoth', map: 's9_3/hoth_02' },
  tatooine_02: { world: 'tatooine', map: 's9_3/tatooine_02' },
  naboo_03: { world: 'naboo', map: 's7_2/levels/naboo_03' },
  kashyyyk_02: { world: 'kashyyyk', map: 's7/levels/kashyyyk_02' },
  kamino_03: { world: 'kamino', map: 's7_1/levels/kamino_03' },
  geonosis_02: { world: 'geonosis', map: 's6_2/geonosis_02/levels/geonosis_02' },
  felucia_01: { world: 'felucia', map: 's8/felucia/levels/mp/felucia_01' },
  scarif_02: { world: 'scarif', map: 's9_3/scarif/levels/mp/scarif_02' },
};

export function levelKeyOf(level) {
  if (!level) return null;
  const k = String(level).toLowerCase();
  if (LEVELS[k]) return k;
  // (a world's first: the rulebook's short name, `hoth`)
  return Object.keys(LEVELS).find((key) => LEVELS[key].world === k) ?? null;
}

export const wholePackOf = (key) => (LEVELS[key] ? `${LEVELS[key].world}/game/${key}` : null);

// each mode's own layers (the spec's mode catalogue; Explore is the level as
// Galactic Assault dresses it); a layer no mode names is every mode's
const MODE_LAYERS = {
  galacticAssault: ['fantasybattle', 'fb_'],
  explore: ['fantasybattle', 'fb_'],
  hvv: ['heroarena', 'heroesvsvillains'],
  blast: ['teamdeathmatch', 'smallmodesprops'],
  arcade: ['teamdeathmatch', 'smallmodesprops'],
  strike: ['planetarymissions', 'domination', 'smallmodesprops'],
  showdown: ['mode6', 'smallmodesprops'],
  coop: ['mode9', 'modedefend'],
  supremacy: ['mode1', 'mode8'],
  extraction: ['extraction', 'mode5', 'mode2'],
  ewokHunt: ['mode3'],
  jetpackCargo: ['modec'],
};
const owns = (prefix, layer) => layer === prefix || layer.startsWith(prefix.endsWith('_') ? prefix : `${prefix}_`);
const named = (layer) => Object.values(MODE_LAYERS).some((list) => list.some((p) => owns(p, layer)));

export function layerShown(layer, mode) {
  if (!layer || !mode || !MODE_LAYERS[mode]) return true;
  const l = String(layer).toLowerCase();
  return !named(l) || MODE_LAYERS[mode].some((p) => owns(p, l));
}

export function hiddenFor(pack, mode) {
  if (!pack?.whole || !pack.modeOnly || !mode) return [];
  const shown = new Set();
  const hide = new Set();
  for (const [layer, meshes] of Object.entries(pack.modeOnly)) for (const m of meshes) (layerShown(layer, mode) ? shown : hide).add(m);
  return [...hide].filter((m) => !shown.has(m)).sort((a, b) => a - b);
}
