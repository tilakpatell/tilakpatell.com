// What grows beside the road: a stage’s table (stages/tables.js) placed on
// its land by a pure rule, then drawn through the nature kits’ instanced
// pools (kitNodes), one pool a model for every built stage, each stage’s
// items under its own key. A row is the MegaKit’s (`naturemega`) unless it
// names another kit (`pack: 'nature'`: the older Stylized Nature Pack’s
// maples, birches and dead trees).
//
//   placements(rows, land, road, rng, { tier, reach }) → [{ model, x, y, z, yaw, scale, tint, pack? }]
//     (pure: density per 100 m², in clumps, never within CLEAR of the road,
//     off steep ground and out of the water, `reach` metres either side of
//     the road at most; low halves the counts and drops the grass, mid thins it;
//     a row with `z: [z0, z1]` or `x: [x0, x1]` keeps to that band of the stage;
//     nothing inside the land’s `clear` circles, [{ at: [x, z], r }]: a town, a garden;
//     a row with `at: [[x, z, scale], …]` stands at those places alone, its scale × the row's first;
//     a row with `verge: [near, far]` lines the road, near to far metres off its middle: see verge)
//   rowsFor(id) → the stage’s rows
//   rngOf(seed) → () → 0…1, the same for the same seed
//   createScatter({ kitFor, tier }) → { group, set(key, items, dz), free(key), update(camera, dt), stats, dispose }
//     kitFor(tint, pack) → that kit in that tint (null: its own colours; no pack: the MegaKit)
//     (lib/three/kitScatter's, which a galaxy world's streamed ground draws through too)

import { distanceTo } from '../../../lib/land/paths.js';
import { createKitScatter } from '../../../lib/three/kitScatter';
import { SCATTER } from './stages/tables';

export { CASTS } from '../../../lib/three/kitScatter';
export const createScatter = ({ kitFor, tier = 'high' } = {}) => createKitScatter({ kitFor, tier, name: 'road:scatter' });

export const CLEAR = 6; // m: nothing grows nearer the road’s middle than this
const SLOPE = 0.6; // the steepest ground a row stands on by default (rise over run)
const REACH = 300; // m either side of the road a stage is planted to

export const rowsFor = (id) => SCATTER[id] ?? [];

// mulberry32
export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const share = (row, tier) => {
  if (row.kind === 'grass') return tier === 'low' ? 0 : tier === 'mid' ? 0.5 : 1;
  return tier === 'low' ? 0.5 : 1;
};

// A verge's row, `verge: [near, far]`: its clumps down the road's length,
// either side, near to far metres off its middle, as many to its strip's
// area as `per100` says; the low things that line a lane (flowers, tufts,
// pebbles), nearer the road than CLEAR, never nearer than VERGE.
export const VERGE = 1.1; // m: the nearest a verge's row grows to the road's middle
function verge(row, land, road, rng, tier, out) {
  const field = land.field ?? land.heightAt;
  const [near, far] = [Math.max(VERGE, row.verge[0]), row.verge[1]];
  const off = distanceTo(road, far + 1);
  const count = Math.round((row.per100 * road.length * 2 * (far - near) * share(row, tier)) / 100);
  const clump = Math.max(1, row.clump ?? 1);
  const spread = row.spread ?? 1;
  const [s0, s1] = row.scale ?? [1, 1];
  const [z0, z1] = row.z ?? [-Infinity, Infinity];
  for (let n = 0; n < count; n += clump) {
    const p = road.pointAt(rng() * road.length);
    const [tx, , tz] = p.tangent;
    const l = Math.hypot(tx, tz) || 1;
    const side = rng() < 0.5 ? -1 : 1;
    const d = near + rng() * (far - near);
    const cx = p.x + (tz / l) * side * d;
    const cz = p.z - (tx / l) * side * d;
    for (let k = 0; k < clump && n + k < count; k++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * spread;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const yaw = rng() * Math.PI * 2;
      const scale = s0 + rng() * (s1 - s0);
      const o = off(x, z);
      if (o < near || o > far || z < z0 || z > z1) continue;
      if (land.wet?.(x, z)) continue;
      if (land.clear?.some((c) => Math.hypot(x - c.at[0], z - c.at[1]) < c.r)) continue;
      out.push({ model: row.model, x, y: field(x, z), z, yaw, scale, tint: row.tint ?? null, ...(row.pack ? { pack: row.pack } : {}) });
    }
  }
}

export function placements(rows, land, road, rng, { tier = 'high', reach = REACH } = {}) {
  const off = distanceTo(road, CLEAR);
  const field = land.field ?? land.heightAt;
  const x0 = Math.max(land.x0, -reach);
  const x1 = Math.min(land.x0 + land.w, reach);
  const z0 = land.z0;
  const z1 = land.z0 + land.d;
  const out = [];
  for (const row of rows) {
    // (a row at its own places, `at: [[x, z, scale], …]`: the stage's own trees, where its builder put them)
    if (row.at) {
      for (const [x, z, s = 1] of row.at) out.push({ model: row.model, x, y: field(x, z), z, yaw: rng() * Math.PI * 2, scale: s * (row.scale?.[0] ?? 1), tint: row.tint ?? null, ...(row.pack ? { pack: row.pack } : {}) });
      continue;
    }
    if (row.verge) {
      verge(row, land, road, rng, tier, out);
      continue;
    }
    // (a row’s own band, inside the stage’s: a field of corn, a wood)
    const bx0 = Math.max(x0, row.x?.[0] ?? x0);
    const bx1 = Math.min(x1, row.x?.[1] ?? x1);
    const bz0 = Math.max(z0, row.z?.[0] ?? z0);
    const bz1 = Math.min(z1, row.z?.[1] ?? z1);
    if (bx1 <= bx0 || bz1 <= bz0) continue;
    const area = (bx1 - bx0) * (bz1 - bz0);
    const count = Math.round((row.per100 * area * share(row, tier)) / 100);
    const clump = Math.max(1, row.clump ?? 1);
    const spread = row.spread ?? 4;
    const cap = row.slope ?? SLOPE;
    const [s0, s1] = row.scale ?? [1, 1];
    for (let n = 0; n < count; n += clump) {
      const cx = bx0 + rng() * (bx1 - bx0);
      const cz = bz0 + rng() * (bz1 - bz0);
      for (let k = 0; k < clump && n + k < count; k++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * spread;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        const yaw = rng() * Math.PI * 2;
        const scale = s0 + rng() * (s1 - s0);
        if (x < bx0 || x > bx1 || z < bz0 || z > bz1) continue;
        if (off(x, z) < CLEAR) continue;
        if (land.wet?.(x, z)) continue;
        if (land.clear?.some((c) => Math.hypot(x - c.at[0], z - c.at[1]) < c.r)) continue;
        const sx = (field(x + 1, z) - field(x - 1, z)) / 2;
        const sz = (field(x, z + 1) - field(x, z - 1)) / 2;
        if (Math.hypot(sx, sz) > cap) continue;
        out.push({ model: row.model, x, y: field(x, z), z, yaw, scale, tint: row.tint ?? null, ...(row.pack ? { pack: row.pack } : {}) });
      }
    }
  }
  return out;
}
