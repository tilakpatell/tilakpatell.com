// Dot Matrix, the world: a Game Boy island to walk and jump about in, drawn
// in the handheld's four greens. This is the island and its rules, with no
// drawing in it: the tile map and how high each tile stands, the hero's
// walking, jumping and landing, what there is to pick up, what bites, and
// what the B button does where you're standing. ./scene.js draws it;
// ./DotMatrixWorld.jsx reads the keys and keeps the score.
//
// The island is a grid of one-unit tiles, x east and z south, a tile (ix, iz)
// covering [ix, ix + 1) × [iz, iz + 1). Each tile is a column of solid
// spans [lo, hi] (the ground under it is one from far below up to its top),
// so a "?" block floating over the road, the cloud over the sea and a pipe on
// the cloud are all just spans higher up the same column.
//
// The hero is a box 0.6 across and 0.9 tall, feet at y. He steps up anything
// within STEP of his feet while he's on the ground, falls, lands, and bumps
// his head on the underside of whatever's over him.

// ── the map ──
//
//   ~ sea          , sand          . grass          " long grass
//   = path         : grass, one up ! grass, two up  % grass, three up
//   T tree         Y tree, one up  o boulder        O stepping stone
//   # stone wall   H house         G the Game Boy   P pipe
//   N the N64     C the crafting table
//   B the dock     s a sign        L the lighthouse M the windmill, three up
export const MAP = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 0
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 1
  '~~~~~~~~~~~~~~~~~~~~~~~~,,,,,,,~~~~~~~~~~~~~,,L~', // 2
  '~~~~~~~~~~~~~~~~~,,,,,,,,..T..,,,,~~~~~~~~~,,.,~', // 3
  '~~~~~~~~~~~~~~,,,T...T....T.....,,,~~~~~~~~~,,,~', // 4
  '~~~~~~~~~~~~Y::...T....T..........,,~~~~~~O~~~~~', // 5
  '~~~~~~~~~~~!!::..T...............T.,~~~~O~~~~~~~', // 6
  '~~~~~~~~~%%!!!::........T..........,,~O~~~~~~~~~', // 7
  '~~~~~~~~%%%%%!!::...T.........s.....,~~~~~~~~~~~', // 8
  '~~~~~~~!M%%%%%!Y:...............T...,,~~~~~~~~~~', // 9
  '~~~~~~!!!%%%%!!::.==========NNNN.CC..,,~~~~~~~~~', // 10
  '~~~~~~Y:!!!!!!!::.==========NNNN.CC...,,~~~~~~~~', // 11
  '~~~~~~,::!!!!!:::.=====GGGG=NNNN.......,~~~~~~~~', // 12
  '~~~~~~,,::::::::..=====GGGG=====.##########~~~~~', // 13
  '~~~~~~,,.:::::.T..==============.#........#~~~~~', // 14
  '~~~~~~,...........==============.#........#~~~~~', // 15
  '~~~~~~,"""..."""..================........#,~~~~', // 16
  '~~~~~,,""""o""".."======s=========........#,~~~~', // 17
  '~~~~~,""""..."""..........====..s#........#.,~~~', // 18
  '~~~~,,"""""."""...........====...#........#.,~~~', // 19
  '~~~~,=========================...#........#..,~~', // 20
  '~~~~,=========================...##########..,,~', // 21
  '~~~~,""".""".."""s........====...............,~~', // 22
  '~~~,,""""""".""""".HHH....====.HHH............,~', // 23
  '~~~,,T""""""."""".oHHH....====.HHH.......T...,~~', // 24
  '~~~~,"""""""."""""........====......o......T.,~~', // 25
  '~~~~,,""""""""""".........====...............,~~', // 26
  '~~~~~,,."""""""..T........====.....P...P....,,~~', // 27
  '~~~~~~,...................====.......P.......,~~', // 28
  '~~~~~~,,..T...........T...====...s..PPP....,,~~~', // 29
  '~~~~~~~,.......TT.........====.P.....P.....,~~~~', // 30
  '~~~~~~~,,.................====.....P...P..,,~~~~', // 31
  '~~~~~~~~,,..........T.....====...........,,~~~~~', // 32
  '~~~~~~~~~,,,,,,,,,,,,,,,,s====,,,,,T,,,,,,~~~~~~', // 33
  '~~~~~~~~~~~~,,,,,,,,,,,,,,====,,,,,,,,,,~~~~~~~~', // 34
  '~~~~~~~~~~~~~~~,,,,,,,,,,,BBBB,,,,,,,~~~~~~~~~~~', // 35
  '~~~~~~~~~~~~~~~~~~~~~~~~~~BBBB~~~~~~~~~~~~~~~~~~', // 36
  '~~~~~~~~~~~~~~~~~~~~~~~~~~BBBB~~~~~~~~~~~~~~~~~~', // 37
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 38
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 39
];
export const W = MAP[0].length;
export const H = MAP.length;

// what each letter is: its kind, the ground it stands on, and how high its
// top is (a tree's is its crown: nobody stands up there)
export const SEA = -0.6; // the sea floor, as far as falling goes
export const WATER = -0.32; // the water's surface
const LEGEND = {
  '~': { kind: 'sea', ground: SEA, top: SEA },
  ',': { kind: 'sand', ground: 0, top: 0 },
  '.': { kind: 'grass', ground: 0, top: 0 },
  '"': { kind: 'long', ground: 0, top: 0 },
  '=': { kind: 'path', ground: 0, top: 0 },
  ':': { kind: 'grass', ground: 1, top: 1 },
  '!': { kind: 'grass', ground: 2, top: 2 },
  '%': { kind: 'grass', ground: 3, top: 3 },
  T: { kind: 'tree', ground: 0, top: 4.5 },
  Y: { kind: 'tree', ground: 1, top: 5.5 },
  o: { kind: 'boulder', ground: 0, top: 1 },
  O: { kind: 'stone', ground: SEA, top: 0.3 },
  '#': { kind: 'wall', ground: 0, top: 1.6 },
  H: { kind: 'house', ground: 0, top: 2 },
  G: { kind: 'gameboy', ground: 0, top: 7 },
  N: { kind: 'n64', ground: 0, top: 1.1 },
  C: { kind: 'craft', ground: 0, top: 2 },
  P: { kind: 'pipe', ground: 0, top: 1.25 },
  B: { kind: 'dock', ground: SEA, top: 0 },
  s: { kind: 'sign', ground: 0, top: 1.1 },
  L: { kind: 'lighthouse', ground: 0, top: 4.6 },
  M: { kind: 'mill', ground: 3, top: 7 },
};
export const legend = (c) => LEGEND[c] ?? LEGEND['~'];

// Block Drop tower: a spiral of stacked pieces, one up each step round, to
// the cartridge on top. [ix, iz, top]
export const TOWER = [
  [29, 6, 1],
  [30, 6, 2],
  [31, 6, 3],
  [31, 5, 4],
  [31, 4, 5],
  [30, 4, 6],
  [29, 4, 7],
  [29, 5, 8],
  [30, 5, 9],
];

// "?" blocks, hanging where a jump from the ground bumps them from below.
// One has a heart in it; the rest a coin each.
export const BLOCK_LO = 2;
export const BLOCKS = [
  { id: 'q1', ix: 8, iz: 20 },
  { id: 'q2', ix: 9, iz: 20 },
  { id: 'q3', ix: 10, iz: 20, heart: true },
  { id: 'q4', ix: 11, iz: 20 },
  { id: 'q5', ix: 19, iz: 15 },
  { id: 'q6', ix: 32, iz: 16 },
];

// The cloud over the sea to the south-west, which only a pipe reaches, with
// a pipe of its own to go back by.
export const CLOUD = { x0: 1, z0: 29, x1: 5, z1: 33, lo: 6, top: 7 };
const PIPE_H = 1.25;

// The pipes: the garden's middle one has the cartridge on it, with a plant
// in each pipe round it; four plain ones stand at the garden's corners; and
// the warp between the road and the cloud.
export const PIPES = [
  { id: 'mid', ix: 37, iz: 29 },
  { id: 'n', ix: 37, iz: 28, plant: true },
  { id: 'w', ix: 36, iz: 29, plant: true },
  { id: 'e', ix: 38, iz: 29, plant: true },
  { id: 's', ix: 37, iz: 30, plant: true },
  { id: 'nw', ix: 35, iz: 27 },
  { id: 'ne', ix: 39, iz: 27 },
  { id: 'sw', ix: 35, iz: 31 },
  { id: 'se', ix: 39, iz: 31 },
  { id: 'road', ix: 31, iz: 30, to: 'sky' },
  { id: 'sky', ix: 2, iz: 31, base: CLOUD.top, to: 'road' },
];
const PIPE = Object.fromEntries(PIPES.map((p) => [p.id, p]));
// pipes that aren't on the map (the cloud's) stand on what's under them
for (const p of PIPES) if (p.base == null) p.base = 0;

// The giant Game Boy in the square, facing south, and where to stand to play it.
export const GAMEBOY = { x0: 23, z0: 12, x1: 27, z1: 14, front: { x0: 22.4, x1: 27.6, z0: 14, z1: 16.6 } };

// The giant N64 beside it, lying flat with its cartridge standing up out of
// the top, and where to stand to play it (the Mario 64 tribute,
// ../mario64/). The console is a jump up, and the cartridge another.
export const N64 = { x0: 28, z0: 10, x1: 32, z1: 13, top: 1.1, front: { x0: 27.7, x1: 32.3, z0: 13, z1: 15.4 } };
export const N64_CART = { x0: 29, z0: 11, x1: 31, z1: 12, top: 2.1 };

// The giant crafting table east of it, a block two across and as tall (too
// high to jump onto), and where to stand to play Minecraft at it (the
// tribute, ../minecraft/): on its south side, before the pen's wall.
export const CRAFT = { x0: 33, z0: 10, x1: 35, z1: 12, top: 2, front: { x0: 32.7, x1: 35.3, z0: 12, z1: 13 } };

// The snake's pen: it goes round and round a loop inside the walls, and the
// way in is a gap in the west wall.
export const PEN = { x0: 33, z0: 13, x1: 42, z1: 21 };
export const SNAKE = {
  loop: [
    [35.5, 15.5],
    [40.5, 15.5],
    [40.5, 19.5],
    [35.5, 19.5],
  ],
  length: 8, // segments
  gap: 0.9, // between them, along the loop
  speed: 3.2,
};

// Where you come ashore: the end of the dock, facing the island.
export const START = { x: 28, y: 0, z: 36.2, face: Math.PI };

// The eight cartridges: each one a project (data/projects.js), hidden
// somewhere it takes a little doing to reach. The Game Boy emulator is the
// giant Game Boy itself. [x, y, z] is where it floats; `where` is the hint.
export const CARTRIDGES = [
  { id: 'devspace', at: [10.5, 3, 9.5], where: 'On top of the plateau' },
  { id: 'swaminarayan-translator', at: [30.5, 9, 5.5], where: 'On top of Block Drop tower' },
  { id: 'unix-shell', at: [38, 0, 17.5], where: 'In the snake’s pen' },
  { id: 'fuse-fs', at: [37.5, PIPE_H, 29.5], where: 'Among the plants in the pipe garden' },
  { id: 'gpu-checkpoint-restart', at: [4.5, CLOUD.top, 30.5], where: 'Up on the cloud' },
  { id: 'awesome-copilot', at: [45.5, 0, 3.5], where: 'Out on the islet' },
  { id: 'finance-platform', at: [20.5, 2, 23.5], where: 'On a roof' },
  { id: 'smart-summarizer', at: [8.5, 0, 24.5], where: 'In the long grass' },
];

// Coins, [x, y, z]: along the roads, up the plateau and the tower, over the
// stepping stones, on the cloud.
const ring = (cx, cz, r, n, y) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), y, cz + r * Math.sin((i / n) * Math.PI * 2)]);
export const COINS = [
  // the dock and the south road
  [27.5, 0, 36.5],
  [28.5, 0, 36.5],
  [28, 0, 31.5],
  [28, 0, 29.5],
  [28, 0, 27.5],
  [28, 0, 25.5],
  [28, 0, 23.5],
  // the west road, under the blocks
  [6.5, 0, 21],
  [13.5, 0, 21],
  [15.5, 0, 21],
  [17.5, 0, 21],
  // the square, round the Game Boy
  ...ring(25, 13, 4.2, 6, 0).filter(([x, , z]) => z > 14.5 || x < 21 || x > 29),
  // up the plateau
  [13.5, 1, 13.5],
  [12.5, 2, 11.5],
  [8.5, 3, 8.5],
  // up the tower, one a step
  ...TOWER.slice(0, 8).map(([ix, iz, top]) => [ix + 0.5, top, iz + 0.5]),
  // over the stepping stones
  [38.5, 1, 7.5],
  [40.5, 1, 6.5],
  [42.5, 1, 5.5],
  // the pen's corners
  [34.5, 0, 14.5],
  [41.5, 0, 14.5],
  [34.5, 0, 20.5],
  [41.5, 0, 20.5],
  // the long grass
  [6.5, 0, 17.5],
  [14.5, 0, 25.5],
  [10.5, 0, 27.5],
  // the cloud
  [1.5, CLOUD.top, 29.5],
  [5.5, CLOUD.top, 33.5],
  [1.5, CLOUD.top, 33.5],
  [3.5, CLOUD.top, 32.5],
].map(([x, y, z], i) => ({ id: `c${i}`, x, y: y + 0.55, z }));

// Walkers: little mushrooms that pace up and down. Jump on one to flatten it
// (it's back a while later); walk into one and it hurts.
export const WALKERS = [
  { id: 'w1', from: [6.5, 23.5], to: [15.5, 23.5], speed: 1.3 },
  { id: 'w2', from: [10.5, 16.5], to: [10.5, 27.5], speed: 1.1 },
  { id: 'w3', from: [5.5, 26.5], to: [14.5, 26.5], speed: 1.5 },
  { id: 'w4', from: [19.5, 6.5], to: [27.5, 6.5], speed: 1.2 },
  { id: 'w5', from: [33.5, 26.5], to: [43.5, 26.5], speed: 1.4 },
];
export const WALKER_BACK = 24; // seconds flat before it gets up again

// Signs, and what they say.
export const SIGNS = [
  { id: 'dock', ix: 25, iz: 33, title: 'Dot Matrix island', text: 'Eight cartridges are hidden here, and each one is something I’ve built. The giant Game Boy in the square plays for real.' },
  { id: 'square', ix: 24, iz: 17, title: 'The Game Boy', text: 'Stand in front of it and press B to play: Super Tilak Land, Block Drop and Snake, on the emulator project’s console.' },
  { id: 'pen', ix: 32, iz: 18, title: 'The snake pen', text: 'It never stops going round, and it doesn’t share. Wait for the gap.' },
  { id: 'meadow', ix: 17, iz: 22, title: 'The west meadow', text: 'Walkers in the long grass. Jump on them; don’t walk into them.' },
  { id: 'pipes', ix: 33, iz: 29, title: 'The pipe garden', text: 'Stand on a pipe and its plant stays down. One of these pipes goes somewhere.' },
  { id: 'tower', ix: 30, iz: 8, title: 'Block Drop tower', text: 'Every piece landed just right. One step up at a time, all the way round.' },
];

// The villagers: four islanders who walk a short beat each and stop to talk
// when you come up to them, each with a hint or two about where the
// cartridges are, and a last word once you've found the whole set.
export const TALK_R = 1.6; // they stop and turn to face you from this close
export const VILLAGERS = [
  {
    id: 'nana',
    name: 'Nana',
    from: [18.5, 25.5],
    to: [24.5, 25.5],
    speed: 0.9,
    dwell: 1.6,
    lines: [
      'Welcome, dear. Eight cartridges on this island, they say, and every one of them something he built.',
      'The lad next door keeps climbing onto my roof. Says he left something up there. Use the boulder, if you must.',
      'There’s a plateau up west, three steps high. You can’t jump two at once, so take them one at a time.',
    ],
    done: 'All eight? Well, aren’t you something. Put the kettle on.',
  },
  {
    id: 'fisher',
    name: 'The fisher',
    from: [20.5, 34.5],
    to: [25.5, 34.5],
    speed: 0.8,
    dwell: 2.2,
    lines: [
      'Three stepping stones out to the islet, off the north-east shore. Not one of them where you’d want it.',
      'Fall in and the sea puts you back where you were. It’s that sort of sea.',
      'The snake in the pen never stops. Wait for the gap and go in at the west wall.',
    ],
    done: 'The whole set. I’ll tell the gulls.',
  },
  {
    id: 'gardener',
    name: 'The gardener',
    from: [31.5, 32.5],
    to: [40.5, 32.5],
    speed: 1.0,
    dwell: 1.4,
    lines: [
      'Stand on a pipe and the plant in it stays down. Sulks, I reckon.',
      'The one in the middle has a cartridge sitting on it. Jump across between bites.',
      'One of the pipes by the road isn’t for plants. Stand on it and press B.',
    ],
    done: 'You found the one up on the cloud? Even I haven’t been up there.',
  },
  {
    id: 'kid',
    name: 'The kid',
    from: [18.5, 18.5],
    to: [24.5, 18.5],
    speed: 1.3,
    dwell: 0.9,
    lines: [
      'The big one in the square plays three games. I can’t reach the buttons.',
      'There’s a cartridge in the long grass out west, but the walkers are there. Jump on them, don’t walk into them.',
      'Block Drop tower, north-east. One step up at a time, all the way round.',
      'The grey one next to the Game Boy is an N64. There’s a whole castle in it, with paintings you jump into.',
    ],
    done: 'You got them ALL? Can I have a go on the Game Boy now?',
  },
];
const VILLAGER = Object.fromEntries(VILLAGERS.map((v) => [v.id, v]));
export const HEART_EVERY = 15; // coins picked up between hearts back

// The camera: how far it stands from the hero (the wheel, a pinch, + and -,
// or a pad's triggers change it), and how steeply it looks down from there
// (less, the closer it comes, so a close view is more over his shoulder).
export const ZOOM = { min: 7, start: 12.5, max: 20 };
export const zoomTo = (dist, k) => Math.max(ZOOM.min, Math.min(ZOOM.max, dist * k));
export const pitchFor = (dist) => 0.68 + (dist - ZOOM.start) * 0.018;

// Where the hero is, for the other islanders online (the towns' rooms,
// middleearth/towns/travellers.js): the island's own coordinates, how fast
// he's going and how high he stands.
export const islanderStep = (h) => ({ x: h.x, z: h.z, face: h.face, speed: h.moving ?? 0, y: Math.max(0, h.y) });

// ── the columns ──

// [lo, hi, block id or null] spans, per tile, bottom up
let columns = null;
const key = (ix, iz) => iz * W + ix;
function build() {
  const cols = new Array(W * H);
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const t = legend(MAP[iz][ix]);
      cols[key(ix, iz)] = [[-Infinity, t.top, null]];
    }
  }
  for (const [ix, iz, top] of TOWER) cols[key(ix, iz)] = [[-Infinity, top, null]];
  for (const b of BLOCKS) cols[key(b.ix, b.iz)].push([BLOCK_LO, BLOCK_LO + 1, b.id]);
  for (let iz = CLOUD.z0; iz <= CLOUD.z1; iz++) for (let ix = CLOUD.x0; ix <= CLOUD.x1; ix++) cols[key(ix, iz)].push([CLOUD.lo, CLOUD.top, null]);
  for (const p of PIPES) if (p.base > 0) cols[key(p.ix, p.iz)].push([p.base, p.base + PIPE_H, null]);
  for (let iz = N64_CART.z0; iz < N64_CART.z1; iz++) for (let ix = N64_CART.x0; ix < N64_CART.x1; ix++) cols[key(ix, iz)] = [[-Infinity, N64_CART.top, null]];
  for (const c of cols) c.sort((a, b) => a[0] - b[0]);
  return cols;
}
export function column(ix, iz) {
  if (!columns) columns = build();
  if (ix < 0 || iz < 0 || ix >= W || iz >= H) return [[-Infinity, SEA, null]];
  return columns[key(ix, iz)];
}

// the tile's letter and legend entry, at a point
export function tileAt(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const c = ix < 0 || iz < 0 || ix >= W || iz >= H ? '~' : MAP[iz][ix];
  return { c, ix, iz, ...legend(c) };
}

// the top of the highest span at a point that's no higher than `y` (where a
// thing dropped from y lands)
export function floorAt(x, z, y = Infinity) {
  let best = -Infinity;
  for (const [, hi] of column(Math.floor(x), Math.floor(z))) if (hi <= y + 1e-6 && hi > best) best = hi;
  return best;
}

// ── the hero ──

export const HERO = {
  r: 0.3, // half his width
  h: 0.9, // his height
  speed: 4.6, // walking
  jump: 8.9, // up, at the start of a jump
  gravity: 28,
  step: 0.55, // what he walks up without jumping
  mantle: 0.18, // in the air: a ledge this far over his feet still catches him
  coyote: 0.1, // a jump still counts this long after walking off an edge
  buffer: 0.12, // and this long before landing
  hearts: 3,
  hurt: 1.6, // seconds he blinks, untouchable, after being hurt
};
const MAX_FALL = 22;

export function newHero(at = START) {
  return { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, face: at.face ?? 0, ground: true, air: 0, buffer: 0, cut: false, safe: { x: at.x, y: at.y, z: at.z }, safeT: 0, moving: 0 };
}

// the tiles under a box of half-width r at (x, z)
function under(x, z, r = HERO.r) {
  const out = [];
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r - 1e-9);
  const z0 = Math.floor(z - r);
  const z1 = Math.floor(z + r - 1e-9);
  for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) out.push([ix, iz]);
  return out;
}

// is the hero's box at (x, z), feet at y, inside anything? `lift`: how far
// over his feet a top can be and still be stepped onto rather than walked into
export function blocked(x, z, y, lift) {
  for (const [ix, iz] of under(x, z)) {
    for (const [lo, hi] of column(ix, iz)) if (hi > y + lift && lo < y + HERO.h) return true;
  }
  return false;
}

// the highest top under the hero's box that's within `lift` over his feet
function surface(x, z, y, lift) {
  let best = -Infinity;
  for (const [ix, iz] of under(x, z)) for (const [, hi] of column(ix, iz)) if (hi <= y + lift && hi > best) best = hi;
  return best;
}

// the lowest underside over his head, and the block it belongs to (the one
// most under him, if he hits two)
function ceiling(x, z, y) {
  let best = Infinity;
  let block = null;
  let near = Infinity;
  for (const [ix, iz] of under(x, z)) {
    for (const [lo, , id] of column(ix, iz)) {
      if (lo < y + HERO.h - 0.02) continue;
      const d = Math.hypot(ix + 0.5 - x, iz + 0.5 - z);
      if (lo < best - 1e-6 || (Math.abs(lo - best) < 1e-6 && d < near)) {
        best = lo;
        block = id;
        near = d;
      }
    }
  }
  return { at: best, block };
}

// One axis of a move: as far as he can go towards `to`, stopping flush
// against whatever's in the way.
function slide(h, axis, to, lift) {
  const from = h[axis];
  if (to === from) return;
  const x = axis === 'x' ? to : h.x;
  const z = axis === 'z' ? to : h.z;
  if (!blocked(x, z, h.y, lift)) {
    h[axis] = to;
    return;
  }
  const r = HERO.r;
  const edge = to > from ? Math.floor(to + r) - r - 1e-4 : Math.floor(to - r) + 1 + r + 1e-4;
  const x2 = axis === 'x' ? edge : h.x;
  const z2 = axis === 'z' ? edge : h.z;
  if ((to > from ? edge > from : edge < from) && !blocked(x2, z2, h.y, lift)) h[axis] = edge;
  if (axis === 'x') h.vx = 0;
  else h.vz = 0;
}

// Walk the camera's way: `yaw` is where the camera stands round the hero
// (0: south of him, looking north), fwd and side are the stick, -1 to 1.
export function cameraMove(yaw, fwd, side) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  let x = -s * fwd + c * side;
  let z = -c * fwd - s * side;
  const m = Math.hypot(x, z);
  if (m > 1) {
    x /= m;
    z /= m;
  }
  return { x, z };
}

// One step of the hero (no hazards, no pickups: those are in `step`).
// input: { x, z } the way to walk (length up to 1), jump (held), jumped
// (pressed this frame). Returns what happened: 'jump', 'land', 'bump' (with
// the block), 'splash'.
export function moveHero(h, input, dt) {
  const ev = [];
  const want = { x: (input.x ?? 0) * HERO.speed, z: (input.z ?? 0) * HERO.speed };
  const grip = 1 - Math.exp(-(h.ground ? 14 : 5) * dt);
  h.vx += (want.x - h.vx) * grip;
  h.vz += (want.z - h.vz) * grip;
  const sp = Math.hypot(h.vx, h.vz);
  h.moving = sp;
  if (Math.hypot(want.x, want.z) > 0.3) {
    const target = Math.atan2(want.x, want.z);
    let d = target - h.face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    h.face += d * (1 - Math.exp(-16 * dt));
  }

  // the jump: pressed a moment early, or a moment after walking off
  if (input.jumped) h.buffer = HERO.buffer;
  else h.buffer = Math.max(0, h.buffer - dt);
  if (h.ground) h.air = 0;
  else h.air += dt;
  if (h.buffer > 0 && (h.ground || h.air < HERO.coyote) && h.vy <= 0.01) {
    h.vy = HERO.jump;
    h.ground = false;
    h.air = HERO.coyote;
    h.buffer = 0;
    h.cut = false;
    ev.push({ type: 'jump' });
  }
  // let go early for a little hop
  if (!h.ground && h.vy > 0 && !input.jump && !h.cut) {
    h.vy *= 0.5;
    h.cut = true;
  }

  // across, one axis at a time
  const lift = h.ground ? HERO.step : HERO.mantle;
  slide(h, 'x', h.x + h.vx * dt, lift);
  slide(h, 'z', h.z + h.vz * dt, lift);

  // up and down
  if (h.ground) {
    // stay on the ground: up a step, or down one, or off the edge
    const s = surface(h.x, h.z, h.y, HERO.step);
    if (s >= h.y - 0.3) h.y = s;
    else {
      h.ground = false;
      h.air = 0;
    }
  }
  if (!h.ground) {
    h.vy = Math.max(-MAX_FALL, h.vy - HERO.gravity * dt);
    const y0 = h.y;
    const y1 = y0 + h.vy * dt;
    if (h.vy > 0) {
      const c = ceiling(h.x, h.z, y0);
      if (y1 + HERO.h >= c.at) {
        h.y = c.at - HERO.h - 1e-4;
        h.vy = 0;
        ev.push({ type: 'bump', block: c.block });
      } else h.y = y1;
    } else {
      // (a top a little over his feet still catches him: he's pulled up onto it)
      const s = surface(h.x, h.z, y0, HERO.mantle);
      if (y1 <= s) {
        h.y = s;
        h.vy = 0;
        h.ground = true;
        ev.push({ type: 'land', speed: -y1 + y0 });
      } else h.y = y1;
    }
  }

  // somewhere to come back to: solid ground under his middle
  h.safeT -= dt;
  if (h.ground && h.safeT <= 0) {
    const t = tileAt(h.x, h.z);
    if (t.kind !== 'sea' && Math.abs(floorAt(h.x, h.z, h.y) - h.y) < 0.02 && !blocked(h.x, h.z, h.y, 0.02)) {
      h.safe = { x: h.x, y: h.y, z: h.z };
      h.safeT = 0.25;
    }
  }
  if (h.y < WATER) ev.push({ type: 'splash' });
  return ev;
}

// ── what moves ──

// a walker's place at time t: there and back along its line
export function walkerAt(w, t) {
  const [ax, az] = w.from;
  const [bx, bz] = w.to;
  const len = Math.hypot(bx - ax, bz - az);
  const s = (t * w.speed) % (2 * len);
  const k = s <= len ? s / len : 2 - s / len;
  const dir = s <= len ? 1 : -1;
  return { x: ax + (bx - ax) * k, y: 0, z: az + (bz - az) * k, face: Math.atan2((bx - ax) * dir, (bz - az) * dir) };
}

// Each villager's state: where along the beat (s, from `from`), which way,
// how long still to wait at an end, where they are and which way they face.
export const newFolk = () =>
  Object.fromEntries(
    VILLAGERS.map((v, i) => {
      const k = ((i * 0.37) % 1) * 0.8;
      return [v.id, { s: k * Math.hypot(v.to[0] - v.from[0], v.to[1] - v.from[1]), dir: 1, wait: 0, x: v.from[0] + (v.to[0] - v.from[0]) * k, z: v.from[1] + (v.to[1] - v.from[1]) * k, face: Math.atan2(v.to[0] - v.from[0], v.to[1] - v.from[1]), stopped: false }];
    }),
  );

// One step of a villager: stopped, facing the hero, while he's within TALK_R;
// otherwise there and back along the beat, waiting `dwell` at each end.
export function stepVillager(v, f, dt, hero) {
  const dx = hero.x - f.x;
  const dz = hero.z - f.z;
  if (Math.hypot(dx, dz) < TALK_R && (hero.y ?? 0) < 1.2) {
    f.stopped = true;
    const target = Math.atan2(dx, dz);
    let d = target - f.face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    f.face += d * (1 - Math.exp(-10 * dt));
    return f;
  }
  f.stopped = false;
  const len = Math.hypot(v.to[0] - v.from[0], v.to[1] - v.from[1]);
  if (f.wait > 0) {
    f.wait = Math.max(0, f.wait - dt);
  } else {
    f.s += f.dir * v.speed * dt;
    if (f.s >= len) {
      f.s = len;
      f.dir = -1;
      f.wait = v.dwell;
    } else if (f.s <= 0) {
      f.s = 0;
      f.dir = 1;
      f.wait = v.dwell;
    }
    const k = f.s / len;
    f.x = v.from[0] + (v.to[0] - v.from[0]) * k;
    f.z = v.from[1] + (v.to[1] - v.from[1]) * k;
  }
  const target = Math.atan2((v.to[0] - v.from[0]) * f.dir, (v.to[1] - v.from[1]) * f.dir);
  let d = target - f.face;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  f.face += d * (1 - Math.exp(-10 * dt));
  return f;
}

// the snake: where each segment is at time t, head first
const loopLen = SNAKE.loop.reduce((n, p, i) => {
  const q = SNAKE.loop[(i + 1) % SNAKE.loop.length];
  return n + Math.hypot(q[0] - p[0], q[1] - p[1]);
}, 0);
export function alongLoop(s) {
  let d = ((s % loopLen) + loopLen) % loopLen;
  for (let i = 0; i < SNAKE.loop.length; i++) {
    const p = SNAKE.loop[i];
    const q = SNAKE.loop[(i + 1) % SNAKE.loop.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d <= len) return { x: p[0] + ((q[0] - p[0]) * d) / len, z: p[1] + ((q[1] - p[1]) * d) / len, face: Math.atan2(q[0] - p[0], q[1] - p[1]) };
    d -= len;
  }
  return { x: SNAKE.loop[0][0], z: SNAKE.loop[0][1], face: 0 };
}
export const snakeAt = (t) => Array.from({ length: SNAKE.length }, (_, i) => alongLoop(t * SNAKE.speed - i * SNAKE.gap));

// A plant's state machine: down a while, up out of its pipe, a while up, back
// down. It won't come up while you're standing on its pipe. Up, it leans out
// at anything jumping by: REACH across, from its pipe's middle.
export const PLANT = { down: 2.2, rise: 0.55, up: 1.5, sink: 0.55, reach: 1.05 };
export const newPlant = (phase = 0) => ({ state: 'down', t: phase });
export function stepPlant(p, dt, on) {
  p.t += dt;
  if (p.state === 'down' && p.t >= PLANT.down && !on) Object.assign(p, { state: 'rise', t: 0 });
  else if (p.state === 'rise' && p.t >= PLANT.rise) Object.assign(p, { state: 'up', t: 0 });
  else if (p.state === 'up' && p.t >= PLANT.up) Object.assign(p, { state: 'sink', t: 0 });
  else if (p.state === 'sink' && p.t >= PLANT.sink) Object.assign(p, { state: 'down', t: 0 });
  return p;
}
// how far out of its pipe it is, 0 to 1
export const plantOut = (p) => (p.state === 'down' ? 0 : p.state === 'up' ? 1 : p.state === 'rise' ? Math.min(1, p.t / PLANT.rise) : 1 - Math.min(1, p.t / PLANT.sink));
// does a plant this far out bite a hero standing (feet) at y, d across from
// its pipe's middle?
export function bites(out, d, y, top) {
  if (out < 0.35) return false;
  return d < 0.55 + (PLANT.reach - 0.55) * out && y < top + 0.1 + out * 1.0 && y + HERO.h > top + 0.1;
}

// ── the game ──

export const pipeTop = (p) => p.base + PIPE_H;

export function newGame({ found = [] } = {}) {
  return {
    t: 0,
    hero: newHero(),
    hearts: HERO.hearts,
    hurt: 0, // blinking
    over: 0, // counting down to coming ashore again
    coins: new Set(),
    found: new Set(found.filter((id) => CARTRIDGES.some((c) => c.id === id))),
    used: new Set(), // "?" blocks already bumped
    flat: {}, // walker id → when it went flat
    plants: Object.fromEntries(PIPES.filter((p) => p.plant).map((p, i) => [p.id, newPlant(i * 0.3)])),
    folk: newFolk(),
    said: {}, // villager id → how many lines heard
    gone: false, // in a pipe
  };
}

// What a villager says next: their lines in turn, round again, or their last
// word once every cartridge is found. Or null, for nobody.
export function talk(g, id) {
  const v = VILLAGER[id];
  if (!v) return null;
  if (g.found.size === CARTRIDGES.length) return { name: v.name, text: v.done };
  const n = g.said[id] ?? 0;
  g.said[id] = n + 1;
  return { name: v.name, text: v.lines[n % v.lines.length] };
}

const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function hurt(g, from, ev) {
  if (g.hurt > 0 || g.over > 0) return;
  const h = g.hero;
  g.hearts -= 1;
  g.hurt = HERO.hurt;
  const d = Math.hypot(h.x - from.x, h.z - from.z) || 1;
  h.vx = ((h.x - from.x) / d) * 5;
  h.vz = ((h.z - from.z) / d) * 5;
  h.vy = 6.5;
  h.ground = false;
  if (g.hearts <= 0) {
    g.over = 2;
    ev.push({ type: 'over' });
  } else ev.push({ type: 'hurt' });
}

// What the B button would do where the hero's standing: a pipe to go down,
// the Game Boy, the N64 or the crafting table to play, a sign to read. Or null.
export function nearAction(g) {
  const h = g.hero;
  if (g.over > 0) return null;
  for (const p of PIPES) {
    if (!p.to || !h.ground) continue;
    if (Math.abs(h.y - pipeTop(p)) < 0.05 && Math.hypot(h.x - (p.ix + 0.5), h.z - (p.iz + 0.5)) < 0.6) return { kind: 'pipe', id: p.id };
  }
  const f = GAMEBOY.front;
  if (h.x > f.x0 && h.x < f.x1 && h.z > f.z0 && h.z < f.z1 && h.y < 0.5) return { kind: 'gameboy', id: 'gameboy' };
  const n = N64.front;
  if (h.x > n.x0 && h.x < n.x1 && h.z > n.z0 && h.z < n.z1 && h.y < 0.5) return { kind: 'n64', id: 'n64' };
  const c = CRAFT.front;
  if (h.x > c.x0 && h.x < c.x1 && h.z > c.z0 && h.z < c.z1 && h.y < 0.5) return { kind: 'craft', id: 'craft' };
  let best = null;
  let bd = 1.25;
  for (const v of VILLAGERS) {
    const p = g.folk[v.id];
    const d = Math.hypot(h.x - p.x, h.z - p.z);
    if (d < bd && h.y < 1.2) {
      bd = d;
      best = { kind: 'talk', id: v.id };
    }
  }
  if (best) return best;
  for (const s of SIGNS) {
    const d = Math.hypot(h.x - (s.ix + 0.5), h.z - (s.iz + 0.5));
    if (d < bd && h.y < 1.2) {
      bd = d;
      best = { kind: 'sign', id: s.id };
    }
  }
  return best;
}

// Down the pipe he's standing on, and up out of its partner.
export function warp(g, id) {
  const p = PIPE[id];
  const to = p && PIPE[p.to];
  if (!to) return false;
  const h = g.hero;
  Object.assign(h, { x: to.ix + 0.5, z: to.iz + 0.5, y: pipeTop(to), vx: 0, vy: 0, vz: 0, ground: true });
  h.safe = { x: h.x, y: h.y, z: h.z };
  return true;
}

// One step of everything. input: { x, z, jump, jumped }. Returns the
// events: jump, land, bump, block (a "?" block gave something), coin, cart,
// heart, stomp, hurt, over, splash, ashore.
export function step(g, input, dt) {
  const ev = [];
  g.t += dt;
  const h = g.hero;
  if (g.over > 0) {
    g.over -= dt;
    if (g.over <= 0) {
      g.over = 0;
      g.hero = newHero();
      g.hearts = HERO.hearts;
      g.hurt = 0;
      ev.push({ type: 'ashore' });
    }
    return ev;
  }
  g.hurt = Math.max(0, g.hurt - dt);
  const coinsBefore = g.coins.size; // (a "?" block's coin counts too)
  const still = { x: 0, z: 0, jump: false, jumped: false };
  for (const e of moveHero(h, g.hurt > HERO.hurt - 0.35 ? still : input, dt)) {
    if (e.type === 'bump' && e.block && !g.used.has(e.block)) {
      g.used.add(e.block);
      const b = BLOCKS.find((x) => x.id === e.block);
      if (b.heart) {
        g.hearts = Math.min(HERO.hearts, g.hearts + 1);
        ev.push({ type: 'block', id: b.id, gives: 'heart' });
      } else {
        g.coins.add(b.id);
        ev.push({ type: 'block', id: b.id, gives: 'coin' });
      }
    }
    if (e.type === 'splash') {
      Object.assign(h, { ...h.safe, vx: 0, vy: 0, vz: 0, ground: true });
      ev.push({ type: 'splash' });
      continue;
    }
    ev.push(e);
  }

  // pickups
  const mid = h.y + HERO.h / 2;
  for (const c of COINS) {
    if (g.coins.has(c.id)) continue;
    if (Math.abs(c.x - h.x) < 0.6 && Math.abs(c.z - h.z) < 0.6 && Math.abs(c.y - mid) < 0.75) {
      g.coins.add(c.id);
      ev.push({ type: 'coin', id: c.id });
    }
  }
  // every so many coins, a heart back; and the last one of all
  if (g.coins.size !== coinsBefore) {
    if (Math.floor(g.coins.size / HEART_EVERY) > Math.floor(coinsBefore / HEART_EVERY) && g.hearts < HERO.hearts) {
      g.hearts += 1;
      ev.push({ type: 'coinheart' });
    }
    if (g.coins.size === COINS.length + BLOCKS.filter((b) => !b.heart).length) ev.push({ type: 'allcoins' });
  }
  for (const v of VILLAGERS) stepVillager(v, g.folk[v.id], dt, h);
  for (const c of CARTRIDGES) {
    if (g.found.has(c.id)) continue;
    const [x, y, z] = c.at;
    if (Math.abs(x - h.x) < 0.65 && Math.abs(z - h.z) < 0.65 && mid > y - 0.2 && mid < y + 1.4) {
      g.found.add(c.id);
      ev.push({ type: 'cart', id: c.id });
    }
  }

  // walkers: flatten from above, hurt from the side
  for (const w of WALKERS) {
    const at = g.flat[w.id];
    if (at != null) {
      if (g.t - at >= WALKER_BACK) delete g.flat[w.id];
      else continue;
    }
    const p = walkerAt(w, g.t);
    const d = flatDist(h, p);
    if (d < 0.62 && h.vy < 0 && h.y > p.y + 0.3 && h.y < p.y + 1.1) {
      g.flat[w.id] = g.t;
      h.vy = input.jump ? 11 : 7.5;
      h.ground = false;
      h.cut = !input.jump;
      ev.push({ type: 'stomp', id: w.id });
    } else if (d < 0.55 && h.y < p.y + 0.55) hurt(g, p, ev);
  }

  // plants
  for (const p of PIPES) {
    if (!p.plant) continue;
    const px = p.ix + 0.5;
    const pz = p.iz + 0.5;
    const d = Math.hypot(h.x - px, h.z - pz);
    const top = pipeTop(p);
    const plant = stepPlant(g.plants[p.id], dt, h.ground && d < 0.6 && Math.abs(h.y - top) < 0.05);
    if (bites(plantOut(plant), d, h.y, top)) hurt(g, { x: px, z: pz }, ev);
  }

  // the snake
  if (h.y < 0.85) {
    for (const s of snakeAt(g.t)) {
      if (Math.hypot(h.x - s.x, h.z - s.z) < 0.6) {
        hurt(g, s, ev);
        break;
      }
    }
  }
  return ev;
}

// how far along you are
export const progress = (g) => ({ found: g.found.size, of: CARTRIDGES.length, coins: g.coins.size, coinsOf: COINS.length + BLOCKS.filter((b) => !b.heart).length, done: g.found.size === CARTRIDGES.length });
