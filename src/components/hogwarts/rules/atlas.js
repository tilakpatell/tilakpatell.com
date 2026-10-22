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
import { placeById } from './places';
import { OUTLINE as HERO_OUTLINE } from '../world/castle/hero';
import { BRIDGES as HERO_BRIDGES } from '../world/castle/plan';
import { PATHS as TERRAIN_PATHS } from '../world/terrain';

const xz = (p) => [p[0], p[2]];
import { BUILDINGS, SHACK, VILLAGE, buildingAt, frameAt } from './hogsmeade';

export const BOUNDS = [-720, -720, 760, 720];


// the castle, part by part: the hero castle’s ground as boxes (world/castle/hero.js),
// its bridges, the crag round it and its courtyard
export const CASTLE = HERO_OUTLINE.map((b) => ({ kind: 'box', at: b.at, w: b.w, d: b.d }));
export const BRIDGES = [
  { id: 'viaduct', from: xz(HERO_BRIDGES.viaduct.from), to: xz(HERO_BRIDGES.viaduct.to), width: 5.4 },
  { id: 'covered', from: xz(HERO_BRIDGES.covered.from), to: xz(HERO_BRIDGES.covered.to), width: 3.6 },
];
export const CRAG = { at: placeById('castle').at, rx: 150, rz: 110, turn: 0 };
export const COURTYARD = { at: placeById('courtyard').at, r: 18 };

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
export const PATHS = TERRAIN_PATHS.filter((p) => p.id !== 'road');
export const ROAD = TERRAIN_PATHS.find((p) => p.id === 'road');

export const GROUNDS = {
  pitch: { at: [300, -50], rx: 46, rz: 82 },
  hut: { at: [-250, -230], r: 5 },
  paddock: { at: [-284, -248], w: 30, d: 22 },
  pumpkins: { at: [-230, -250], r: 8 },
  willow: { at: [-135, -170], r: 9 },
  circle: { at: placeById('stone-circle').at, r: 9, stones: 11 },
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
      // (a shore that wanders, as a hand draws one: long bays and points, a little roughness)
      const rag = 1 + 0.035 * Math.sin(i * 0.31 + s * 1.3) + 0.02 * Math.sin(i * 0.83 + s);
      const rough = 1.2 * Math.sin(i * 2.9 + s * 5);
      return [x + nx * (w * s * rag + rough), z + nz * (w * s * rag + rough)];
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
