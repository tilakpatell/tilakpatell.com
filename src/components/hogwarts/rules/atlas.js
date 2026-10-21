// What the Marauder’s Map draws (the design’s §4.8): the castle and the
// grounds as the Map draws them, in ink, north up, in the grounds’ frame
// (metres, +x east, +z south: rules/places.js’s). One data file, read by
// the Map (hud/mapInk.js) and nothing else: the castle’s outline as the
// castle’s plan lays it (world/castle/plan.js’s parts, the halls as boxes
// and the towers as rings), the Black Lake along its spine and the worn
// paths as the terrain lays them (world/terrain.js’s LOCH and PATHS), the
// forest, the landmarks, the village and the names. Until the grounds’
// files stand on main these are their numbers copied here; once they do,
// this file reads them in their place. The corridors come from
// rules/paths.js and the village from rules/hogsmeade.js, as the walkers
// do, so the ink and the footprints never disagree. Pure.
//
//   BOUNDS: the Map’s extent, [x0, z0, x1, z1]
//   CASTLE: [{ kind: 'box', at, w, d, turn, name? } | { kind: 'ring', at, r, name? } | { kind: 'wall', from, to }]
//   BRIDGES: [{ from, to, width }]   CRAG: the castle’s rock, an oval   COURTYARD
//   LOCH: the lake’s spine, [x, z, half its width]; lakeOutline() → [[x, z]…], the shore all round
//   PATHS: [{ id, width, points }]   ROAD: the carriages’ road
//   GROUNDS: the landmarks: { pitch, hut, paddock, pumpkins, willow, circle, owlery, greenhouses, station, boathouse }
//   trees() → [[x, z, size]…]: the forest’s glyphs, seeded, the same every time
//   LABELS: [{ text, at, size: 'big' | 'mid' | 'small', zoom: [min, max] px a metre }]
//   ROOMS: the castle’s rooms named inside it (at the castle’s zoom), with `below` for the dungeons
//   corridors() → [[[x, z], [x, z]]…]: the castle’s passages, from rules/paths.js’s edges
//   village() → { street: [[x, z], [x, z]], width, buildings: [{ id, name, at, w, d, turn, lean }], shack, fence }
//   project(view, x, z) → [px, py]; unproject(view, px, py) → [x, z]
//     view: { cx, cz (the middle, metres), scale (px a metre), w, h (px) }

import { EDGES, spotById } from './paths';
import { BUILDINGS, SHACK, VILLAGE, buildingAt, frameAt } from './hogsmeade';

export const BOUNDS = [-720, -720, 760, 720];

const E = Math.PI / 2;

// the castle, part by part (world/castle/plan.js’s footprints)
export const CASTLE = [
  { kind: 'box', at: [-12, 11], w: 73, d: 25, name: 'greatHall' },
  { kind: 'box', at: [37, 8], w: 26, d: 30, name: 'entrance' },
  { kind: 'ring', at: [-55, 6], r: 8.3 },
  { kind: 'ring', at: [-61, 26], r: 4.8 },
  { kind: 'ring', at: [58, 24], r: 6.3 },
  { kind: 'ring', at: [-14, 34], r: 3.9 },
  { kind: 'box', at: [2, -24], w: 22, d: 22, name: 'staircase' },
  { kind: 'ring', at: [-34, -22], r: 7.3, name: 'gryffindor' },
  { kind: 'box', at: [-74, -12], w: 26, d: 20, name: 'charms' },
  { kind: 'ring', at: [-94, -32], r: 7.8, name: 'ravenclaw' },
  { kind: 'box', at: [-40, -60], w: 48, d: 18, name: 'library' },
  { kind: 'ring', at: [-82, -86], r: 8.8, name: 'astronomy' },
  { kind: 'box', at: [-38, -96], w: 13, d: 13, name: 'defence' },
  { kind: 'box', at: [-4, -100], w: 30, d: 16, name: 'requirement' },
  { kind: 'ring', at: [26, -80], r: 6.8, name: 'headmaster' },
  { kind: 'box', at: [74, -40], w: 13, d: 13, name: 'clock' },
  { kind: 'ring', at: [44, -52], r: 4.4, name: 'fountain' },
  { kind: 'ring', at: [-18, -44], r: 3.5 },
  { kind: 'ring', at: [16, -44], r: 3.1 },
  { kind: 'ring', at: [-64, -50], r: 4.3 },
  { kind: 'ring', at: [-104, -10], r: 3.8 },
  { kind: 'ring', at: [46, -86], r: 3.3 },
  { kind: 'ring', at: [-20, -114], r: 3.9 },
  { kind: 'ring', at: [90, -64], r: 3.3 },
  { kind: 'wall', from: [-58, 33], to: [-18, 36] },
  { kind: 'wall', from: [-10, 36], to: [50, 38] },
  { kind: 'wall', from: [-62, -2], to: [-88, -24] },
  { kind: 'wall', from: [-98, -40], to: [-110, -54] },
  { kind: 'wall', from: [-112, -64], to: [-88, -80] },
  { kind: 'wall', from: [-74, -92], to: [-45, -97] },
  { kind: 'wall', from: [11, -98], to: [21, -86] },
  { kind: 'wall', from: [32, -84], to: [56, -108] },
  { kind: 'wall', from: [70, -110], to: [82, -48] },
  { kind: 'box', at: [-25, 55], w: 14, d: 9, turn: -E, name: 'boathouse' },
  { kind: 'ring', at: [-30, -268], r: 5.8, name: 'owlery' },
  { kind: 'box', at: [128, 41], w: 24, d: 10, turn: -E },
  { kind: 'box', at: [150, 41], w: 24, d: 10, turn: -E },
  { kind: 'box', at: [172, 41], w: 24, d: 10, turn: -E },
];

export const BRIDGES = [
  { id: 'viaduct', from: [64, -115], to: [214, -232], width: 5.4 },
  { id: 'covered', from: [-117, -60], to: [-204, -80], width: 3.6 },
];
export const CRAG = { at: [-6, -46], rx: 128, rz: 90, turn: 0.12 };
export const COURTYARD = { at: [44, -52], r: 18 };

// the Black Lake’s spine, west to the north-east arm’s head (world/terrain.js’s LOCH)
export const LOCH = [
  [-1500, 300, 340],
  [-560, 255, 300],
  [-260, 228, 255],
  [0, 248, 197],
  [220, 252, 170],
  [420, 165, 130],
  [522, -38, 104],
  [578, -250, 90],
  [612, -410, 74],
  [626, -486, 54],
  [630, -520, 34],
];

// the worn ways (world/terrain.js’s PATHS); the road is the carriages’
export const PATHS = [
  { id: 'lawn', width: 3.2, points: [[66, -8], [96, -10], [130, -18], [170, -30], [215, -42], [252, -48]] },
  { id: 'greenhouses', width: 2.4, points: [[130, -18], [140, 0], [148, 18], [150, 26]] },
  { id: 'pitch-south', width: 2.4, points: [[215, -42], [250, -4], [292, 34]] },
  { id: 'willow', width: 2.6, points: [[-60, -128], [-96, -150], [-128, -166], [-170, -196], [-212, -218], [-242, -228]] },
  { id: 'circle', width: 2.2, points: [[-232, -100], [-248, -140], [-252, -186], [-250, -222]] },
  { id: 'owlery', width: 2, points: [[-40, -128], [-36, -170], [-32, -214], [-30, -252]] },
  { id: 'forest', width: 2, points: [[-262, -232], [-300, -252], [-338, -272], [-382, -300], [-420, -320], [-450, -330]] },
  { id: 'castle-north', width: 2.6, points: [[-60, -128], [-30, -128], [10, -122], [60, -116], [96, -106]] },
];
export const ROAD = { id: 'road', width: 4.2, points: [[214, -228], [262, -268], [318, -312], [384, -354], [448, -400], [506, -438], [536, -470], [572, -524], [612, -572], [646, -604], [664, -620]] };

export const GROUNDS = {
  pitch: { at: [300, -50], rx: 46, rz: 82 },
  hut: { at: [-250, -230], r: 5 },
  paddock: { at: [-284, -248], w: 30, d: 22 },
  pumpkins: { at: [-230, -250], r: 8 },
  willow: { at: [-135, -170], r: 9 },
  circle: { at: [-225, -82], r: 9, stones: 11 },
  station: { at: [548, -472], w: 16, d: 70, turn: -0.42 },
  endRock: { at: [-150, 150], r: 4 },
};

// The forest: from the paddock’s fence west and north to the Map’s edge,
// thinning at its edge, never on the water or the castle’s rock
const FOREST = { at: [-480, -360], r: 300, edge: [-300, -200] };
let TREES = null;
export function trees() {
  if (TREES) return TREES;
  const out = [];
  let a = 0x2545f491;
  const rnd = () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
  for (let i = 0; i < 2600; i++) {
    const x = BOUNDS[0] + rnd() * 520;
    const z = BOUNDS[1] + rnd() * 640;
    const d = Math.hypot(x - FOREST.at[0], z - FOREST.at[1]);
    // (a ragged edge: thick inside, a few strays out toward the hut)
    const k = d / FOREST.r + 0.25 * Math.sin(x * 0.031) * Math.sin(z * 0.027);
    if (k > 1 || (k > 0.8 && rnd() > 0.35)) continue;
    if (x > FOREST.edge[0] && z > FOREST.edge[1]) continue;
    if (inLake(x, z)) continue;
    out.push([x, z, 0.75 + rnd() * 0.6]);
  }
  TREES = out;
  return out;
}

// whether a point is on the lake (near the spine, within its half-width)
export function inLake(x, z) {
  for (let i = 1; i < LOCH.length; i++) {
    const [ax, az, aw] = LOCH[i - 1];
    const [bx, bz, bw] = LOCH[i];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < aw + (bw - aw) * t) return true;
  }
  return false;
}

// The lake’s shore all the way round: out along one side of the spine and
// back along the other, a little ragged (the same every time), the head of
// the arm rounded
let OUTLINE = null;
export function lakeOutline() {
  if (OUTLINE) return OUTLINE;
  const pts = [];
  for (let i = 0; i < LOCH.length - 1; i++) {
    const [ax, az, aw] = LOCH[i];
    const [bx, bz, bw] = LOCH[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 14));
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, aw + ((bw - aw) * k) / n]);
  }
  pts.push(LOCH[LOCH.length - 1]);
  const side = (s) =>
    pts.map(([x, z, w], i) => {
      const [px, pz] = pts[Math.max(0, i - 1)];
      const [qx, qz] = pts[Math.min(pts.length - 1, i + 1)];
      const l = Math.hypot(qx - px, qz - pz) || 1;
      const nx = -(qz - pz) / l;
      const nz = (qx - px) / l;
      const rag = 1 + 0.05 * Math.sin(i * 1.7 + s) + 0.03 * Math.sin(i * 4.3 + s * 2);
      return [x + nx * w * s * rag, z + nz * w * s * rag];
    });
  const [hx, hz, hw] = LOCH[LOCH.length - 1];
  const [px, pz] = LOCH[LOCH.length - 2];
  const l = Math.hypot(hx - px, hz - pz);
  const head = [];
  for (let k = 1; k < 8; k++) {
    const a = (k / 8) * Math.PI;
    const ux = (hx - px) / l;
    const uz = (hz - pz) / l;
    head.push([hx + (-uz * Math.cos(a) + ux * Math.sin(a)) * hw, hz + (ux * Math.cos(a) + uz * Math.sin(a)) * hw]);
  }
  OUTLINE = [...side(1), ...head, ...side(-1).reverse()];
  return OUTLINE;
}

export const LABELS = [
  { text: 'Hogwarts Castle', at: [-6, -150], size: 'big', zoom: [0, 1.6] },
  { text: 'The Black Lake', at: [-120, 300], size: 'big', zoom: [0, 9] },
  { text: 'The Forbidden Forest', at: [-520, -420], size: 'big', zoom: [0, 9] },
  { text: 'The Whomping Willow', at: [-135, -186], size: 'mid', zoom: [0.5, 9] },
  { text: 'Hagrid’s hut', at: [-250, -214], size: 'mid', zoom: [0.5, 9] },
  { text: 'The Quidditch pitch', at: [300, -146], size: 'mid', zoom: [0, 9] },
  { text: 'The greenhouses', at: [150, 66], size: 'mid', zoom: [0.5, 9] },
  { text: 'The Owlery', at: [-30, -284], size: 'mid', zoom: [0.5, 9] },
  { text: 'The stone circle', at: [-225, -100], size: 'small', zoom: [0.8, 9] },
  { text: 'The covered bridge', at: [-170, -58], size: 'small', zoom: [1.2, 9] },
  { text: 'The viaduct', at: [150, -158], size: 'small', zoom: [0.8, 9] },
  { text: 'The boathouse', at: [-25, 70], size: 'small', zoom: [1.2, 9] },
  { text: 'Hogsmeade station', at: [585, -455], size: 'small', zoom: [0.5, 9] },
  { text: 'Hogsmeade', at: [700, -690], size: 'big', zoom: [0, 9] },
  { text: 'The Shrieking Shack', at: [frameAt(-30, -78)[0], frameAt(-30, -78)[1] - 16], size: 'small', zoom: [0.8, 9] },
  { text: 'The paddock', at: [-284, -266], size: 'small', zoom: [1.2, 9] },
  { text: 'The road to Hogsmeade', at: [400, -400], size: 'small', zoom: [0.8, 9] },
];

// the rooms named inside the castle, at the castle’s zoom (the dungeons drawn broken: they’re below)
export const ROOMS = [
  { text: 'Great Hall', at: [-12, 11] },
  { text: 'Entrance Hall', at: [37, 8] },
  { text: 'Grand Staircase', at: [2, -24] },
  { text: 'Gryffindor', at: [-34, -22] },
  { text: 'Charms', at: [-74, -12] },
  { text: 'Ravenclaw', at: [-94, -32] },
  { text: 'Library', at: [-40, -60] },
  { text: 'Restricted', at: [-58, -66] },
  { text: 'Astronomy', at: [-82, -86] },
  { text: 'Defence', at: [-38, -96] },
  { text: 'Seventh floor', at: [-4, -100] },
  { text: 'Headmaster', at: [26, -80] },
  { text: 'Courtyard', at: [44, -60] },
  { text: 'Hospital wing', at: [6, -66] },
  { text: 'Filch', at: [27, -9] },
  { text: 'Staff room', at: [-17, -42] },
  { text: 'Kitchens', at: [20, 27], below: true },
  { text: 'Hufflepuff', at: [34, 31], below: true },
  { text: 'Potions', at: [-28, 27], below: true },
  { text: 'Slytherin', at: [-48, 29], below: true },
];

// the castle’s passages: every way between two spots that are both inside
let CORRIDORS = null;
export function corridors() {
  if (CORRIDORS) return CORRIDORS;
  CORRIDORS = EDGES.filter(([a, b]) => spotById(a).inside && spotById(b).inside).map(([a, b]) => ({ from: spotById(a).at, to: spotById(b).at, below: Boolean(spotById(a).below || spotById(b).below) }));
  return CORRIDORS;
}

let VILLAGE_INK = null;
export function village() {
  if (VILLAGE_INK) return VILLAGE_INK;
  const [ux, uz] = VILLAGE.axis;
  VILLAGE_INK = {
    street: [frameAt(-VILLAGE.half, 0), frameAt(VILLAGE.half, 0)],
    width: VILLAGE.width,
    buildings: BUILDINGS.map((b) => {
      const s = buildingAt(b.id);
      // (turned so its width runs along the street: a box’s turn as the castle’s plan reads one)
      return { id: b.id, name: b.name, at: s.at, w: b.w, d: b.d, turn: Math.atan2(-uz, ux), lean: b.lean };
    }),
    shack: SHACK.at,
    fence: SHACK.fence,
  };
  return VILLAGE_INK;
}

export const project = (v, x, z) => [v.w / 2 + (x - v.cx) * v.scale, v.h / 2 + (z - v.cz) * v.scale];
export const unproject = (v, px, py) => [v.cx + (px - v.w / 2) / v.scale, v.cz + (py - v.h / 2) / v.scale];

// the grounds’ wider places, for saying where you are when no spot is near (rules/places.js’s)
export const AREAS = [
  { name: 'The south shore', at: [30, 445], r: 70 },
  { name: 'The end rock', at: [-150, 150], r: 14 },
  { name: 'The Forbidden Forest', at: [-480, -360], r: 220 },
  { name: 'The glen', at: [380, -350], r: 90 },
  { name: 'The moor', at: [200, -590], r: 150 },
  { name: 'Hogsmeade', at: [665, -625], r: 70 },
  { name: 'The Black Lake', at: [-60, 250], r: 260 },
];
