// What each planet on the universe map is like down on it, once the ship's
// flown down onto it and the crew are out (../entry.js, ../footScene.js): pure data,
// tested in Node. Each planet's things are built by its own file
// (./<id>.js, loaded only when you land there; ./furnish.js puts them on
// the ground).
//
//   title, sub  the place's name on the card as you come down, and under it
//   ground      { style, colors: [a, b, c] }: the ground round you, up close
//               (./ground.js has the styles; a, b the main colours, c a
//               third for paths, seams, patches)
//   sky         { zenith, horizon, sun, space? }: the day sky (space: how
//               much of space shows through overhead by day, 0…1)
//   models      GLBs by kind: { url, tall | long | wide (metres: the size it's
//               brought to, by its height, its longest way along the ground
//               or its widest), yaw?, y? (a turn, a lift, in metres), node?
//               (one model of a kit: ./models.js), tint? (a colour its own
//               are multiplied by), body? (what the landing's physics makes
//               of it: ./bodies.js) }
//   things      [{ kind, at: [x, z], yaw?, face?, r, opts? }] in metres round
//               where the ship comes down, three.js's way round: +z ahead,
//               the way the ship faces, +x to its left (the door's on its
//               right, −x). r is how far it reaches along the ground; face
//               'spot' (left out) turns its front (+z) to the ship, false
//               leaves it as yaw has it from the ship's heading; strip:
//               [hw, hd], a long flat thing's half length and width (a
//               road), kept clear of the scatter but walked over; around:
//               laid out round the landing spot itself (a skyline: its
//               builder keeps its parts out past the things)
//               door: { label, at?, reach? }: G there goes into the planet's
//               page ('Into Bag End'), at a spot on the thing (its own
//               frame, metres) or by it; say: { name, line }: what someone
//               (a figure: kind 'figure', opts { url | meshy, tall }) says
//               when you come up to them
//   scatter     [{ kind, n, from, to, scale: [a, b], opts?, solid? }]: many
//               of a kind, drawn instanced, `from` to `to` metres out, clear
//               of the things and the ship (solid: false to walk through)
//   leaves      { colours: [a, b, accent], density (a m²), size (of a 1 m
//               quad: Bruno's 0.25), shed (a second, from the trees round
//               you), crown?: { lit, shade, depth } }: the fallen leaves on
//               the ground (./litter.js), and the crowns' two tones over
//               the leaves' own colours (./canopy.js); none left out
//   wind        { strength (0…1), angle? }: what moves the crowns and the
//               leaves, rising and falling round its strength
//   biomes      the parts of the planet you can come down on, read off the
//               colour of its map under the spot (./biomes.js): each its
//               own name, ground, sky (haze: the air along its horizon),
//               things, scatter, leaves and wind, the planet's own where it
//               leaves one out (but its leaves: a biome with a scatter of
//               its own has none of the planet's); the last is the
//               fallback, the landing as above
//
// A kind is one of `models`, or a builder in the planet's file (its PROPS
// for things, SCATTER or PROPS for scatter).

// how far from where the ship comes down anything solid stands (metres:
// the Falcon, the biggest, parks about 30 m long)
export const CLEAR = 22;
// the most of anything scattered a landing draws (phones: half)
export const SCATTER_MAX = 900;

const sz = 0.6; // (a scatter scale range's spread, as a share of its base)
const ROUND = Math.PI; // (a thing turned right round: the Black Lake’s boats, bows to the castle)
const range = (k) => [k * (1 - sz / 2), k * (1 + sz / 2)];

// The Quaternius kits' models (scripts/quaternius.mjs: baked to metres,
// standing on the ground, each a node of its family's GLB; the manifest,
// public/models/quaternius/manifest.json, has their sizes): a model of a
// kit at the size asked, and anything more its spec says
const kit = (file) => (node, size, more = {}) => ({ url: `/models/quaternius/${file}.glb`, node, ...size, ...more });
const trees = kit('nature/trees');
// (a tree's solid is its trunk, not its crown: half a metre round, at its
// scatter's scale)
const tree = (node, size, more = {}) => trees(node, size, { reach: 0.5, ...more });
const flowers = kit('nature/flowers');
const grass = kit('nature/grass');
const rocks = kit('nature/rocks');
const mushrooms = kit('nature/mushrooms');
const furniture = kit('props/furniture');
const street = kit('props/street');
const city = kit('props/city');
const space = kit('props/space');
// what each small thing is to a landing's physics (./bodies.js: its shape,
// its mass in kg, sized from its own box): the loose ones light or
// middling, a shot sends them and a shove moves them; the street's own
// (lamps, lights, signs, bollards, planters) fixed, for the loose ones to
// fetch up against and a bolt to stop at. One on a pole says the pole
// (`post`: r, metres, and at, [x, z] where it stands in the model's own
// frame), so a bolt that clears the pole goes by: the kit's own, decoded
// from street.glb (a sign's pole 6.4 cm across, 2 to 3 cm behind the
// plate's middle; the traffic light's 25 cm, 13 cm behind its lights'; the
// streetlight's collar at a chest's height, where a shot on foot flies,
// 40 cm, its pole over that 23 to 12)
const loose = (shape, mass) => ({ body: { shape, mass } });
const fixed = (shape, mass, post = null) => ({ body: { shape, mass, fixed: true, ...post } });
const PROP = {
  chair: furniture('Chair', { tall: 0.95 }, loose('box', 4)),
  stool: furniture('Stool', { tall: 0.65 }, loose('cylinder', 2.5)),
  table: furniture('Table', { tall: 0.76 }, loose('box', 14)),
  vase: furniture('Vase', { tall: 0.4 }, loose('cylinder', 1.5)),
  pot: furniture('Plant', { tall: 0.45 }, loose('cylinder', 1.2)),
  ac: city('Prop_ACUnit', { tall: 0.6 }, loose('box', 25)),
  crate: space('Pickup_Crate', { tall: 0.8 }, loose('box', 8)),
  jar: space('Pickup_Jar', { tall: 0.9 }, loose('cylinder', 3)),
  bollard: city('Prop_Bollard', { tall: 0.89 }, fixed('cylinder', 60)),
  planter: city('Prop_Planter_Single', { tall: 0.6 }, fixed('box', 300)),
  streetlight: street('Streetlight_Single', { tall: 5.6 }, fixed('cylinder', 120, { r: 0.2 })),
  trafficLight: street('TrafficLight', { tall: 4.4 }, fixed('cylinder', 150, { r: 0.13, at: [0.01, -0.13] })),
  stopSign: street('Sign_Stop', { tall: 2.4 }, fixed('cylinder', 15, { r: 0.032, at: [0, -0.02] })),
  noParking: street('Sign_NoParking', { tall: 2.4 }, fixed('cylinder', 12, { r: 0.032, at: [0, -0.03] })),
};
// a table and its chairs round it, at [x, z] (yaw: the table's turn; each
// chair faces it, pulled out a little, `out` metres from its middle)
export const tableSet = ([x, z], { yaw = 0, chairs = 4, out = 1.15 } = {}) => [
  { kind: 'table', at: [x, z], r: 0.8, face: false, yaw },
  ...Array.from({ length: chairs }, (_, i) => {
    const a = yaw + (i * 2 * Math.PI) / chairs;
    const at = [x + Math.sin(a) * out, z + Math.cos(a) * out];
    // (its front, +z, turned toward the table)
    return { kind: 'chair', at, r: 0.3, face: false, yaw: a + Math.PI };
  }),
];
// (a biome's test on its map colour, biomes.js's classify: h degrees, s and l 0…1)
const hue = (c, a, b) => c.h >= a && c.h <= b;
// (and on where it is: inside an ellipse round [lat, lon] on the map, its
// half-axes a and b degrees, the a axis turned `deg` from east toward north)
const oval = ([la, lo], [lat, lon], a, b, deg = 0) => {
  const t = (deg * Math.PI) / 180;
  const x = lo - lon;
  const y = la - lat;
  return ((x * Math.cos(t) + y * Math.sin(t)) / a) ** 2 + ((y * Math.cos(t) - x * Math.sin(t)) / b) ** 2 < 1;
};
// Tortuga as the Caribbean's bake lays it (scripts/planets/caribbean.mjs):
// the island (real about [20.05, −72.79]) centred at [19.99, 8.63] on the
// globe (its Cayona mark, [20.04, −72.79], at [19.945, 8.639]), about 1.5°
// long and tilted 11° down to the east. An ellipse along it, 0.78° by 0.3°:
// all of the island and its harbour in, Hispaniola's north coast (0.24–0.29°
// across the channel) out
const TORTUGA = [19.99, 8.63];
const onTortuga = (at) => {
  if (!at) return false;
  const y = at[0] - TORTUGA[0];
  const x = (at[1] - TORTUGA[1]) * Math.cos((TORTUGA[0] * Math.PI) / 180);
  const t = (-11 * Math.PI) / 180;
  return ((x * Math.cos(t) + y * Math.sin(t)) / 0.78) ** 2 + ((y * Math.cos(t) - x * Math.sin(t)) / 0.3) ** 2 <= 1;
};
// The leaves on the ground (./litter.js), each place's: two colours a leaf
// is between and an accent (a share of them), how many a square metre,
// how big, how many a second its trees shed, and its crowns' two tones.
// Bilbo's party is on 22 September: the Shire's are greens turning gold
// with a few gone russet; the old forest's Bruno's rust and orange, muted
// under the eaves; Lothlórien's gold
const LEAVES = {
  shire: { colours: ['#a39c34', '#d8a83c', '#b4622c'], density: 0.55, size: 0.28, shed: 0.7 },
  forest: { colours: ['#8a4a2e', '#d8762e', '#c9a23a'], density: 0.9, size: 0.28, shed: 2, crown: { lit: [1.06, 1.02, 0.88], shade: [0.86, 0.92, 0.98], depth: 0.28 } },
  lorien: { colours: ['#b8862a', '#f2cf55', '#e8b04a'], density: 0.9, size: 0.28, shed: 2.5, crown: { lit: [1.12, 1.05, 0.8], shade: [0.9, 0.92, 0.9], depth: 0.22 } },
  lawn: { colours: ['#a3a23a', '#c9b544', '#c08a2e'], density: 0.2, size: 0.24, shed: 0.4 },
  earth: { colours: ['#a6a83c', '#cdb84a', '#c47a2c'], density: 0.25, size: 0.24, shed: 0.5 },
  dusk: { colours: ['#c2582a', '#f0a04c', '#f2c25a'], density: 0.2, size: 0.22, shed: 0.5, crown: { lit: [1.12, 0.98, 0.84], shade: [0.86, 0.86, 0.98], depth: 0.22 } },
};

// Middle-earth's woods: its forest biome, found by colour and (Lothlórien,
// whose gold canopy reads as grass from orbit) by place
const ME_FOREST = {
  title: 'The old forest',
  sub: 'Middle-earth · under the eaves, where the trees are older than the Shire',
  ground: { style: 'grass', colors: ['#26381c', '#34481f', '#4a3a26'] },
  sky: { zenith: '#557a8a', horizon: '#a8b49a', sun: '#f0e6c0' },
  leaves: LEAVES.forest,
  wind: { strength: 0.35 },
  // (pines and the Shire's oaks, darker under the eaves; ferns and the
  // Shire's mushrooms and grass beneath)
  models: {
    pine: tree('Pine_5', { tall: 10 }),
    pineTall: tree('Pine_4', { tall: 12 }),
    oakOld: tree('CommonTree_3', { tall: 10, tint: '#a8b890' }),
    fern: flowers('Fern_2', { wide: 1.3 }),
    bush: trees('Bush_Long_1', { tall: 1.4, tint: '#b0c098' }),
  },
  things: [],
  scatter: [
    { kind: 'pine', n: 34, from: 24, to: 110, scale: range(1.1) },
    { kind: 'pineTall', n: 14, from: 26, to: 110, scale: range(1.1) },
    { kind: 'oakOld', n: 18, from: 24, to: 110, scale: range(1.1) },
    { kind: 'bush', n: 24, from: 8, to: 90, scale: range(1) },
    { kind: 'fern', n: 50, from: 4, to: 80, scale: range(1), solid: false },
    { kind: 'mushroom', n: 40, from: 4, to: 70, scale: range(1), solid: false },
    { kind: 'tufts', n: 160, from: 3, to: 70, scale: range(0.8), solid: false },
  ],
};

export const LANDINGS = {
  middleearth: {
    title: 'The Shire',
    sub: 'Middle-earth · Hobbiton, the day of the party',
    ground: { style: 'grass', colors: ['#4d7a2a', '#7aa544', '#a08c58'] },
    sky: { zenith: '#4f86d4', horizon: '#e4ecd6', sun: '#fff0c4' },
    leaves: LEAVES.shire,
    wind: { strength: 0.45 },
    // the Shire's oaks, hedges, flowers, mushrooms and grass (Bag End, the
    // holes, the Party Tree, the Green Dragon and the rest are its own kit's)
    models: {
      oak: tree('CommonTree_4', { tall: 7.5 }),
      oakTall: tree('CommonTree_3', { tall: 9 }),
      oakLow: tree('CommonTree_5', { tall: 6 }),
      hedge: trees('Bush_Common_Flowers', { tall: 1.1 }),
      flowers: flowers('Flower_3_Single', { tall: 0.42 }),
      daisies: flowers('Flower_1_Single', { tall: 0.38 }),
      poppies: flowers('Flower_6', { wide: 0.5 }),
      mushroom: mushrooms('Mushroom_RedCap', { tall: 0.28 }),
      tufts: grass('Grass_Common_Short', { tall: 0.65 }),
    },
    things: [
      { kind: 'bagEnd', at: [-30, 30], r: 10, door: { label: 'Bag End', at: [0, 6.5], reach: 3 } },
      { kind: 'gandalf', at: [-18, 22], r: 0.5, say: { name: 'Gandalf', line: 'A wizard is never late, nor is he early.' } },
      { kind: 'hobbit', at: [14, 42], r: 0.4, say: { name: 'Sam', line: 'It’s the party of the century, Mr Frodo!' }, opts: { cloak: '#7a6a3a', pack: true } },
      { kind: 'hobbit', at: [-1, 41], r: 0.4, opts: { cloak: '#4b5a3a' } },
      { kind: 'hole', at: [-46, 4], r: 7, opts: { door: '#a83224', seed: 2 } },
      { kind: 'hole', at: [34, 36], r: 7, opts: { door: '#d8a92e', seed: 3 } },
      { kind: 'hole', at: [44, 8], r: 7, opts: { door: '#2f5f9a', seed: 5 } },
      { kind: 'partyTree', at: [6, 50], r: 7 },
      { kind: 'signpost', at: [-17, 18], r: 0.6, opts: { lines: ['Hobbiton', 'Bag End', 'The Green Dragon'] } },
      { kind: 'cart', at: [22, 24], r: 2.6, face: false, yaw: 0.6 },
      { kind: 'hayBale', at: [26, 21], r: 1 },
      { kind: 'beehive', at: [-40, 18], r: 0.6 },
      { kind: 'barrel', at: [-20, 20], r: 0.6 },
      { kind: 'mailbox', at: [-38, -6], r: 0.4 },
      { kind: 'scarecrow', at: [-30, -34], r: 0.6 },
      { kind: 'sheep', at: [30, -26], r: 0.9, face: false, yaw: 2.1, opts: { seed: 1 } },
      { kind: 'sheep', at: [36, -30], r: 0.9, face: false, yaw: 1.2, opts: { seed: 2 } },
      { kind: 'sheep', at: [28, -34], r: 0.9, face: false, yaw: 3.5, opts: { seed: 3 } },
      { kind: 'greenDragon', at: [8, -58], r: 10 },
    ],
    scatter: [
      { kind: 'oak', n: 8, from: 34, to: 110, scale: range(1) },
      { kind: 'oakTall', n: 8, from: 34, to: 110, scale: range(1) },
      { kind: 'oakLow', n: 7, from: 40, to: 110, scale: range(1) },
      { kind: 'hedge', n: 20, from: 14, to: 90, scale: range(1) },
      { kind: 'flowers', n: 100, from: 5, to: 80, scale: range(1), solid: false },
      { kind: 'daisies', n: 90, from: 5, to: 80, scale: range(1), solid: false },
      { kind: 'poppies', n: 70, from: 5, to: 80, scale: range(1), solid: false },
      { kind: 'mushroom', n: 26, from: 6, to: 60, scale: range(1), solid: false },
      { kind: 'tufts', n: 320, from: 3, to: 70, scale: range(1), solid: false },
    ],
    // Tolkien's map (scripts/planets/middleearth.mjs): the Belegaer and the
    // inland seas; Mordor's black plain; Mirkwood's, Fangorn's and the Old
    // Forest's dark woods; the Misty, White and Grey Mountains, rock and
    // snow; Harad's sands; and the green of Eriador, Rohan and Gondor, the
    // Shire's. Measured against the bake's own geography rasterized onto the
    // map's 256 × 128 copy (forest precision 46% → 92%, Mordor 76% → 85%):
    // the woods and Mordor are bounded by where the map has them, as the
    // bake lays a conifer belt round 50–58° N and dark rock on the far side
    biomes: [
      { id: 'sea', sea: true, match: (c) => hue(c, 185, 255) && c.s > 0.12 && c.l < 0.6 },
      {
        id: 'mordor',
        // (inside its walls only: dark rock and dark coasts elsewhere aren't Mordor)
        match: (c, at) => c.l < 0.3 && (c.s < 0.12 || c.h < 60 || c.h > 300) && (!at || (at[0] > 3 && at[0] < 28 && at[1] > 15 && at[1] < 47)),
        title: 'Mordor',
        sub: 'Middle-earth · the plateau of Gorgoroth, under Orodruin',
        ground: { style: 'sand', colors: ['#3a3330', '#4a403a', '#241e1c'] },
        sky: { zenith: '#3a2420', horizon: '#8a3a20', sun: '#ff6a30', haze: '#a8401c' },
        // (the ash's rock and grit, burnt dark)
        models: {
          crag: rocks('Rock_Medium_1', { long: 1.3, tint: '#6a5a54' }),
          stones: rocks('Pebble_Square_3', { long: 0.7, tint: '#5a4c48' }),
        },
        things: [
          { kind: 'orodruin', at: [-80, 320], r: 90, face: false, solid: false },
          { kind: 'baradDur', at: [230, 330], r: 26, face: false, yaw: -0.9, solid: false },
          { kind: 'fissure', at: [-26, 24], r: 3, face: false, yaw: 0.4 },
          { kind: 'fissure', at: [32, -20], r: 3, face: false, yaw: 2.2, opts: { seed: 5 } },
        ],
        scatter: [
          { kind: 'crag', n: 60, from: 24, to: 110, scale: range(2.2) },
          { kind: 'stones', n: 200, from: 4, to: 80, scale: range(0.6), solid: false },
          { kind: 'embers', n: 60, from: 6, to: 90, scale: range(1), solid: false },
        ],
      },
      // (Lothlórien's gold canopy reads as grass from orbit: by place; its
      // leaves on the ground gold)
      { id: 'forest', near: [36.9, 3.4, 1.6], ...ME_FOREST, leaves: LEAVES.lorien },
      {
        id: 'forest',
        // (only where the map has woods: not the far side, nor the conifer
        // belt the bake lays north of 50 degrees, but for Mirkwood's north)
        match: (c, at) => ((c.l < 0.26 && hue(c, 95, 140)) || (c.l < 0.22 && hue(c, 60, 140))) && (!at || (at[0] > -28 && at[0] < 61 && at[1] > -40 && at[1] < 60 && (at[0] < 50 || (at[1] > 9 && at[1] < 33)))),
        ...ME_FOREST,
      },
      {
        id: 'mountains',
        // (and the polar ice's pale edge)
        match: (c) => (c.s < 0.15 && c.l >= 0.35 && !(hue(c, 90, 170) && c.s > 0.08)) || c.l > 0.8 || (c.l > 0.55 && hue(c, 180, 260)),
        title: 'The mountains',
        sub: 'Middle-earth · high on a pass, the snow above',
        ground: { style: 'sand', colors: ['#7c7872', '#8e8a84', '#eef0f2'] },
        sky: { zenith: '#3f72c0', horizon: '#dfe6ee', sun: '#fff8ea' },
        wind: { strength: 0.6 },
        // (grey crags and scree, a few pines below the pass; the snow-capped
        // boulders are the generic rock, white)
        models: {
          crag: rocks('Rock_Medium_4', { long: 1.3 }),
          stones: rocks('Pebble_Square_3', { long: 0.7 }),
          pine: tree('Pine_5', { tall: 8 }),
        },
        things: [],
        scatter: [
          { kind: 'crag', n: 70, from: 24, to: 110, scale: range(2.4) },
          { kind: 'rock', n: 40, from: 24, to: 110, scale: range(1.4), opts: { color: '#e8ecf0', sharp: 0.3, seed: 8 } },
          { kind: 'pine', n: 12, from: 30, to: 110, scale: range(1) },
          { kind: 'stones', n: 160, from: 4, to: 80, scale: range(0.6), solid: false },
        ],
      },
      {
        id: 'harad',
        match: (c, at) => hue(c, 20, 60) && c.s > 0.15 && c.l > 0.42 && (!at || (at[0] < 10 && at[1] > -20 && at[1] < 90)),
        title: 'Harad',
        sub: 'Middle-earth · the sands of the Haradrim, far south of Gondor',
        ground: { style: 'sand', colors: ['#d8b880', '#c8a468', '#9a7848'] },
        sky: { zenith: '#3f78c8', horizon: '#f2dcb0', sun: '#fff2d0' },
        // (sandstone, its grit, and dry grass)
        models: {
          crag: rocks('Rock_Desert_1', { long: 1.3 }),
          stones: rocks('Pebble_Desert', { long: 0.7 }),
          scrub: grass('Grass_Wispy_Short', { tall: 0.7 }),
        },
        things: [],
        scatter: [
          { kind: 'crag', n: 30, from: 24, to: 110, scale: range(1.6) },
          { kind: 'stones', n: 140, from: 4, to: 80, scale: range(0.5), solid: false },
          { kind: 'scrub', n: 60, from: 5, to: 90, scale: range(0.8), solid: false },
        ],
      },
      { id: 'shire' },
    ],
  },

  breakingbad: {
    title: 'The desert',
    sub: 'Breaking Bad · out past Albuquerque, where the RV cooks',
    ground: { style: 'sand', colors: ['#e6c896', '#d6b07e', '#a8845e'] },
    sky: { zenith: '#2f74cc', horizon: '#f0dcbc', sun: '#fff6dc' },
    models: {
      rv: { url: '/models/albuquerque/world/rv.glb', long: 8.5 },
      cactus: { url: '/models/sketchfab/cactus.glb', tall: 4.2 },
      tumbleweed: { url: '/models/sketchfab/tumbleweed.glb', wide: 1.1 },
      tower: { url: '/models/sketchfab/watertower.glb', tall: 14 },
      barrel: { url: '/models/metherria/drum-blue.glb', tall: 0.9 },
      bucket: { url: '/models/sketchfab/bucket.glb', tall: 0.42 },
      car: { url: '/models/albuquerque/world/aztek.glb', long: 4.6 },
      // (sandstone and its grit, and the desert's dry grass)
      crag: rocks('Rock_Desert_1', { long: 1.3 }),
      crag2: rocks('Rock_Desert_2', { long: 1.3 }),
      stones: rocks('Pebble_Desert', { long: 0.7 }),
      scrub: grass('Grass_Wispy_Short', { tall: 0.75 }),
    },
    things: [
      { kind: 'rv', at: [-28, 16], r: 5, face: false, yaw: -1.2, door: { label: 'the RV', reach: 7 } },
      { kind: 'figure', at: [-36, 24], r: 0.4, say: { name: 'Saul', line: 'Better call Saul!' }, opts: { url: '/models/albuquerque/saul.glb', tall: 1.78 } },
      { kind: 'figure', at: [26, 38], r: 0.4, say: { name: 'Mike', line: 'No more half measures.' }, opts: { url: '/models/albuquerque/mike.glb', tall: 1.8 } },
      { kind: 'barrel', at: [-23, 11], r: 0.5 },
      { kind: 'barrel', at: [-22.2, 12.1], r: 0.5 },
      { kind: 'barrel', at: [-23.4, 12.6], r: 0.5 },
      { kind: 'bucket', at: [-21.5, 14], r: 0.3 },
      { kind: 'cook', at: [-22, 22.5], r: 1.6 },
      { kind: 'car', at: [-40, 30], r: 2.6, face: false, yaw: 0.9 },
      { kind: 'tower', at: [34, 48], r: 4 },
      { kind: 'mesa', at: [-10, 78], r: 18, face: false },
      { kind: 'mesa', at: [64, -30], r: 16, face: false, yaw: 1.3, opts: { seed: 4 } },
      { kind: 'mesa', at: [-70, -40], r: 18, face: false, yaw: 2.6, opts: { seed: 7 } },
    ],
    scatter: [
      { kind: 'cactus', n: 12, from: 26, to: 100, scale: range(1) },
      { kind: 'tumbleweed', n: 10, from: 10, to: 60, scale: range(1), solid: false },
      { kind: 'crag', n: 40, from: 24, to: 110, scale: range(1.6) },
      { kind: 'crag2', n: 30, from: 24, to: 110, scale: range(1.6) },
      { kind: 'stones', n: 160, from: 4, to: 70, scale: range(0.5), solid: false },
      { kind: 'scrub', n: 120, from: 5, to: 90, scale: range(1), solid: false },
    ],
    // New Mexico (scripts/planets/breakingbad.mjs: the state ~100° tall on
    // the globe, a km 0.174°): Albuquerque by place, its grid as the bake
    // paints it (1.6× round the Big I: 30–43° N, ±5° of lon 0); White
    // Sands' gypsum by colour inside the dunes' oval (8° S 5° E); the
    // malpais' black lava, El Malpais by colour (29° N 24° W) and the
    // Carrizozo flow by place (under a pixel wide in the map's copy); the
    // ranges' rock, pine and snow (snow only up north, where the San Juans
    // and Sangres are); the high desert. Each fitted to the bake's own
    // shapes (breakingbad-geo.mjs) on the map's 256 × 128 copy
    biomes: [
      {
        id: 'city',
        match: (c, at) => !!at && oval(at, [36.5, -0.1], 4.4, 6),
        title: 'Albuquerque',
        sub: 'Breaking Bad · a lot off Central Avenue, by Los Pollos Hermanos',
        ground: { style: 'asphalt', colors: ['#5a5a58', '#6a6966', '#e8e2c8'] },
        sky: { zenith: '#2f74cc', horizon: '#f0dcbc', sun: '#fff6dc' },
        models: {
          pollos: { url: '/models/albuquerque/world/pollos.glb', wide: 22 },
          carwash: { url: '/models/albuquerque/world/carwash.glb', wide: 20 },
          suv: { url: '/models/albuquerque/world/suv.glb', long: 5 },
          // (the street's furniture, and the lot's grit)
          ...PROP,
          stones: rocks('Pebble_Square_3', { long: 0.6, tint: '#b8b2a8' }),
        },
        things: [
          { kind: 'pollos', at: [0, 52], r: 14, door: { label: 'Los Pollos Hermanos', reach: 9 } },
          { kind: 'carwash', at: [-48, 26], r: 13, yaw: 0.3 },
          { kind: 'figure', at: [6, 34], r: 0.4, say: { name: 'Gus', line: 'I hide in plain sight, same as you.' }, opts: { url: '/models/albuquerque/gus.glb', tall: 1.85 } },
          { kind: 'car', at: [24, 30], r: 2.6, face: false, yaw: 1.6 },
          { kind: 'suv', at: [30, 22], r: 2.6, face: false, yaw: 1.5 },
          // the bollards and planters along the restaurant's front, its
          // tables out on the lot, the corner's light and signs
          ...[-6, -3, 3].map((x) => ({ kind: 'bollard', at: [x, 37.4], r: 0.2 })),
          { kind: 'planter', at: [-10.5, 37], r: 1.3 },
          { kind: 'planter', at: [10.5, 38], r: 1.3 },
          ...tableSet([-15, 31], { yaw: 0.3 }),
          ...tableSet([-20, 36], { yaw: -0.2, chairs: 3 }),
          { kind: 'stool', at: [-11.5, 28], r: 0.3, face: false, yaw: 0.8 },
          { kind: 'streetlight', at: [18, 38], r: 0.35 },
          { kind: 'streetlight', at: [-26, 40], r: 0.35 },
          { kind: 'trafficLight', at: [20, 45], r: 0.35, face: false, yaw: -1.2 },
          { kind: 'stopSign', at: [16, 22.5], r: 0.3 },
          { kind: 'noParking', at: [-30, 21], r: 0.3 },
          { kind: 'ac', at: [-35, 34], r: 0.5, face: false, yaw: 1.9 },
          { kind: 'ac', at: [-34.4, 35.4], r: 0.5, face: false, yaw: 1.9 },
        ],
        scatter: [{ kind: 'stones', n: 60, from: 4, to: 60, scale: range(0.4), solid: false }],
      },
      {
        id: 'sands',
        match: (c, at) => c.l > 0.72 && c.s < 0.5 && (!at || oval(at, [-8, 4.95], 4.3, 2.3, -78.5)),
        title: 'White Sands',
        sub: 'Breaking Bad · the gypsum dunes, south toward Alamogordo',
        ground: { style: 'sand', colors: ['#f4f1ea', '#e6e0d2', '#cfc4ae'] },
        sky: { zenith: '#2466cc', horizon: '#e6eef6', sun: '#ffffff' },
        // (the gypsum's grass, bleached)
        models: { scrub: grass('Grass_Wispy_Short', { tall: 0.65, tint: '#f2ecd8' }) },
        things: [
          { kind: 'rv', at: [-28, 16], r: 5, face: false, yaw: -1.2, door: { label: 'the RV', reach: 7 } },
          { kind: 'figure', at: [-34, 24], r: 0.4, say: { name: 'Jesse', line: 'Yeah, science!' }, opts: { url: '/models/albuquerque/jesse.glb', tall: 1.75 } },
        ],
        scatter: [
          { kind: 'dune', n: 26, from: 30, to: 110, scale: range(1), solid: false },
          { kind: 'scrub', n: 40, from: 5, to: 90, scale: range(0.8), solid: false },
          { kind: 'tumbleweed', n: 6, from: 10, to: 60, scale: range(1), solid: false },
        ],
      },
      {
        id: 'malpais',
        match: (c, at) => (c.l < 0.3 && c.s < 0.18 && (!at || (at[0] > 26 && at[0] < 33 && at[1] > -27 && at[1] < -21.6))) || (!!at && oval(at, [7.76, 9.94], 5.1, 0.5, 73.8)),
        title: 'The malpais',
        sub: 'Breaking Bad · the black lava flows, El Malpais and the Valley of Fires',
        ground: { style: 'sand', colors: ['#3b3430', '#524640', '#5a2e22'] },
        sky: { zenith: '#2a6ccc', horizon: '#ecdcc4', sun: '#fff4d8' },
        // (the lava's black rock and cinders)
        models: {
          crag: rocks('Rock_Medium_1', { long: 1.3, tint: '#5a524e' }),
          stones: rocks('Pebble_Square_3', { long: 0.7, tint: '#4a4442' }),
        },
        things: [
          { kind: 'rv', at: [-28, 16], r: 5, face: false, yaw: -1.2, door: { label: 'the RV', reach: 7 } },
          { kind: 'cook', at: [-22, 22.5], r: 1.6 },
        ],
        scatter: [
          { kind: 'crag', n: 90, from: 24, to: 110, scale: range(1.8) },
          { kind: 'stones', n: 200, from: 4, to: 80, scale: range(0.6), solid: false },
          { kind: 'scrub', n: 50, from: 5, to: 90, scale: range(0.8), solid: false },
        ],
      },
      {
        id: 'mountains',
        match: (c, at) => (c.l < 0.45 && c.s < 0.4 && (c.h < 120 || c.h >= 300)) || ((c.s < 0.15 || c.l > 0.8) && (!at || at[0] > 34)),
        title: 'The mountains',
        sub: 'Breaking Bad · up among the juniper and the granite, the valley far below',
        ground: { style: 'sand', colors: ['#8a7a68', '#74675a', '#b8a890'] },
        sky: { zenith: '#2a6ccc', horizon: '#e6dccb', sun: '#fff6dc' },
        wind: { strength: 0.6 },
        // (granite, and the junipers: short pines, blue-green)
        models: {
          crag: rocks('Rock_Medium_4', { long: 1.3, tint: '#d8c8b4' }),
          juniper: tree('Pine_5', { tall: 5.5, tint: '#9ab4a4' }),
        },
        things: [
          { kind: 'car', at: [-26, 22], r: 2.6, face: false, yaw: 0.9, door: { label: 'the Aztek, back down to the city', reach: 4 } },
          { kind: 'mesa', at: [-10, 90], r: 22, face: false, opts: { seed: 9, h: 40, r: 22 } },
          { kind: 'mesa', at: [80, 40], r: 20, face: false, yaw: 1.1, opts: { seed: 3, h: 34, r: 20 } },
        ],
        scatter: [
          { kind: 'crag', n: 80, from: 24, to: 110, scale: range(2) },
          { kind: 'juniper', n: 40, from: 24, to: 110, scale: range(1) },
          { kind: 'stones', n: 160, from: 4, to: 70, scale: range(0.5), solid: false },
          { kind: 'scrub', n: 60, from: 5, to: 90, scale: range(1), solid: false },
        ],
      },
      { id: 'desert' },
    ],
  },

  rickmorty: {
    title: 'Dimension C-137',
    sub: 'Rick and Morty · the Smiths’ street',
    ground: { style: 'grass', colors: ['#4f9a3c', '#86bf52', '#8d8a82'] },
    sky: { zenith: '#3f9be0', horizon: '#d8f3fb', sun: '#fff6d8' },
    models: {
      house: { url: '/models/c137/smith-house.glb', wide: 17 },
      school: { url: '/models/c137/school.glb', wide: 34 },
      limo: { url: '/models/c137/limo.glb', long: 9 },
      fedship: { url: '/models/c137/fedship.glb', wide: 14 },
      shoneys: { url: '/models/c137/shoneys.glb', wide: 20 },
      ...PROP,
    },
    things: [
      { kind: 'road', at: [0, 32], r: 0, face: false, strip: [70, 7] },
      { kind: 'house', at: [-24, 50], r: 11 },
      { kind: 'school', at: [42, 66], r: 20 },
      { kind: 'limo', at: [-4, 30], r: 4.6, face: false },
      { kind: 'portal', at: [-20, 14], r: 1.6, door: { label: 'the portal', reach: 3 } },
      { kind: 'figure', at: [-30, 37.5], r: 0.4, opts: { meshy: 'beth', tall: 1.7 } },
      { kind: 'figure', at: [-27, 37], r: 0.4, say: { name: 'Jerry', line: 'Hungry for apples?' }, opts: { meshy: 'jerry', tall: 1.78 } },
      { kind: 'figure', at: [-23, 37.5], r: 0.4, say: { name: 'Summer', line: 'Ugh. Grandpa’s here again.' }, opts: { meshy: 'summer', tall: 1.65 } },
      { kind: 'figure', at: [6, 31], r: 0.4, say: { name: 'The President', line: 'Get in the limo, Rick.' }, opts: { meshy: 'president', tall: 1.88 } },
      { kind: 'hydrant', at: [-12, 26.5], r: 0.3 },
      { kind: 'mailbox', at: [-20, 37.5], r: 0.3 },
      { kind: 'fedship', at: [34, -8], r: 8 },
      { kind: 'shoneys', at: [-50, -30], r: 12 },
      // the street's lamps and its corner's sign, and a table out on the
      // Smiths' lawn
      ...[-40, -8, 24].map((x) => ({ kind: 'streetlight', at: [x, 40.6], r: 0.35 })),
      { kind: 'stopSign', at: [16, 23.6], r: 0.3 },
      ...tableSet([-10, 47], { yaw: 0.2 }),
      { kind: 'vase', at: [-12.6, 44.6], r: 0.2 },
    ],
    scatter: [
      { kind: 'tree', n: 18, from: 30, to: 100, scale: range(1) },
      { kind: 'bush', n: 40, from: 22, to: 90, scale: range(1) },
      { kind: 'plumbus', n: 4, from: 12, to: 40, scale: range(1), solid: false },
    ],
    // the show's world (scripts/planets/rickmorty.mjs): its purple and pink
    // hills, out past town; the rest is the Smiths' street
    biomes: [
      {
        id: 'hills',
        match: (c) => hue(c, 250, 350) && c.s > 0.25,
        title: 'The purple hills',
        sub: 'Rick and Morty · out past town, where the portal came out',
        ground: { style: 'grass', colors: ['#7a4aa8', '#9a6ac8', '#e88ac0'] },
        sky: { zenith: '#3f9be0', horizon: '#e8d8fb', sun: '#fff6d8' },
        things: [
          { kind: 'portal', at: [-20, 14], r: 1.6, door: { label: 'the portal', reach: 3 } },
          { kind: 'figure', at: [-14, 22], r: 0.4, say: { name: 'Rick', line: 'Wubba lubba dub dub!' }, opts: { meshy: 'rick', tall: 1.85 } },
        ],
        scatter: [
          { kind: 'bush', n: 50, from: 22, to: 100, scale: range(1.2), opts: { color: '#c86ab8' } },
          { kind: 'plumbus', n: 6, from: 12, to: 50, scale: range(1), solid: false },
        ],
      },
      { id: 'street' },
    ],
  },

  // (the rest get their own ground and sky now, and their things in turn)
  music: {
    title: 'The courtyard',
    sub: 'Indian classical music · dusk, and the lamps lit',
    ground: { style: 'tiles', colors: ['#d9b48a', '#c99d70', '#7a5a3c'] },
    sky: { zenith: '#1f2350', horizon: '#f2894a', sun: '#ffc27a' },
    leaves: LEAVES.dusk,
    wind: { strength: 0.3 },
    models: {
      pavilion: { url: '/models/music/pavilion.glb', wide: 8 },
      gaddi: { url: '/models/music/gaddi.glb', wide: 2.6 },
      harmonium: { url: '/models/music/harmonium.glb', wide: 0.62 },
      tabla: { url: '/models/music/tabla.glb', wide: 0.62 },
      sitar: { url: '/models/music/sitar.glb', long: 1.22 },
      tanpura: { url: '/models/music/tanpura.glb', tall: 1.4 },
      lamp: { url: '/models/music/lamp.glb', tall: 1.25 },
      // (a broad shade tree in each corner; the marigolds and petals keep
      // their own festival colours, one an instance)
      tree: tree('CommonTree_4', { tall: 8 }),
    },
    things: [
      { kind: 'pavilion', at: [0, 40], r: 6, door: { label: 'the music room', reach: 8 } },
      { kind: 'recital', at: [0, 29], r: 1.6 },
      { kind: 'lamp', at: [-7, 26], r: 0.4 },
      { kind: 'lamp', at: [7, 26], r: 0.4 },
      { kind: 'lamp', at: [-9, 40], r: 0.4 },
      { kind: 'lamp', at: [9, 40], r: 0.4 },
      { kind: 'fountain', at: [-32, 16], r: 3.8 },
      { kind: 'screen', at: [36, 32], r: 10.5 },
      { kind: 'screen', at: [-46, 40], r: 10.5 },
      { kind: 'screen', at: [12, -46], r: 10.5 },
    ],
    scatter: [
      { kind: 'tree', n: 12, from: 30, to: 100, scale: range(1) },
      { kind: 'marigolds', n: 180, from: 5, to: 70, scale: range(1), solid: false },
      { kind: 'petals', n: 260, from: 3, to: 40, scale: range(1), solid: false },
      { kind: 'diyas', n: 70, from: 4, to: 45, scale: range(1), solid: false },
    ],
  },
  transformers: {
    title: 'Cybertron',
    sub: 'Transformers · the plating outside Iacon',
    ground: { style: 'plating', colors: ['#3e4350', '#2a2e37', '#7fd8ff'] },
    sky: { zenith: '#170f2e', horizon: '#6a4c8a', sun: '#d8c8ff', space: 0.5 },
    models: {
      optimus: { url: '/models/cybertron/optimus-orbit.glb', tall: 9.4 },
      megatron: { url: '/models/cybertron/megatron-orbit.glb', tall: 10.5 },
    },
    things: [
      { kind: 'optimus', at: [-22, 30], r: 3 },
      { kind: 'megatron', at: [26, 34], r: 3 },
      { kind: 'gate', at: [0, 46], r: 13, door: { label: 'the gate to Iacon', reach: 7 } },
      { kind: 'figure', at: [-11, 27], r: 0.8, say: { name: 'Bumblebee', line: '[a burst of radio] …roll out!' }, opts: { url: '/games/meshy/rollout/bumblebee.glb', tall: 4.8 } },
      { kind: 'tower', at: [-50, 62], r: 8, opts: { seed: 2, w: 14 } },
      { kind: 'tower', at: [48, 70], r: 7, opts: { seed: 5, w: 12, color: '#4a4f5c', glow: '#ff5a3a' } },
      { kind: 'tower', at: [-12, 90], r: 9, opts: { seed: 9, w: 16 } },
      { kind: 'tower', at: [72, -20], r: 6, opts: { seed: 4, w: 11, glow: '#ff5a3a' } },
      { kind: 'tower', at: [-68, -30], r: 7, opts: { seed: 7, w: 13 } },
      { kind: 'energon', at: [-28, 8], r: 2.4 },
      { kind: 'energon', at: [30, 2], r: 2, opts: { seed: 4, s: 1.3, color: '#ff5adf' } },
      { kind: 'wreck', at: [12, -30], r: 3 },
      { kind: 'wreck', at: [-30, -20], r: 3, opts: { seed: 9 } },
    ],
    scatter: [
      { kind: 'shard', n: 140, from: 4, to: 90, scale: range(1), solid: false },
      { kind: 'crystals', n: 60, from: 8, to: 90, scale: range(1), solid: false },
    ],
  },
  marvel: {
    title: 'Avengers HQ',
    sub: 'Marvel · upstate, on the compound’s lawn',
    ground: { style: 'grass', colors: ['#5f8f3a', '#8fb85a', '#9a9a96'] },
    sky: { zenith: '#3f82cf', horizon: '#dfe9ef', sun: '#fff4dc' },
    leaves: LEAVES.lawn,
    wind: { strength: 0.45 },
    models: {
      gauntlet: { url: '/models/universe/marvel.glb', tall: 5 },
      // the lawn's trees, and the compound's furniture
      tree: tree('CommonTree_3', { tall: 9 }),
      conifer: tree('Pine_4', { tall: 11 }),
      ...PROP,
    },
    things: [
      { kind: 'hq', at: [0, 72], r: 31, door: { label: 'the compound', at: [0, 8], reach: 5 } },
      { kind: 'pad', at: [-44, 22], r: 14 },
      { kind: 'monument', at: [27, 28], r: 2.5 },
      { kind: 'hero', at: [-14, 22], r: 0.6, opts: { who: 'thor' }, say: { name: 'Thor', line: 'Another!' } },
      { kind: 'hero', at: [-4, 25], r: 0.6, opts: { who: 'widow' } },
      { kind: 'hero', at: [6, 25], r: 0.6, opts: { who: 'ironman' } },
      { kind: 'hero', at: [15, 21], r: 1, opts: { who: 'hulk' }, say: { name: 'Hulk', line: 'Hulk… smash?' } },
      { kind: 'flag', at: [-15, 42], r: 0.3 },
      { kind: 'flag', at: [15, 42], r: 0.3 },
      // bollards and planters across the drive, lamps on the paths, the
      // Quinjet's cargo by the pad, a table out on the lawn
      ...[-5, -2.5, 2.5, 5].map((x) => ({ kind: 'bollard', at: [x, 38], r: 0.2 })),
      { kind: 'planter', at: [-9, 38], r: 1.3 },
      { kind: 'planter', at: [9, 38], r: 1.3 },
      { kind: 'streetlight', at: [-22, 36], r: 0.35 },
      { kind: 'streetlight', at: [22, 38], r: 0.35 },
      { kind: 'crate', at: [-28, 34], r: 0.6, face: false, yaw: 0.3 },
      { kind: 'crate', at: [-26.6, 34.4], r: 0.6, face: false, yaw: 0.1 },
      { kind: 'crate', at: [-27.4, 35.7], r: 0.6, face: false, yaw: 0.7 },
      { kind: 'jar', at: [-25, 32.6], r: 0.35 },
      { kind: 'jar', at: [-24.4, 33.5], r: 0.35 },
      ...tableSet([30, 12], { yaw: -0.4 }),
    ],
    scatter: [
      { kind: 'tree', n: 18, from: 34, to: 110, scale: range(1) },
      { kind: 'conifer', n: 14, from: 40, to: 110, scale: range(1) },
    ],
  },
  office: {
    title: 'Scranton Business Park',
    sub: 'The Office · the lot out back of Dunder Mifflin',
    ground: { style: 'asphalt', colors: ['#4e4f52', '#5d5e61', '#e8e2c8'] },
    sky: { zenith: '#9aa4ae', horizon: '#dcd8cf', sun: '#f2f0ea' },
    models: { ...PROP },
    things: [
      { kind: 'lot', at: [0, 42], yaw: -Math.PI / 2, r: 0, strip: [23, 18], door: { label: 'Dunder Mifflin', at: [-16, 3.5], reach: 4 } },
      { kind: 'figure', at: [-7, 25], r: 0.4, say: { name: 'Michael', line: 'Would I rather be feared or loved? Easy. Both.' }, opts: { url: '/models/office/cast/michael.glb', tall: 1.75 } },
      { kind: 'figure', at: [-4, 24], r: 0.4, say: { name: 'Dwight', line: 'Fact: this lot is under my jurisdiction.' }, opts: { url: '/models/office/cast/dwight.glb', tall: 1.88 } },
      { kind: 'figure', at: [6, 25], r: 0.4, say: { name: 'Jim', line: '[looks at the camera]' }, opts: { url: '/models/office/cast/jim.glb', tall: 1.91 } },
      // (the lot as it stands, the building's back along z = 59: the units
      // and bollards by its dock, a chair and a pot plant put out by the
      // dumpster, a table and chairs for lunch on the lot)
      { kind: 'ac', at: [9, 58.2], r: 0.5, face: false, yaw: Math.PI },
      { kind: 'ac', at: [10.3, 58.2], r: 0.5, face: false, yaw: Math.PI },
      { kind: 'bollard', at: [1.2, 57.2], r: 0.2 },
      { kind: 'bollard', at: [5.8, 57.2], r: 0.2 },
      { kind: 'noParking', at: [-2, 58.2], r: 0.3, face: false, yaw: Math.PI },
      { kind: 'chair', at: [-8.2, 56.6], r: 0.3, face: false, yaw: 2.6 },
      { kind: 'pot', at: [-8.6, 55.6], r: 0.3 },
      { kind: 'vase', at: [-7.6, 55.4], r: 0.2 },
      ...tableSet([15, 23], { yaw: 0.5 }),
    ],
    scatter: [
      { kind: 'paper', n: 70, from: 3, to: 70, scale: range(1), solid: false },
      { kind: 'reams', n: 5, from: 8, to: 30, scale: range(1), solid: false },
    ],
  },
  gaming: {
    title: 'Dot Matrix',
    sub: 'Gaming · four shades of green',
    ground: { style: 'pixel', colors: ['#306230', '#8bac0f', '#0f380f'] },
    sky: { zenith: '#8bac0f', horizon: '#9bbc0f', sun: '#e0f8d0' },
    models: {
      gameboy: { url: '/models/universe/gaming.glb', tall: 14 },
      mario: { url: '/models/universe/mario.glb', tall: 3.2 },
      piranha: { url: '/models/universe/piranha.glb', tall: 2.4 },
    },
    things: [
      { kind: 'gameboy', at: [0, 50], r: 5, door: { label: 'the Game Boy', reach: 8 } },
      { kind: 'mario', at: [-18, 22], r: 1, say: { name: 'Mario', line: 'It’s-a me!' } },
      { kind: 'pipe', at: [20, 26], r: 1.4, opts: { plant: 'piranha' } },
      { kind: 'pipe', at: [28, -14], r: 1.4, opts: { h: 2 } },
      { kind: 'blocks', at: [-6, 30], r: 2.5 },
      { kind: 'flagpole', at: [34, 46], r: 0.8 },
      { kind: 'cartridge', at: [-36, 14], r: 1.2, opts: { project: 0 } },
      { kind: 'cartridge', at: [-40, 27], r: 1.2, opts: { project: 1 } },
      { kind: 'cartridge', at: [-32, 39], r: 1.2, opts: { project: 2 } },
      { kind: 'cartridge', at: [-38, 1], r: 1.2, opts: { project: 3 } },
    ],
    scatter: [
      { kind: 'tree', n: 16, from: 30, to: 100, scale: range(1) },
      { kind: 'bush', n: 40, from: 6, to: 80, scale: range(1), solid: false },
    ],
  },
  travel: {
    title: 'Earth',
    sub: 'Travel · an airfield somewhere I’ve been',
    ground: { style: 'grass', colors: ['#4c7a34', '#76a04a', '#a39a7a'] },
    sky: { zenith: '#3c7fd6', horizon: '#d6e6f2', sun: '#fff6e2' },
    leaves: LEAVES.earth,
    wind: { strength: 0.5 },
    models: {
      plane: { url: '/models/sketchfab/earth-plane.glb', long: 36 },
      // (broadleaves and pines round the field, wildflowers in its grass)
      tree: tree('CommonTree_4', { tall: 8 }),
      pine: tree('Pine_5', { tall: 9 }),
      flowers: flowers('Flower_3_Single', { tall: 0.42 }),
      daisies: flowers('Flower_1_Single', { tall: 0.38 }),
      poppies: flowers('Flower_6', { wide: 0.5 }),
    },
    things: [
      { kind: 'airfield', at: [0, 46], r: 0, face: false, strip: [110, 16], door: { label: 'the plane', at: [-24, 0], reach: 18 } },
      { kind: 'signpost', at: [-14, 20], r: 0.6 },
    ],
    scatter: [
      { kind: 'tree', n: 14, from: 26, to: 110, scale: range(1) },
      { kind: 'pine', n: 10, from: 30, to: 110, scale: range(1) },
      { kind: 'flowers', n: 110, from: 3, to: 80, scale: range(1), solid: false },
      { kind: 'daisies', n: 110, from: 3, to: 80, scale: range(1), solid: false },
      { kind: 'poppies', n: 80, from: 3, to: 80, scale: range(1), solid: false },
    ],
    // Earth: the sea (on to the nearest land), the ice caps, and land
    biomes: [
      { id: 'sea', sea: true, match: (c) => hue(c, 200, 250) && c.s > 0.3 && c.l < 0.5 },
      {
        id: 'ice',
        match: (c) => c.l > 0.78 && (c.s < 0.15 || (hue(c, 180, 260) && c.s < 0.5)),
        title: 'The ice',
        sub: 'Travel · as far as anyone goes, and not been yet',
        ground: { style: 'sand', colors: ['#eef2f6', '#dfe6ee', '#b8c4d0'] },
        sky: { zenith: '#3a6cb8', horizon: '#e8f0f8', sun: '#fffaf0' },
        things: [{ kind: 'signpost', at: [-14, 20], r: 0.6 }],
        scatter: [],
      },
      { id: 'land' },
    ],
  },
  caribbean: {
    title: 'A Caribbean island',
    sub: 'Pirates of the Caribbean · ashore, the Pearl at anchor',
    ground: { style: 'sand', colors: ['#ecd9a6', '#dcc28a', '#b49a68'] },
    sky: { zenith: '#2a8ad8', horizon: '#d2f0f4', sun: '#fff8e0' },
    models: {
      ship: { url: '/games/caribbean/pearl.glb', long: 46 },
      palm: { url: '/models/galaxy/surface/palm.glb', tall: 11 },
      chest: { url: '/games/caribbean/chest.glb', wide: 1.1 },
      skull: { url: '/games/caribbean/skull.glb', wide: 34 },
    },
    things: [
      { kind: 'sea', at: [0, 109], r: 0, face: false, strip: [130, 75], opts: { shore: -75, deep: 150 } },
      { kind: 'pearl', at: [-14, 82], r: 0, face: false, yaw: 1.2, solid: false },
      { kind: 'skull', at: [50, 80], r: 0, solid: false },
      { kind: 'rowboat', at: [-16, 26], r: 2.2, face: false, yaw: 0.3, door: { label: 'the rowboat, out to the Pearl', reach: 4 } },
      { kind: 'figure', at: [-10, 22], r: 0.4, say: { name: 'Jack', line: 'This is the day you will always remember…' }, opts: { url: '/games/caribbean/jack.glb', tall: 1.78 } },
      { kind: 'chest', at: [18, 20], r: 0.8 },
      { kind: 'cargo', at: [24, 14], r: 1.6 },
      { kind: 'fire', at: [-24, 8], r: 1 },
    ],
    scatter: [
      { kind: 'palm', n: 14, from: 24, to: 90, scale: range(1) },
      { kind: 'shells', n: 120, from: 3, to: 34, scale: range(1), solid: false },
    ],
    // the Caribbean (scripts/planets/caribbean.mjs): Tortuga where the bake
    // lays it (onTortuga, by place: too small for the 256 × 128 copy, whose
    // cells there read sea), the banks' and coasts' turquoise shallows, the
    // sea (every blue to teal the reef doesn't take: on to the nearest land,
    // 64 strides out, as most of this globe is open sea), and an island's beach
    biomes: [
      {
        id: 'tortuga',
        match: (c, at) => onTortuga(at),
        title: 'Tortuga',
        sub: 'Pirates of the Caribbean · the port, the Faithful Bride’s lamps lit',
        ground: { style: 'sand', colors: ['#b49a70', '#9a8260', '#6a5640'] },
        models: { port: { url: '/games/caribbean/port.glb', wide: 44 } },
        things: [
          { kind: 'sea', at: [0, 109], r: 0, face: false, strip: [130, 75], opts: { shore: -75, deep: 150 } },
          { kind: 'pearl', at: [-30, 92], r: 0, face: false, yaw: 1.2, solid: false },
          { kind: 'port', at: [34, 52], r: 22, yaw: -0.5 },
          { kind: 'rowboat', at: [-16, 26], r: 2.2, face: false, yaw: 0.3, door: { label: 'the rowboat, out to the Pearl', reach: 4 } },
          { kind: 'figure', at: [-8, 24], r: 0.4, say: { name: 'Jack', line: 'If every town in the world were like this one, no man would ever feel unwanted.' }, opts: { url: '/games/caribbean/jack.glb', tall: 1.78 } },
          { kind: 'cargo', at: [-30, 30], r: 1.6, opts: { seed: 3 } },
          { kind: 'cargo', at: [12, 24], r: 1.6, opts: { seed: 7 } },
          { kind: 'fire', at: [-26, 6], r: 1 },
        ],
        scatter: [{ kind: 'shells', n: 40, from: 3, to: 30, scale: range(1), solid: false }],
      },
      {
        id: 'reef',
        match: (c) => hue(c, 160, 195) && c.l >= 0.46 && c.s >= 0.3,
        title: 'A reef flat',
        sub: 'Pirates of the Caribbean · the shallows at low tide, the Pearl standing off',
        ground: { style: 'sand', colors: ['#e0d4a8', '#d0c294', '#5fbcb4'] },
        sky: { zenith: '#2a8ad8', horizon: '#d2f4f4', sun: '#fff8e0' },
        things: [
          { kind: 'sea', at: [0, 90], r: 0, face: false, strip: [130, 60], opts: { shore: -60, deep: 120 } },
          { kind: 'pearl', at: [-14, 82], r: 0, face: false, yaw: 1.2, solid: false },
          { kind: 'rowboat', at: [-16, 26], r: 2.2, face: false, yaw: 0.3, door: { label: 'the rowboat, out to the Pearl', reach: 4 } },
          { kind: 'figure', at: [-10, 22], r: 0.4, say: { name: 'Jack', line: 'Not all treasure is silver and gold, mate.' }, opts: { url: '/games/caribbean/jack.glb', tall: 1.78 } },
          { kind: 'chest', at: [18, 20], r: 0.8 },
        ],
        scatter: [
          { kind: 'shells', n: 260, from: 3, to: 60, scale: range(1), solid: false },
          { kind: 'coral', n: 90, from: 6, to: 60, scale: range(1), solid: false },
        ],
      },
      { id: 'sea', sea: true, reach: 64, match: (c) => hue(c, 165, 260) },
      { id: 'beach' },
    ],
  },
  invincible: {
    title: 'The Graysons’ city',
    sub: 'Invincible · after Omni-Man came through',
    ground: { style: 'asphalt', colors: ['#5d5e5c', '#6c6b68', '#c9b98a'] },
    sky: { zenith: '#3a5fa0', horizon: '#f0b07a', sun: '#ffd8a8' },
    models: { ...PROP },
    things: [
      { kind: 'skyline', at: [0, 0], r: 0, face: false, around: true },
      { kind: 'crater', at: [-8, 36], r: 11, door: { label: 'the city', reach: 13 } },
      { kind: 'figure', at: [6, 30], r: 0.4, say: { name: 'Mark', line: 'Think, Mark!' }, opts: { url: '/models/invincible/mark.glb', tall: 1.78 } },
      { kind: 'wreck', at: [20, 24], r: 2.4, face: false, yaw: 0.7 },
      { kind: 'wreck', at: [-26, 18], r: 2.4, face: false, yaw: 2.2, opts: { color: '#2f4f7a', side: true } },
      { kind: 'wreck', at: [10, 48], r: 2.4, face: false, yaw: 1.4, opts: { color: '#c9c3b4' } },
      // what's left standing of the street (its lights, its signs, a
      // planter, the bollards), and what the fight threw down it: AC units
      // off the roofs, a café's tables and chairs
      { kind: 'trafficLight', at: [24, 36], r: 0.35, face: false, yaw: 0.4 },
      { kind: 'streetlight', at: [-22, 30], r: 0.35 },
      { kind: 'streetlight', at: [30, 8], r: 0.35 },
      { kind: 'stopSign', at: [14, 20], r: 0.3, face: false, yaw: 2.6 },
      { kind: 'planter', at: [-20, 44], r: 1.3 },
      ...[12, 13.6, 15.2].map((x) => ({ kind: 'bollard', at: [x, 39.5], r: 0.2 })),
      { kind: 'ac', at: [16, 31], r: 0.5, face: false, yaw: 0.9 },
      { kind: 'ac', at: [-4, 24], r: 0.5, face: false, yaw: 2.3 },
      { kind: 'table', at: [30, 16], r: 0.8, face: false, yaw: 0.7 },
      { kind: 'chair', at: [27.6, 17.4], r: 0.3, face: false, yaw: 1.9 },
      { kind: 'chair', at: [31.8, 13.6], r: 0.3, face: false, yaw: -2.2 },
      { kind: 'stool', at: [28.4, 13.8], r: 0.3, face: false, yaw: 0.2 },
    ],
    scatter: [
      { kind: 'rubble', n: 160, from: 4, to: 60, scale: range(1.2), solid: false },
      { kind: 'glass', n: 120, from: 3, to: 50, scale: range(1), solid: false },
    ],
    // the war-worn world (scripts/build-invincible-planet.mjs): its pale
    // rust plateaus, out of town; the dark old sea beds, the city
    biomes: [
      {
        id: 'badlands',
        match: (c) => c.l > 0.55,
        title: 'The badlands',
        sub: 'Invincible · miles out of town, where the fight threw them',
        ground: { style: 'sand', colors: ['#c8865a', '#b07048', '#6a3a2a'] },
        sky: { zenith: '#3a5fa0', horizon: '#f0b07a', sun: '#ffd8a8' },
        things: [
          { kind: 'crater', at: [-8, 36], r: 11, door: { label: 'the city', reach: 13 } },
          { kind: 'figure', at: [6, 30], r: 0.4, say: { name: 'Mark', line: 'I’d still have you, Dad.' }, opts: { url: '/models/invincible/mark.glb', tall: 1.78 } },
          { kind: 'crater', at: [44, 60], r: 14, opts: { r: 12, seed: 8 } },
          { kind: 'wreck', at: [20, 24], r: 2.4, face: false, yaw: 0.7 },
        ],
        scatter: [
          { kind: 'rubble', n: 120, from: 4, to: 80, scale: range(1.4), solid: false },
          { kind: 'rock', n: 50, from: 24, to: 110, scale: range(1.8), opts: { color: '#8a4a30', sharp: 0.6, seed: 2 } },
        ],
      },
      { id: 'city' },
    ],
  },
  // the Harry Potter world (scripts/planets/potter.mjs): the shore of the
  // Black Lake, the castle across the water (./potter.js). Hagrid by the
  // boats waits for the Hogwarts cast's figure: none of the site's own
  // stands in for him.
  potter: {
    title: 'The shore of the Black Lake',
    sub: 'Hogwarts · the night the first-years come',
    ground: { style: 'grass', colors: ['#3e4a34', '#4f5a3e', '#77746c'] },
    sky: { zenith: '#1a2446', horizon: '#e89a5a', sun: '#ffd0a0' },
    wind: { strength: 0.3 },
    models: {
      pine: tree('Pine_5', { tall: 14, tint: '#9aa898' }),
      pineTall: tree('Pine_4', { tall: 17, tint: '#8a9a8c' }),
      tufts: grass('Grass_Common_Short', { tall: 0.55, tint: '#b8b490' }),
      crag: rocks('Rock_Medium_1', { long: 1.4, tint: '#8a8a88' }),
    },
    things: [
      { kind: 'loch', at: [0, 109], r: 0, face: false, strip: [150, 75], opts: { shore: -75, deep: 160 } },
      { kind: 'castle', at: [12, 124], r: 60, solid: false },
      { kind: 'boat', at: [-15, 34], r: 2.2, face: false, yaw: ROUND, opts: { seed: 1 } },
      { kind: 'boat', at: [-9.5, 35.2], r: 2.2, face: false, yaw: ROUND - 0.08, opts: { seed: 2 } },
      { kind: 'boat', at: [-4, 34.4], r: 2.2, face: false, yaw: ROUND + 0.06, opts: { seed: 3 } },
      { kind: 'boat', at: [1.5, 35.6], r: 2.2, face: false, yaw: ROUND - 0.04, opts: { lantern: true, seed: 4 }, door: { label: 'Hogwarts', reach: 6 } },
      { kind: 'lanternPost', at: [6.5, 31], r: 0.4 },
      { kind: 'owlPost', at: [-21, 28], r: 0.4 },
    ],
    scatter: [
      { kind: 'pine', n: 26, from: 40, to: 110, scale: range(1) },
      { kind: 'pineTall', n: 12, from: 50, to: 110, scale: range(1) },
      { kind: 'crag', n: 14, from: 24, to: 80, scale: range(1.2) },
      { kind: 'shingle', n: 220, from: 3, to: 40, scale: range(1), solid: false },
      { kind: 'tufts', n: 200, from: 6, to: 70, scale: range(1), solid: false },
      { kind: 'heather', n: 60, from: 14, to: 80, scale: range(1), solid: false },
    ],
    // the world's own map: its seas and lochs; the Black Lake's shore by
    // place (its middle where the bake prints it, its crag 2.4 degrees on);
    // the Highlands' pinewoods; their moors of heather, bracken and rock;
    // and the green country, the shore as above
    biomes: [
      { id: 'sea', sea: true, match: (c) => hue(c, 180, 240) && c.s > 0.15 && c.l < 0.45 },
      { id: 'loch', near: [55.44, -20.0, 3] },
      {
        id: 'forest',
        match: (c) => c.l < 0.21 && hue(c, 85, 175),
        title: 'The forest’s edge',
        sub: 'Hogwarts · where the Forbidden Forest begins, and the path goes no further',
        ground: { style: 'grass', colors: ['#202a1c', '#2a3424', '#3a3428'] },
        sky: { zenith: '#121a30', horizon: '#4a5060', sun: '#c8b8a0', haze: '#363c48' },
        wind: { strength: 0.2 },
        things: [
          { kind: 'lanternPost', at: [-4, 26], r: 0.4, door: { label: 'Hogwarts', reach: 6 } },
          { kind: 'glimmer', at: [18, 62], r: 0.5, solid: false },
        ],
        scatter: [
          { kind: 'pine', n: 60, from: 24, to: 110, scale: range(1) },
          { kind: 'pineTall', n: 40, from: 26, to: 110, scale: range(1.1) },
          { kind: 'tufts', n: 120, from: 4, to: 60, scale: range(0.8), solid: false },
        ],
      },
      {
        id: 'moor',
        // (and the bare tops, their rock and their snow)
        match: (c) => ((hue(c, 280, 360) || hue(c, 0, 50)) && c.s >= 0.08 && c.l > 0.18 && c.l < 0.55) || (c.s < 0.1 && c.l > 0.3) || c.l > 0.75,
        title: 'The moor',
        sub: 'Hogwarts · heather and a stone circle, the castle far off',
        ground: { style: 'grass', colors: ['#4a3e48', '#5a4a40', '#6a6a50'] },
        sky: { zenith: '#1e2a50', horizon: '#d08860', sun: '#ffd0a0' },
        wind: { strength: 0.5 },
        things: [
          { kind: 'stoneCircle', at: [-8, 42], r: 9 },
          { kind: 'castle', at: [40, 150], r: 60, solid: false },
          { kind: 'lanternPost', at: [8, 26], r: 0.4, door: { label: 'Hogwarts', reach: 6 } },
        ],
        scatter: [
          { kind: 'heather', n: 260, from: 4, to: 90, scale: range(1.1), solid: false },
          { kind: 'crag', n: 24, from: 24, to: 110, scale: range(1.4) },
          { kind: 'tufts', n: 120, from: 4, to: 80, scale: range(0.9), solid: false },
        ],
      },
      { id: 'loch' },
    ],
  },
  // ── the Rick and Morty system's moons, round the Citadel (universes.js's MOONS; ./rmmoons.js) ──
  gazorpazorp: {
    title: 'Gazorpazorp',
    sub: 'Rick and Morty · the men’s desert, the women’s gate',
    ground: { style: 'sand', colors: ['#c85a3a', '#e08a5a', '#8a3a2a'] },
    sky: { zenith: '#4a1a4a', horizon: '#f2b070', sun: '#ffd8a0' },
    models: {
      gate: { url: '/models/c137/rm/gazorpgate.glb', tall: 9 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'Gazorpazorp, through the portal', reach: 3 } },
      { kind: 'gate', at: [0, 52], r: 5 },
      { kind: 'figure', at: [0, 44], r: 0.4, say: { name: 'Mar-Sha', line: 'A boy. From the sky. We make an exception for a Morty.' }, opts: { meshy: 'marsha', tall: 2.3 } },
      { kind: 'figure', at: [22, 30], r: 0.5, say: { name: 'A Gazorpian', line: 'RAAARGH. (He throws a rock at a rock.)' }, opts: { meshy: 'gazorpian', tall: 2.8 } },
      { kind: 'figure', at: [26, 26], r: 0.5, opts: { meshy: 'gazorpian', tall: 2.8 } },
      { kind: 'figure', at: [-14, 34], r: 0.4, say: { name: 'Morty Jr.', line: 'Dad? You’re back? I wrote a book about you. It isn’t kind.' }, opts: { meshy: 'mortyjr', tall: 2.0 } },
      { kind: 'rock', at: [16, 44], r: 2.6, face: false, opts: { seed: 3, size: 2.4 } },
      { kind: 'rock', at: [-26, 24], r: 3, face: false, opts: { seed: 7, size: 3 } },
    ],
    scatter: [
      { kind: 'rock', n: 60, from: 24, to: 110, scale: range(1), opts: { color: '#8a3a2a' } },
      { kind: 'bone', n: 30, from: 20, to: 80, scale: range(1), solid: false },
    ],
  },
  squanch: {
    title: 'Planet Squanch',
    sub: 'Rick and Morty · Squanchy’s planet, red grass and cat trees',
    ground: { style: 'grass', colors: ['#b83a3a', '#d85a4a', '#7a2a2a'] },
    sky: { zenith: '#2a8a9a', horizon: '#f2d8b8', sun: '#fff0d8' },
    models: {
      house: { url: '/models/c137/rm/squanchy-house.glb', tall: 9 },
      guest: { url: '/models/c137/rm/magdalian-a.glb', tall: 1.55 },
      guest2: { url: '/models/c137/rm/magdalian-c.glb', tall: 1.6 },
      suckulent: { url: '/models/c137/rm/suckulent.glb', tall: 2.2 },
      smallsuckulent: { url: '/models/c137/rm/sm/suckulent.glb', tall: 1.6 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'Planet Squanch, through the portal', reach: 3 } },
      { kind: 'house', at: [-16, 50], r: 4 },
      { kind: 'figure', at: [-8, 36], r: 0.4, say: { name: 'Squanchy', line: 'You squanch what you squanch, Morty. Welcome to my squanch.' }, opts: { meshy: 'squanchy', tall: 1.15 } },
      { kind: 'figure', at: [10, 40], r: 0.4, say: { name: 'Birdperson', line: 'Morty. You have come a long way. It is good to see a friend.' }, opts: { meshy: 'birdperson', tall: 2.0 } },
      { kind: 'guest', at: [4, 30], r: 0.4 },
      { kind: 'guest2', at: [16, 32], r: 0.4 },
      { kind: 'suckulent', at: [24, 44], r: 1.2, yaw: 0.8 },
      { kind: 'suckulent', at: [-28, 30], r: 1.2, yaw: -1.4 },
    ],
    scatter: [
      { kind: 'cattree', n: 10, from: 40, to: 120, scale: range(1) },
      { kind: 'smallsuckulent', n: 14, from: 26, to: 100, scale: range(0.8) },
    ],
  },
  birdworld: {
    title: 'Bird World',
    sub: 'Rick and Morty · Birdperson’s home, the nest on the rocks',
    ground: { style: 'grass', colors: ['#4a8a3a', '#6aa84a', '#8a6a3a'] },
    sky: { zenith: '#3a7ad8', horizon: '#d8f0f8', sun: '#fff8e8' },
    models: {
      nest: { url: '/models/c137/rm/birdperson-house.glb', tall: 14 },
      perch: { url: '/models/c137/rm/birdperch.glb', tall: 6 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'Bird World, through the portal', reach: 3 } },
      { kind: 'nest', at: [0, 56], r: 7 },
      { kind: 'figure', at: [-4, 40], r: 0.4, say: { name: 'Phoenixperson', line: '(A hum of servos. He looks at you for a long time, and does not fire.)' }, opts: { meshy: 'phoenixperson', tall: 2.05 } },
      { kind: 'figure', at: [12, 36], r: 0.4, say: { name: 'Unity', line: 'We are all of us. Welcome to Bird World, Morty. The locals are a little quiet.' }, opts: { meshy: 'unity', tall: 1.75 } },
      { kind: 'perch', at: [20, 46], r: 2 },
      { kind: 'perch', at: [-22, 44], r: 2 },
      { kind: 'rock', at: [26, 30], r: 3, face: false, opts: { seed: 11, size: 3, color: '#6a6a60' } },
    ],
    scatter: [
      { kind: 'rock', n: 40, from: 26, to: 110, scale: range(1), opts: { color: '#6a6a60' } },
      { kind: 'feather', n: 50, from: 10, to: 70, scale: range(1), solid: false },
    ],
  },
  gearworld: {
    title: 'Gear World',
    sub: 'Rick and Morty · everything here is a gear, and so is everyone',
    ground: { style: 'plating', colors: ['#b88a3a', '#d8aa5a', '#6a4a2a'] },
    sky: { zenith: '#5a4a2a', horizon: '#d8b070', sun: '#ffe8b0' },
    models: {
      gearperson: { url: '/models/c137/rm/gearperson-a.glb', tall: 1.8 },
      gearperson2: { url: '/models/c137/rm/gearperson-b.glb', tall: 1.8 },
      monument: { url: '/models/c137/rm/gearbig.glb', tall: 12 },
      cog: { url: '/models/c137/rm/gearcog.glb', wide: 5 },
      smallcog: { url: '/models/c137/rm/sm/gearcog.glb', wide: 1.8 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'Gear World, through the portal', reach: 3 } },
      { kind: 'figure', at: [2, 38], r: 0.4, say: { name: 'Gearhead', line: 'Rick! Oh. Not Rick. Everyone’s best friend, Gearhead. Welcome to Gear World.' }, opts: { meshy: 'gearhead', tall: 1.8 } },
      { kind: 'gearperson', at: [-12, 34], r: 0.4 },
      { kind: 'gearperson2', at: [14, 30], r: 0.4 },
      { kind: 'monument', at: [0, 56], r: 5 },
      { kind: 'cog', at: [24, 40], r: 2.4, yaw: 0.3 },
      { kind: 'cog', at: [-26, 28], r: 2.4, yaw: 1.1 },
    ],
    scatter: [
      { kind: 'smallcog', n: 20, from: 24, to: 110, scale: range(1) },
      { kind: 'bolt', n: 60, from: 10, to: 80, scale: range(1), solid: false },
    ],
  },
  pluto: {
    title: 'Pluto',
    sub: 'Rick and Morty · it’s a planet, and its king will tell you so',
    ground: { style: 'sand', colors: ['#a8b4c8', '#d0dae8', '#6a7488'] },
    sky: { zenith: '#0a0e1e', horizon: '#3a4a6a', sun: '#f0f4ff', space: 0.7 },
    models: {
      plutonian: { url: '/models/c137/rm/plutonian-a.glb', tall: 1.35 },
      plutonian2: { url: '/models/c137/rm/plutonian-b.glb', tall: 1.35 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'Pluto, through the portal', reach: 3 } },
      { kind: 'figure', at: [0, 44], r: 0.4, say: { name: 'King Flippy Nips', line: 'Pluto is a planet! Say it with me, boy. Say it with the whole court.' }, opts: { meshy: 'flippynips', tall: 1.5 } },
      { kind: 'figure', at: [18, 36], r: 0.4, say: { name: 'Scroopy Noopers', line: 'Pluto is shrinking. The plutonium mines. Nobody listens to Scroopy.' }, opts: { meshy: 'scroopy', tall: 1.4 } },
      { kind: 'plutonian', at: [-10, 38], r: 0.4 },
      { kind: 'plutonian2', at: [-16, 42], r: 0.4 },
      { kind: 'plutonian', at: [8, 50], r: 0.4 },
      { kind: 'rock', at: [26, 30], r: 3, face: false, opts: { seed: 13, size: 3, color: '#8a94a8' } },
    ],
    scatter: [{ kind: 'rock', n: 50, from: 24, to: 110, scale: range(1), opts: { color: '#8a94a8' } }],
  },
  snakeplanet: {
    title: 'Snake Planet',
    sub: 'Rick and Morty · the snakes have a space programme, and you’re on their planet',
    ground: { style: 'grass', colors: ['#5a8a3a', '#7ab84a', '#3a5a2a'] },
    sky: { zenith: '#2a6a5a', horizon: '#d8f0b8', sun: '#fff8d0' },
    models: {
      rocket: { url: '/models/c137/rm/snakerocket.glb', tall: 12 },
      astronaut: { url: '/models/c137/rm/snakeastronaut.glb', tall: 1.2 },
      snake: { url: '/models/c137/rm/snake-a.glb', tall: 0.9 },
      snake2: { url: '/models/c137/rm/snake-b.glb', tall: 0.9 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'Snake Planet, through the portal', reach: 3 } },
      { kind: 'rocket', at: [0, 56], r: 3.5 },
      { kind: 'astronaut', at: [6, 46], r: 0.5 },
      { kind: 'astronaut', at: [-5, 47], r: 0.5 },
      { kind: 'snake', at: [-12, 34], r: 0.5 },
      { kind: 'snake2', at: [14, 32], r: 0.5 },
      { kind: 'snake', at: [22, 44], r: 0.5 },
      { kind: 'rock', at: [-26, 30], r: 3, face: false, opts: { seed: 17, size: 3, color: '#5a5a40' } },
    ],
    scatter: [{ kind: 'rock', n: 40, from: 26, to: 110, scale: range(1), opts: { color: '#5a5a40' } }],
  },
  nuptia: {
    title: 'Nuptia 4',
    sub: 'Rick and Morty · couples’ counselling, where what you see in each other comes to life',
    ground: { style: 'tiles', colors: ['#d8a8c8', '#f0d0e4', '#8a5a7a'] },
    sky: { zenith: '#6a2a6a', horizon: '#ffd8ec', sun: '#fff0f8' },
    models: {
      machine: { url: '/models/c137/rm/nuptiamachine.glb', tall: 2.2 },
      mytholog: { url: '/models/c137/rm/mytholog.glb', tall: 2.4 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'Nuptia 4, through the portal', reach: 3 } },
      { kind: 'figure', at: [0, 40], r: 0.4, say: { name: 'Glexo Slim Slom', line: 'Welcome to Nuptia 4. We ask every couple one question: what do you see when you look at each other? Then we show them.' }, opts: { meshy: 'glexo', tall: 1.85 } },
      { kind: 'machine', at: [8, 46], r: 1.6 },
      { kind: 'machine', at: [-8, 46], r: 1.6 },
      { kind: 'mytholog', at: [24, 56], r: 1.4 },
      { kind: 'mytholog', at: [-26, 52], r: 1.4 },
    ],
    scatter: [{ kind: 'rock', n: 30, from: 30, to: 110, scale: range(1), opts: { color: '#8a5a7a' } }],
  },
  resort: {
    title: 'Immortality Field Resort',
    sub: 'Rick and Morty · inside the field nothing can hurt you; the Whirly Dirly goes outside it',
    ground: { style: 'sand', colors: ['#e8d8a0', '#f4e8c0', '#b8a070'] },
    sky: { zenith: '#3a9ad8', horizon: '#e0f8ff', sun: '#fffbe8' },
    models: {
      guest: { url: '/models/c137/rm/resortguest-a.glb', tall: 1.7 },
      guest2: { url: '/models/c137/rm/resortguest-b.glb', tall: 1.95 },
      dirly: { url: '/models/c137/rm/dirlycar.glb', tall: 2.2 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'the Immortality Field Resort, through the portal', reach: 3 } },
      { kind: 'figure', at: [0, 40], r: 0.4, say: { name: 'Risotto Groupon', line: 'Welcome to the Immortality Field Resort. Inside the field, nothing can hurt you. Outside it, everything can.' }, opts: { meshy: 'risotto', tall: 1.9 } },
      { kind: 'dirly', at: [16, 50], r: 2.4 },
      { kind: 'guest', at: [-8, 34], r: 0.4 },
      { kind: 'guest2', at: [10, 32], r: 0.4 },
      { kind: 'guest', at: [-18, 44], r: 0.4 },
      { kind: 'guest2', at: [24, 38], r: 0.4 },
    ],
    scatter: [{ kind: 'rock', n: 24, from: 34, to: 110, scale: range(1), opts: { color: '#b8a070' } }],
  },
  cronenberg: {
    title: 'Cronenberg World',
    sub: 'Rick and Morty · the Earth they left behind, and the Smiths who stayed',
    ground: { style: 'grass', colors: ['#6a7a3a', '#8a9a4a', '#5a4a3a'] },
    sky: { zenith: '#3a2a3a', horizon: '#c8a08a', sun: '#ffc8a0' },
    models: {
      house: { url: '/models/c137/rm/cronhouse.glb', tall: 8.6 },
      car: { url: '/models/c137/rm/croncar.glb', tall: 1.6 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'Cronenberg World, through the portal', reach: 3 } },
      { kind: 'house', at: [-12, 56], r: 11 },
      { kind: 'car', at: [18, 40], r: 2.8, face: false, yaw: 0.6 },
      { kind: 'figure', at: [-6, 38], r: 0.4, say: { name: 'Beth', line: 'Morty? You look… the same. How are you the same?' }, opts: { meshy: 'beth', tall: 1.68 } },
      { kind: 'figure', at: [-12, 36], r: 0.4, say: { name: 'Jerry', line: 'We lived, Morty. No Rick, no portal gun, just us and a lot of spears. I’ve never been happier.' }, opts: { meshy: 'jerry', tall: 1.78 } },
      { kind: 'figure', at: [-1, 35], r: 0.4, say: { name: 'Summer', line: 'I have a spear now. It’s fine. Everything’s fine.' }, opts: { meshy: 'summer', tall: 1.6 } },
      { kind: 'figure', at: [16, 28], r: 0.6, opts: { meshy: 'cronenberg', tall: 1.45 } },
      { kind: 'figure', at: [26, 50], r: 0.6, opts: { meshy: 'cronenberg', tall: 1.45 } },
      { kind: 'figure', at: [32, 64], r: 1.6, say: { name: 'A Cronenberg', line: '(It gurgles at you from somewhere in the middle of itself.)' }, opts: { meshy: 'bigcronenberg', tall: 3.9 } },
    ],
    scatter: [{ kind: 'rock', n: 40, from: 26, to: 110, scale: range(1), opts: { color: '#6a5a4a' } }],
  },
  purge: {
    title: 'The Purge Planet',
    sub: 'Rick and Morty · a quiet farming village of cat people, one night a year',
    ground: { style: 'sand', colors: ['#b8945a', '#d8b878', '#7a5a3a'] },
    sky: { zenith: '#1c2350', horizon: '#f2a070', sun: '#ffd2a0' },
    models: {
      cabin: { url: '/models/c137/rm/purgecottage.glb', tall: 6 },
      barn: { url: '/models/c137/rm/purgebarn.glb', tall: 9.5 },
      bell: { url: '/models/c137/rm/purgesiren.glb', tall: 7 },
      well: { url: '/models/c137/rm/purgewell.glb', tall: 2.8 },
      villager: { url: '/models/c137/rm/magdalian-a.glb', tall: 1.55 },
      villager2: { url: '/models/c137/rm/magdalian-b.glb', tall: 1.55 },
      villager3: { url: '/models/c137/rm/magdalian-c.glb', tall: 1.6 },
    },
    things: [
      { kind: 'portal', at: [-20, 17], r: 1.6, door: { label: 'the Purge Planet, through the portal', reach: 3 } },
      { kind: 'figure', at: [2, 38], r: 0.4, say: { name: 'Arthricia', line: 'You’re not from here. Tonight’s the purge, and anything goes. If the bell rings, run for your portal.' }, opts: { meshy: 'arthricia', tall: 1.6 } },
      { kind: 'bell', at: [-14, 32], r: 2 },
      { kind: 'well', at: [8, 32], r: 1.6 },
      { kind: 'cabin', at: [-26, 46], r: 5 },
      { kind: 'cabin', at: [24, 48], r: 5 },
      { kind: 'barn', at: [0, 64], r: 7 },
      { kind: 'villager', at: [-6, 42], r: 0.4 },
      { kind: 'villager2', at: [12, 40], r: 0.4 },
      { kind: 'villager3', at: [16, 56], r: 0.4 },
    ],
    scatter: [{ kind: 'rock', n: 30, from: 30, to: 110, scale: range(1), opts: { color: '#8a6a4a' } }],
  },
};

export const landingOf = (id) => LANDINGS[id] ?? null;

// a number from a planet's id, for laying its landing out the same for
// everyone who lands there
export function seedOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Where `n` of a scatter entry go ([{ x, z, s, yaw }], metres): spread
// evenly over the ring `from`…`to` out, each `reach` (its footprint at
// scale 1, metres) clear of the things (and, if it's solid, of the ship)
export function scatterSpots(entry, things, rand, { n = entry.n, reach = 0.5 } = {}) {
  const out = [];
  const [s0, s1] = entry.scale ?? [1, 1];
  for (let tries = 0; out.length < n && tries < n * 12; tries++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(entry.from ** 2 + rand() * (entry.to ** 2 - entry.from ** 2));
    const x = Math.sin(a) * d;
    const z = Math.cos(a) * d;
    const s = s0 + rand() * (s1 - s0);
    const r = reach * s;
    if (entry.solid !== false && d - r < CLEAR) continue;
    if (things.some((t) => (t.strip ? Math.abs(t.at[0] - x) < t.strip[0] + r && Math.abs(t.at[1] - z) < t.strip[1] + r : Math.hypot(t.at[0] - x, t.at[1] - z) < t.r + r + 1))) continue;
    out.push({ x, z, s, yaw: rand() * Math.PI * 2 });
  }
  return out;
}
