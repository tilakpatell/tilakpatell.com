// A whole level's navgrid at pack time (lane G2; the game design's decision
// 7): lane 1's buildNav (src/lib/battlefront/nav.js) over the pack's ground
// and its pieces' collision, written as nav.bin beside level.json, so the
// game world reads the grid in place of building it from the drawn ground
// with no solids. Pure: scripts/bf2017-level.mjs --whole reads the cells and
// the shapes and writes the file.
//
// The solids are each placed piece's game shapes (lane P0's hulls,
// src/lib/level/shapeSolids.js), else its bounds (lane L's colliderOf),
// standing boxes only: a floor plate or a stair's tread is ground to walk
// on, not a wall. A level with no terrain (Kamino_01, DeathStar02_01)
// stands on its floors: the ground is the highest floor over a cell, and a
// cell with none is a drop no one walks into.
//
//   levelSolids(pack, cells, shapes) → { boxes, floors } (cells: Map key → the cell's bin; shapes: { mesh: shapes | null })
//   floorHeight(floors, { cell, below }) → heightAt(x, z)
//   navOf({ heightAt, bounds, boxes, cover, cell }) → nav (buildNav's), its solids those within the bounds, under BIG_SOLID and reaching the ground
//   navBounds(rows, extent) → { min: [x, z], max: [x, z] }: the gameplay records' bounds where they have them

import { buildNav } from '../../src/lib/battlefront/nav.js';
import { solidsOf } from '../../src/lib/level/collision.js';
import { shapeSolids } from '../../src/lib/level/shapeSolids.js';

export const NAV_CELL = 2; // m: the game world's grid (battle.js's NAV_CELL)
// m: a box half this wide is a building's shell or a cliff's hull taken
// whole (Echo Base's hangar, 100 m), not a wall: it would wall in the
// spawns inside it, so the grid leaves it out (as colliderOf's BIG does)
export const BIG_SOLID = 30;
const BELOW = -1000; // m: no floor here

export function levelSolids(pack, cells, shapes = {}) {
  const boxes = [];
  const floors = [];
  for (const [key, bin] of cells) {
    const c = pack.cells[key];
    if (!c) continue;
    const got = shapeSolids(c.draws, bin, shapes);
    const rest = solidsOf(pack, got.without, bin);
    boxes.push(...got.boxes, ...rest.boxes, ...got.circles.map((s) => ({ x: s.x, z: s.z, hw: s.r, hd: s.r, yaw: 0, top: s.top, base: s.base })));
    floors.push(...got.floors, ...rest.floors);
  }
  return { boxes, floors };
}

// the highest floor over (x, z), on a grid of `cell` metres the floors are laid into once
export function floorHeight(floors, { cell = NAV_CELL, below = BELOW } = {}) {
  const grid = new Map();
  for (const f of floors) {
    const c = Math.cos(f.yaw ?? 0);
    const s = Math.sin(f.yaw ?? 0);
    const ex = Math.abs(f.hw * c) + Math.abs(f.hd * s);
    const ez = Math.abs(f.hw * s) + Math.abs(f.hd * c);
    for (let gx = Math.floor((f.x - ex) / cell); gx <= Math.floor((f.x + ex) / cell); gx++)
      for (let gz = Math.floor((f.z - ez) / cell); gz <= Math.floor((f.z + ez) / cell); gz++) {
        // (the cell's middle inside the plate, as three turns a thing about y)
        const dx = (gx + 0.5) * cell - f.x;
        const dz = (gz + 0.5) * cell - f.z;
        if (Math.abs(dx * c - dz * s) > f.hw + cell / 2 || Math.abs(dx * s + dz * c) > f.hd + cell / 2) continue;
        const k = `${gx},${gz}`;
        grid.set(k, Math.max(grid.get(k) ?? below, f.y));
      }
  }
  return (x, z) => grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? below;
}

export function navOf({ heightAt, bounds, boxes, cover = {}, cell = NAV_CELL }) {
  const inside = (b) => b.x + b.hw >= bounds.min[0] && b.x - b.hw <= bounds.max[0] && b.z + b.hd >= bounds.min[1] && b.z - b.hd <= bounds.max[1];
  // (and one wholly under the ground, Echo Base's halls under the glacier, walls in nothing up there)
  const above = (b) => b.top >= heightAt(b.x, b.z) - 0.5;
  const solids = boxes.filter((b) => inside(b) && Math.max(b.hw, b.hd) <= BIG_SOLID && above(b)).map((b) => ({ at: [b.x, (b.top + b.base) / 2, b.z], half: [b.hw, (b.top - b.base) / 2, b.hd], yaw: b.yaw ?? 0 }));
  return buildNav({ heightAt, bounds, cell, solids, cover });
}

export function navBounds(rows, extent) {
  const b = rows?.bounds;
  if (b?.min && b?.max) return { min: [b.min[0], b.min[1]], max: [b.max[0], b.max[1]] };
  return { min: extent.min.slice(), max: extent.max.slice() };
}
