// What grows along each stage, by the nature kit’s names
// (public/kit/naturemega/index.json): a row a model, `per100` items a
// hundred square metres, in clumps of `clump` spread over `spread` metres,
// off slopes steeper than `slope`, sized between `scale`’s two, `kind:
// 'grass'` for what low drops and mid thins. `tint` (the kit’s per-material
// colours) recolours a row for its season. Data only: scatter.js places it.
//
// Hobbiton’s is its own (oaks in the hedgerows, the hedges themselves,
// flowers by the lane); the rest stand on three rough sets until their stage
// tasks write theirs.

const GREEN = [
  { model: 'CommonTree_1', per100: 0.035, clump: 3, spread: 9, scale: [0.9, 1.4] },
  { model: 'CommonTree_3', per100: 0.025, clump: 2, spread: 8, scale: [0.9, 1.3] },
  { model: 'Bush_Common', per100: 0.08, clump: 4, spread: 5, scale: [0.9, 1.5] },
  { model: 'Rock_Medium_1', per100: 0.01, clump: 2, spread: 4, scale: [0.6, 1.1] },
];
const ROUGH = [
  { model: 'Pine_1', per100: 0.04, clump: 4, spread: 10, scale: [0.8, 1.3], slope: 0.9 },
  { model: 'Pine_3', per100: 0.03, clump: 3, spread: 9, scale: [0.8, 1.2], slope: 0.9 },
  { model: 'Rock_Big_1', per100: 0.012, clump: 2, spread: 8, scale: [0.6, 1.4], slope: 1.4 },
  { model: 'Rock_Medium_2', per100: 0.03, clump: 3, spread: 5, scale: [0.6, 1.2], slope: 1.4 },
];
const BARE = [
  { model: 'Rock_Medium_3', per100: 0.02, clump: 3, spread: 5, scale: [0.6, 1.2] },
  { model: 'DeadTree_1', per100: 0.006, clump: 2, spread: 8, scale: [0.8, 1.2] },
];

export const SCATTER = {
  hobbiton: [
    // (oaks: the common tree at its broadest, in the hedgerows’ clumps)
    { model: 'CommonTree_1', per100: 0.03, clump: 3, spread: 10, scale: [1.1, 1.6] },
    { model: 'CommonTree_2', per100: 0.02, clump: 2, spread: 8, scale: [1.0, 1.5] },
    // the hedges: long bushes strung close in a line of a clump
    { model: 'Bush_Long_1', per100: 0.12, clump: 6, spread: 6, scale: [1.0, 1.4] },
    { model: 'Bush_Common_Flowers', per100: 0.05, clump: 3, spread: 4, scale: [0.9, 1.3] },
    // (the kit’s flowers stand two metres: a third of that is a cottage border’s)
    { model: 'Flower_3_Group', per100: 0.08, clump: 4, spread: 3, scale: [0.3, 0.45] },
    { model: 'Grass_Common_Tall', per100: 0.4, clump: 6, spread: 3, scale: [0.45, 0.7], kind: 'grass' },
  ],
  'shire-edge': GREEN,
  bree: GREEN,
  weathertop: GREEN,
  ford: ROUGH,
  rivendell: ROUGH,
  caradhras: ROUGH,
  moria: [],
  lorien: GREEN,
  anduin: ROUGH,
  marshes: BARE,
  ithilien: GREEN,
  'cirith-ungol': BARE,
  gorgoroth: BARE,
  'minas-tirith': GREEN,
  havens: BARE,
};
