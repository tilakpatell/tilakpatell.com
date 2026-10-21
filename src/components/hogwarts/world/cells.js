// The grounds streamed in CELL-metre cells (the Road’s lands.js shape, a
// cell where it has a stage): the cell you stand in and the two nearest it
// to where you stand get the ground’s fine mesh (ground.js’s cellJob), the
// far ground sinking out of their way; every cell within REACH gets what
// grows on it handed to the scatter’s pools (scatter.js’s placements,
// worked out once a cell and kept); the rest are given back. A cell is
// built a slice a frame, a few milliseconds at a time, the one you stand in
// first; a cell you are carried into before it is ready is built at once.
//
//   createCells({ land, tier, scatter, material, far, exact, budget }) → {
//     group,                     the near cells’ meshes
//     at(x, z),                  where you are: which cells, which items
//     step(),                    a frame’s slice of the building
//     wanted, built,             the near cells asked for and the ones standing (keys 'i:j')
//     stats: [{ key, ms, slices }], dispose() }
//   COUNT (cells a side), NEAR_CELLS (built at a time), REACH (m)
//   nearest(x, z) → the cells to build round a point, nearest first (pure)

import * as THREE from 'three';
import { CELL, cellJob, cellRect } from './ground';
import { HALF } from './terrain';
import { placementsFor } from './scatter';

export const COUNT = Math.round((2 * HALF) / CELL);
export const NEAR_CELLS = 3;
export const REACH = { low: 260, mid: 320, high: 380, ultra: 460 };

const key = (i, j) => `${i}:${j}`;
const clampCell = (v) => Math.min(COUNT - 1, Math.max(0, v));

// how far a point is from a cell (0 inside it)
function toCell(x, z, i, j) {
  const [x0, z0, x1, z1] = cellRect(i, j);
  const dx = Math.max(x0 - x, 0, x - x1);
  const dz = Math.max(z0 - z, 0, z - z1);
  return Math.hypot(dx, dz);
}

export function nearest(x, z, n = NEAR_CELLS) {
  const ci = clampCell(Math.floor((x + HALF) / CELL));
  const cj = clampCell(Math.floor((z + HALF) / CELL));
  const out = [];
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (i < 0 || j < 0 || i >= COUNT || j >= COUNT) continue;
      out.push({ i, j, d: toCell(x, z, i, j) });
    }
  out.sort((a, b) => a.d - b.d || Math.abs(a.i - ci) + Math.abs(a.j - cj) - (Math.abs(b.i - ci) + Math.abs(b.j - cj)));
  return out.slice(0, n).map(({ i, j }) => ({ i, j }));
}

export function createCells({ land, tier = 'high', scatter = null, material, far = null, exact = null, budget = 5 } = {}) {
  const group = new THREE.Group();
  group.name = 'hogwarts:cells';
  const built = new Map(); // key → { mesh }
  const jobs = new Map(); // key → { job, i, j }
  const items = new Map(); // key → placements (kept: pure, the same every time)
  const placed = new Set(); // keys whose items are in the scatter
  const stats = [];
  const clocks = new Map();
  let wanted = [];
  const reach = REACH[tier] ?? REACH.high;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const sinkRects = () => far?.near?.([...built.keys()].map((k) => cellRect(...k.split(':').map(Number))));
  const finish = (k, geometry) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `cell:${k}`;
    mesh.receiveShadow = tier !== 'low';
    group.add(mesh);
    built.set(k, { mesh });
    jobs.delete(k);
    const c = clocks.get(k) ?? { ms: 0, slices: 0 };
    stats.push({ key: k, ms: Math.round(c.ms), slices: c.slices });
    clocks.delete(k);
    sinkRects();
  };
  const drop = (k) => {
    const b = built.get(k);
    if (b) {
      group.remove(b.mesh);
      b.mesh.geometry.dispose();
      built.delete(k);
    }
    jobs.get(k)?.job.return();
    jobs.delete(k);
    sinkRects();
  };
  const runSlice = (k, until) => {
    const j = jobs.get(k);
    const t0 = now();
    let r;
    do r = j.job.next();
    while (!r.done && now() < until);
    const c = clocks.get(k) ?? { ms: 0, slices: 0 };
    clocks.set(k, { ms: c.ms + now() - t0, slices: c.slices + 1 });
    if (r.done) finish(k, r.value);
  };

  return {
    group,
    get wanted() {
      return wanted.map(({ i, j }) => key(i, j));
    },
    get built() {
      return [...built.keys()];
    },
    stats,
    at(x, z) {
      wanted = nearest(x, z);
      const want = new Set(wanted.map(({ i, j }) => key(i, j)));
      for (const k of [...built.keys(), ...jobs.keys()]) if (!want.has(k)) drop(k);
      for (const { i, j } of wanted) {
        const k = key(i, j);
        if (!built.has(k) && !jobs.has(k)) jobs.set(k, { job: cellJob(land, i, j, { tier, exact }), i, j });
      }
      // (the cell you stand in, if it isn’t there yet, at once: you would see through the sunk far ground)
      const here = key(wanted[0].i, wanted[0].j);
      if (jobs.has(here)) runSlice(here, Infinity);
      // what grows: every cell within reach in the scatter, the rest given back
      if (scatter) {
        for (let j = 0; j < COUNT; j++)
          for (let i = 0; i < COUNT; i++) {
            const k = key(i, j);
            const near = toCell(x, z, i, j) < reach;
            if (near && !placed.has(k)) {
              if (!items.has(k)) items.set(k, placementsFor(land, i, j, { tier }));
              scatter.set(`cell:${k}`, items.get(k));
              placed.add(k);
            } else if (!near && placed.has(k)) {
              scatter.free(`cell:${k}`);
              placed.delete(k);
            }
          }
      }
    },
    step() {
      const until = now() + budget;
      for (const { i, j } of wanted) {
        const k = key(i, j);
        if (!jobs.has(k)) continue;
        runSlice(k, until);
        if (now() >= until) return;
      }
    },
    // (every cell’s items worked out ahead, for the check: the same as as you walk)
    itemsOf: (i, j) => items.get(key(i, j)) ?? placementsFor(land, i, j, { tier }),
    dispose() {
      for (const k of [...built.keys(), ...jobs.keys()]) drop(k);
      for (const k of placed) scatter?.free(`cell:${k}`);
      placed.clear();
    },
  };
}
