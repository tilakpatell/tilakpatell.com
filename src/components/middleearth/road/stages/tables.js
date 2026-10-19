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

const CORN = { Grass: { recolour: '#fbe8a8' } };
const HEATH = { Leaves: { recolour: '#6e6a44' } };
const BRACKEN = { Leaves: { recolour: '#a8743a' } };
const GOLD = { Leaves_NormalTree: { recolour: '#d8a23a' }, Leaves_Birch: { recolour: '#e2b84a' } };
// the oaks’ bark a warm brown (the kit’s is a cartoon red-brown), and the
// green stages’ stones and pebbles a warm grey (the kit’s go navy in the shade)
const OAK = { Bark_NormalTree: { recolour: '#6e5a46' }, Rocks: { recolour: '#8e8474' }, PathRocks: { recolour: '#8e8474' } };
// the Lone-lands’ stone warm grey (the kit’s goes a cold purple in the dusk), the Midgewater’s reeds dull
const STONE = { Rocks: { recolour: '#8c8274' }, PathRocks: { recolour: '#8c8274' } };
const REED = { Grass: { recolour: '#6e7044' } };
// the dead stems of the Marshes, Mordor’s black rock, the dune grass bleached by the sea’s wind
const DEAD = { Grass: { recolour: '#7a6e4a' }, Leaves: { recolour: '#5e5638' } };
const BLACK = { Rocks: { recolour: '#2e2a28' }, PathRocks: { recolour: '#2e2a28' }, Bark_DeadTree: { recolour: '#2a2422' } };
const DUNE = { Grass: { recolour: '#b8b07a' } };
// (the holly’s bark grey, as the Trollshaws’: the kit’s oak bark is a red-brown)
const HOLLY = { Leaves_NormalTree: { recolour: '#1f3a1c' }, Leaves: { recolour: '#22401f' }, Bark_NormalTree: { recolour: '#6a6458' } };
const HEATH_GRASS = { Grass: { recolour: '#8a8458' } };
const SNOWED = { Leaves_Pine: { recolour: '#e8eef2' } };
// (the kit’s oak bark is a red-brown: the Trollshaws’ a warm grey, so it isn’t violet under a grey sky)
const AUTUMN = { Leaves_NormalTree: { recolour: '#eeae5c' }, Leaves_Birch: { recolour: '#f2c86a' }, Leaves: { recolour: '#b07a3e' }, Bark_NormalTree: { recolour: '#806c50' } };

export const SCATTER = {
  hobbiton: [
    // (oaks: the common tree at its broadest, in the hedgerows’ clumps)
    { model: 'CommonTree_1', per100: 0.05, clump: 3, spread: 10, scale: [1.1, 1.6], tint: OAK },
    { model: 'CommonTree_2', per100: 0.035, clump: 2, spread: 8, scale: [1.0, 1.5], tint: OAK },
    { model: 'CommonTree_5', per100: 0.02, clump: 2, spread: 7, scale: [1.0, 1.4], tint: OAK },
    // the hedges: long bushes strung close in a line of a clump, some in flower
    { model: 'Bush_Long_1', per100: 0.16, clump: 6, spread: 6, scale: [1.0, 1.4] },
    { model: 'Bush_Common_Flowers', per100: 0.1, clump: 3, spread: 4, scale: [0.9, 1.3] },
    { model: 'Bush_Large_Flowers', per100: 0.03, clump: 2, spread: 4, scale: [0.8, 1.1] },
    // the lane’s borders and the gardens by it: flowers in drifts, clover,
    // herbs (the kit’s flowers stand one and a half to two and a half metres:
    // a third of that is a cottage border’s)
    { model: 'Flower_1_Group', per100: 0.3, clump: 5, spread: 2.5, scale: [0.28, 0.4], x: [-30, 30] },
    { model: 'Flower_2_Group', per100: 0.25, clump: 5, spread: 2.5, scale: [0.28, 0.4], x: [-30, 30] },
    { model: 'Flower_7_Group', per100: 0.25, clump: 4, spread: 2, scale: [0.28, 0.4], x: [-30, 30] },
    { model: 'Flower_4_Group', per100: 0.15, clump: 4, spread: 2, scale: [0.2, 0.3], x: [-30, 30] },
    { model: 'Flower_3_Group', per100: 0.12, clump: 4, spread: 3, scale: [0.3, 0.45] },
    { model: 'Clover_1', per100: 0.8, clump: 6, spread: 2.5, scale: [0.4, 0.7], x: [-26, 26], kind: 'grass' },
    { model: 'Plant_3', per100: 0.2, clump: 4, spread: 2, scale: [0.7, 1.1], x: [-30, 30] },
    { model: 'Plant_6', per100: 0.2, clump: 4, spread: 2, scale: [0.7, 1.0], x: [-30, 30] },
    // stones kicked to the lane’s edges
    { model: 'Pebble_Round_2', per100: 0.8, clump: 5, spread: 2, scale: [2, 4], x: [-8, 8], tint: OAK },
    { model: 'Grass_Common_Tall', per100: 0.7, clump: 6, spread: 3, scale: [0.45, 0.7], kind: 'grass' },
    { model: 'Grass_Wispy_Short', per100: 0.5, clump: 6, spread: 3, scale: [0.5, 0.8], x: [-40, 40], kind: 'grass' },
  ],
  'shire-edge': [
    // Maggot’s crop either side of the lane at the stage’s start: ears over
    // the stage’s canopy of corn, a little above a hobbit’s head (the kit’s
    // wheat is red-brown and 1.75 m: recoloured to standing corn in a low sun)
    { model: 'Grass_Wheat', per100: 4, clump: 6, spread: 2.5, scale: [0.7, 0.9], z: [-10, 58], x: [5, 34], tint: CORN },
    { model: 'Grass_Wheat', per100: 4, clump: 6, spread: 2.5, scale: [0.7, 0.9], z: [-10, 58], x: [-34, -5], tint: CORN },
    // the verges: tall grass, clover and the small white flowers of a lane in late summer
    { model: 'Grass_Common_Tall', per100: 2.4, clump: 6, spread: 3, scale: [0.5, 0.8], x: [-24, 24], kind: 'grass' },
    { model: 'Clover_1', per100: 0.6, clump: 5, spread: 2, scale: [0.5, 0.8], x: [-20, 20], kind: 'grass' },
    { model: 'Flower_6', per100: 1.2, clump: 6, spread: 2, scale: [1, 1.4], x: [-18, 18] },
    { model: 'Flower_2_Group', per100: 0.15, clump: 4, spread: 2, scale: [0.25, 0.35], x: [-18, 18] },
    { model: 'Plant_6', per100: 0.2, clump: 4, spread: 2, scale: [0.7, 1.0], x: [-20, 20] },
    // the Woody End: beeches (the common tree at its tallest) over the hollow, ferns and toadstools under them
    { model: 'CommonTree_2', per100: 0.14, clump: 3, spread: 10, scale: [1.3, 1.8], z: [62, 118], tint: OAK },
    { model: 'CommonTree_4', per100: 0.09, clump: 2, spread: 9, scale: [1.2, 1.7], z: [62, 118], tint: OAK },
    { model: 'Fern_1', per100: 0.9, clump: 6, spread: 4, scale: [0.8, 1.3], z: [62, 118], x: [-70, 70] },
    { model: 'Fern_2', per100: 0.6, clump: 5, spread: 3, scale: [0.9, 1.4], z: [62, 118], x: [-50, 50] },
    { model: 'Plant_2', per100: 0.3, clump: 4, spread: 3, scale: [0.8, 1.2], z: [62, 118], x: [-40, 40] },
    { model: 'Mushroom_Laetiporus', per100: 0.03, clump: 2, spread: 1, scale: [0.6, 0.9], z: [62, 118], x: [-30, 30] },
    { model: 'Mushroom_Common', per100: 0.35, clump: 5, spread: 1.5, scale: [0.6, 1], z: [62, 118], x: [-30, 30] },
    { model: 'Mushroom_RedCap', per100: 0.08, clump: 3, spread: 1, scale: [0.5, 0.8], z: [62, 118], x: [-30, 30] },
    { model: 'Bush_Large', per100: 0.05, clump: 2, spread: 5, scale: [0.9, 1.3], z: [62, 118] },
    // the rest of the Eastfarthing
    { model: 'CommonTree_1', per100: 0.02, clump: 3, spread: 9, scale: [0.9, 1.4], tint: OAK },
    { model: 'Bush_Common', per100: 0.06, clump: 4, spread: 5, scale: [0.9, 1.5] },
    // the Brandywine’s banks: reeds and rushes, pebbles at the landing
    { model: 'Grass_Wispy_Tall', per100: 2.2, clump: 8, spread: 4, scale: [0.9, 1.3], z: [118, 182], x: [-80, 80], kind: 'grass' },
    { model: 'Plant_2', per100: 0.5, clump: 5, spread: 3, scale: [0.8, 1.2], z: [118, 182], x: [-60, 60] },
    { model: 'Pebble_Round_2', per100: 1.5, clump: 6, spread: 2, scale: [2, 4], z: [118, 136], x: [-14, 14], tint: OAK },
  ],
  bree: [
    // round the town, outside its hedge, and on Bree-hill: hedgerow trees and long grass
    { model: 'CommonTree_1', per100: 0.03, clump: 3, spread: 9, scale: [1.0, 1.5], tint: OAK },
    { model: 'CommonTree_3', per100: 0.02, clump: 2, spread: 8, scale: [1.0, 1.4], tint: OAK },
    { model: 'Bush_Large', per100: 0.04, clump: 3, spread: 5, scale: [0.9, 1.3] },
    { model: 'Bush_Common', per100: 0.08, clump: 4, spread: 5, scale: [0.9, 1.4] },
    { model: 'Bush_Long_1', per100: 0.1, clump: 6, spread: 6, scale: [1.0, 1.4] },
    { model: 'Grass_Common_Tall', per100: 1.6, clump: 6, spread: 3, scale: [0.6, 0.9], kind: 'grass' },
    { model: 'Fern_1', per100: 0.3, clump: 5, spread: 3, scale: [0.8, 1.2], x: [-60, 60] },
    { model: 'Plant_2', per100: 0.25, clump: 4, spread: 2, scale: [0.8, 1.2], x: [-50, 50] },
    // the road up to the gate: its verges, puddled and trodden
    { model: 'Grass_Wide_Short', per100: 2, clump: 6, spread: 3, scale: [0.6, 0.9], z: [-40, 12], x: [-30, 30], kind: 'grass' },
    { model: 'Pebble_Square_3', per100: 2, clump: 6, spread: 2, scale: [2, 4], z: [-40, 150], x: [-6.5, 6.5], tint: OAK },
    // cottage gardens behind the houses
    { model: 'Bush_Common_Flowers', per100: 0.25, clump: 3, spread: 3, scale: [0.7, 1.0], z: [24, 140], x: [-22, 22] },
    { model: 'Plant_1', per100: 0.5, clump: 4, spread: 2, scale: [0.8, 1.2], z: [24, 140], x: [-22, 22] },
  ],
  weathertop: [
    // the Lone-lands: heath and stone, a thorn or a dead tree, almost nothing tall
    { model: 'Grass_Wispy_Tall', per100: 2, clump: 7, spread: 4, scale: [0.7, 1.1], x: [-90, 90], kind: 'grass' },
    { model: 'Grass_Wispy_Short', per100: 2.4, clump: 7, spread: 4, scale: [0.8, 1.2], x: [-60, 60], kind: 'grass' },
    { model: 'Rock_Medium_1', per100: 0.05, clump: 3, spread: 4, scale: [0.6, 1.3], slope: 1.4, tint: STONE },
    { model: 'Rock_Medium_3', per100: 0.04, clump: 3, spread: 5, scale: [0.6, 1.2], slope: 1.4, tint: STONE },
    { model: 'Rock_Big_2', per100: 0.015, clump: 2, spread: 8, scale: [0.6, 1.2], slope: 1.6, tint: STONE },
    { model: 'DeadTree_2', per100: 0.008, clump: 2, spread: 10, scale: [0.8, 1.2] },
    { model: 'TwistedTree_2', per100: 0.004, clump: 1, spread: 1, scale: [0.6, 0.9] },
    { model: 'Bush_Common', per100: 0.1, clump: 4, spread: 5, scale: [0.6, 1.0], tint: HEATH },
    { model: 'Fern_2', per100: 0.35, clump: 6, spread: 4, scale: [0.9, 1.3], x: [-80, 80], tint: BRACKEN },
    { model: 'Rock_Medium_2', per100: 0.06, clump: 4, spread: 4, scale: [0.4, 0.9], x: [-50, 50], slope: 1.4, tint: STONE },
    { model: 'Pebble_Square_2', per100: 0.8, clump: 6, spread: 2.5, scale: [2.5, 5], x: [-20, 20], tint: STONE },
    // the Midgewater at the stage’s start: reeds over the wet ground
    { model: 'Grass_Wide_Tall', per100: 3, clump: 8, spread: 4, scale: [0.9, 1.3], z: [-40, 50], x: [-120, 120], kind: 'grass', tint: REED },
    { model: 'Pebble_Round_4', per100: 1, clump: 5, spread: 2, scale: [2, 4], x: [-8, 8], tint: STONE },
  ],
  ford: [
    // the Trollshaws: grey autumn woods on broken hills, the leaves turned
    { model: 'CommonTree_3', per100: 0.15, clump: 4, spread: 10, scale: [1.0, 1.5], tint: AUTUMN },
    { model: 'CommonTree_1', per100: 0.05, clump: 3, spread: 9, scale: [1.0, 1.4], tint: AUTUMN },
    { model: 'Birch_2', per100: 0.08, clump: 3, spread: 8, scale: [0.8, 1.1], tint: AUTUMN },
    { model: 'DeadTree_1', per100: 0.008, clump: 2, spread: 8, scale: [0.8, 1.1] },
    { model: 'Pine_1', per100: 0.03, clump: 3, spread: 9, scale: [0.9, 1.3], slope: 0.9 },
    { model: 'Rock_Big_1', per100: 0.012, clump: 2, spread: 8, scale: [0.6, 1.3], slope: 1.4, tint: OAK },
    { model: 'Bush_Common', per100: 0.06, clump: 3, spread: 5, scale: [0.9, 1.4], tint: AUTUMN },
    // the woods’ floor: ferns gone bronze, the grass long, the stones of the rivers’ beds
    { model: 'Fern_2', per100: 0.8, clump: 6, spread: 4, scale: [0.9, 1.4], x: [-60, 60], tint: BRACKEN },
    { model: 'Grass_Wide_Short', per100: 1.6, clump: 6, spread: 3, scale: [0.6, 0.9], x: [-30, 30], kind: 'grass' },
    { model: 'Mushroom_Common', per100: 0.15, clump: 4, spread: 1.5, scale: [0.6, 1], x: [-24, 24] },
    { model: 'Mushroom_RedCap', per100: 0.05, clump: 3, spread: 1, scale: [0.5, 0.8], x: [-24, 24] },
    { model: 'Fern_1', per100: 0.5, clump: 6, spread: 4, scale: [0.8, 1.3], x: [-50, 50], tint: BRACKEN },
    { model: 'Bush_Large', per100: 0.04, clump: 2, spread: 5, scale: [0.9, 1.3], tint: AUTUMN },
    { model: 'Plant_2', per100: 0.2, clump: 4, spread: 3, scale: [0.8, 1.2], x: [-40, 40] },
    { model: 'Pebble_Round_1', per100: 2, clump: 6, spread: 2.5, scale: [2.5, 5], z: [38, 66], x: [-40, 40], tint: OAK },
    { model: 'Pebble_Round_3', per100: 2, clump: 6, spread: 2.5, scale: [2.5, 5], z: [150, 186], x: [-50, 50], tint: OAK },
  ],
  rivendell: [
    // autumn gold on the valley’s trees, pines above on the slopes
    { model: 'CommonTree_5', per100: 0.09, clump: 3, spread: 9, scale: [1.0, 1.5], tint: GOLD },
    { model: 'Birch_3', per100: 0.08, clump: 3, spread: 7, scale: [0.9, 1.2], tint: GOLD },
    { model: 'Fern_1', per100: 0.4, clump: 6, spread: 4, scale: [0.8, 1.2], slope: 1.2 },
    { model: 'Pine_3', per100: 0.04, clump: 4, spread: 9, scale: [0.9, 1.3], slope: 0.9 },
    { model: 'Rock_Medium_2', per100: 0.02, clump: 3, spread: 5, scale: [0.6, 1.2], slope: 1.4, tint: OAK },
    // the gardens: flowering bushes, beds of flowers, the lawns kept short
    { model: 'Bush_Common_Flowers', per100: 0.12, clump: 3, spread: 4, scale: [0.8, 1.2], z: [56, 150], x: [-40, 40] },
    { model: 'Flower_4_Group', per100: 0.35, clump: 4, spread: 2, scale: [0.25, 0.35], z: [56, 150], x: [-30, 30] },
    { model: 'Flower_7_Group', per100: 0.35, clump: 4, spread: 2, scale: [0.3, 0.42], z: [56, 150], x: [-30, 30] },
    { model: 'Flower_1_Group', per100: 0.2, clump: 4, spread: 2, scale: [0.28, 0.38], z: [56, 150], x: [-30, 30] },
    { model: 'Plant_5', per100: 0.15, clump: 3, spread: 2, scale: [0.7, 1.0], z: [40, 150], x: [-30, 30] },
    { model: 'Grass_Common_Short', per100: 2.4, clump: 6, spread: 3, scale: [0.4, 0.6], x: [-40, 40], kind: 'grass' },
    { model: 'Plant_1_Big', per100: 0.15, clump: 3, spread: 2, scale: [0.6, 0.9], z: [40, 60], x: [-30, 30] },
  ],
  caradhras: [
    // Hollin: holly (the common tree, dark and glossy), heath and grey stone on bare hills
    { model: 'CommonTree_3', per100: 0.05, clump: 3, spread: 7, scale: [0.6, 0.9], z: [-40, 46], tint: HOLLY },
    { model: 'Bush_Large', per100: 0.08, clump: 3, spread: 5, scale: [0.8, 1.2], z: [-40, 46], tint: HOLLY },
    { model: 'Grass_Wispy_Short', per100: 2, clump: 7, spread: 4, scale: [0.7, 1.0], z: [-40, 46], x: [-70, 70], kind: 'grass', tint: HEATH_GRASS },
    { model: 'Rock_Medium_1', per100: 0.06, clump: 3, spread: 4, scale: [0.6, 1.3], slope: 1.4 },
    { model: 'Rock_Big_1', per100: 0.02, clump: 2, spread: 8, scale: [0.8, 1.6], slope: 1.6 },
    // the Redhorn’s shoulder: pines under snow, boulders out of the drifts
    { model: 'Pine_1', per100: 0.03, clump: 3, spread: 9, scale: [0.8, 1.2], z: [40, 116], slope: 0.9, tint: SNOWED },
    { model: 'Pine_3', per100: 0.02, clump: 2, spread: 8, scale: [0.7, 1.1], z: [40, 116], slope: 0.9, tint: SNOWED },
    { model: 'Rock_Big_2', per100: 0.03, clump: 2, spread: 7, scale: [0.8, 1.5], z: [40, 116], slope: 1.6 },
    // the lake’s shore: holly again, stones by the water
    { model: 'CommonTree_3', per100: 0.04, clump: 2, spread: 6, scale: [0.6, 0.85], z: [116, 150], tint: HOLLY },
    { model: 'Pebble_Round_3', per100: 1.2, clump: 6, spread: 2.5, scale: [2.5, 5], z: [116, 160], x: [-30, 12] },
  ],
  // (under the mountain nothing; the Dimrill Dale’s heath, stones and a few firs past the East-gate)
  moria: [
    { model: 'Grass_Wispy_Short', per100: 1.6, clump: 7, spread: 4, scale: [0.6, 0.9], z: [130, 200], x: [-60, 60], kind: 'grass', tint: HEATH_GRASS },
    { model: 'Rock_Medium_2', per100: 0.08, clump: 3, spread: 4, scale: [0.6, 1.3], z: [128, 200] },
    { model: 'Pine_3', per100: 0.02, clump: 3, spread: 8, scale: [0.7, 1.1], z: [136, 200], slope: 0.9 },
  ],
  lorien: GREEN,
  anduin: ROUGH,
  // the Dead Marshes: dead reeds and rushes over the pools, rotten stumps, the tussocks between
  marshes: [
    { model: 'Grass_Wide_Tall', per100: 3.2, clump: 9, spread: 4, scale: [0.9, 1.4], x: [-120, 120], kind: 'grass', tint: DEAD },
    { model: 'Grass_Wispy_Tall', per100: 2, clump: 8, spread: 4, scale: [0.8, 1.2], x: [-90, 90], kind: 'grass', tint: DEAD },
    { model: 'DeadTree_3', per100: 0.008, clump: 2, spread: 10, scale: [0.5, 0.8] },
    { model: 'DeadTree_1', per100: 0.01, clump: 3, spread: 8, scale: [0.4, 0.7] },
    { model: 'Plant_7', per100: 0.6, clump: 6, spread: 3, scale: [1.5, 2.5], x: [-60, 60], tint: DEAD },
    { model: 'Rock_Medium_3', per100: 0.02, clump: 3, spread: 5, scale: [0.4, 0.8] },
  ],
  // Ithilien: the garden of Gondor gone wild, cedars and pines, herbs and flowers in the long grass
  ithilien: [
    { model: 'CommonTree_4', per100: 0.08, clump: 3, spread: 10, scale: [1.0, 1.5], tint: OAK },
    { model: 'Pine_2', per100: 0.05, clump: 3, spread: 9, scale: [0.9, 1.3] },
    { model: 'GiantPine_3', per100: 0.008, clump: 1, spread: 1, scale: [0.6, 0.8] },
    { model: 'Bush_Large_Flowers', per100: 0.08, clump: 3, spread: 4, scale: [0.8, 1.2] },
    { model: 'Bush_Common_Flowers', per100: 0.12, clump: 3, spread: 4, scale: [0.8, 1.2] },
    { model: 'Flower_2_Group', per100: 0.3, clump: 5, spread: 2.5, scale: [0.28, 0.4], x: [-40, 40] },
    { model: 'Flower_4_Group', per100: 0.25, clump: 4, spread: 2, scale: [0.2, 0.3], x: [-40, 40] },
    { model: 'Flower_7_Group', per100: 0.3, clump: 4, spread: 2, scale: [0.28, 0.4], x: [-40, 40] },
    { model: 'Plant_4', per100: 0.25, clump: 4, spread: 2, scale: [0.7, 1.0], x: [-40, 40] },
    { model: 'Fern_1', per100: 0.4, clump: 6, spread: 4, scale: [0.8, 1.3] },
    { model: 'Grass_Common_Tall', per100: 1.6, clump: 6, spread: 3, scale: [0.6, 0.9], kind: 'grass' },
    { model: 'Rock_Medium_2', per100: 0.02, clump: 3, spread: 5, scale: [0.6, 1.2], slope: 1.4, tint: OAK },
  ],
  // the stair of Cirith Ungol: black rock, nothing growing
  'cirith-ungol': [
    { model: 'Rock_Big_1', per100: 0.04, clump: 3, spread: 6, scale: [0.6, 1.4], slope: 2, tint: BLACK },
    { model: 'Rock_Medium_1', per100: 0.12, clump: 4, spread: 5, scale: [0.5, 1.2], slope: 2, tint: BLACK },
    { model: 'Rock_Medium_4', per100: 0.1, clump: 4, spread: 4, scale: [0.4, 1.0], slope: 2, tint: BLACK },
    { model: 'Pebble_Square_4', per100: 1.2, clump: 6, spread: 2, scale: [2, 4], x: [-10, 10], tint: BLACK },
  ],
  // Gorgoroth: cinders and slag, the rocks black, dead wood where anything once grew
  gorgoroth: [
    { model: 'Rock_Big_2', per100: 0.03, clump: 3, spread: 8, scale: [0.6, 1.3], tint: BLACK },
    { model: 'Rock_Medium_3', per100: 0.1, clump: 5, spread: 5, scale: [0.4, 1.0], tint: BLACK },
    { model: 'Pebble_Round_5', per100: 1.6, clump: 8, spread: 3, scale: [2, 4.5], x: [-30, 30], tint: BLACK },
    { model: 'DeadTree_4', per100: 0.004, clump: 1, spread: 1, scale: [0.4, 0.6], tint: BLACK },
  ],
  // the Pelennor: farms and fields under the walls, orchards, the road between low walls
  'minas-tirith': [
    { model: 'CommonTree_5', per100: 0.05, clump: 6, spread: 12, scale: [0.8, 1.1], tint: OAK },
    { model: 'CommonTree_2', per100: 0.03, clump: 3, spread: 9, scale: [1.0, 1.4], tint: OAK },
    { model: 'Bush_Long_1', per100: 0.12, clump: 6, spread: 6, scale: [1.0, 1.3] },
    { model: 'Bush_Common', per100: 0.06, clump: 3, spread: 5, scale: [0.9, 1.3] },
    { model: 'Grass_Wheat', per100: 2.5, clump: 6, spread: 2.5, scale: [0.7, 0.9], x: [12, 80], tint: CORN },
    { model: 'Grass_Common_Tall', per100: 1.2, clump: 6, spread: 3, scale: [0.6, 0.9], kind: 'grass' },
    { model: 'Flower_3_Group', per100: 0.1, clump: 4, spread: 3, scale: [0.3, 0.45], x: [-30, 30] },
    { model: 'Rock_Medium_1', per100: 0.015, clump: 2, spread: 4, scale: [0.6, 1.1], tint: OAK },
  ],
  // the Havens: dune grass and thrift to the sand, wind-bent pines, pebbles at the water
  havens: [
    { model: 'Grass_Wispy_Tall', per100: 2.4, clump: 8, spread: 4, scale: [0.8, 1.2], kind: 'grass', tint: DUNE },
    { model: 'Grass_Wispy_Short', per100: 2, clump: 8, spread: 4, scale: [0.7, 1.1], kind: 'grass', tint: DUNE },
    { model: 'Pine_5', per100: 0.03, clump: 3, spread: 9, scale: [0.8, 1.2] },
    { model: 'Flower_6_2', per100: 0.8, clump: 6, spread: 2, scale: [1, 1.4], x: [-40, 40] },
    { model: 'Rock_Medium_2', per100: 0.03, clump: 3, spread: 5, scale: [0.6, 1.2], tint: OAK },
    { model: 'Pebble_Round_3', per100: 1.6, clump: 6, spread: 2.5, scale: [2, 4.5], tint: OAK },
  ],
};
