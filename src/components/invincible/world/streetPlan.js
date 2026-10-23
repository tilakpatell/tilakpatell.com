// The city's street furniture and its brick tenements, as plain data from
// ./map.js's world: where each lamp, traffic light, stop sign, manhole,
// street tree, bollard and planter stands, and which of the outer city's
// low brick blocks the Downtown City MegaKit's tenements stand in for, cut
// to fill each one's box exactly (./streetKit.js draws them). Pure, from the
// map alone, so a test holds the lamps to the ground's own pools of light
// (./ground.js: both pavements, every 30 m, 8.6 m off the centre line), the
// furniture off the crossings and out of every box, and the tenements
// inside the box the flight collides with.
//
//   TILE                              the streamed square, metres
//   tileOf(x, z) → key                tilesNear(x, z, r) → [key]
//   furnitureIn(world, key) → { lamps, lights, stops, manholes, trees, bollards, planters }
//     each [{ x, z, yaw }] (trees { x, z, s }), in the world, y the ground (0 in town)
//   KIT                               the tenements, measured from the kit's files
//   isTenement(building) → bool       tenementsFor(building) → [{ model, x, z, yaw, sx, sy, sz }]
//   tenementTiles(world) → Map(key → [{ ...tenement, id }])
//   roofUnits(building) → [{ x, y, z, yaw }]

import { GRID, LOT, blockKind } from './map';

export const TILE = 400;
const HALF = GRID.cell / 2;
const EDGE = 8.6; // a pavement's lamp line off the street's centre line (./ground.js's)
const EVERY = 30; // and between them along it
const CLEAR = 15; // nothing nearer a crossing's centre than this (its zebra and stop line)
const DOWNTOWN = { x: 60, z: -80, r: 900 }; // the traffic lights' city; stop signs past it

export const tileOf = (x, z) => `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
export function tilesNear(x, z, r) {
  const out = [];
  for (let i = Math.floor((x - r) / TILE); i <= Math.floor((x + r) / TILE); i++) for (let j = Math.floor((z - r) / TILE); j <= Math.floor((z + r) / TILE); j++) out.push(`${i},${j}`);
  return out;
}
const boundsOf = (key) => {
  const [i, j] = key.split(',').map(Number);
  return { x0: i * TILE, x1: (i + 1) * TILE, z0: j * TILE, z1: (j + 1) * TILE };
};
const inside = (t, x, z) => x >= t.x0 && x < t.x1 && z >= t.z0 && z < t.z1;
// a number from a place, 0 to 1, the same every time
const hash = (a, b, c = 0) => {
  let h = Math.imul(Math.round(a * 10) | 0, 374761393) + Math.imul(Math.round(b * 10) | 0, 668265263) + Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// how far v is from the nearest street's centre line (streets at 80i + 40)
const offStreet = (v) => Math.abs(v - (Math.round((v - HALF) / GRID.cell) * GRID.cell + HALF));
const cellOf = (v) => Math.round(v / GRID.cell);

// ── the furniture ──
export function furnitureIn(world, key) {
  const t = boundsOf(key);
  const f = { lamps: [], lights: [], stops: [], manholes: [], trees: [], bollards: [], planters: [] };
  const i0 = Math.floor((t.x0 - HALF - EDGE) / GRID.cell);
  const i1 = Math.ceil((t.x1 - HALF + EDGE) / GRID.cell);
  const j0 = Math.floor((t.z0 - HALF - EDGE) / GRID.cell);
  const j1 = Math.ceil((t.z1 - HALF + EDGE) / GRID.cell);
  // along both pavements of every street: a lamp every 30 m, a tree half-way between on most
  // built blocks (the street's own: `x` its centre line, `along` z), and the same turned for E–W
  const pavements = (ns) => {
    const [a0, a1, b0, b1] = ns ? [i0, i1, t.z0, t.z1] : [j0, j1, t.x0, t.x1];
    for (let a = a0; a <= a1; a++) {
      const line = a * GRID.cell + HALF;
      for (let k = Math.floor(b0 / EVERY) * EVERY; k < b1 + EVERY; k += EVERY / 2) {
        if (offStreet(k) < CLEAR) continue;
        for (const s of [-1, 1]) {
          const across = line + s * EDGE;
          const [x, z] = ns ? [across, k] : [k, across];
          if (!inside(t, x, z)) continue;
          const kind = ns ? blockKind(s < 0 ? a : a + 1, cellOf(z)) : blockKind(cellOf(x), s < 0 ? a : a + 1);
          if (!kind) continue;
          const yaw = ns ? 0 : Math.PI / 2;
          if (k % EVERY === 0) f.lamps.push({ x, z, yaw });
          else if (kind === 'built' && hash(x, z, 3) < 0.6) f.trees.push({ x, z, s: 2 + hash(x, z, 4) * 0.7 });
        }
      }
    }
  };
  pavements(true);
  pavements(false);
  // the crossings: traffic lights at each corner downtown, their arms out over the way in;
  // further out, a stop sign on two corners for the N–S street's traffic
  for (let a = i0; a <= i1; a++)
    for (let b = j0; b <= j1; b++) {
      const cx = a * GRID.cell + HALF;
      const cz = b * GRID.cell + HALF;
      const round = [blockKind(a, b), blockKind(a + 1, b), blockKind(a, b + 1), blockKind(a + 1, b + 1)];
      if (round.filter(Boolean).length < 3) continue;
      const lit = Math.hypot(cx - DOWNTOWN.x, cz - DOWNTOWN.z) < DOWNTOWN.r;
      // (the corner, and the way its arm reaches: SE west, NW east, NE south, SW north)
      for (const [sx, sz, yaw] of [
        [1, 1, -Math.PI / 2],
        [-1, -1, Math.PI / 2],
        [1, -1, 0],
        [-1, 1, Math.PI],
      ]) {
        const x = cx + sx * EDGE;
        const z = cz + sz * EDGE;
        if (!inside(t, x, z)) continue;
        if (lit) f.lights.push({ x, z, yaw });
        else if (sx === sz) f.stops.push({ x, z, yaw: sz > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
      // a manhole in each street's lane, half-way down to the next crossing
      for (const [x, z, yaw] of [
        [cx + 1.8, cz + HALF, 0],
        [cx + HALF, cz - 1.8, Math.PI / 2],
      ])
        if (inside(t, x, z) && (blockKind(cellOf(x - 10), cellOf(z - 10)) || blockKind(cellOf(x + 10), cellOf(z + 10)))) f.manholes.push({ x, z, yaw });
    }
  // the Guardians' plaza: bollards round its edge, its four ways in open, planters by them
  const P = LOT - 0.6;
  for (let s = -P; s <= P + 1e-6; s += (2 * P) / 24)
    for (const [x, z] of [
      [s, -P],
      [s, P],
      [-P, s],
      [P, s],
    ])
      if (Math.abs(s) > 6 && inside(t, x, z)) f.bollards.push({ x, z, yaw: 0 });
  for (const s of [-20, -9, 9, 20])
    for (const [x, z] of [
      [s, -P + 1.6],
      [s, P - 1.6],
      [-P + 1.6, s],
      [P - 1.6, s],
    ])
      if (inside(t, x, z)) f.planters.push({ x, z, yaw: 0 });
  return f;
}

// ── the tenements ──
// The kit's three, each facing its own +z, its origin on its front wall:
// `x` its walls' span across its front, `d` how deep, `h` how high (from
// the files; ../../galaxy's Coronet City measured them so too). The small
// one is a corner building, its -x side a front as well.
export const KIT = {
  small: { name: 'Building_Small_1', x: [-7.23, 5.23], d: 12.23, h: 17.03 },
  medium: { name: 'Building_Medium_2_001', x: [-7.53, 7.53], d: 12.49, h: 25.01 },
  large: { name: 'Building_Large_2', x: [-9.32, 11.32], d: 16.32, h: 28 },
};
const CELL = 13; // about a kit building's front

// the outer city's low brick blocks, a single box each, big enough for four
export const isTenement = (b) => b.kind === 'brick' && b.zone !== 'core' && !b.top && b.h >= 12 && b.h <= 24 && b.w >= 18 && b.d >= 18;

// (three's turn about y: a model's (x, z) at `yaw`)
const turn = (x, z, yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];

// One kit building put in a cell [x0, x1] × [z0, z1] facing `yaw`, stretched to fill it.
function fill(model, yaw, c, h) {
  const m = KIT[model];
  const across = Math.abs(Math.sin(yaw)) > 0.5; // (its front along z)
  const w = c.x1 - c.x0;
  const d = c.z1 - c.z0;
  const sx = (across ? d : w) / (m.x[1] - m.x[0]);
  const sz = (across ? w : d) / m.d;
  // where its scaled footprint's corner falls from its origin, so the origin puts it in the cell
  let ox = Infinity;
  let oz = Infinity;
  for (const [lx, lz] of [
    [m.x[0], 0],
    [m.x[1], 0],
    [m.x[0], -m.d],
    [m.x[1], -m.d],
  ]) {
    const [wx, wz] = turn(lx * sx, lz * sz, yaw);
    ox = Math.min(ox, wx);
    oz = Math.min(oz, wz);
  }
  return { model, x: c.x0 - ox, z: c.z0 - oz, yaw, sx, sy: h / m.h, sz };
}

// The ring of kit buildings round a block's box: a corner building at each
// corner turned so both its fronts face out, the middle one facing out along
// each side; nothing inside the ring (the box's own roof fills it from above).
export function tenementsFor(b) {
  const nx = Math.max(2, Math.round(b.w / CELL));
  const nz = Math.max(2, Math.round(b.d / CELL));
  const cw = b.w / nx;
  const cd = b.d / nz;
  const x0 = b.x - b.w / 2;
  const z0 = b.z - b.d / 2;
  const out = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const west = i === 0;
      const east = i === nx - 1;
      const north = j === 0;
      const south = j === nz - 1;
      if (!(west || east || north || south)) continue;
      const c = { x0: x0 + i * cw, x1: x0 + (i + 1) * cw, z0: z0 + j * cd, z1: z0 + (j + 1) * cd };
      // (a corner's yaw puts its +z and its -x on its two outer sides: SW 0, SE ¼, NE ½, NW −¼ turn)
      if ((west || east) && (north || south)) out.push(fill('small', south ? (west ? 0 : Math.PI / 2) : east ? Math.PI : -Math.PI / 2, c, b.h));
      else out.push(fill('medium', south ? 0 : north ? Math.PI : east ? Math.PI / 2 : -Math.PI / 2, c, b.h));
    }
  return out;
}

// Every tenement, by the tile its block's middle is in.
export function tenementTiles(world) {
  const tiles = new Map();
  for (const b of world.buildings) {
    if (!isTenement(b)) continue;
    const key = tileOf(b.x, b.z);
    if (!tiles.has(key)) tiles.set(key, []);
    for (const t of tenementsFor(b)) tiles.get(key).push({ ...t, id: b.id });
  }
  return tiles;
}

// A few air-conditioning units on a tenement's roof, back from its edges.
export function roofUnits(b) {
  const n = 2 + Math.floor(hash(b.x, b.z, 7) * 3);
  const out = [];
  for (let k = 0; k < n; k++) {
    const u = hash(b.x, b.z, 11 + k) - 0.5;
    const v = hash(b.z, b.x, 23 + k) - 0.5;
    out.push({ x: b.x + u * (b.w - 6), y: b.h, z: b.z + v * (b.d - 6), yaw: hash(b.x, k, 31) < 0.5 ? 0 : Math.PI / 2 });
  }
  return out;
}
