// Where the hero castle stands (public/models/hogwarts/castle/, its cuts
// from Jzax's voxel Hogwarts: world/heroes.js), and the ground it needs, in
// the world's frame (rules/places.js: +x east, +z south, the lake's water
// at y 0). Pure, so the terrain, the colliders, the Map and a test read the
// same castle the builder draws.
//
// The frame is set by the boathouse: the model's own boathouse, at the foot
// of its hill and its zig-zag stair, sits at the edge of the Black Lake's
// north shore, the model unturned (its boathouse to the south, its viaduct
// running out south-east over the gorge to the shore, its wooden bridge north
// to the stone circle and the Owlery on its crag), scaled so its courts stand
// on the crag's floor (CASTLE_FLOOR) over the water.
//
//   WATER: the model's water line (its hill's foot), in its own metres
//   HERO: { scale, turn, at: [x, y, z] }: the model's origin in the world, its scale and turn
//   toWorld([x, y, z]) → the world's point of a point in the model's frame
//   toModel(x, z) → [x, z] in the model's frame of a point on the world's map
//   ANCHORS: the castle's places in the model's frame, read off its plan
//     (scripts/hogwarts-castle.mjs's rasters): [x, y, z]
//   at(name) → the world's [x, y, z] of an anchor
//   SOLIDS, OUTLINE: [{ at: [x, z], w, d }]: the castle's ground in the
//     world as boxes, where it has no floor (what the walk goes round), and
//     all of it (what the Map inks)
//   groundAt(x, z) → { y, d } | null: the level of the castle's ground
//     nearest the point and how far outside it the point is (0 inside), or
//     null where the castle is far off
//   inside(x, z) → whether the point is under the castle's ground

import { CASTLE_FLOOR } from '../../rules/places';
import { CELL, FLOOR, GROUND } from './heroGround';

export const WATER = 0.8;
const S = CASTLE_FLOOR / (FLOOR - WATER);
// the boathouse: in the model's frame, and on the lake's edge in the world's
const BOATHOUSE = { model: [-86, 189], world: [-60, 36] };
export const HERO = { scale: S, turn: 0, at: [BOATHOUSE.world[0] - BOATHOUSE.model[0] * S, -WATER * S, BOATHOUSE.world[1] - BOATHOUSE.model[1] * S] };

const c = Math.cos(HERO.turn);
const s = Math.sin(HERO.turn);
export const toWorld = ([x, y, z]) => [HERO.at[0] + S * (x * c + z * s), HERO.at[1] + S * y, HERO.at[2] + S * (-x * s + z * c)];
export function toModel(x, z) {
  const dx = (x - HERO.at[0]) / S;
  const dz = (z - HERO.at[2]) / S;
  return [dx * c - dz * s, dx * s + dz * c];
}

// (each read off the cut's plan and elevation, and the tallest points in it)
export const ANCHORS = {
  boathouse: [...BOATHOUSE.model.slice(0, 1), 2, BOATHOUSE.model[1]],
  boathouseDoor: [-86, 2, 182],
  stairFoot: [-83, 4, 181],
  stairTop: [-96, 46, 82],
  greatHall: [-118, 50, 28],
  // (the gatehouse where the stair and the viaduct come in, its doors north into the Entrance Hall)
  greatDoors: [-80, 50, 58],
  staircase: [15, 50, 20],
  courtyard: [36, 50, 30],
  courtyardDoor: [28, 50, 35],
  clockTower: [68, 50, 70],
  astronomy: [-80, 50, 39],
  viaductFrom: [-67, 46, 74],
  viaductTo: [2, 46, 146],
  bridgeFrom: [-60, 76, -80],
  bridgeTo: [-60, 76, -145],
  owlery: [11, 96, -153],
  greenhouses: [66, 50, 72],
};
export const at = (name) => toWorld(ANCHORS[name]);

// The ground as the grid it was read off (CELL metres of the model's), each
// cell its level, and past the castle's edge a chamfer distance outward
// (two passes, the eight neighbours) carrying the nearest cell's level with
// it, out to REACH: the terrain asks hundreds of thousands of times as it
// builds, so a read is a lookup, not a search.
const REACH = 140; // m of the world's past the castle's ground that a point still feels it
const PAD = Math.ceil(REACH / S / CELL) + 2;
const G = (() => {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [a, b, c, d] of GROUND) {
    x0 = Math.min(x0, a);
    z0 = Math.min(z0, b);
    x1 = Math.max(x1, c);
    z1 = Math.max(z1, d);
  }
  const ox = x0 - PAD * CELL;
  const oz = z0 - PAD * CELL;
  const nx = Math.round((x1 - x0) / CELL) + PAD * 2;
  const nz = Math.round((z1 - z0) / CELL) + PAD * 2;
  const dist = new Float32Array(nx * nz).fill(Infinity);
  const level = new Float32Array(nx * nz);
  for (const [a, b, c, d, y] of GROUND)
    for (let j = Math.round((b - oz) / CELL); j < Math.round((d - oz) / CELL); j++)
      for (let i = Math.round((a - ox) / CELL); i < Math.round((c - ox) / CELL); i++) {
        dist[j * nx + i] = 0;
        level[j * nx + i] = Math.max(level[j * nx + i], y);
      }
  const D = Math.SQRT2;
  const pass = (from, to, step, nbrs) => {
    for (let j = from[1]; j !== to[1]; j += step)
      for (let i = from[0]; i !== to[0]; i += step) {
        const k = j * nx + i;
        for (const [di, dj, w] of nbrs) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
          const o = b * nx + a;
          if (dist[o] + w < dist[k]) {
            dist[k] = dist[o] + w;
            level[k] = level[o];
          }
        }
      }
  };
  pass([0, 0], [nx, nz], 1, [[-1, 0, 1], [0, -1, 1], [-1, -1, D], [1, -1, D]]);
  pass([nx - 1, nz - 1], [-1, -1], -1, [[1, 0, 1], [0, 1, 1], [1, 1, D], [-1, 1, D]]);
  return { ox, oz, nx, nz, dist, level };
})();

// a cell's distance in the world's metres, outward from the castle's edge
const distOf = (i, j) => (i < 0 || j < 0 || i >= G.nx || j >= G.nz ? Infinity : G.dist[j * G.nx + i] * CELL * S);

export function groundAt(x, z, reach = REACH) {
  const [mx, mz] = toModel(x, z);
  const fx = (mx - G.ox) / CELL;
  const fz = (mz - G.oz) / CELL;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) return null;
  const k = j * G.nx + i;
  const y = (G.level[k] - WATER) * S;
  if (G.dist[k] === 0) return { y, d: 0 };
  // (between cell middles, so a cliff falls smoothly and not in steps)
  const u = fx - i - 0.5;
  const v = fz - j - 0.5;
  const a = u < 0 ? -1 : 1;
  const b = v < 0 ? -1 : 1;
  const tu = Math.abs(u);
  const tv = Math.abs(v);
  const d00 = distOf(i, j);
  const d10 = distOf(i + a, j);
  const d01 = distOf(i, j + b);
  const d11 = distOf(i + a, j + b);
  const near = Math.min(d10, d01, d11) === Infinity ? d00 : null;
  const d = near ?? (d00 * (1 - tu) + Math.min(d10, d00 + CELL * S) * tu) * (1 - tv) + (Math.min(d01, d00 + CELL * S) * (1 - tu) + Math.min(d11, d00 + CELL * S) * tu) * tv;
  // (a cell's edge, not its middle, is where the castle ends: half a cell in)
  const out = Math.max(1e-3, d - (CELL * S) / 2);
  return out <= reach ? { y, d: out } : null;
}
export const inside = (x, z) => groundAt(x, z, 0)?.d === 0;

// the castle's ground in the world as boxes (unturned, a rectangle in the
// model's frame is one in the world's)
const boxOf = ([a, b, c, d]) => {
  const [x0, , z0] = toWorld([a, 0, b]);
  const [x1, , z1] = toWorld([c, 0, d]);
  return { at: [(x0 + x1) / 2, (z0 + z1) / 2], w: Math.abs(x1 - x0), d: Math.abs(z1 - z0) };
};
export const SOLIDS = GROUND.filter((r) => r[5]).map(boxOf);
export const OUTLINE = GROUND.map(boxOf);
