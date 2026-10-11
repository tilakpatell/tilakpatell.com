// What a level's stream fetches first (the GPU-first design's lane N4): the
// boot slice round the visitor, then everything else by how big it is on
// screen and whether it lies ahead, and a little more ahead before it is
// needed. Pure: the stream (galaxy/surface/level/levelStream.js) ranks its
// queue with these.
//
//   priorityOf({ x, z, r }, { position, heading }) → projected size × the heading's weight
//   headingOf(from, to) → a unit [x, z], or null for no move
//   bootCells(pack, [x, z]) → your cell and its eight neighbours, yours first
//   prefetchAhead(pack, { position, heading, tier, n }) → the n cells beyond the mid ring ahead
//   coarseReach(tier) → how many rings of 512 m cells the tier fetches
//   coarseHidden(meshes, { loaded, drawn }) → whether the fine path stands in for a coarse cell

import { budget } from '../budgets.js';
import { bandsFor } from './bands.js';
import { CELL, cellKey, cellOf } from './instances.js';

// How much the heading weighs: a thing straight ahead counts 1.5 times its
// size, straight behind half. _source: the design's §4 N4 ("projected screen
// size × distance-along-heading"); Needle's gltf-progressive and Spark load
// by screen coverage alone (the research note's streaming section), and half
// again either way keeps a big thing behind you before a speck ahead.
export const HEADING = 0.5;

export function priorityOf({ x, z, r }, { position, heading = null }) {
  const dx = x - position[0];
  const dz = z - position[1];
  const d = Math.hypot(dx, dz);
  const size = r / Math.max(d, r);
  if (!heading || d <= r) return size;
  return size * (1 + HEADING * ((dx * heading[0] + dz * heading[1]) / d));
}

export function headingOf(from, to) {
  if (!from || !to) return null;
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const l = Math.hypot(dx, dz);
  return l > 1e-6 ? [dx / l, dz / l] : null;
}

// _source: the design's §4 N4, "the player's cell and its eight neighbours"
export function bootCells(pack, [x, z]) {
  const cell = pack.cell ?? CELL;
  const [cx, cz] = cellOf(x, z, cell);
  const out = [];
  for (const [dx, dz] of [
    [0, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ]) {
    const key = cellKey(cx + dx, cz + dz);
    if (pack.cells?.[key]) out.push(key);
  }
  return out;
}

// _source: the design's §4 N4, "a cell two ahead on the heading is prefetched"
export function prefetchAhead(pack, { position, heading, tier = 'high', n = 2 }) {
  if (!heading) return [];
  const cell = pack.cell ?? CELL;
  const ring = bandsFor(budget(tier), cell).midRing;
  const [cx, cz] = cellOf(position[0], position[1], cell);
  const out = [];
  for (let k = ring + 1; k <= ring + n; k++) {
    const key = cellKey(cx + Math.round(heading[0] * k), cz + Math.round(heading[1] * k));
    if (pack.cells?.[key] && !out.includes(key)) out.push(key);
  }
  return out;
}

// _source: the budget rows' horizon reach (bands.js: the small tiers draw
// half the backdrop): low a ring of 512 m cells (1.5 km across), mid two,
// high and ultra the whole grid
export const coarseReach = (tier) => (tier === 'low' ? 1 : tier === 'mid' ? 2 : Infinity);

export function coarseHidden(meshes, { loaded, drawn }) {
  if (!meshes?.length) return false;
  return meshes.every((m) => !drawn(m) || loaded(m));
}
